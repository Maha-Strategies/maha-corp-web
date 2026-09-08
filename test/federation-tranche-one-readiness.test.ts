import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { adjudicateSemantics, buildDependencyGraph, calibrateDemand, selectTrancheOne, type CandidateMap, type GscSnapshot } from '../lib/federation-4000-adjudication.ts'
import type { FrozenBaseline } from '../lib/federation-4000-plan.ts'
import { evaluateTrancheOne, sourceFileFingerprints } from '../lib/federation-tranche-one-readiness.ts'
import { generateReadiness } from '../scripts/generate-federation-tranche-one-readiness.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T = Record<string, unknown>>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
const semantic = readJson<Parameters<typeof evaluateTrancheOne>[1]>('content/federation/federation-semantic-adjudication-v1.json')
const graph = readJson<Parameters<typeof evaluateTrancheOne>[2]>('content/federation/federation-dependency-graph-v1.json')
const cohort = readJson<Parameters<typeof evaluateTrancheOne>[3]>('content/federation/federation-tranche-1-cohort-v1.json')
const generated = evaluateTrancheOne(candidateMap, semantic, graph, cohort, sourceFileFingerprints(ROOT))

test('the reviewed selection inputs and all freeze artifacts verify deterministically', () => {
  const baseline = readJson<FrozenBaseline>('content/federation/federation-route-baseline-v1.json')
  const snapshot = readJson<GscSnapshot>('content/federation/federation-gsc-demand-snapshot-v1.json')
  const demand = readJson<ReturnType<typeof calibrateDemand>>('content/federation/federation-gsc-demand-calibration-v1.json')
  assert.deepEqual(snapshot.window, { start: '2026-08-20', end: '2026-08-26', searchType: 'Web' })
  assert.deepEqual(snapshot.sourceCounts, { queryRows: 247, pageRows: 256 })
  for (const artifact of [snapshot, semantic, demand, graph, cohort]) assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  const regeneratedSemantic = adjudicateSemantics(candidateMap, baseline)
  const regeneratedDemand = calibrateDemand(candidateMap, snapshot)
  const regeneratedGraph = buildDependencyGraph(candidateMap, regeneratedSemantic)
  const regeneratedCohort = selectTrancheOne(candidateMap, regeneratedSemantic, regeneratedGraph, regeneratedDemand)
  assert.deepEqual(regeneratedSemantic, semantic)
  assert.deepEqual(regeneratedDemand, demand)
  assert.deepEqual(regeneratedGraph, graph)
  assert.deepEqual(regeneratedCohort, cohort)
  assert.deepEqual(semantic.counts, { 'reject-cross-property-definition': 3, 'reject-internal-duplicate': 2, 'replace-with-existing-route': 12, 'retain-distinct': 1585, 'revise-as-local-application': 26 })
  assert.deepEqual(demand.counts, { directTopicQuerySignal: 48, adjacentExistingPageSignal: 26, unknown: 1554 })
  assert.equal(graph.counts.cycles, 0)
  assert.equal(cohort.entries.length, 100)
})

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name)
    return entry.isDirectory() ? filesUnder(target) : [target]
  })
}

test('all 43 machine semantic exclusions received an append-only manual review', () => {
  assert.equal(generated.manualSemantic.counts.reviewed, 43)
  assert.equal(generated.manualSemantic.entries.length, 43)
  assert.equal(new Set(generated.manualSemantic.entries.map((entry) => entry.candidateId)).size, 43)
  assert.equal(generated.manualSemantic.counts.corrected, 8)
  assert.ok(generated.manualSemantic.entries.every((entry) => entry.manualReason.length > 80))
  assert.ok(generated.manualSemantic.entries.every((entry) => entry.reviewerTier === 'internal-editorial'))
  assert.ok(generated.manualSemantic.entries.every((entry) => entry.manualDisposition !== 'retain-distinct'))
  assert.ok(generated.manualSemantic.entries.some((entry) => entry.changedByManualReview))
  assert.ok(generated.manualSemantic.entries.some((entry) => !entry.changedByManualReview))
})

test('all 100 selected candidates resolve the correct local and canonical-owner definitions', () => {
  assert.deepEqual(generated.dependencyValidation.counts, { checked: 100, valid: 100, invalid: 0, bodyInspectionCaveats: 4 })
  assert.equal(generated.dependencyValidation.entries.length, 100)
  for (const entry of generated.dependencyValidation.entries) {
    assert.ok(entry.dependencyValid, entry.url)
    assert.ok(entry.canonicalOwnerDefinition, `${entry.url} lacks a canonical-owner definition`)
    if (entry.canonicalOwnerDefinition?.candidateId) {
      assert.ok(cohort.entries.some((candidate) => candidate.candidateId === entry.canonicalOwnerDefinition?.candidateId))
    }
    assert.ok(entry.graphEdges.every((edge) => typeof edge.url === 'string' && edge.url.startsWith('https://')), `${entry.url} has an unresolved graph edge`)
  }
  const localApplications = generated.dependencyValidation.entries.filter((entry) => ['source-identity', 'rights-basis', 'uncertainty-propagation'].includes(entry.topic) && entry.url.includes('www.mahastrategies.com'))
  assert.ok(localApplications.length > 0)
  assert.ok(localApplications.every((entry) => entry.canonicalOwner === 'maha-research'))
  assert.ok(localApplications.every((entry) => entry.canonicalOwnerDefinition?.url.includes('research.mahastrategies.com')))
})

test('all 38 represented topics carry exact identity, locator, rights, scope and boundary packets', () => {
  assert.equal(generated.evidencePackets.counts.topics, 38)
  assert.equal(generated.evidencePackets.packets.length, 38)
  assert.equal(new Set(generated.evidencePackets.packets.map((packet) => packet.topicKey)).size, 38)
  assert.equal(Object.keys(generated.evidencePackets.localSourceFingerprints).length, 8)
  for (const packet of generated.evidencePackets.packets) {
    assert.ok(packet.sources.length > 0, packet.topicKey)
    assert.equal(packet.sourceIdentityChecked, true, packet.topicKey)
    assert.equal(packet.locatorChecked, true, packet.topicKey)
    assert.equal(packet.rightsChecked, true, packet.topicKey)
    assert.equal(packet.scopeChecked, true, packet.topicKey)
    assert.equal(packet.boundaryChecked, true, packet.topicKey)
    for (const source of packet.sources) {
      assert.ok(source.title && source.responsibleBody && source.versionOrDate && source.url)
      assert.ok(source.locator.length > 5)
      assert.ok(source.rightsBasis.length > 20)
      assert.ok(source.scope.length > 20)
      assert.ok(source.boundary.length > 20)
      assert.equal('excerpt' in source, false)
      assert.equal('passageText' in source, false)
    }
  }
})

test('the 100 decisions form an exact, honest four-state partition', () => {
  assert.deepEqual(generated.decisionManifest.counts, { 'evidence-ready': 90, revise: 4, blocked: 4, 'reject-as-duplicative': 2 })
  assert.equal(Object.values(generated.decisionManifest.counts).reduce((sum, count) => sum + Number(count), 0), 100)
  assert.equal(generated.decisionManifest.entries.length, 100)
  assert.equal(new Set(generated.decisionManifest.entries.map((entry) => entry.candidateId)).size, 100)
  assert.ok(generated.decisionManifest.entries.every((entry) => entry.activeRouteCreated === false))
  assert.equal(generated.decisionManifest.entries.filter((entry) => entry.topic === 'agentic-query-letter').every((entry) => entry.disposition === 'revise'), true)
  assert.equal(generated.decisionManifest.entries.filter((entry) => entry.topic === 'release-manifest').every((entry) => entry.disposition === 'blocked'), true)
  assert.equal(generated.decisionManifest.entries.filter((entry) => entry.topic === 'health-data-consent').every((entry) => entry.disposition === 'revise'), true)
})

test('only evidence-ready candidates receive substantial-page specifications', () => {
  const ready = new Set(generated.decisionManifest.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  const specified = new Set(generated.specifications.specifications.map((entry) => entry.candidateId))
  assert.equal(generated.specifications.counts.specifications, 90)
  assert.deepEqual([...specified].sort(), [...ready].sort())
  for (const spec of generated.specifications.specifications) {
    assert.ok(spec.requiredSections.includes('Evidence and exact locators'))
    assert.ok(spec.requiredSections.includes('What the evidence does not establish'))
    assert.equal(spec.boundedQuestions.length, 5)
    assert.ok(spec.sourceBindings.length > 0)
    assert.equal(spec.machineContract.releaseAndRevisionMatchRequiredBeforePublication, true)
    assert.equal(spec.implementationState, 'specification-only')
  }
})

test('every artifact digest verifies and changes when evidentiary content is mutated', () => {
  for (const artifact of [generated.manualSemantic, generated.dependencyValidation, generated.evidencePackets, generated.decisionManifest, generated.specifications, generated.readinessReport]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const mutated = structuredClone(generated.evidencePackets)
  mutated.packets[0]!.sources[0]!.boundary += ' altered'
  assert.notEqual(provenanceDigest(mutated), generated.evidencePackets.provenanceDigest)
  const changedDecision = structuredClone(generated.decisionManifest)
  changedDecision.entries[0]!.disposition = 'blocked'
  assert.notEqual(provenanceDigest(changedDecision), generated.decisionManifest.provenanceDigest)
})

test('readiness generation is byte-identical in two independent directories', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-federation-ready-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-federation-ready-b-'))
  try {
    const a = generateReadiness(first)
    const b = generateReadiness(second)
    assert.deepEqual(a.artifacts, b.artifacts)
    for (const path of a.artifacts) {
      assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
    }
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('private research artifacts carry no secrets, passages or public-route dependency', () => {
  const privateArtifacts = JSON.stringify(generated)
  for (const secretShape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/, /service_role\s*[:=]\s*[A-Za-z0-9._-]{12,}/i, /authorization:\s*bearer\s+[A-Za-z0-9._-]{12,}/i]) {
    assert.doesNotMatch(privateArtifacts, secretShape)
  }
  for (const forbidden of ['privatePassageText', 'reviewerEmail', 'credentialValue', 'secretValue', 'customerData', 'natalData']) {
    assert.equal(privateArtifacts.includes(forbidden), false)
  }
  const servedSource = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-1-readiness', 'federation-tranche-1-evidence-packets', 'federation-tranche-1-page-specifications']) {
    assert.doesNotMatch(servedSource, new RegExp(marker))
  }
})

test('the local report exposes readiness without claiming release or deployment', () => {
  assert.deepEqual(generated.readinessReport.counts, {
    semanticAdjudicationsReviewed: 43,
    semanticAdjudicationsCorrected: 8,
    selectedCandidates: 100,
    representedTopics: 38,
    dependenciesValid: 100,
    evidenceReady: 90,
    revise: 4,
    blocked: 4,
    duplicative: 2,
    substantialPageSpecifications: 90,
    publicRoutesCreated: 0,
    vercelBuildsRun: 0,
  })
  assert.match(generated.readinessReport.implementationBoundary, /Publication still requires/)
  assert.equal(generated.readinessReport.status, 'local-readiness-complete')
})
