import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import {
  TEARDOWN_HANDLE_KINDS,
  teardownHandleDigests,
  type ExactTeardownHandles,
  type TeardownHandleDigests,
} from '../lib/batch-11-evidence-binding.ts'
import {
  assertSanitized,
  produceTeardownObservations,
  type ProviderQueryResult,
  type QueryStatus,
} from '../lib/batch-11-teardown-observations.ts'

/**
 * Independently checks the exact resources named by a protected rehearsal.
 * Only explicit not-found responses for exact identifiers establish absence.
 */
const flag = (name: string, fallback: string | null = null): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const artifactPath = flag('artifact')
const handlesPath = flag('handles')
const outPath = flag('out', 'batch-11-teardown/observations.json')!
const skipGithub = process.argv.includes('--skip-github')
const allowPartial = process.argv.includes('--allow-partial')
if (!artifactPath || !handlesPath) {
  console.error('--artifact and --handles are required.')
  process.exit(2)
}

const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as Record<string, unknown>
const handles = JSON.parse(readFileSync(handlesPath, 'utf8')) as ExactTeardownHandles
const expected = artifact.teardownHandleDigests as TeardownHandleDigests | undefined
const recomputed = teardownHandleDigests(handles)
if (!expected || TEARDOWN_HANDLE_KINDS.some((kind) => expected[kind] !== recomputed[kind])) {
  console.error('Private teardown handles do not match the digests bound by the public rehearsal artifact.')
  process.exit(2)
}
if (artifact.workflowRunId !== handles.workflowRunId || artifact.runMarker !== handles.runMarker
  || artifact.reviewedCommit !== handles.reviewedCommit) {
  console.error('Private teardown handles do not belong to the supplied rehearsal artifact.')
  process.exit(2)
}
const artifactReleaseIds = Array.isArray(artifact.releaseIdentities)
  ? artifact.releaseIdentities.map((row) => String((row as Record<string, unknown>).releaseId ?? '')).sort()
  : []
if (artifactReleaseIds.join('\u0000') !== [...handles.databaseReleaseRows.releaseIds].sort().join('\u0000')) {
  console.error('Private teardown handles do not name exactly the releases in the supplied artifact.')
  process.exit(2)
}

interface ExactAttempt {
  status: QueryStatus
  matches: { identifierFingerprint: string; status: string }[]
  detail: string
}

async function exactGet(label: string, url: string, headers: Record<string, string>, fingerprint: string): Promise<ExactAttempt> {
  try {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (response.status === 404) {
      return { status: 'succeeded', matches: [], detail: `${label} returned not-found for the exact identifier.` }
    }
    if (!response.ok) {
      return { status: 'failed', matches: [], detail: `${label} returned ${response.status}; absence is not established.` }
    }
    return {
      status: 'succeeded',
      matches: [{ identifierFingerprint: fingerprint, status: 'present' }],
      detail: `${label} returned the exact resource; it remains present.`,
    }
  } catch (error) {
    return { status: 'failed', matches: [], detail: `${label} raised ${(error as Error).name}; absence is not established.` }
  }
}

const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? ''
const vercelToken = process.env.VERCEL_TOKEN?.trim() ?? ''
const githubToken = process.env.GITHUB_TOKEN?.trim() ?? ''
const repository = process.env.GITHUB_REPOSITORY?.trim() ?? 'Maha-Strategies/maha-corp-web'
const vercelTeam = process.env.VERCEL_TEAM_ID?.trim() ?? 'team_KTJouKHTcPGeMXNMDqh6CoYs'

const supabase: ExactAttempt = supabaseToken
  ? await exactGet('The exact Supabase branch query',
    `https://api.supabase.com/v1/branches/${encodeURIComponent(handles.supabaseBranch.branchId)}`,
    { authorization: `Bearer ${supabaseToken}` }, expected['supabase-branch'])
  : { status: 'not-attempted', matches: [], detail: 'The Supabase credential was not supplied.' }

const vercel: ExactAttempt = vercelToken
  ? await exactGet('The exact Vercel deployment query',
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(handles.vercelPreview.deploymentId)}?teamId=${encodeURIComponent(vercelTeam)}`,
    { authorization: `Bearer ${vercelToken}` }, expected['vercel-preview'])
  : { status: 'not-attempted', matches: [], detail: 'The Vercel credential was not supplied.' }

async function githubSecrets(): Promise<ExactAttempt> {
  if (skipGithub) return { status: 'not-attempted', matches: [], detail: 'GitHub secret teardown is finalized after the protected run ends.' }
  if (!githubToken) return { status: 'not-attempted', matches: [], detail: 'The GitHub credential was not supplied.' }
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/environments/${handles.githubEnvironmentSecrets.environment}/secrets`,
      { headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json' }, cache: 'no-store' },
    )
    if (!response.ok) return { status: 'failed', matches: [], detail: `The exact GitHub environment-secret listing returned ${response.status}.` }
    const body = await response.json() as { secrets?: { name?: string }[] }
    if (!Array.isArray(body.secrets)) return { status: 'malformed', matches: [], detail: 'The GitHub secret listing was malformed.' }
    const expectedNames = new Set(handles.githubEnvironmentSecrets.names)
    const survivors = body.secrets.filter((row) => expectedNames.has(String(row.name ?? '')))
    return {
      status: 'succeeded',
      matches: survivors.map(() => ({ identifierFingerprint: expected['github-environment-secret'], status: 'bound' })),
      detail: survivors.length === 0
        ? 'The exact temporary secret-name set is absent from the protected environment.'
        : `${survivors.length} exact temporary secret binding(s) remain.`,
    }
  } catch (error) {
    return { status: 'failed', matches: [], detail: `The GitHub secret listing raised ${(error as Error).name}.` }
  }
}
const github = await githubSecrets()

// Release rows existed only inside the exact ephemeral branch. Their absence
// is established by confirmed destruction of that container, after checking
// above that the private handle names exactly the artifact's release ids.
const rows: ExactAttempt = supabase.status === 'succeeded' && supabase.matches.length === 0
  ? { status: 'succeeded', matches: [], detail: 'Exact release rows are absent by confirmed destruction of their exact containing branch.' }
  : {
    status: supabase.status,
    matches: supabase.matches.length > 0
      ? [{ identifierFingerprint: expected['database-release-rows'], status: 'containing-branch-present' }]
      : [],
    detail: 'Release-row absence cannot be established until the exact containing branch is confirmed absent.',
  }

const attempts = {
  'supabase-branch': supabase,
  'vercel-preview': vercel,
  'github-environment-secret': github,
  'database-release-rows': rows,
}
const results: ProviderQueryResult[] = TEARDOWN_HANDLE_KINDS.map((kind) => ({
  provider: kind === 'database-release-rows' ? 'supabase-container' : kind.split('-')[0],
  resourceKind: kind,
  queryStatus: attempts[kind].status,
  scope: 'exact-identifier',
  runMarker: handles.runMarker,
  reviewedCommit: handles.reviewedCommit,
  identifierFingerprint: expected[kind],
  matches: attempts[kind].matches,
  detail: attempts[kind].detail,
}))

const report = produceTeardownObservations({
  runMarker: handles.runMarker,
  reviewedCommit: handles.reviewedCommit,
  expectedFingerprints: expected,
  results,
})
const payload = { ...report, workflowRunId: handles.workflowRunId, providerResults: results }
assertSanitized(payload)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({
  runMarker: handles.runMarker,
  allConfirmedAbsent: report.allConfirmedAbsent,
  states: report.observations.map((entry) => ({ resourceKind: entry.resourceKind, observedState: entry.observedState, refusal: entry.refusal })),
}, null, 2)}\n`)
if (!report.allConfirmedAbsent) {
  const partialSafe = allowPartial
    && report.observations.every((entry) => entry.resourceKind === 'github-environment-secret'
      ? entry.observedState === 'unknown'
      : entry.observedState === 'confirmed-absent')
  if (!partialSafe) process.exit(1)
}
