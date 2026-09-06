import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheEightReview } from '../scripts/generate-federation-tranche-eight-review.ts'
import { generateTrancheEight } from '../scripts/generate-federation-tranche-eight.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheEight>
type Review = ReturnType<typeof generateFederationTrancheEightReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-8-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-8-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-8-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-8-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-8-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-8-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-8-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 8 freezes exactly candidates 701–800 without moving a prior cohort', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-eight-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    overlapWithPriorTranches: 0,
    dependenciesSatisfiedByPriorTranches: 76,
    byProperty: { 'maha-strategies': 31, 'maha-research': 25, 'agentic-publishing': 10, 'maha-os': 6, 'mayone-maharajan': 5, 'mayon-rajan': 5, 'maha-policy': 18 },
    inspected: 0,
    evidenceReady: 0,
    pageSpecs: 0,
  })
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3, 4, 5, 6, 7].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
})

test('semantic and dependency review preserves 100 distinct, dependency-closed contracts', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct' && entry.reason.length > 60))
  assert.deepEqual(dependencies.counts, { candidates: 100, resolved: 100, unresolved: 0 })
  assert.ok(dependencies.entries.every((entry) => entry.allDependenciesResolved))
  const candidateIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  for (const entry of dependencies.entries) {
    for (const dependency of entry.dependencies) assert.ok(candidateIds.has(dependency.dependsOn) || dependency.resolution === 'prior-tranche')
  }
})

test('ten new packets and fifty-five carried packets preserve source identity, locator, rights, scope, and boundary independently', () => {
  assert.deepEqual(packets.counts, { topics: 65, newTopics: 10, carriedForwardTopics: 55, sources: 105 })
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'new-section-inspection').length, 10)
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'carried-forward-same-version').length, 55)
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
      if (packet.provenance === 'new-section-inspection' && source.url.startsWith('repo:')) {
        assert.equal(existsSync(resolve(ROOT, source.url.slice('repo:'.length))), true, source.url)
      }
    }
  }
})

test('new-topic boundaries refuse the important frame transfers', () => {
  const value = (topicKey: string) => JSON.stringify(packets.packets.find((entry) => entry.topicKey === topicKey))
  assert.match(value('maha-policy:agent-identity'), /does not address machine-to-machine|cannot be assigned to an autonomous agent/i)
  assert.match(value('maha-policy:public-sector-procurement'), /limited to covered U\.S\. federal agencies|not a universal procurement code/i)
  assert.match(value('maha-research:benchmark-design'), /Initial Public Draft|does not establish general intelligence/i)
  assert.match(value('maha-strategies:civilizational-computation'), /authorial metaphor|does not establish that civilization literally computes/i)
  assert.match(value('maha-strategies:narayana'), /one translator.s rendering|not.*identity in every period/i)
  assert.match(value('mayon-rajan:ashfall'), /records no current alert|does not establish a current Mayon ashfall/i)
  assert.match(value('mayon-rajan:deformation'), /one signal does not determine|does not determine whether or when Mayon will erupt/i)
  assert.match(value('mayone-maharajan:mental-sovereignty'), /not a diagnosis, legal status|authority over another person/i)
})

test('all one hundred exact candidates are ready and no candidate receives more than one specification', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 100, revise: 0, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 100, revise: 0, blocked: 0, duplicative: 0, pageSpecifications: 100, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(specifications.specifications.length, 100)
  assert.equal(new Set(specifications.specifications.map((entry) => entry.candidateId)).size, 100)
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), new Set(decisions.entries.map((entry) => entry.candidateId)))
  assert.ok(specifications.specifications.every((entry) => entry.implementationState === 'specification-only' && entry.machineContract.canonicalReleaseRequiredBeforePublication))
})

test('cumulative contracts reach 854 local pages while adapters expose only dependency-ready contracts', () => {
  assert.deepEqual(implementationRegistry.counts, {
    pages: 854,
    readyForOwnerIntegration: 844,
    blockedOnUnreadyPrerequisite: 10,
    byProperty: { 'maha-strategies': 259, 'maha-research': 225, 'agentic-publishing': 74, 'maha-os': 54, 'mayone-maharajan': 37, 'mayon-rajan': 45, 'maha-policy': 160 },
    boundedAnswers: 4270,
    sourceBindings: 1466,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  assert.deepEqual(adapterRegistry.counts, { properties: 7, routes: 844, boundedAnswers: 4220, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(new Set(implementationRegistry.entries.map((entry) => entry.candidateId)).size, 854)
  assert.equal(implementationRegistry.entries.filter((entry) => entry.adoptionState === 'blocked-on-unready-prerequisite').length, 10)
  const trancheIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  assert.equal(implementationRegistry.entries.filter((entry) => trancheIds.has(entry.candidateId) && entry.adoptionState === 'blocked-on-unready-prerequisite').length, 2)
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 8 and cumulative artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t8-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t8-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheEight(root)
      const review = generateFederationTrancheEightReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-8-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('appending Tranche 8 cannot rewrite any earlier page contract', () => {
  const priorRoot = mkdtempSync(join(tmpdir(), 'maha-fed-t7-only-'))
  const fullRoot = mkdtempSync(join(tmpdir(), 'maha-fed-t8-full-'))
  try {
    const prior = generateFederationPageImplementations(priorRoot, 7)
    const full = generateFederationPageImplementations(fullRoot, 8)
    const fullByCandidate = new Map(full.pages.map((page) => [page.candidateId, page]))
    assert.equal(prior.pages.length, 657)
    for (const page of prior.pages) {
      assert.deepEqual(fullByCandidate.get(page.candidateId), page, page.canonicalUrl)
    }
  } finally {
    rmSync(priorRoot, { recursive: true })
    rmSync(fullRoot, { recursive: true })
  }
})

test('all digests verify and private federation evidence stays outside served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-eight', 'tranche-8-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ packets, decisions, specifications, adapterRegistry })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})
