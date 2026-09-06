/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { MYTHOLOGY_ALLOCATION, migrateCandidateMapV2 } from '../lib/federation-mythology-candidate-migration.ts'
import { writeMythologyCandidateMigration } from '../scripts/generate-federation-mythology-candidate-migration.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = (path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
const baseline = readJson('content/federation/federation-route-baseline-v1.json')
const v1Map = readJson('content/federation/federation-route-candidates-v1.json')
const v1Semantic = readJson('content/federation/federation-semantic-adjudication-v1.json')
const v1Dependency = readJson('content/federation/federation-dependency-graph-v1.json')
const v1Demand = readJson('content/federation/federation-gsc-demand-calibration-v1.json')
const trancheCohorts = Array.from({ length: 10 }, (_, index) => readJson(`content/federation/federation-tranche-${index + 1}-cohort-v1.json`))
const lineage = readJson('content/federation/federation-candidate-lineage-v2.json')
const map = readJson('content/federation/federation-route-candidates-v2.json')
const semantic = readJson('content/federation/federation-semantic-adjudication-v2.json')
const dependency = readJson('content/federation/federation-dependency-graph-v2.json')
const demand = readJson('content/federation/federation-gsc-demand-calibration-v2.json')

test('candidate-map v2 is an append-only, digest-bound migration from v1', () => {
  for (const artifact of [baseline, v1Map, v1Semantic, v1Dependency, v1Demand, lineage, map, semantic, dependency, demand]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  assert.equal(lineage.previousCandidateMapDigest, v1Map.provenanceDigest)
  assert.equal(map.previousCandidateMapDigest, v1Map.provenanceDigest)
  assert.equal(map.lineageDigest, lineage.provenanceDigest)
  assert.equal(semantic.previousSemanticAdjudicationDigest, v1Semantic.provenanceDigest)
  assert.equal(dependency.previousDependencyGraphDigest, v1Dependency.provenanceDigest)
  assert.equal(demand.previousDemandCalibrationDigest, v1Demand.provenanceDigest)
})

test('all 1,000 reviewed candidate objects survive byte-for-byte', () => {
  const selectedIds = new Set(trancheCohorts.flatMap((cohort) => cohort.entries.map((entry: any) => entry.candidateId)))
  assert.equal(selectedIds.size, 1_000)
  const oldById = new Map(v1Map.candidates.map((candidate: any) => [candidate.candidateId, candidate]))
  const newById = new Map(map.candidates.map((candidate: any) => [candidate.candidateId, candidate]))
  for (const id of selectedIds) assert.deepEqual(newById.get(id), oldById.get(id), id)
  assert.equal(lineage.retainedCandidates.filter((entry: any) => entry.reviewedInTranche !== null).length, 1_000)
  assert.equal(lineage.supersededCandidates.filter((entry: any) => selectedIds.has(entry.candidateId)).length, 0)
})

test('exactly 200 unselected v1 leaves are superseded and all 43 semantic exclusions are removed', () => {
  const retiredIds = new Set(lineage.supersededCandidates.map((entry: any) => entry.candidateId))
  const selectedIds = new Set(trancheCohorts.flatMap((cohort) => cohort.entries.map((entry: any) => entry.candidateId)))
  const priorSemanticExclusions = v1Semantic.entries.filter((entry: any) => entry.disposition !== 'retain-distinct')
  assert.equal(retiredIds.size, 200)
  assert.equal([...retiredIds].filter((id) => selectedIds.has(id)).length, 0)
  assert.equal(priorSemanticExclusions.length, 43)
  assert.equal(priorSemanticExclusions.filter((entry: any) => retiredIds.has(entry.candidateId)).length, 43)
  assert.equal(v1Dependency.edges.filter((edge: any) => retiredIds.has(edge.dependsOn)).length, 0)
  assert.equal(lineage.supersededCandidates.filter((entry: any) => entry.transition !== 'superseded-before-selection').length, 0)
})

test('books, authorial continuity, Tamil religion and astrology are weighted rather than silently discarded', () => {
  const active = new Set(map.candidates.map((candidate: any) => candidate.candidateId))
  const selected = new Set(trancheCohorts.flatMap((cohort) => cohort.entries.map((entry: any) => entry.candidateId)))
  for (const groupId of ['book-concepts', 'authorial-concepts', 'tamil-religion', 'astrology-infrastructure']) {
    const prior = v1Map.candidates.filter((candidate: any) => candidate.groupId === groupId)
    assert.ok(prior.some((candidate: any) => active.has(candidate.candidateId)), groupId)
    assert.ok(prior.filter((candidate: any) => selected.has(candidate.candidateId)).every((candidate: any) => active.has(candidate.candidateId)), groupId)
  }
  const activeMahaPrincipleDefinition = map.candidates.filter((candidate: any) => candidate.title === 'Maha Principle — Definition')
  assert.equal(activeMahaPrincipleDefinition.length, 1)
  assert.equal(activeMahaPrincipleDefinition[0].groupId, 'book-concepts')
})

test('200 mythology candidates replace 200 retired candidates without changing the 4,000-route projection', () => {
  const additions = map.candidates.filter((candidate: any) => candidate.groupId.startsWith('mythology-'))
  assert.equal(map.candidates.length, 1_628)
  assert.equal(lineage.counts.retained, 1_428)
  assert.equal(lineage.counts.superseded, 200)
  assert.equal(additions.length, 200)
  assert.equal(map.summary.projectedCanonicalRoutes, 4_000)
  assert.equal(map.summary.observedCanonicalRoutes + map.summary.activeCandidates, 4_000)
  assert.equal(map.allocation.reduce((sum: number, entry: any) => sum + entry.projected, 0), 4_000)
  assert.equal(new Set(map.candidates.map((candidate: any) => candidate.candidateId)).size, 1_628)
  assert.equal(new Set(map.candidates.map((candidate: any) => candidate.url)).size, 1_628)
  const observed = new Set(baseline.observedProperties.flatMap((property: any) => property.routes))
  assert.equal(map.candidates.filter((candidate: any) => observed.has(candidate.url)).length, 0)
})

test('mythology allocation, hub and registry match the approved architecture', () => {
  const additions = lineage.addedCandidates
  const actual = Object.fromEntries(Object.keys(MYTHOLOGY_ALLOCATION).map((collectionId) => [collectionId, additions.filter((entry: any) => entry.collectionId === collectionId).length]))
  assert.deepEqual(actual, MYTHOLOGY_ALLOCATION)
  const hub = map.candidates.find((candidate: any) => candidate.groupId === 'mythology-discovery-hub')
  const registry = map.candidates.find((candidate: any) => candidate.groupId === 'mythology-machine-registry')
  assert.equal(hub.path, '/knowledge/religion/mythology')
  assert.equal(registry.path, '/knowledge/religion/mythology/registry')
  assert.ok(hub.typedRelationships.some((edge: any) => edge.type === 'contrasts-with' && edge.target.endsWith(':mayon')))
})

test('new mythology candidates remain uninspected, noncanonical, noncrawlable and demand-unknown', () => {
  const additions = map.candidates.filter((candidate: any) => candidate.groupId.startsWith('mythology-'))
  const demandById = new Map(demand.entries.map((entry: any) => [entry.candidateId, entry]))
  for (const candidate of additions) {
    assert.deepEqual(candidate.evidencePlan, {
      sourceIdentity: 'not-started', contentInspection: 'not-started', locatorInspection: 'not-started',
      rightsReview: 'not-started', alignmentAudit: 'not-started', exactRevisionReview: 'not-started',
    })
    assert.deepEqual(candidate.publication, { state: 'candidate-only', inspected: false, reviewed: false, canonicallyReleased: false, compiled: false, crawlable: false })
    const calibrated: any = demandById.get(candidate.candidateId)
    assert.equal(calibrated.basis, 'unknown')
    assert.equal(calibrated.queryImpressions, 0)
    assert.equal(calibrated.adjacentPageImpressions, 0)
    assert.deepEqual(calibrated.matchedQueries, [])
    assert.deepEqual(calibrated.matchedPages, [])
  }
  assert.equal(map.executionState.buildRun, false)
  assert.equal(map.executionState.deployed, false)
})

test('semantic uniqueness and source-frame boundaries are explicit for every mythology candidate', () => {
  const additions = map.candidates.filter((candidate: any) => candidate.groupId.startsWith('mythology-'))
  const semanticById = new Map(semantic.entries.map((entry: any) => [entry.candidateId, entry]))
  assert.equal(semantic.entries.length, 1_628)
  assert.equal(semantic.counts['retain-distinct'], 1_628)
  for (const candidate of additions) {
    const entry: any = semanticById.get(candidate.candidateId)
    assert.equal(entry.disposition, 'retain-distinct')
    assert.match(entry.retainedBoundary, /cannot equate traditions/)
    assert.ok(candidate.routeContract.mustNotClaim.includes('cross-tradition identity from shared attributes'))
    assert.ok(candidate.routeContract.mustNotClaim.includes('theological truth or falsity'))
  }
})

test('dependency v2 is acyclic and every specialized mythology route follows methods and its hub', () => {
  const candidateIds = new Set(map.candidates.map((candidate: any) => candidate.candidateId))
  const externalIds = new Set([
    ...dependency.observedAnchorNodes.map((node: any) => node.nodeId),
    ...dependency.observedTopicNodes.map((node: any) => node.nodeId),
    ...dependency.missingOwnerTopicNodes.map((node: any) => node.nodeId),
  ])
  assert.equal(dependency.counts.cycles, 0)
  assert.equal(dependency.topologicalOrder.length, 1_628)
  assert.equal(new Set(dependency.topologicalOrder).size, 1_628)
  for (const edge of dependency.edges) {
    assert.ok(candidateIds.has(edge.from), edge.from)
    assert.ok(candidateIds.has(edge.dependsOn) || externalIds.has(edge.dependsOn), edge.dependsOn)
  }
  const hub = map.candidates.find((candidate: any) => candidate.groupId === 'mythology-discovery-hub')
  const additions = map.candidates.filter((candidate: any) => candidate.groupId.startsWith('mythology-'))
  for (const candidate of additions.filter((candidate: any) => candidate.candidateId !== hub.candidateId)) {
    assert.ok(dependency.edges.some((edge: any) => edge.from === candidate.candidateId && edge.dependsOn === hub.candidateId), candidate.url)
  }
})

test('generation is byte-identical across two clean output roots', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-mythology-map-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-mythology-map-b-'))
  try {
    writeMythologyCandidateMigration(first)
    writeMythologyCandidateMigration(second)
    for (const path of [
      'content/federation/federation-candidate-lineage-v2.json',
      'content/federation/federation-route-candidates-v2.json',
      'content/federation/federation-semantic-adjudication-v2.json',
      'content/federation/federation-dependency-graph-v2.json',
      'content/federation/federation-gsc-demand-calibration-v2.json',
      'docs/federation/federation-mythology-candidate-migration.md',
    ]) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true, force: true })
    rmSync(second, { recursive: true, force: true })
  }
})

test('the migration emits no inspected passage, credential, customer or private-submission material', () => {
  const serialized = JSON.stringify({ lineage, map, semantic, dependency, demand })
  for (const forbidden of [
    /inspectedPassage/i, /passageText/i, /service[_-]?role/i, /authorization:\s*bearer/i,
    /stripe[_-]?(secret|key)/i, /customerEmail/i, /enquiryPayload/i, /submittedContent/i,
  ]) assert.doesNotMatch(serialized, forbidden)
})

test('the pure migration and committed artifacts agree', () => {
  const regenerated = migrateCandidateMapV2({ baseline, v1Map, v1Semantic, v1Dependency, v1Demand, trancheCohorts })
  assert.deepEqual(regenerated.lineage, lineage)
  assert.deepEqual(regenerated.candidateMap, map)
  assert.deepEqual(regenerated.semantic, semantic)
  assert.deepEqual(regenerated.dependency, dependency)
  assert.deepEqual(regenerated.demand, demand)
})
