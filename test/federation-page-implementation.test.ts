import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { provenanceDigest } from '../lib/evidence-dossier/digest.ts'
import { compileFederationPages } from '../lib/federation-page-implementation.ts'
import { SITE_CONTRACTS } from '../lib/federation-4000-plan.ts'
import { generateFederationPageImplementations } from '../scripts/generate-federation-page-implementations.ts'

const ROOT = resolve(import.meta.dirname, '..')
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T

function inputs(): Parameters<typeof compileFederationPages>[0] {
  type Input = Parameters<typeof compileFederationPages>[0]
  return {
    candidateMap: readJson<Input['candidateMap']>('content/federation/federation-route-candidates-v1.json'),
    tranches: [1, 2].map((tranche) => ({
      tranche: tranche as 1 | 2,
      decisions: readJson<Input['tranches'][number]['decisions']>(`content/federation/federation-tranche-${tranche}-decisions-v1.json`),
      specifications: readJson<Input['tranches'][number]['specifications']>(`content/federation/federation-tranche-${tranche}-page-specifications-v1.json`),
      packets: readJson<Input['tranches'][number]['packets']>(`content/federation/federation-tranche-${tranche}-evidence-packets-v1.json`),
    })),
  }
}

const sourceInputs = inputs()
const generated = compileFederationPages(sourceInputs)

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name)
    return entry.isDirectory() ? filesUnder(target) : [target]
  })
}

test('all source manifests verify before the 175 implementations are composed', () => {
  assert.equal(provenanceDigest(sourceInputs.candidateMap), sourceInputs.candidateMap.provenanceDigest)
  for (const tranche of sourceInputs.tranches) {
    assert.equal(provenanceDigest(tranche.decisions), tranche.decisions.provenanceDigest)
    assert.equal(provenanceDigest(tranche.specifications), tranche.specifications.provenanceDigest)
    assert.equal(provenanceDigest(tranche.packets), tranche.packets.provenanceDigest)
  }
  assert.equal(generated.pages.length, 175)
  assert.equal(new Set(generated.pages.map((entry) => entry.candidateId)).size, 175)
  assert.equal(new Set(generated.pages.map((entry) => entry.canonicalUrl)).size, 175)
})

test('every implementation corresponds exactly to an evidence-ready decision and specification', () => {
  const ready = new Set(sourceInputs.tranches.flatMap((tranche) => tranche.decisions.entries.filter((entry) => entry.disposition === 'evidence-ready').map((entry) => entry.candidateId)))
  const specified = new Set(sourceInputs.tranches.flatMap((tranche) => tranche.specifications.specifications.map((entry) => entry.candidateId)))
  const implemented = new Set(generated.pages.map((entry) => entry.candidateId))
  assert.deepEqual([...implemented].sort(), [...ready].sort())
  assert.deepEqual([...implemented].sort(), [...specified].sort())
  assert.equal(sourceInputs.tranches.flatMap((tranche) => tranche.decisions.entries).filter((entry) => entry.disposition !== 'evidence-ready' && implemented.has(entry.candidateId)).length, 0)
})

test('host-specific manifests partition all implementations without duplication', () => {
  assert.deepEqual(generated.registry.counts.byProperty, {
    'maha-strategies': 54,
    'maha-research': 50,
    'agentic-publishing': 6,
    'maha-os': 11,
    'mayone-maharajan': 8,
    'mayon-rajan': 10,
    'maha-policy': 36,
  })
  assert.equal(generated.propertyManifests.length, 7)
  assert.equal(generated.propertyManifests.reduce((sum, entry) => sum + entry.pages.length, 0), 175)
  const allIds = generated.propertyManifests.flatMap((entry) => entry.pages.map((page) => page.candidateId))
  assert.equal(new Set(allIds).size, 175)
  for (const manifest of generated.propertyManifests) {
    const contract = SITE_CONTRACTS.find((entry) => entry.siteId === manifest.siteId)!
    assert.equal(manifest.canonicalHost, contract.canonicalHost)
    assert.ok(manifest.pages.every((page) => new URL(page.canonicalUrl).host === contract.canonicalHost))
    assert.equal(provenanceDigest(manifest), manifest.provenanceDigest)
  }
})

test('each page contains substantial bounded content rather than a route shell', () => {
  for (const page of generated.pages) {
    assert.equal(page.sections.length, 6, page.canonicalUrl)
    assert.equal(page.qualityDimensions.length, 8, page.canonicalUrl)
    assert.equal(page.boundedAnswers.length, 5, page.canonicalUrl)
    assert.ok(page.directAnswer.length > 160, page.canonicalUrl)
    assert.ok(page.sections.every((section) => section.paragraphs.length > 0), page.canonicalUrl)
    assert.ok(page.sections.find((section) => section.kind === 'role-method')!.paragraphs.length >= 3, page.canonicalUrl)
    assert.ok(page.sources.length > 0, page.canonicalUrl)
    assert.ok(page.sources.every((source) => source.locator.length > 5 && source.establishes.length > 20 && source.doesNotEstablish.length > 20), page.canonicalUrl)
    assert.ok(page.relatedLinks.length > 0, page.canonicalUrl)
    assert.equal(page.structuredData['@type'], 'TechArticle')
    assert.equal(page.structuredData.url, page.canonicalUrl)
    assert.equal(page.structuredData.mainEntity.length, 5)
    assert.equal(page.sourcePolicy.unsupportedValuesRemainUnknown, true)
    assert.equal('wordCount' in page, false)
  }
})

test('role-specific content and page content digests remain distinct', () => {
  assert.equal(new Set(generated.pages.map((entry) => entry.directAnswer)).size, 175)
  assert.equal(new Set(generated.pages.map((entry) => entry.contentDigest)).size, 175)
  for (const page of generated.pages) {
    const body = structuredClone(page)
    delete (body as Partial<typeof page>).contentDigest
    assert.equal(provenanceDigest(body), page.contentDigest, page.canonicalUrl)
    assert.ok(page.sections[1]!.heading !== 'Role-specific answer', page.canonicalUrl)
  }
})

test('the adoption gate preserves the unready Maha OS family prerequisite', () => {
  assert.deepEqual(generated.registry.counts, {
    pages: 175,
    readyForOwnerIntegration: 164,
    blockedOnUnreadyPrerequisite: 11,
    byProperty: {
      'maha-strategies': 54,
      'maha-research': 50,
      'agentic-publishing': 6,
      'maha-os': 11,
      'mayone-maharajan': 8,
      'mayon-rajan': 10,
      'maha-policy': 36,
    },
    boundedAnswers: 875,
    sourceBindings: 309,
    publicRoutesCreated: 0,
    nextBuildsRun: 0,
    vercelBuildsRun: 0,
  })
  const held = generated.pages.filter((entry) => entry.adoption.state === 'blocked-on-unready-prerequisite')
  assert.equal(held.length, 11)
  assert.ok(held.every((entry) => entry.siteId === 'maha-os'))
  assert.ok(held.every((entry) => entry.adoption.blockedDependencies.length === 1))
  assert.ok(held.every((entry) => entry.adoption.blockedDependencies[0]!.candidateId === 'cand_671d652918d62414c37d751d'))
  assert.ok(held.every((entry) => entry.relatedLinks.every((link) => link.candidateId !== 'cand_671d652918d62414c37d751d')))
})

test('every rendered dependency link is either implemented here or observed existing', () => {
  const implemented = new Set(generated.pages.map((entry) => entry.canonicalUrl))
  for (const page of generated.pages) {
    for (const link of page.relatedLinks) {
      assert.ok(link.availability !== 'unready-candidate', `${page.canonicalUrl} exposes unready ${link.url}`)
      if (link.availability === 'implemented-in-this-batch') assert.ok(implemented.has(link.url), `${page.canonicalUrl} links missing ${link.url}`)
      assert.match(link.url, /^https:\/\//)
    }
  }
})

test('release and crawlability remain false for every local implementation', () => {
  for (const page of generated.pages) {
    assert.equal(page.adoption.routeFileCreated, false)
    assert.equal(page.adoption.exactRevisionReviewed, false)
    assert.equal(page.adoption.canonicallyReleased, false)
    assert.equal(page.adoption.crawlable, false)
  }
  assert.equal(generated.registry.status, 'local-unreleased')
  assert.match(generated.registry.releaseBoundary, /No route exists/)
  assert.equal(provenanceDigest(generated.registry), generated.registry.provenanceDigest)
})

test('public-safe implementation records expose no repository path or retained source text', () => {
  const serialized = JSON.stringify(generated.propertyManifests)
  assert.doesNotMatch(serialized, /"url":"repo:/)
  assert.doesNotMatch(serialized, /privatePassageText|passageText|sourceExcerpt|fullText|submittedClaim|customerData|natalData|credentialValue|secretValue/)
  for (const secretShape of [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/, /\bgh[oprsu]_[A-Za-z0-9_]{20,}\b/, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/, /authorization:\s*bearer\s+[A-Za-z0-9._-]{12,}/i]) assert.doesNotMatch(serialized, secretShape)
})

test('generation is byte-identical in two independent directories', () => {
  const first = mkdtempSync(join(tmpdir(), 'maha-federation-pages-a-'))
  const second = mkdtempSync(join(tmpdir(), 'maha-federation-pages-b-'))
  try {
    const a = generateFederationPageImplementations(first)
    const b = generateFederationPageImplementations(second)
    assert.deepEqual(a.artifacts, b.artifacts)
    for (const path of a.artifacts) assert.equal(readFileSync(resolve(first, path), 'utf8'), readFileSync(resolve(second, path), 'utf8'), path)
  } finally {
    rmSync(first, { recursive: true })
    rmSync(second, { recursive: true })
  }
})

test('no main-app route or component imports the unreleased implementation artifacts', () => {
  const servedSource = [...filesUnder(resolve(ROOT, 'app')), ...filesUnder(resolve(ROOT, 'components'))]
    .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    .map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const marker of ['federation-page-implementation', 'federation-page-implementation-registry', 'federation/implementations']) assert.doesNotMatch(servedSource, new RegExp(marker))
})
