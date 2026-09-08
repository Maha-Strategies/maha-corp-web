import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheTenReview } from '../scripts/generate-federation-tranche-ten-review.ts'
import { generateTrancheTen } from '../scripts/generate-federation-tranche-ten.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheTen>
type Review = ReturnType<typeof generateFederationTrancheTenReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-10-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-10-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-10-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-10-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-10-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-10-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-10-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 10 freezes exactly candidates 901–1,000 without moving a prior cohort', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-ten-cohort/1.0')
  assert.deepEqual(cohort.counts, {
    selected: 100,
    overlapWithPriorTranches: 0,
    dependenciesSatisfiedByPriorTranches: 73,
    byProperty: { 'maha-strategies': 31, 'maha-research': 25, 'agentic-publishing': 10, 'maha-os': 6, 'mayone-maharajan': 5, 'mayon-rajan': 5, 'maha-policy': 18 },
    inspected: 0,
    evidenceReady: 0,
    pageSpecs: 0,
  })
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
})

test('semantic and dependency review preserves one hundred distinct, dependency-closed contracts', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct' && entry.reason.length > 60))
  assert.deepEqual(dependencies.counts, { candidates: 100, resolved: 100, unresolved: 0 })
  assert.ok(dependencies.entries.every((entry) => entry.allDependenciesResolved))
  const candidateIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  for (const entry of dependencies.entries) {
    for (const dependency of entry.dependencies) assert.ok(candidateIds.has(dependency.dependsOn) || dependency.resolution === 'prior-tranche')
  }
})

test('twelve fresh or refreshed packets and forty-eight carried packets preserve every evidence axis', () => {
  assert.deepEqual(packets.counts, { topics: 60, newTopics: 12, carriedForwardTopics: 48, sources: 92 })
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'new-section-inspection').length, 12)
  assert.equal(packets.packets.filter((entry) => entry.provenance === 'carried-forward-same-version').length, 48)
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
      if (source.url.startsWith('repo:')) {
        for (const path of source.url.split(';').map((value) => value.trim()).filter(Boolean)) {
          assert.equal(path.startsWith('repo:'), true, source.url)
          assert.equal(existsSync(resolve(ROOT, path.slice('repo:'.length))), true, path)
        }
      }
    }
  }
})

test('fresh packets preserve legal, scientific, literary, operational and authorial boundaries', () => {
  const value = (topicKey: string) => JSON.stringify(packets.packets.find((entry) => entry.topicKey === topicKey))
  assert.match(value('maha-policy:machine-contracting'), /model law is not automatically enacted law|depends on the governing jurisdiction/i)
  assert.match(value('maha-policy:model-evaluation'), /does not.*certify a model|does not.*guarantee deployment performance/i)
  assert.match(value('maha-policy:scientific-evidence-policy'), /executive order is not a statute|may change, be revoked/i)
  assert.match(value('maha-os:data-retention'), /does not choose a retention period|prove deletion/i)
  assert.match(value('maha-strategies:coordinate-frames'), /not astrological meaning|do not validate astrology/i)
  assert.match(value('maha-strategies:primary-text-boundaries'), /named translation|commentary|reception history|theology/i)
  assert.match(value('mayon-rajan:gas-emissions'), /time-sensitive and intentionally not copied|latest PHIVOLCS bulletin/i)
  assert.match(value('mayone-maharajan:maha-principle'), /author’s intended relationships only|does not prove novelty/i)
  assert.match(value('mayone-maharajan:recursive-institutions'), /editorial label, not a settled academic term/i)
})

test('ninety-seven candidates are specified and three unsupported calculation-role transfers remain held', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 97, revise: 3, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 97, revise: 3, blocked: 0, duplicative: 0, pageSpecifications: 97, publicRoutesCreated: 0, buildsRun: 0 })
  assert.deepEqual(decisions.entries.filter((entry) => entry.disposition !== 'evidence-ready').map((entry) => entry.url).sort(), [
    'https://www.mahastrategies.com/clearing/astrology-infrastructure/house-system-selection/calculation',
    'https://www.mahastrategies.com/clearing/astrology-infrastructure/interpretation-boundaries/calculation',
    'https://www.mahastrategies.com/clearing/astrology-infrastructure/tradition-comparison/calculation',
  ])
  assert.ok(decisions.entries.filter((entry) => entry.disposition === 'revise').every((entry) => /recomputable|numerical operation/i.test(entry.reason)))
  assert.equal(specifications.specifications.length, 97)
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId)))
  assert.ok(specifications.specifications.every((entry) => entry.implementationState === 'specification-only' && entry.machineContract.canonicalReleaseRequiredBeforePublication))
})

test('cumulative local contracts reach 951 while exact-host adapters exclude all ten prerequisite holds', () => {
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
  const trancheIds = new Set(cohort.entries.map((entry) => entry.candidateId))
  assert.equal(implementationRegistry.entries.filter((entry) => trancheIds.has(entry.candidateId)).length, 97)
  assert.equal(implementationRegistry.entries.filter((entry) => trancheIds.has(entry.candidateId) && entry.adoptionState === 'blocked-on-unready-prerequisite').length, 0)
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 10 and cumulative artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t10-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t10-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheTen(root)
      const review = generateFederationTrancheTenReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-10-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('appending Tranche 10 cannot rewrite any earlier page contract', () => {
  const priorRoot = mkdtempSync(join(tmpdir(), 'maha-fed-t9-only-'))
  const fullRoot = mkdtempSync(join(tmpdir(), 'maha-fed-t10-full-'))
  try {
    const prior = generateFederationPageImplementations(priorRoot, 9)
    const full = generateFederationPageImplementations(fullRoot, 10)
    const fullByCandidate = new Map(full.pages.map((page) => [page.candidateId, page]))
    assert.equal(prior.pages.length, 854)
    assert.equal(full.pages.length - prior.pages.length, 97)
    assert.deepEqual(full.pages.slice(0, prior.pages.length), prior.pages)
    for (const page of prior.pages) assert.deepEqual(fullByCandidate.get(page.candidateId), page, page.canonicalUrl)
  } finally {
    rmSync(priorRoot, { recursive: true })
    rmSync(fullRoot, { recursive: true })
  }
})

test('all digests verify and private evidence remains outside served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-ten', 'tranche-10-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ packets, decisions, specifications, adapterRegistry })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})
