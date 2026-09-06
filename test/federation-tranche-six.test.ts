import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheSixReview } from '../scripts/generate-federation-tranche-six-review.ts'
import { generateTrancheSix } from '../scripts/generate-federation-tranche-six.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheSix>
type Review = ReturnType<typeof generateFederationTrancheSixReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-6-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-6-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-6-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-6-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-6-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-6-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-6-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 6 freezes exactly candidates 501–600 without moving a prior cohort', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-six-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    overlapWithPriorTranches: 0,
    dependenciesSatisfiedByPriorTranches: 82,
    byProperty: { 'maha-strategies': 31, 'maha-research': 25, 'agentic-publishing': 10, 'maha-os': 6, 'mayone-maharajan': 5, 'mayon-rajan': 5, 'maha-policy': 18 },
    inspected: 0,
    evidenceReady: 0,
    pageSpecs: 0,
  })
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3, 4, 5].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
})

test('semantic and dependency decisions retain all 100 distinct contracts', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct' && entry.reason.length > 60))
  assert.deepEqual(dependencies.counts, { candidates: 100, resolved: 100, unresolved: 0 })
  assert.ok(dependencies.entries.every((entry) => entry.allDependenciesResolved))
  const candidateIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  for (const entry of dependencies.entries) {
    for (const dependency of entry.dependencies) {
      assert.ok(candidateIds.has(dependency.dependsOn) || dependency.resolution === 'prior-tranche')
    }
  }
})

test('fifteen new packets and forty-two carried packets preserve evidence roles and boundaries', () => {
  assert.deepEqual(packets.counts, { topics: 57, newTopics: 15, carriedForwardTopics: 42, sources: 88 })
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'new-section-inspection').length, 15)
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'carried-forward-same-version').length, 42)
  for (const packet of packets.packets) {
    assert.equal(packet.sourceIdentityChecked, true)
    assert.equal(packet.locatorChecked, true)
    assert.equal(packet.rightsChecked, true)
    assert.equal(packet.scopeChecked, true)
    assert.equal(packet.boundaryChecked, true)
    assert.ok(packet.sources.length > 0)
    for (const source of packet.sources) {
      assert.ok(source.url.startsWith('https://') || source.url.startsWith('repo:'))
      assert.ok(source.locator.length > 5)
      assert.ok(source.rightsBasis.length > 20)
      assert.ok(source.scope.length > 20)
      assert.ok(source.boundary.length > 20)
    }
  }
  for (const topicKey of ['maha-policy:export-controls', 'maha-policy:health-ai-governance']) {
    assert.ok(packets.packets.find((entry) => entry.topicKey === topicKey)!.sources.length >= 2)
  }
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-os:caregiver-access')), /family relationship alone does not create universal access/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-research:compiler-provenance')), /does not by itself prove.*compiler correctness/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-strategies:missing-inputs')), /missing inputs remain missing/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-strategies:mayon')), /modern namesake|Mayon Volcano/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'mayon-rajan:seismicity')), /records no current alert level or numerical reading/i)
})

test('ninety-eight candidates are ready and two inherited evidence gaps remain held', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 98, revise: 2, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 98, revise: 2, blocked: 0, duplicative: 0, pageSpecifications: 98, publicRoutesCreated: 0, buildsRun: 0 })
  assert.deepEqual(decisions.entries.filter((entry) => entry.disposition !== 'evidence-ready').map((entry) => `${entry.siteId}:${entry.topic}:${entry.routeRole}`).sort(), [
    'agentic-publishing:agentic-query-letter:failure-mode',
    'mayone-maharajan:public-reason:argument',
  ])
  const readyIds = new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), readyIds)
})

test('cumulative contracts remain local and exact-host adapters exclude unresolved prerequisites', () => {
  assert.deepEqual(implementationRegistry.counts, {
    pages: 951,
    readyForOwnerIntegration: 941,
    blockedOnUnreadyPrerequisite: 10,
    byProperty: { 'maha-strategies': 287, 'maha-research': 250, 'agentic-publishing': 84, 'maha-os': 60, 'mayone-maharajan': 42, 'mayon-rajan': 50, 'maha-policy': 178 },
    boundedAnswers: 4755,
    sourceBindings: 1609,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  assert.deepEqual(adapterRegistry.counts, { properties: 7, routes: 941, boundedAnswers: 4705, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(new Set(implementationRegistry.entries.map((entry) => entry.candidateId)).size, 951)
  assert.equal(implementationRegistry.entries.filter((entry) => entry.adoptionState === 'blocked-on-unready-prerequisite').length, 10)
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 6 and cumulative artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t6-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t6-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheSix(root)
      const review = generateFederationTrancheSixReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-6-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all digests verify and private federation evidence remains outside served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-six', 'tranche-6-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ packets, decisions, specifications, adapterRegistry })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})
