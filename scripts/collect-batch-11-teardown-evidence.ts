import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { runMarkerFor } from '../lib/batch-11-evidence-binding.ts'
import {
  TEARDOWN_RESOURCE_KINDS,
  assertSanitized,
  produceTeardownObservations,
  type ProviderQueryResult,
  type QueryScope,
  type QueryStatus,
} from '../lib/batch-11-teardown-observations.ts'

/**
 * Runs the authoritative post-cleanup checks and writes a sanitized report.
 *
 * This is the operator's half of teardown verification. The producer is
 * deliberately inert and takes normalized results; something has to actually
 * ask the providers, and this is it.
 *
 * Every query is wrapped so that failure becomes `failed`, never an empty
 * result. That distinction is the whole point: an errored request and a
 * successful search of an empty account both return nothing, and only one of
 * them is evidence of absence.
 *
 * Nothing identifying leaves here. Resource identifiers are hashed before they
 * are recorded, and the report is scanned for credential-shaped text before it
 * is written.
 *
 * Usage:
 *   MAHA_B11_RUN_ID=<numeric run id> \
 *   MAHA_B11_REVIEWED_COMMIT=<40-char sha> \
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... VERCEL_TOKEN=... GITHUB_TOKEN=... \
 *   node --experimental-strip-types scripts/collect-batch-11-teardown-evidence.ts --out <path>
 *
 * Credentials are read from the environment and travel only in request
 * headers. None is written, logged or passed as an argument.
 */

const flag = (name: string, fallback: string | null = null): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const runId = process.env.MAHA_B11_RUN_ID?.trim() ?? ''
const reviewedCommit = process.env.MAHA_B11_REVIEWED_COMMIT?.trim() ?? ''
const outPath = flag('out', 'batch-11-teardown/observations.json')!

if (!/^[0-9]{1,20}$/.test(runId)) {
  console.error('MAHA_B11_RUN_ID must be the numeric workflow run id.')
  process.exit(2)
}
if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) {
  console.error('MAHA_B11_REVIEWED_COMMIT must be a 40-character lowercase SHA.')
  process.exit(2)
}
const runMarker = runMarkerFor(runId)

/** Hashes an identifier so it can be counted without being disclosed. */
const fingerprint = (value: string) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`

interface Attempt {
  matches: { identifierFingerprint: string; status: string }[]
  status: QueryStatus
  scope: QueryScope
  detail: string
}

/**
 * Wraps one authoritative query.
 *
 * A thrown error, a non-OK response and an unparseable body all resolve to a
 * non-succeeded status rather than an empty match list, so a broken query can
 * never be read downstream as absence.
 */
async function attempt(
  describe: string,
  scope: QueryScope,
  run: () => Promise<{ ok: boolean; status: number; body: unknown }>,
  select: (body: unknown) => { identifierFingerprint: string; status: string }[],
): Promise<Attempt> {
  try {
    const response = await run()
    if (!response.ok) {
      return { matches: [], status: 'failed', scope, detail: `${describe} returned ${response.status}.` }
    }
    try {
      return { matches: select(response.body), status: 'succeeded', scope, detail: `${describe} succeeded at ${scope} scope.` }
    } catch {
      return { matches: [], status: 'malformed', scope, detail: `${describe} returned a body this collector could not interpret.` }
    }
  } catch (error) {
    return { matches: [], status: 'failed', scope, detail: `${describe} raised ${(error as Error).name}.` }
  }
}

async function json(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers, cache: 'no-store' })
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  return { ok: response.ok, status: response.status, body }
}

const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ''
const supabaseRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? ''
const vercelToken = process.env.VERCEL_TOKEN?.trim() ?? ''
const githubToken = process.env.GITHUB_TOKEN?.trim() ?? ''
const repository = process.env.GITHUB_REPOSITORY?.trim() ?? 'Maha-Strategies/maha-corp-web'
const environment = 'batch-11-preview-rehearsal'

const array = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  throw new Error('not an array')
}

/** Only resources this run named. A foreign resource proves nothing here. */
const named = (value: unknown, nameOf: (row: Record<string, unknown>) => string, statusOf: (row: Record<string, unknown>) => string) =>
  array(value)
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .filter((row) => nameOf(row).includes(runMarker))
    .map((row) => ({ identifierFingerprint: fingerprint(nameOf(row)), status: statusOf(row) }))

const attempts: Record<string, Attempt> = {
  'supabase-branch': supabaseToken && supabaseRef
    ? await attempt('The Supabase branch listing', 'exact-run-marker',
      () => json(`https://api.supabase.com/v1/projects/${supabaseRef}/branches`, { authorization: `Bearer ${supabaseToken}` }),
      (body) => named(body, (row) => String(row.name ?? ''), (row) => String(row.status ?? 'unknown')))
    : { matches: [], status: 'not-attempted', scope: 'unknown', detail: 'Supabase credentials were not supplied.' },

  'vercel-preview': vercelToken
    ? await attempt('The Vercel deployment listing', 'exact-run-marker',
      () => json('https://api.vercel.com/v6/deployments?limit=100', { authorization: `Bearer ${vercelToken}` }),
      (body) => named((body as Record<string, unknown>)?.deployments, (row) => String(row.name ?? row.meta ?? ''), (row) => String(row.state ?? 'unknown')))
    : { matches: [], status: 'not-attempted', scope: 'unknown', detail: 'The Vercel credential was not supplied.' },

  'github-environment-secret': githubToken
    ? await attempt('The protected-environment secret listing', 'exact-run-marker',
      () => json(`https://api.github.com/repos/${repository}/environments/${environment}/secrets`, {
        authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json',
      }),
      // Only names are read. A temporary binding for this run carries the run
      // marker in its name; the permanent bindings do not and are ignored.
      (body) => named((body as Record<string, unknown>)?.secrets, (row) => String(row.name ?? ''), () => 'bound'))
    : { matches: [], status: 'not-attempted', scope: 'unknown', detail: 'The GitHub credential was not supplied.' },

  // Preview release rows are read through the Preview deployment's own public
  // registry projection, which needs no credential.
  'database-release-rows': process.env.MAHA_B11_PREVIEW_ORIGIN
    ? await attempt('The Preview release registry', 'exact-run-marker',
      () => json(`${process.env.MAHA_B11_PREVIEW_ORIGIN}/knowledge/epistemic-system/releases/registry.json`, {}),
      (body) => named((body as Record<string, unknown>)?.releases, (row) => String(row.rehearsalRunMarker ?? ''), (row) => String(row.status ?? 'unknown')))
    : { matches: [], status: 'not-attempted', scope: 'unknown', detail: 'No Preview origin was supplied.' },
}

const results: ProviderQueryResult[] = TEARDOWN_RESOURCE_KINDS.map((kind) => {
  const outcome = attempts[kind]
  return {
    provider: kind.split('-')[0],
    resourceKind: kind,
    queryStatus: outcome.status,
    scope: outcome.scope,
    runMarker,
    reviewedCommit,
    matches: outcome.matches,
    detail: outcome.detail,
  }
})

const report = produceTeardownObservations({ runMarker, reviewedCommit, results })
const payload = { ...report, workflowRunId: runId, providerResults: results }

// Refuse to write anything credential-shaped, even accidentally.
assertSanitized(payload)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)

process.stdout.write(`${JSON.stringify({
  runMarker,
  allConfirmedAbsent: report.allConfirmedAbsent,
  states: report.observations.map((entry) => ({ resourceKind: entry.resourceKind, observedState: entry.observedState, refusal: entry.refusal })),
}, null, 2)}\n`)

// An operator must not read a green exit as confirmed teardown.
if (!report.allConfirmedAbsent) process.exit(1)
