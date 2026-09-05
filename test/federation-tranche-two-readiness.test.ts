import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import type { CandidateMap } from '../lib/federation-4000-adjudication.ts'
import { evaluateTrancheTwo, trancheTwoSourceFingerprints } from '../lib/federation-tranche-two-readiness.ts'
import { generateTrancheTwoReadiness } from '../scripts/generate-federation-tranche-two-readiness.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
const candidateMap = readJson<CandidateMap>('content/federation/federation-route-candidates-v1.json')
const graph = readJson<Parameters<typeof evaluateTrancheTwo>[1]>('content/federation/federation-dependency-graph-v1.json')
const cohort = readJson<Parameters<typeof evaluateTrancheTwo>[2]>('content/federation/federation-tranche-2-cohort-v1.json')
const trancheOne = readJson<Parameters<typeof evaluateTrancheTwo>[3]>('content/federation/federation-tranche-1-cohort-v1.json')
const priorPackets = readJson<Parameters<typeof evaluateTrancheTwo>[4]>('content/federation/federation-tranche-1-evidence-packets-v1.json')
const generated = evaluateTrancheTwo(candidateMap, graph, cohort, trancheOne, priorPackets, trancheTwoSourceFingerprints(ROOT))

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name)
    return entry.isDirectory() ? filesUnder(target) : [target]
  })
}

test('Tranche 2 is a deterministic 100-candidate continuation with no Tranche 1 overlap', () => {
  assert.equal(provenanceDigest(cohort), cohort.provenanceDigest)
  assert.equal(cohort.entries.length, 100)
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set(trancheOne.entries.map((entry) => entry.candidateId))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
  assert.equal(cohort.entries.filter((entry) => entry.dependenciesSatisfiedByTrancheOne.length > 0).length, 94)
  assert.deepEqual(cohort.entries.reduce<Record<string, number>>((counts, entry) => ({ ...counts, [entry.siteId]: (counts[entry.siteId] ?? 0) + 1 }), {}), {
    'maha-research': 25,
    'agentic-publishing': 10,
    'maha-strategies': 31,
    'maha-os': 6,
    'mayone-maharajan': 5,
    'maha-policy': 18,
    'mayon-rajan': 5,
  })
})

test('all 100 candidates received a manual semantic adjudication', () => {
  assert.deepEqual(generated.manualSemantic.counts, { reviewed: 100, retainedDistinct: 99, replaceWithExisting: 1, corrected: 1 })
  assert.equal(new Set(generated.manualSemantic.entries.map((entry) => entry.candidateId)).size, 100)
  assert.ok(generated.manualSemantic.entries.every((entry) => entry.manualReason.length > 100))
  assert.ok(generated.manualSemantic.entries.every((entry) => entry.reviewerTier === 'internal-editorial'))
  const duplicate = generated.manualSemantic.entries.find((entry) => entry.candidateId === 'cand_48485c2639eca0b2fb4d9852')
  assert.equal(duplicate?.manualDisposition, 'replace-with-existing-route')
  assert.equal(duplicate?.comparedRoute, 'https://publish.mahastrategies.com/docs/machine-readability')
})

test('all dependencies resolve and the rejected definition is replaced rather than depended on', () => {
  assert.deepEqual(generated.dependencyValidation.counts, {
    checked: 100,
    valid: 100,
    invalid: 0,
    dependenciesResolvedThroughTrancheOne: 94,
    observedOwnerBodyCaveats: 6,
  })
  assert.ok(generated.dependencyValidation.entries.every((entry) => entry.dependencyValid))
  assert.ok(generated.dependencyValidation.entries.flatMap((entry) => entry.graphEdges).every((edge) => typeof edge.url === 'string' && edge.url.startsWith('https://')))
  const children = generated.dependencyValidation.entries.filter((entry) => entry.topic === 'machine-readable-article' && entry.routeRole !== 'definition')
  assert.equal(children.length, 2)
  assert.ok(children.every((entry) => entry.definitionDependency?.url === 'https://publish.mahastrategies.com/docs/machine-readability'))
  assert.ok(children.every((entry) => entry.definitionDependency?.resolution === 'observed-canonical-replacement'))
  const crossProperty = generated.dependencyValidation.entries.filter((entry) => entry.canonicalOwner !== entry.siteId)
  assert.ok(crossProperty.length > 0)
  assert.ok(crossProperty.every((entry) => entry.ownerDependencies.every((dependency) => dependency.url)))
})

test('all 44 topic/property pairs carry complete immutable evidence packets', () => {
  assert.deepEqual(generated.evidencePackets.counts, {
    topics: 44,
    carriedForward: 28,
    newlyInspected: 16,
    byDisposition: { 'evidence-ready': 40, revise: 2, blocked: 2 },
  })
  assert.equal(new Set(generated.evidencePackets.packets.map((entry) => entry.topicKey)).size, 44)
  for (const packet of generated.evidencePackets.packets) {
    assert.equal(packet.sourceIdentityChecked, true, packet.topicKey)
    assert.equal(packet.locatorChecked, true, packet.topicKey)
    assert.equal(packet.rightsChecked, true, packet.topicKey)
    assert.equal(packet.scopeChecked, true, packet.topicKey)
    assert.equal(packet.boundaryChecked, true, packet.topicKey)
    assert.ok(packet.sources.length > 0, packet.topicKey)
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
  const carried = generated.evidencePackets.packets.filter((entry) => entry.provenance === 'carried-forward-same-version')
  assert.ok(carried.every((entry) => entry.priorPacketDigest && entry.priorPacketDigest.startsWith('sha256:')))
})

test('the 100 decisions form the exact four-state partition', () => {
  assert.deepEqual(generated.decisionManifest.counts, { 'evidence-ready': 85, revise: 9, blocked: 5, 'reject-as-duplicative': 1 })
  assert.equal(Object.values(generated.decisionManifest.counts).reduce((sum, value) => sum + Number(value), 0), 100)
  assert.equal(new Set(generated.decisionManifest.entries.map((entry) => entry.candidateId)).size, 100)
  assert.ok(generated.decisionManifest.entries.every((entry) => entry.activeRouteCreated === false))
  assert.ok(generated.decisionManifest.entries.filter((entry) => entry.routeRole === 'commercialization').every((entry) => entry.disposition === 'revise'))
  assert.ok(generated.decisionManifest.entries.filter((entry) => entry.topic === 'agentic-query-letter').every((entry) => entry.disposition === 'revise'))
  assert.ok(generated.decisionManifest.entries.filter((entry) => entry.topic === 'public-reason').every((entry) => entry.disposition === 'revise'))
  assert.ok(generated.decisionManifest.entries.filter((entry) => entry.topic === 'release-manifest').every((entry) => entry.disposition === 'blocked'))
  assert.deepEqual(generated.decisionManifest.entries.filter((entry) => entry.topic === 'machine-readable-article').map((entry) => entry.disposition).sort(), ['blocked', 'blocked', 'reject-as-duplicative'])
})

test('only the 85 evidence-ready candidates receive page specifications', () => {
  const ready = new Set(generated.decisionManifest.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  const specified = new Set(generated.specifications.specifications.map((entry) => entry.candidateId))
  assert.equal(generated.specifications.counts.specifications, 85)
  assert.deepEqual([...specified].sort(), [...ready].sort())
  for (const specification of generated.specifications.specifications) {
    assert.equal(specification.boundedQuestions.length, 5)
    assert.ok(specification.requiredSections.includes('Evidence and exact locators'))
    assert.ok(specification.requiredSections.includes('What the evidence does not establish'))
    assert.ok(specification.sourceBindings.length > 0)
    assert.equal(specification.implementationState, 'specification-only')
    assert.equal(specification.machineContract.exactRevisionReviewRequired, true)
    assert.equal(specification.machineContract.canonicalReleaseRequiredBeforePublication, true)
  }
})

test('public-reason remains revise because Rawls cannot establish Mayone authorial adoption', () => {
  const packet = generated.evidencePackets.packets.find((entry) => entry.topicKey === 'mayone-maharajan:public-reason')
  assert.equal(packet?.disposition, 'revise')
  assert.match(packet?.implementationCondition ?? '', /authorial passage/)
  assert.ok(packet?.sources.every((source) => source.sourceId === 'rawls-public-reason'))
  assert.ok(generated.decisionManifest.entries.filter((entry) => entry.topic === 'public-reason').every((entry) => entry.disposition === 'revise'))
})

test('owner-body inspection caveats block Publish derivatives without weakening dependency validity', () => {
  const caveats = generated.dependencyValidation.entries.filter((entry) => entry.bodyInspectionCaveat)
  assert.equal(caveats.length, 6)
  assert.ok(caveats.every((entry) => entry.dependencyValid))
  const decisions = new Map(generated.decisionManifest.entries.map((entry) => [entry.candidateId, entry.disposition]))
  assert.ok(caveats.every((entry) => decisions.get(entry.candidateId) === 'blocked' || decisions.get(entry.candidateId) === 'reject-as-duplicative'))
})

test('all artifact digests verify and evidentiary mutations change the digest', () => {
  for (const artifact of [generated.manualSemantic, generated.dependencyValidation, generated.evidencePackets, generated.decisionManifest, generated.specifications, generated.readinessReport]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const evidenceMutation = structuredClone(generated.evidencePackets)
  evidenceMutation.packets[0]!.sources[0]!.boundary += ' altered'
  assert.notEqual(provenanceDigest(evidenceMutation), generated.evidencePackets.provenanceDigest)
  const decisionMutation = structuredClone(generated.decisionManifest)
  decisionMutation.entries[0]!.disposition = 'blocked'
  assert.notEqual(provenanceDigest(decisionMutation), generated.decisionManifest.provenanceDigest)
})

test('two independent regenerations are byte-identical', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-federation-tranche-two-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-federation-tranche-two-b-'))
  try {
    const a = generateTrancheTwoReadiness(first)
    const b = generateTrancheTwoReadiness(second)
    assert.deepEqual(a.artifacts, b.artifacts)
    for (const path of a.artifacts) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('private artifacts contain no source passages, credentials, customer data, or served imports', () => {
  const serialized = JSON.stringify(generated)
  for (const secretShape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/, /authorization:\s*bearer\s+[A-Za-z0-9._-]{12,}/i]) assert.doesNotMatch(serialized, secretShape)
  for (const forbidden of ['privatePassageText', 'submittedClaim', 'claimContent', 'customerData', 'natalData', 'credentialValue', 'secretValue']) assert.equal(serialized.includes(forbidden), false)
  const servedSource = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-two-readiness', 'federation-tranche-2-evidence-packets', 'federation-tranche-2-page-specifications']) assert.doesNotMatch(servedSource, new RegExp(marker))
})

test('the local readiness report makes no implementation, release, build, or deployment claim', () => {
  assert.deepEqual(generated.readinessReport.counts, {
    selectedCandidates: 100,
    semanticCandidatesReviewed: 100,
    semanticCorrections: 1,
    representedTopics: 44,
    priorPacketsReused: 28,
    newTopicPacketsInspected: 16,
    dependenciesValid: 100,
    evidenceReady: 85,
    revise: 9,
    blocked: 5,
    duplicative: 1,
    substantialPageSpecifications: 85,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  assert.equal(generated.readinessReport.status, 'local-readiness-complete')
  assert.match(generated.readinessReport.implementationBoundary, /explicit approval/)
})
