import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  ARTIFACT_VERSIONS,
  compileRecoveryPackets,
  finalizeRecoveryObservation,
  RECOVERY_CHANNELS,
  RECOVERY_STATES,
  sameSourceIdentity,
  SOURCE_RECOVERY_CANARY_IDS,
  validateObservation,
  type RecoveryObservation,
} from '../lib/source-recovery.ts'
import { executeRecoveryRequest } from '../lib/source-recovery-live.ts'

const packet = compileRecoveryPackets()[0]

function observation(overrides: Partial<RecoveryObservation> = {}): RecoveryObservation {
  return {
    channel: 'europe-pmc',
    requestUrl: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
    status: 'manual-inspection-ready',
    candidateUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC123/',
    artifactVersion: 'repository-copy',
    observedTitle: packet.sourceTitle,
    observedIdentifier: packet.sourceIdentifier,
    identityVerified: true,
    versionRelationshipVerified: true,
    contentInspected: false,
    exactLocator: null,
    note: 'Test observation.',
    ...overrides,
  }
}

test('the canary contains exactly twenty unique, resolving source contracts', () => {
  assert.equal(SOURCE_RECOVERY_CANARY_IDS.length, 20)
  assert.equal(new Set(SOURCE_RECOVERY_CANARY_IDS).size, 20)
  const packets = compileRecoveryPackets()
  assert.equal(packets.length, 20)
  assert.deepEqual(packets.map((item) => item.priority), Array.from({ length: 20 }, (_, index) => 20 - index))
  assert.ok(packets.every((item) => item.affectedRecordIds.length > 0))
})

test('planning is local, deterministic, and never claims inspection', () => {
  const first = compileRecoveryPackets()
  const second = compileRecoveryPackets()
  assert.deepEqual(first, second)
  for (const item of first) {
    assert.equal(item.disposition, 'not-attempted')
    assert.equal(item.inspectionAuthorized, false)
    assert.equal(item.canonicalMutationAuthorized, false)
    assert.deepEqual(item.observations, [])
    assert.match(item.digest, /^sha256:[a-f0-9]{64}$/)
  }
})

test('requests are bounded to declared HTTPS recovery channels', () => {
  for (const item of compileRecoveryPackets()) {
    assert.ok(item.requests.length >= 4)
    for (const request of item.requests) {
      assert.ok(RECOVERY_CHANNELS.includes(request.channel))
      assert.equal(new URL(request.url).protocol, 'https:')
      assert.doesNotMatch(request.url, /token|secret|password|api_key/i)
    }
  }
})

test('identity uses DOI when both sides declare one and exact normalized title otherwise', () => {
  assert.equal(sameSourceIdentity('A title', '10.1/ABC', { observedTitle: 'Wrong', observedIdentifier: 'https://doi.org/10.1/abc' }), true)
  assert.equal(sameSourceIdentity('A title', '10.1/ABC', { observedTitle: 'A title', observedIdentifier: '10.1/different' }), false)
  assert.equal(sameSourceIdentity('A: Title!', null, { observedTitle: 'a title', observedIdentifier: null }), true)
  assert.equal(sameSourceIdentity('A title', null, { observedTitle: 'A similar title', observedIdentifier: null }), false)
})

test('a repository candidate for a different edition is rejected as the wrong document', () => {
  const result = finalizeRecoveryObservation(
    'Mineral Commodity Summaries 2026',
    null,
    observation({
      status: 'open-copy-located',
      candidateUrl: 'https://pubs.usgs.gov/periodicals/mcs2024/mcs2024.pdf',
      artifactVersion: 'government-report',
      observedTitle: 'Mineral Commodity Summaries 2024',
      observedIdentifier: null,
      identityVerified: false,
      versionRelationshipVerified: true,
    }),
  )
  assert.equal(result.identityVerified, false)
  assert.equal(result.status, 'wrong-document')
})

test('manual inspection readiness fails closed on every required axis', () => {
  assert.deepEqual(validateObservation({ title: packet.sourceTitle, identifier: packet.sourceIdentifier }, observation()), [])
  const cases: Array<[Partial<RecoveryObservation>, string]> = [
    [{ identityVerified: false }, 'identity-verdict-disagrees'],
    [{ versionRelationshipVerified: false }, 'inspection-ready-without-version-link'],
    [{ candidateUrl: null }, 'inspection-ready-without-https-copy'],
    [{ artifactVersion: 'unknown' }, 'inspection-ready-without-artifact-version'],
    [{ contentInspected: true as false }, 'recovery-cannot-claim-inspection'],
    [{ exactLocator: 'page 1' as unknown as null }, 'recovery-cannot-claim-inspection'],
  ]
  for (const [change, expected] of cases) {
    assert.ok(validateObservation({ title: packet.sourceTitle, identifier: packet.sourceIdentifier }, observation(change)).includes(expected))
  }
})

test('unknown vocabulary is rejected at runtime', () => {
  assert.ok(RECOVERY_STATES.includes('not-attempted'))
  assert.ok(ARTIFACT_VERSIONS.includes('repository-copy'))
  assert.ok(validateObservation({ title: packet.sourceTitle, identifier: packet.sourceIdentifier }, observation({ status: 'bogus' as never })).includes('unknown-status'))
  assert.ok(validateObservation({ title: packet.sourceTitle, identifier: packet.sourceIdentifier }, observation({ channel: 'bogus' as never })).includes('unknown-channel'))
})

test('Crossref execution normalizes metadata without claiming an open copy', async () => {
  const prior = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: { title: [packet.sourceTitle], DOI: packet.sourceIdentifier, URL: packet.declaredUrl } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch
  try {
    const request = packet.requests.find((item) => item.channel === 'crossref')!
    const result = await executeRecoveryRequest(request)
    assert.equal(result.status, 'metadata-only')
    assert.equal(result.contentInspected, false)
    assert.equal(result.exactLocator, null)
    assert.equal(result.artifactVersion, 'version-of-record')
  } finally {
    globalThis.fetch = prior
  }
})

test('the live executor refuses unapproved hosts before network access', async () => {
  let called = false
  const prior = globalThis.fetch
  globalThis.fetch = (async () => { called = true; throw new Error('must not run') }) as typeof fetch
  try {
    await assert.rejects(() => executeRecoveryRequest({ channel: 'official-publisher', url: 'https://evil.example/source', purpose: 'open-copy' }), /not allowlisted/)
    assert.equal(called, false)
  } finally {
    globalThis.fetch = prior
  }
})

test('generated packets and documentation regenerate byte-identically', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = ['content/source-recovery/canary-packets.json', 'docs/source-recovery/canary.md']
  const before = paths.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-source-recovery-packets.ts'), '--write'], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(join(root, path), 'utf8'), before[index]))
})

test('recovery artifacts are absent from public routes and discovery manifests', () => {
  const app = new URL('../app', import.meta.url).pathname
  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
  const servedSources = walk(app).filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => readFileSync(path, 'utf8')).join('\n')
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  for (const text of [servedSources, sitemap, llms]) assert.doesNotMatch(text, /source-recovery|canary-packets/)
})
