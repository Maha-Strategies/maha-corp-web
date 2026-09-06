import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheFiveReview } from '../scripts/generate-federation-tranche-five-review.ts'
import { generateTrancheFive } from '../scripts/generate-federation-tranche-five.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheFive>
type Review = ReturnType<typeof generateFederationTrancheFiveReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-5-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-5-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-5-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-5-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-5-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-5-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-5-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 5 freezes exactly candidates 401–500 without moving any prior cohort', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-five-cohort/1.0')
  assert.equal(cohort.counts.selected, 100)
  assert.equal(cohort.counts.overlapWithPriorTranches, 0)
  assert.equal(cohort.counts.dependenciesSatisfiedByPriorTranches, 94)
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3, 4].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
})

test('all semantic and dependency decisions remain explicit and role-specific', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct' && entry.reason.length > 60))
  assert.deepEqual(dependencies.counts, { candidates: 100, resolved: 100, unresolved: 0 })
  assert.ok(dependencies.entries.every((entry) => entry.allDependenciesResolved))
  const rolesByTopic = new Map<string, Set<string>>()
  for (const entry of cohort.entries) {
    const key = `${entry.siteId}:${entry.topic}`
    if (!rolesByTopic.has(key)) rolesByTopic.set(key, new Set())
    rolesByTopic.get(key)!.add(entry.routeRole)
  }
  assert.ok([...rolesByTopic.values()].every((roles) => roles.size === [...roles].length))
})

test('thirteen new packets and forty-two carried packets preserve all six evidence boundaries', () => {
  assert.deepEqual(packets.counts, { topics: 55, newTopics: 13, carriedForwardTopics: 42, sources: 89 })
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'new-section-inspection').length, 13)
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
  const metadataPacket = packets.packets.find((entry) => entry.topicKey === 'maha-research:metadata-only-evidence')!
  assert.match(JSON.stringify(metadataPacket), /does not mean the content was inspected/i)
  const seedPacket = packets.packets.find((entry) => entry.topicKey === 'maha-research:random-seed')!
  assert.match(JSON.stringify(seedPacket), /seed alone is insufficient/i)
  const authorPacket = packets.packets.find((entry) => entry.topicKey === 'mayone-maharajan:authorial-lineage')!
  assert.match(JSON.stringify(authorPacket), /not prove.*priority|not.*originality/i)
})

test('ninety-three candidates are ready and seven remain held without invented commercial evidence', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 93, revise: 7, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 93, revise: 7, blocked: 0, duplicative: 0, pageSpecifications: 93, publicRoutesCreated: 0, buildsRun: 0 })
  const held = decisions.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  assert.equal(held.filter((entry) => entry.routeRole === 'commercialization').length, 4)
  assert.deepEqual(held.filter((entry) => entry.routeRole !== 'commercialization').map((entry) => `${entry.siteId}:${entry.topic}:${entry.routeRole}`).sort(), [
    'agentic-publishing:agentic-query-letter:workflow',
    'mayone-maharajan:public-reason:critique',
    'mayone-maharajan:public-reason:origin',
  ])
  assert.ok(held.filter((entry) => entry.routeRole === 'commercialization').every((entry) => /does not establish.*offered, priced, deliverable, or validated/.test(entry.reason)))
  const readyIds = new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), readyIds)
})

test('cumulative page implementations and exact-host adapters add only the ready Tranche 5 contracts', () => {
  assert.deepEqual(implementationRegistry.counts, {
    pages: 459,
    readyForOwnerIntegration: 456,
    blockedOnUnreadyPrerequisite: 3,
    byProperty: { 'maha-strategies': 135, 'maha-research': 125, 'agentic-publishing': 35, 'maha-os': 30, 'mayone-maharajan': 19, 'mayon-rajan': 25, 'maha-policy': 90 },
    boundedAnswers: 2295,
    sourceBindings: 806,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  assert.deepEqual(adapterRegistry.counts, { properties: 7, routes: 456, boundedAnswers: 2280, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(new Set(implementationRegistry.entries.map((entry) => entry.candidateId)).size, 459)
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 5 and cumulative artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t5-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t5-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheFive(root)
      const review = generateFederationTrancheFiveReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-5-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all digests verify and no private federation material enters served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-five', 'tranche-5-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ packets, decisions, specifications, adapterRegistry })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})
