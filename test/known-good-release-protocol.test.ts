import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type FrozenComponent = { path: string; sha256: string }
type Protocol = {
  schemaVersion: string
  protocolId: string
  evidence: {
    migrationDryRun: { productionMutationPerformed: boolean; pendingMigrations: number; preApplyClassification: string }
    repairedRevisionRelease: { initialReleases: number; replayedReleases: number; operation: string }
    propagationVerification: { records: number; routeHttp200: number; provenanceHttp200: number; sitemapComplete: boolean; llmsTxtComplete: boolean; releaseRegistryComplete: boolean }
  }
  frozenComponents: FrozenComponent[]
  requiredBoundaries: string[]
}

const protocol = JSON.parse(readFileSync('docs/operations/known-good-canonical-release-protocol-v1.json', 'utf8')) as Protocol

test('the known-good release protocol is pinned to byte-exact reviewed components', () => {
  assert.equal(protocol.schemaVersion, 'maha-known-good-release-protocol/1.0')
  assert.equal(protocol.frozenComponents.length, 6)
  for (const component of protocol.frozenComponents) {
    const actual = createHash('sha256').update(readFileSync(component.path)).digest('hex')
    assert.equal(actual, component.sha256, `${component.path} changed; create and evidence a new protocol version instead of silently changing v1`)
  }
})

test('the frozen evidence records a non-mutating migration check and complete canary projection', () => {
  assert.deepEqual(protocol.evidence.migrationDryRun, {
    runId: 33090092159,
    headSha: 'c91832835c9c56528e5bbf56c1289118fc4a2588',
    conclusion: 'success',
    pendingMigrations: 0,
    preApplyClassification: 'no-delta',
    postApplyClassification: 'not-run',
    convergence: 'not-applicable',
    productionMutationPerformed: false,
  })
  assert.equal(protocol.evidence.repairedRevisionRelease.operation, 'review-publish-verify')
  assert.equal(protocol.evidence.repairedRevisionRelease.initialReleases, 2)
  assert.equal(protocol.evidence.repairedRevisionRelease.replayedReleases, 0)
  assert.deepEqual(
    {
      records: protocol.evidence.propagationVerification.records,
      routes: protocol.evidence.propagationVerification.routeHttp200,
      provenance: protocol.evidence.propagationVerification.provenanceHttp200,
      sitemap: protocol.evidence.propagationVerification.sitemapComplete,
      llms: protocol.evidence.propagationVerification.llmsTxtComplete,
      registry: protocol.evidence.propagationVerification.releaseRegistryComplete,
    },
    { records: 2, routes: 2, provenance: 2, sitemap: true, llms: true, registry: true },
  )
})

test('the protocol retains the release boundaries that made the canary credible', () => {
  const boundaries = protocol.requiredBoundaries.join('\n')
  for (const phrase of ['Production database identity', 'dry-run never applies', 'Unexplained pre-apply drift', 'exact confirmation phrase', 'credentials remain separate', 'exact reviewed record revisions', 'route, provenance, sitemap, llms.txt and registry', 'never represented as external endorsement']) {
    assert.match(boundaries, new RegExp(phrase))
  }
})
