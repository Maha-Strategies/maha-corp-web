import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { auditCardinality } from '../lib/federation/cardinality-audit.ts'

const F = 'content/federation'
const read = (name: string) => JSON.parse(readFileSync(`${F}/${name}`, 'utf8'))
const v2 = read('federation-route-candidates-v2.json')
const v3 = read('federation-route-candidates-v3.json')
const v4 = read('federation-route-candidates-v4.json')
const objects = read('federation-definition-graph-objects-v1.json')
const lineage = read('federation-candidate-lineage-v4.json')
const reconciliation = read('federation-dependency-reconciliation-v2.json')

const canonical = (value: unknown): string => value === null || typeof value !== 'object'
  ? JSON.stringify(value) ?? 'null'
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
const sha = (value: unknown) => `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`

test('route cardinality is exactly 2,372 plus 1,628 equals 4,000', () => {
  assert.equal(v4.candidates.length, 1628)
  assert.equal(v4.summary.observedCanonicalRoutes, 2372)
  assert.equal(v4.summary.projectedCanonicalRoutes, 4000)
  assert.equal(v4.summary.observedCanonicalRoutes + v4.candidates.length, 4000)
  assert.equal(v4.activeRanks.length, 1628)
  assert.equal(v4.allocation.reduce((n: number, row: { activeCandidates: number }) => n + row.activeCandidates, 0), 1628)
})

test('v4 carries every v2 route candidate byte-for-byte and no v3 addition as a route', () => {
  assert.equal(canonical(v4.candidates), canonical(v2.candidates))
  const routeIds = new Set(v4.candidates.map((candidate: { candidateId: string }) => candidate.candidateId))
  const additions = v3.candidates.filter((candidate: { addedIn?: string }) => candidate.addedIn === 'v3')
  assert.equal(additions.length, 32)
  for (const addition of additions) assert.equal(routeIds.has(addition.candidateId), false)
})

test('all 32 v3 identities survive exactly once as non-route graph objects', () => {
  assert.equal(objects.graphObjects.length, 32)
  assert.equal(new Set(objects.graphObjects.map((object: { graphObjectId: string }) => object.graphObjectId)).size, 32)
  assert.equal(new Set(objects.graphObjects.map((object: { canonicalId: string }) => object.canonicalId)).size, 32)
  for (const object of objects.graphObjects) {
    assert.equal(object.routeBudget, false)
    assert.equal(object.publicRoute, null)
    assert.equal(object.publication.crawlable, false)
  }
  assert.equal(lineage.counts.reclassifiedAsGraphObjects, 32)
  assert.equal(lineage.counts.deletedObjects, 0)
})

test('all 94 dependency identities resolve without inheriting evidence', () => {
  assert.equal(reconciliation.counts.priorMissingRecords, 94)
  assert.equal(reconciliation.counts.identityResolved, 94)
  assert.equal(reconciliation.counts.identityStillMissing, 0)
  assert.ok(reconciliation.rows.every((row: { boundary: string }) => row.boundary.includes('does not inherit evidence')))
})

test('evidence groups are preserved and no object is promoted', () => {
  const groups = Object.fromEntries(['externally-grounded', 'first-party', 'deferred', 'external-authority-required'].map((group) => [group, objects.graphObjects.filter((object: { evidenceGroup: string }) => object.evidenceGroup === group).length]))
  assert.deepEqual(groups, { 'externally-grounded': 3, 'first-party': 15, deferred: 2, 'external-authority-required': 12 })
  assert.equal(objects.counts.publicRoutes, 0)
  assert.equal(objects.counts.crawlable, 0)
})

test('the cardinality audit catches the original v3 contradiction', () => {
  const additions = v3.candidates.filter((candidate: { addedIn?: string }) => candidate.addedIn === 'v3')
  const coverage = new Map<string, string>(
    v3.candidates.map((candidate: { candidateId: string }) => [candidate.candidateId, 'covered'] as const),
  )
  const result = auditCardinality({ observedCanonicalRoutes: 2372,
    routeCandidates: v3.candidates.map((candidate: { candidateId: string; url: string; rank: number | null }) => ({ candidateId: candidate.candidateId, url: candidate.url, rank: candidate.rank })), graphObjects: [], summary: v3.summary,
    allocation: v3.allocation, activeRanksLength: v3.activeRanks.length,
    lineage: { addedCandidates: additions.length, supersededCandidates: 0 }, coverage })
  assert.equal(result.consistent, false)
  const codes = new Set(result.defects.map((defect) => defect.code))
  for (const code of ['summary-active-candidates-disagrees-with-array', 'projected-total-disagrees-with-summary', 'projected-total-off-target', 'active-ranks-disagrees-with-route-candidates', 'allocation-active-disagrees', 'additions-without-supersessions']) assert.ok(codes.has(code), code)
})

test('all generated artifacts carry valid provenance digests', () => {
  for (const name of ['federation-route-candidates-v4.json', 'federation-definition-graph-objects-v1.json', 'federation-candidate-lineage-v4.json', 'federation-dependency-reconciliation-v2.json', 'federation-cardinality-repair-v1.json']) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, sha(body), name)
  }
})

test('regeneration is byte-identical', () => {
  const names = ['federation-route-candidates-v4.json', 'federation-definition-graph-objects-v1.json', 'federation-candidate-lineage-v4.json', 'federation-dependency-reconciliation-v2.json', 'federation-cardinality-repair-v1.json']
  const before = names.map((name) => readFileSync(`${F}/${name}`, 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-federation-cardinality-repair.ts'], { stdio: 'ignore' })
  assert.deepEqual(names.map((name) => readFileSync(`${F}/${name}`, 'utf8')), before)
})

test('repair records zero build, deployment, and public-route creation', () => {
  const repair = read('federation-cardinality-repair-v1.json')
  assert.deepEqual(repair.execution, { candidateContentChanged: false, reviewsRewritten: false, publicRoutesGenerated: false, buildRun: false, deployed: false })
})
