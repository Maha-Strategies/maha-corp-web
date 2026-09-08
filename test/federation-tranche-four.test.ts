import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'
import { generateFederationTrancheFourReview } from '../scripts/generate-federation-tranche-four-review.ts'
import { generateTrancheFour } from '../scripts/generate-federation-tranche-four.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

type Cohort = ReturnType<typeof generateTrancheFour>
type Review = ReturnType<typeof generateFederationTrancheFourReview>
type Implementations = ReturnType<typeof generateFederationPageImplementations>
type Adapters = ReturnType<typeof generateFederationPropertyAdapters>

const cohort = readJson<Cohort>('content/federation/federation-tranche-4-cohort-v1.json')
const semantic = readJson<Review['semanticManifest']>('content/federation/federation-tranche-4-semantic-validation-v1.json')
const dependencies = readJson<Review['dependencyManifest']>('content/federation/federation-tranche-4-dependency-validation-v1.json')
const packets = readJson<Review['packetManifest']>('content/federation/federation-tranche-4-evidence-packets-v1.json')
const decisions = readJson<Review['decisionManifest']>('content/federation/federation-tranche-4-decisions-v1.json')
const specifications = readJson<Review['specificationManifest']>('content/federation/federation-tranche-4-page-specifications-v1.json')
const readiness = readJson<Review['readiness']>('content/federation/federation-tranche-4-readiness-v1.json')
const implementationRegistry = readJson<Implementations['registry']>('content/federation/implementations/federation-page-implementation-registry-v1.json')
const adapterRegistry = readJson<Adapters['registry']>('content/federation/adapters/federation-property-route-adapter-registry-v1.json')

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Tranche 4 freezes exactly candidates 301–400 without moving the prior three cohorts', () => {
  assert.equal(cohort.schemaVersion, 'maha-federation-tranche-four-cohort/1.0')
  assert.equal(cohort.counts.selected, 100)
  assert.equal(cohort.counts.overlapWithPriorTranches, 0)
  assert.equal(cohort.counts.dependenciesSatisfiedByPriorTranches, 96)
  assert.equal(new Set(cohort.entries.map((entry) => entry.candidateId)).size, 100)
  const priorIds = new Set([1, 2, 3].flatMap((tranche) => readJson<{ entries: Array<{ candidateId: string }> }>(`content/federation/federation-tranche-${tranche}-cohort-v1.json`).entries.map((entry) => entry.candidateId)))
  assert.equal(cohort.entries.filter((entry) => priorIds.has(entry.candidateId)).length, 0)
  const trancheThree = readJson<{ provenanceDigest: string }>('content/federation/federation-tranche-3-cohort-v1.json')
  assert.equal(trancheThree.provenanceDigest, 'sha256:5f432d449530f80f593e5fd4a46208ede855c1deafa3006d055a1424399390ef')
})

test('all one hundred semantic and dependency adjudications remain explicit', () => {
  assert.deepEqual(semantic.counts, { reviewed: 100, retainDistinct: 100, duplicative: 0 })
  assert.equal(semantic.entries.length, 100)
  assert.ok(semantic.entries.every((entry) => entry.disposition === 'retain-distinct' && entry.reason.length > 60))
  assert.deepEqual(dependencies.counts, { candidates: 100, resolved: 100, unresolved: 0 })
  assert.equal(dependencies.entries.length, 100)
  assert.ok(dependencies.entries.every((entry) => entry.allDependenciesResolved))
})

test('fifty-one exact-locator topic packets preserve identity, rights, scope and boundary checks', () => {
  assert.deepEqual(packets.counts, { topics: 51, newTopics: 15, carriedForwardTopics: 36, sources: 84 })
  assert.equal(packets.packets.length, 51)
  for (const packet of packets.packets) {
    assert.equal(packet.sourceIdentityChecked, true)
    assert.equal(packet.locatorChecked, true)
    assert.equal(packet.rightsChecked, true)
    assert.equal(packet.scopeChecked, true)
    assert.equal(packet.boundaryChecked, true)
    assert.ok(packet.reason.length > 30)
    assert.ok(packet.sources.length > 0)
    for (const source of packet.sources) {
      assert.ok(source.sourceId && source.title && source.responsibleBody && source.versionOrDate)
      assert.ok(source.url.startsWith('https://') || source.url.startsWith('repo:'))
      assert.ok(source.locator.length > 5 && source.rightsBasis.length > 20)
      assert.ok(source.scope.length > 20 && source.boundary.length > 20)
    }
  }
  const serialized = JSON.stringify(packets)
  assert.doesNotMatch(serialized, /Alert Level\s+[0-9]|current numerical value\s*[:=]\s*[0-9]/i)
  assert.doesNotMatch(serialized, /sourceExcerpt|fullText|credentialValue|secretValue|customerData|natalData/)
})

test('the review partitions 93 ready and seven held without manufacturing commercial evidence', () => {
  assert.deepEqual(decisions.counts, { evidenceReady: 93, revise: 7, blocked: 0, duplicative: 0 })
  assert.deepEqual(readiness.counts, { candidates: 100, evidenceReady: 93, revise: 7, blocked: 0, duplicative: 0, pageSpecifications: 93, publicRoutesCreated: 0, buildsRun: 0 })
  const held = decisions.entries.filter((entry) => entry.disposition !== 'evidence-ready')
  assert.equal(held.length, 7)
  assert.equal(held.filter((entry) => entry.routeRole === 'commercialization').length, 5)
  assert.deepEqual(held.filter((entry) => entry.routeRole !== 'commercialization').map((entry) => `${entry.siteId}:${entry.topic}:${entry.routeRole}`).sort(), [
    'agentic-publishing:agentic-query-letter:policy',
    'mayone-maharajan:public-reason:limits',
  ])
  assert.ok(held.filter((entry) => entry.routeRole === 'commercialization').every((entry) => /does not establish.*offered, priced, deliverable, or validated/.test(entry.reason)))
  const readyIds = new Set(decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  assert.equal(specifications.specifications.length, 93)
  assert.deepEqual(new Set(specifications.specifications.map((entry) => entry.candidateId)), readyIds)
})

test('cumulative local implementation and owner adapters remain unreleased and preserve every genuine dependency hold', () => {
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
  const blocked = implementationRegistry.entries.filter((entry) => entry.adoptionState === 'blocked-on-unready-prerequisite')
  assert.deepEqual(blocked.map((entry) => entry.canonicalUrl).sort(), [
    'https://publish.mahastrategies.com/agentic-publishing/editorial-review/failure-mode',
    'https://publish.mahastrategies.com/agentic-publishing/editorial-review/governance',
    'https://publish.mahastrategies.com/agentic-publishing/editorial-review/machine-interface',
    'https://publish.mahastrategies.com/agentic-publishing/editorial-review/policy',
    'https://publish.mahastrategies.com/agentic-publishing/editorial-review/workflow',
    'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/failure-mode',
    'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/governance',
    'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/machine-interface',
    'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/policy',
    'https://publish.mahastrategies.com/agentic-publishing/machine-readable-article/workflow',
  ])
  assert.deepEqual(adapterRegistry.counts, { properties: 7, routes: 941, boundedAnswers: 4705, publicRoutesCreated: 0, buildsRun: 0 })
  assert.match(adapterRegistry.buildBoundary, /No Next\.js or Vercel build is authorized/)
})

test('Tranche 4 and cumulative local artifacts regenerate byte-identically without any build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-t4-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-t4-b-'))
  try {
    const runs = [first, second].map((root) => {
      const frozen = generateTrancheFour(root)
      const review = generateFederationTrancheFourReview(root)
      const implementations = generateFederationPageImplementations(root)
      const adapters = generateFederationPropertyAdapters(root)
      return { frozen, paths: ['content/federation/federation-tranche-4-cohort-v1.json', ...review.artifacts, ...implementations.artifacts, ...adapters.paths] }
    })
    assert.equal(runs[0]!.frozen.provenanceDigest, runs[1]!.frozen.provenanceDigest)
    assert.deepEqual(runs[0]!.paths, runs[1]!.paths)
    for (const path of runs[0]!.paths) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('all generated digests verify and private governance artifacts remain outside served source', () => {
  for (const artifact of [cohort, semantic, dependencies, packets, decisions, specifications, readiness, implementationRegistry, adapterRegistry]) {
    assert.equal(provenanceDigest(artifact), artifact.provenanceDigest)
  }
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-tranche-four', 'tranche-4-evidence-packets', 'federation/implementations', 'federation-property-route-adapter']) assert.doesNotMatch(served, new RegExp(marker))
})
