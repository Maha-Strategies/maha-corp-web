import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheSevenReview } from '../scripts/generate-federation-tranche-seven-review.ts'
import { generateTrancheSeven } from '../scripts/generate-federation-tranche-seven.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheSeven>
type Review = ReturnType<typeof generateFederationTrancheSevenReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-7-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-7-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-7-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-7-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-7-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-7-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-7-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 7 freezes exactly candidates 601–700 without moving a prior cohort', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-seven-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    overlapWithPriorTranches: 0,
    dependenciesSatisfiedByPriorTranches: 68,
    byProperty: { 'maha-strategies': 31, 'maha-research': 25, 'agentic-publishing': 10, 'maha-os': 6, 'mayone-maharajan': 5, 'mayon-rajan': 5, 'maha-policy': 18 },
    inspected: 0,
    evidenceReady: 0,
    pageSpecs: 0,
  })
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3, 4, 5, 6].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
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

test('twenty-three new packets and thirty-five carried packets keep source roles and boundaries explicit', () => {
  assert.deepEqual(packets.counts, { topics: 58, newTopics: 23, carriedForwardTopics: 35, sources: 92 })
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'new-section-inspection').length, 23)
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'carried-forward-same-version').length, 35)
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
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-os:consent-receipts')), /does not prove identity, comprehension, legal validity/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-os:sensor-provenance')), /does not prove sensor accuracy/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-research:container-image')), /does not prove security, provenance, reproducibility/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'maha-strategies:palai')), /passage-level silence/i)
  assert.match(JSON.stringify(packets.packets.find((entry) => entry.topicKey === 'mayon-rajan:eruption-history')), /no current alert|records no alert/i)
})

test('all one hundred exact candidates are ready and no non-ready candidate receives a specification', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 100, revise: 0, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 100, revise: 0, blocked: 0, duplicative: 0, pageSpecifications: 100, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(specifications.specifications.length, 100)
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), new Set(decisions.entries.map((entry) => entry.candidateId)))
  assert.ok(specifications.specifications.every((entry) => entry.implementationState === 'specification-only' && entry.machineContract.canonicalReleaseRequiredBeforePublication))
})

test('cumulative contracts reach 657 local pages while adapters expose only dependency-ready contracts', () => {
  assert.deepEqual(implementationRegistry.counts, {
    pages: 657,
    readyForOwnerIntegration: 650,
    blockedOnUnreadyPrerequisite: 7,
    byProperty: { 'maha-strategies': 197, 'maha-research': 175, 'agentic-publishing': 54, 'maha-os': 42, 'mayone-maharajan': 28, 'mayon-rajan': 35, 'maha-policy': 126 },
    boundedAnswers: 3285,
    sourceBindings: 1133,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  assert.deepEqual(adapterRegistry.counts, { properties: 7, routes: 650, boundedAnswers: 3250, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(new Set(implementationRegistry.entries.map((entry) => entry.candidateId)).size, 657)
  assert.equal(implementationRegistry.entries.filter((entry) => entry.adoptionState === 'blocked-on-unready-prerequisite').length, 7)
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 7 and cumulative artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t7-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t7-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheSeven(root)
      const review = generateFederationTrancheSevenReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-7-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all digests verify and private federation evidence stays outside served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-seven', 'tranche-7-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ packets, decisions, specifications, adapterRegistry })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})
