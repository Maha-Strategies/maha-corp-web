import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { runMarkerFor } from '../lib/batch-11-evidence-binding.ts'
import {
  REVOCABLE_CREDENTIALS,
  assertRevocationInputSanitized,
  produceRevocationEvidence,
  type CheckScope,
  type CheckStatus,
  type RevocableCredential,
  type RevocationCheck,
} from '../lib/batch-11-revocation-evidence.ts'

/**
 * Asks each provider whether a temporary credential still resolves.
 *
 * Revocation is the fact that outlives the run. A branch can be destroyed while
 * the token that created it stays valid, and nothing in the rehearsal's own
 * evidence would reveal that - which is why this is a separate collection,
 * performed after teardown, by whoever holds the credentials.
 *
 * Every check is wrapped so a thrown error, an unreadable response or an
 * unsupplied credential becomes `failed` or `not-attempted`, never a claim of
 * revocation. The asymmetry is the same one teardown uses: a provider saying
 * "this no longer resolves" is evidence; silence is not.
 *
 * Credentials are read from the environment, travel only in request headers,
 * and are recorded only as fingerprints. Nothing here writes, revokes or
 * deletes anything - it observes what revocation already happened.
 *
 * Usage:
 *   MAHA_B11_RUN_ID=<numeric run id> \
 *   MAHA_B11_REVIEWED_COMMIT=<40-char sha> \
 *   [SUPABASE_ACCESS_TOKEN=...] [VERCEL_TOKEN=...] [GITHUB_TOKEN=...] \
 *   node --experimental-strip-types scripts/collect-batch-11-revocation-evidence.ts --out <path>
 *
 * Supply the credential you are testing for revocation. Its absence yields
 * `not-attempted`, which does not close.
 */

const flag = (name: string, fallback: string | null = null): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const runId = process.env.MAHA_B11_RUN_ID?.trim() ?? ''
const reviewedCommit = process.env.MAHA_B11_REVIEWED_COMMIT?.trim() ?? ''
const outPath = flag('out', 'batch-11-teardown/revocation.json')!

if (!/^[0-9]{1,20}$/.test(runId)) {
  console.error('MAHA_B11_RUN_ID must be the numeric workflow run id.')
  process.exit(2)
}
if (!/^[0-9a-f]{40}$/.test(reviewedCommit)) {
  console.error('MAHA_B11_REVIEWED_COMMIT must be a 40-character lowercase SHA.')
  process.exit(2)
}
const runMarker = runMarkerFor(runId)

const fingerprint = (value: string) => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`

/** The five temporary secrets a rehearsal binds. Names only, never values. */
const TEMPORARY_SECRET_NAMES = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_ACCESS_TOKEN_SHA256',
  'EPISTEMIC_OPERATIONS_TOKEN',
  'EPISTEMIC_RELEASE_AUTHORITY_TOKEN',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
]

interface Outcome {
  status: CheckStatus
  scope: CheckScope
  stillResolves: boolean
  detail: string
}

/**
 * Runs one revocation probe.
 *
 * `stillResolves` is only ever set from a definite provider answer. Anything
 * ambiguous resolves to a non-succeeded status instead, so an unreadable
 * response cannot be mistaken for revocation.
 */
async function probe(
  describe: string,
  scope: CheckScope,
  run: () => Promise<Outcome>,
): Promise<Outcome> {
  try {
    return await run()
  } catch (error) {
    return { status: 'failed', scope, stillResolves: false, detail: `${describe} raised ${(error as Error).name}.` }
  }
}

const notAttempted = (detail: string): Outcome =>
  ({ status: 'not-attempted', scope: 'unknown', stillResolves: false, detail })

const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ''
const vercelToken = process.env.VERCEL_TOKEN?.trim() ?? ''
const githubToken = process.env.GITHUB_TOKEN?.trim() ?? ''
const repository = process.env.GITHUB_REPOSITORY?.trim() ?? 'Maha-Strategies/maha-corp-web'
const environment = 'batch-11-preview-rehearsal'

const outcomes: Record<RevocableCredential, Outcome> = {
  // A revoked personal access token stops authenticating. 401 is the provider
  // stating that; any other answer is not revocation.
  'supabase-access-token': supabaseToken
    ? await probe('The Supabase token probe', 'exact-credential-fingerprint', async () => {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        headers: { authorization: `Bearer ${supabaseToken}` }, cache: 'no-store',
      })
      if (response.status === 401 || response.status === 403) {
        return { status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: false,
          detail: `Supabase rejected the token with ${response.status}; it no longer authenticates.` }
      }
      if (response.ok) {
        return { status: 'succeeded', scope: 'exact-credential-fingerprint', stillResolves: true,
          detail: 'Supabase still accepts the token; it has not been revoked.' }
      }
      return { status: 'failed', scope: 'exact-credential-fingerprint', stillResolves: false,
        detail: `Supabase answered ${response.status}, which neither confirms nor denies revocation.` }
    })
    : notAttempted('The Supabase token was not supplied, so its revocation cannot be confirmed.'),

  // The bypass secret lives on the project's protection settings. Its absence
  // there is the provider stating it is gone.
  'vercel-automation-bypass': vercelToken && process.env.VERCEL_PROJECT_ID
    ? await probe('The Vercel protection-bypass probe', 'exact-environment', async () => {
      const projectId = process.env.VERCEL_PROJECT_ID
      const team = process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ''
      const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}${team}`, {
        headers: { authorization: `Bearer ${vercelToken}` }, cache: 'no-store',
      })
      if (!response.ok) {
        return { status: 'failed', scope: 'exact-environment', stillResolves: false,
          detail: `Vercel answered ${response.status}; the protection settings could not be read.` }
      }
      const body = await response.json() as Record<string, unknown>
      const protection = body.protectionBypass
      // An empty or absent bypass map means no automation bypass is configured.
      const active = protection !== null && protection !== undefined
        && typeof protection === 'object' && Object.keys(protection).length > 0
      return { status: 'succeeded', scope: 'exact-environment', stillResolves: active,
        detail: active
          ? 'The project still carries an automation-bypass entry.'
          : 'The project carries no automation-bypass entry.' }
    })
    : notAttempted('VERCEL_TOKEN and VERCEL_PROJECT_ID were not both supplied, so bypass revocation cannot be confirmed.'),

  // Deleted environment secrets stop being listed. Names only are read.
  'github-environment-secrets': githubToken
    ? await probe('The protected-environment secret listing', 'exact-environment', async () => {
      const response = await fetch(`https://api.github.com/repos/${repository}/environments/${environment}/secrets`, {
        headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json' }, cache: 'no-store',
      })
      if (!response.ok) {
        return { status: 'failed', scope: 'exact-environment', stillResolves: false,
          detail: `GitHub answered ${response.status}; the environment secrets could not be listed.` }
      }
      const body = await response.json() as { secrets?: { name: string }[] }
      const present = (body.secrets ?? []).map((entry) => entry.name)
      const surviving = TEMPORARY_SECRET_NAMES.filter((name) => present.includes(name))
      return { status: 'succeeded', scope: 'exact-environment', stillResolves: surviving.length > 0,
        detail: surviving.length > 0
          ? `${surviving.length} temporary secret name(s) are still bound to ${environment}.`
          : `No temporary secret name remains bound to ${environment}.` }
    })
    : notAttempted('No GitHub credential was supplied, so secret deletion cannot be confirmed.'),
}

const checks: RevocationCheck[] = REVOCABLE_CREDENTIALS.map((credential) => {
  const outcome = outcomes[credential]
  return {
    provider: credential.split('-')[0],
    credential,
    checkStatus: outcome.status,
    scope: outcome.scope,
    runMarker,
    reviewedCommit,
    // Identity of the credential slot, not of any value.
    credentialFingerprint: fingerprint(`${runMarker}:${credential}`),
    stillResolves: outcome.stillResolves,
    selfReportedOnly: false,
    detail: outcome.detail,
  }
})

const report = produceRevocationEvidence({ runMarker, reviewedCommit, checks })
const payload = { ...report, workflowRunId: runId, checks }

assertRevocationInputSanitized(payload)

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)

process.stdout.write(`${JSON.stringify({
  runMarker,
  allConfirmedRevoked: report.allConfirmedRevoked,
  states: report.observations.map((entry) => ({ credential: entry.credential, observedState: entry.observedState, refusal: entry.refusal })),
}, null, 2)}\n`)

// A green exit must not be readable as confirmed revocation.
if (!report.allConfirmedRevoked) process.exit(1)
