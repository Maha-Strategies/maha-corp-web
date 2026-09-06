import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { createFederationPropertyAdapter, type PropertyManifest } from '../lib/federation-property-adapter.ts'
import { generateFederationContinuation } from '../scripts/generate-federation-continuation.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'
import { generateFederationPropertyAdapters } from '../scripts/generate-federation-property-adapters.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T
const ids = {
  health: 'cand_671d652918d62414c37d751d',
  Claude: ['cand_41ee6b7080d2c8416e30adaf', 'cand_5322e19e5c67b1aae32124b0', 'cand_b0625906e210bafb279b7669', 'cand_c8b98032f22fc91b51dac6be', 'cand_f6409ea20cfc51496e3a61d8'],
  editorialDefinition: 'cand_379d39a7b88f7c76518ba50c',
  commercialHolds: ['cand_35312a8e1744e223d0647e34', 'cand_8ebaeb0d3ab9edaecaa39fcf', 'cand_947cfe53f46c16bf80fb9cae', 'cand_7e491bc22da1ad832898171b', 'cand_c05ceb49a98afde6f4382268'],
}

const continuation = generateFederationContinuation(ROOT)
const implementations = generateFederationPageImplementations(ROOT)
const adapters = generateFederationPropertyAdapters(ROOT)

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? filesUnder(join(path, entry.name)) : [join(path, entry.name)])
}

test('Claude promotions are reviewed append-only and retain their narrower boundaries', () => {
  assert.equal(continuation.remediations.review.counts.ClaudePromotionsReviewed, 5)
  assert.equal(continuation.remediations.review.counts.ClaudePromotionsAccepted, 5)
  const decisions = continuation.remediations.decisionManifest.entries
  for (const id of ids.Claude) {
    const decision = decisions.find((entry) => entry.candidateId === id)!
    assert.equal(decision.disposition, 'evidence-ready')
    assert.ok(decision.supersedesDecisionDigest.startsWith('sha256:'))
    assert.ok(decision.narrowedScope.mayState.length > 0)
    assert.ok(decision.narrowedScope.mayNotState.length > 0)
  }
  const serialized = JSON.stringify(decisions)
  assert.match(serialized, /must stop resolving|payload validation|metadata-only|failure-path behavior/i)
  assert.doesNotMatch(serialized, /guaranteed savings|guaranteed recovery|customer success/i)
})

test('health-data consent is narrowed to an operational permission record and clears all eleven holds', () => {
  const decision = continuation.remediations.decisionManifest.entries.find((entry) => entry.candidateId === ids.health)!
  assert.equal(decision.disposition, 'evidence-ready')
  assert.match(JSON.stringify(decision.narrowedScope), /legal regime/)
  assert.match(JSON.stringify(decision.narrowedScope), /HIPAA authorization/)
  assert.equal(continuation.remediations.review.counts.downstreamMahaOsPagesCleared, 11)
  assert.equal(implementations.pages.filter((entry) => entry.siteId === 'maha-os' && entry.adoption.state === 'blocked-on-unready-prerequisite').length, 0)
  assert.equal(implementations.registry.counts.blockedOnUnreadyPrerequisite, 1)
  assert.equal(implementations.registry.counts.readyForOwnerIntegration, 365)
})

test('candidates 201–300 partition into 92 ready, seven revise and one semantic duplicate', () => {
  assert.deepEqual(continuation.trancheThree.readiness.counts, { candidates: 100, evidenceReady: 92, revise: 7, blocked: 0, duplicative: 1, pageSpecifications: 92, publicRoutesCreated: 0, buildsRun: 0 })
  assert.equal(continuation.trancheThree.decisionManifest.entries.length, 100)
  assert.equal(continuation.trancheThree.specificationManifest.specifications.length, 92)
  assert.equal(continuation.trancheThree.decisionManifest.entries.find((entry) => entry.candidateId === ids.editorialDefinition)!.disposition, 'reject-as-duplicative')
  for (const id of ids.commercialHolds) assert.equal(continuation.trancheThree.decisionManifest.entries.find((entry) => entry.candidateId === id)!.disposition, 'revise')
  assert.equal(new Set(continuation.trancheThree.decisionManifest.entries.map((entry) => entry.candidateId)).size, 100)
})

test('all Tranche 3 dependencies resolve to an evidence-ready candidate or an observed canonical owner', () => {
  const ready = new Set([
    ...readJson<{ entries: Array<{ candidateId: string; disposition: string }> }>('content/federation/federation-tranche-1-decisions-v1.json').entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId),
    ...readJson<{ entries: Array<{ candidateId: string; disposition: string }> }>('content/federation/federation-tranche-2-decisions-v1.json').entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId),
    ...continuation.remediations.decisionManifest.entries.map((entry) => entry.candidateId),
    ...continuation.trancheThree.decisionManifest.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId),
  ])
  const trancheThreeReady = new Set(continuation.trancheThree.decisionManifest.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId))
  for (const entry of continuation.trancheThree.dependencyManifest.entries) {
    assert.equal(entry.allDependenciesResolved, true)
    if (!trancheThreeReady.has(entry.candidateId)) continue
    for (const dependency of entry.dependencies) {
      if (dependency.dependsOn) assert.ok(ready.has(dependency.dependsOn), `${entry.candidateId} depends on non-ready ${dependency.dependsOn}`)
      else assert.equal(dependency.url, 'https://publish.mahastrategies.com/docs/editorial-workflow')
    }
  }
})

test('the combined publication tranche has 366 unique, source-bound implementations', () => {
  assert.deepEqual(implementations.registry.counts.byProperty, { 'maha-strategies': 108, 'maha-research': 100, 'agentic-publishing': 26, 'maha-os': 24, 'mayone-maharajan': 16, 'mayon-rajan': 20, 'maha-policy': 72 })
  assert.equal(implementations.pages.length, 366)
  assert.equal(new Set(implementations.pages.map((entry) => entry.candidateId)).size, 366)
  assert.equal(new Set(implementations.pages.map((entry) => entry.canonicalUrl)).size, 366)
  assert.ok(implementations.pages.every((entry) => entry.sources.length > 0 && entry.boundedAnswers.length === 5))
  assert.equal(implementations.pages.filter((entry) => entry.adoption.state === 'blocked-on-unready-prerequisite').length, 1)
  assert.equal(implementations.registry.counts.publicRoutesCreated, 0)
  assert.equal(implementations.registry.counts.nextBuildsRun, 0)
  assert.equal(implementations.registry.counts.vercelBuildsRun, 0)
})

test('seven property adapters resolve only exact ready paths and never cross hosts', () => {
  assert.deepEqual(adapters.registry.counts, { properties: 7, routes: 365, boundedAnswers: 1825, publicRoutesCreated: 0, buildsRun: 0 })
  for (const contract of adapters.contracts) {
    const manifest = readJson<PropertyManifest>(`content/federation/implementations/${contract.siteId}-pages-v1.json`)
    const adapter = createFederationPropertyAdapter(manifest)
    assert.equal(adapter.count, contract.counts.routes)
    const first = contract.entries[0]!
    assert.equal(adapter.resolve(first.path)?.canonicalUrl, first.canonicalUrl)
    assert.equal(adapter.resolve(`${first.path}-substituted`), null)
    assert.equal(adapter.resolve('https://example.com/not-this-property'), null)
    assert.equal(adapter.metadata(first.path)?.alternates.canonical, first.canonicalUrl)
    assert.equal(adapter.staticParams().length, contract.counts.routes)
  }
})

test('all continuation, implementation and adapter artifacts regenerate byte-identically without a build', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-fed-cont-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-fed-cont-b-'))
  try {
    const a = generateFederationContinuation(first)
    const b = generateFederationContinuation(second)
    const implementationA = generateFederationPageImplementations(first)
    const implementationB = generateFederationPageImplementations(second)
    const adapterA = generateFederationPropertyAdapters(first)
    const adapterB = generateFederationPropertyAdapters(second)
    const pathsA = [...a.artifacts, ...implementationA.artifacts, ...adapterA.paths]
    const pathsB = [...b.artifacts, ...implementationB.artifacts, ...adapterB.paths]
    assert.deepEqual(pathsA, pathsB)
    for (const path of pathsA) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('private review material and federation adapters remain outside served source', () => {
  const served = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))].filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path)).map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-continuation', 'federation-property-adapter', 'readiness-remediation', 'tranche-3-evidence-packets', 'tranche-4-evidence-packets']) assert.doesNotMatch(served, new RegExp(marker))
  const serialized = JSON.stringify({ continuation, adapters })
  assert.doesNotMatch(serialized, /customerData|natalData|credentialValue|secretValue|sourceExcerpt|fullText/)
  for (const shape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /authorization:\s*bearer\s+/i]) assert.doesNotMatch(serialized, shape)
})

test('all generated manifests verify their own digests', () => {
  const paths = [...continuation.artifacts.filter((path) => path.endsWith('.json')), ...implementations.artifacts.filter((path) => path.endsWith('.json')), ...adapters.paths.filter((path) => path.endsWith('.json'))]
  for (const path of paths) {
    const value = readJson<{ provenanceDigest: string }>(path)
    assert.equal(provenanceDigest(value), value.provenanceDigest, path)
  }
})
