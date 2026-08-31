import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

import {
  TEMPORARY_PREVIEW_SECRET_NAMES,
  type TeardownHandleDigests,
} from '../lib/batch-11-evidence-binding.ts'
import {
  assertSanitized,
  produceTeardownObservations,
  type ProviderQueryResult,
} from '../lib/batch-11-teardown-observations.ts'

const flag = (name: string): string | null => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null
}
const artifactPath = flag('artifact')
const partialPath = flag('partial')
const outPath = flag('out')
if (!artifactPath || !partialPath || !outPath) {
  console.error('--artifact, --partial and --out are required.')
  process.exit(2)
}
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as Record<string, unknown>
const partial = JSON.parse(readFileSync(partialPath, 'utf8')) as Record<string, unknown>
const expected = artifact.teardownHandleDigests as TeardownHandleDigests | undefined
if (!expected || partial.workflowRunId !== artifact.workflowRunId || partial.runMarker !== artifact.runMarker
  || partial.reviewedCommit !== artifact.reviewedCommit) {
  console.error('The sanitized partial report does not belong to the supplied artifact.')
  process.exit(2)
}
const prior = Array.isArray(partial.providerResults)
  ? partial.providerResults as ProviderQueryResult[]
  : []
const requiredPrior = ['supabase-branch', 'vercel-preview', 'database-release-rows']
if (requiredPrior.some((kind) => !prior.some((entry) => entry.resourceKind === kind
  && entry.queryStatus === 'succeeded' && entry.matches.length === 0
  && entry.identifierFingerprint === expected[kind as keyof TeardownHandleDigests]))) {
  console.error('The sanitized partial report does not prove exact branch, deployment and release-row teardown.')
  process.exit(2)
}

const githubToken = process.env.GITHUB_TOKEN?.trim() ?? ''
const repository = process.env.GITHUB_REPOSITORY?.trim() ?? 'Maha-Strategies/maha-corp-web'
let github: ProviderQueryResult
try {
  let body: { secrets?: { name?: string }[] }
  if (githubToken) {
    const response = await fetch(`https://api.github.com/repos/${repository}/environments/batch-11-preview-rehearsal/secrets`, {
      headers: { authorization: `Bearer ${githubToken}`, accept: 'application/vnd.github+json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`GitHub returned ${response.status}.`)
    body = await response.json() as { secrets?: { name?: string }[] }
  } else {
    // The local operator can use the already-authenticated gh session; no
    // credential is extracted, printed, or passed as a command argument.
    body = JSON.parse(execFileSync('gh', [
      'api', `repos/${repository}/environments/batch-11-preview-rehearsal/secrets`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })) as { secrets?: { name?: string }[] }
  }
  if (!Array.isArray(body.secrets)) throw new Error('GitHub returned a malformed secret listing.')
  const expectedNames = new Set<string>(TEMPORARY_PREVIEW_SECRET_NAMES)
  const survivors = body.secrets.filter((entry) => expectedNames.has(String(entry.name ?? '')))
  github = {
    provider: 'github',
    resourceKind: 'github-environment-secret',
    queryStatus: 'succeeded',
    scope: 'exact-identifier',
    runMarker: String(artifact.runMarker),
    reviewedCommit: String(artifact.reviewedCommit),
    identifierFingerprint: expected['github-environment-secret'],
    matches: survivors.map(() => ({ identifierFingerprint: expected['github-environment-secret'], status: 'bound' })),
    detail: survivors.length === 0 ? 'The exact temporary secret-name set is absent.' : `${survivors.length} exact temporary secret binding(s) remain.`,
  }
} catch (error) {
  github = {
    provider: 'github', resourceKind: 'github-environment-secret', queryStatus: 'failed', scope: 'exact-identifier',
    runMarker: String(artifact.runMarker), reviewedCommit: String(artifact.reviewedCommit),
    identifierFingerprint: expected['github-environment-secret'], matches: [],
    detail: `The exact GitHub secret query failed: ${(error as Error).message}`,
  }
}
const results = [...prior.filter((entry) => entry.resourceKind !== 'github-environment-secret'), github]
const report = produceTeardownObservations({
  runMarker: String(artifact.runMarker),
  reviewedCommit: String(artifact.reviewedCommit),
  expectedFingerprints: expected,
  results,
})
const payload = { ...report, workflowRunId: String(artifact.workflowRunId), providerResults: results }
assertSanitized(payload)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ allConfirmedAbsent: report.allConfirmedAbsent }, null, 2)}\n`)
if (!report.allConfirmedAbsent) process.exit(1)
