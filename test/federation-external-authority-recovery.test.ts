import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { AUTHORITY_DECISIONS, AUTHORITY_SOURCES, assertRecoveryContract, digest } from '../lib/federation/external-authority-recovery.ts'
import { EXTERNAL_AUTHORITY_REQUIRED } from '../lib/federation/first-party-definitions.ts'

const root = resolve(import.meta.dirname, '..')
const read = (name: string) => JSON.parse(readFileSync(resolve(root, 'content/federation', name), 'utf8'))

test('covers exactly the twelve refused external-authority concepts', () => {
  assert.doesNotThrow(assertRecoveryContract)
  assert.deepEqual([...AUTHORITY_DECISIONS.map((x) => x.conceptId)].sort(), [...EXTERNAL_AUTHORITY_REQUIRED.map((x) => x.conceptId)].sort())
})

test('ready definitions have section-level support and exact locators', () => {
  const sources = new Map(AUTHORITY_SOURCES.map((x) => [x.sourceId, x]))
  for (const decision of AUTHORITY_DECISIONS.filter((x) => x.state === 'definition-proposal-ready')) {
    assert.ok(decision.sourceIds.some((id) => sources.get(id)?.inspectionDepth === 'section-or-full-text'))
    for (const id of decision.sourceIds) assert.ok((sources.get(id)?.locator.length ?? 0) > 8)
  }
})

test('deterministic arithmetic is not promoted beyond inspected authority', () => {
  const decision = AUTHORITY_DECISIONS.find((x) => x.conceptId.endsWith(':deterministic-arithmetic'))
  assert.equal(decision?.state, 'revise')
  assert.match(decision?.doesNotEstablish ?? '', /cross-platform|replay/)
})

test('all sources are reference-only and no passage text is stored', () => {
  assert.ok(AUTHORITY_SOURCES.every((x) => x.rightsBasis === 'reference-only'))
  const serialized = JSON.stringify(AUTHORITY_SOURCES)
  for (const forbidden of ['passageText', 'fullText', 'excerpt', 'credential', 'reviewerIdentity']) assert.equal(serialized.includes(forbidden), false)
})

test('dependent impact is derived from the frozen candidate map without mutation', () => {
  const map = read('federation-route-candidates-v4.json')
  const graph = read('federation-definition-graph-objects-v1.json')
  const cohort = read('federation-external-authority-recovery-cohort-v1.json')
  const impact = read('federation-external-authority-dependency-impact-v1.json')
  const ids = new Set(AUTHORITY_DECISIONS.map((x) => x.conceptId))
  const expected = map.candidates
    .filter((x: { conceptId: string }) => ids.has(x.conceptId))
    .sort((a: { rank: number; candidateId: string }, b: { rank: number; candidateId: string }) => a.rank - b.rank || a.candidateId.localeCompare(b.candidateId))
    .map((x: { candidateId: string }) => x.candidateId)
  const expectedObjects = graph.graphObjects.filter((x: { conceptId: string }) => ids.has(x.conceptId)).map((x: { graphObjectId: string }) => x.graphObjectId).sort()
  assert.deepEqual(cohort.dependentRouteCandidateIds, expected)
  assert.deepEqual(cohort.graphObjectIds, expectedObjects)
  assert.equal(impact.totalDependentRouteCandidates, expected.length)
  assert.equal(impact.totalDefinitionGraphObjects, expectedObjects.length)
  assert.equal(impact.totalPriorMissingDependencyRecords, 32)
  assert.equal(map.candidates.length, cohort.candidateMap.routeCandidateCount)
  assert.equal(map.candidates.length, 1628)
  assert.equal(expected.length, 48)
  assert.equal(expectedObjects.length, 12)
})

test('authority proposals overlay graph identities without converting them into routes', () => {
  const graph = read('federation-definition-graph-objects-v1.json')
  const impact = read('federation-external-authority-dependency-impact-v1.json')
  for (const row of impact.impacts) {
    const object = graph.graphObjects.find((item: { graphObjectId: string }) => item.graphObjectId === row.graphObjectId)
    assert.ok(object, row.conceptId)
    assert.equal(object.publicRoute, null)
    assert.equal(object.routeBudget, false)
    assert.equal(row.routeCandidateCount, 4)
  }
})

test('generated artifacts authenticate their complete bodies', () => {
  for (const name of ['federation-external-authority-recovery-cohort-v1.json', 'federation-external-authority-source-inspections-v1.json', 'federation-external-authority-decisions-v1.json', 'federation-external-authority-dependency-impact-v1.json', 'federation-external-authority-readiness-v1.json']) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body))
  }
})

test('proposals confer no publication or release state', () => {
  const decisions = read('federation-external-authority-decisions-v1.json')
  const readiness = read('federation-external-authority-readiness-v1.json')
  assert.deepEqual(decisions.adoption, { activeBindingsChanged: 0, candidateStatesChanged: 0, reviewsCreated: 0, releasesCreated: 0, routesCompiled: 0 })
  assert.deepEqual(readiness.execution, { buildRun: false, routeGenerated: false, sitemapChanged: false, llmsChanged: false, deployed: false })
})
