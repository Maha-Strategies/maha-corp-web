import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const root = resolve(import.meta.dirname, '..')
const f = resolve(root, 'content/federation/implementations')
const read = (name: string) => JSON.parse(readFileSync(resolve(f, name), 'utf8'))
const registryName = 'federation-page-implementation-registry-v2.json'
const propertyNames = ['agentic-publishing', 'maha-os', 'maha-policy', 'maha-research', 'maha-strategies', 'mayon-rajan', 'mayone-maharajan'].map((site) => `${site}-pages-v2.json`)

test('implements all 1,628 candidate routes across seven property handoffs', () => {
  const registry = read(registryName)
  assert.deepEqual(registry.counts.byProperty, { 'maha-strategies': 660, 'maha-research': 369, 'maha-policy': 300, 'agentic-publishing': 108, 'mayone-maharajan': 71, 'maha-os': 66, 'mayon-rajan': 54 })
  assert.equal(registry.counts.pages, 1628)
  assert.equal(registry.counts.readyForOwnerIntegration, 1628)
  assert.equal(registry.counts.blocked, 0)
  assert.equal(registry.counts.boundedAnswers, 8140)
  assert.equal(registry.manifests.length, 7)
})

test('every page is substantial, source-bound, canonical, and not public', () => {
  const pages = propertyNames.flatMap((name) => read(name).pages)
  assert.equal(pages.length, 1628)
  assert.equal(new Set(pages.map((page: { candidateId: string }) => page.candidateId)).size, 1628)
  assert.equal(new Set(pages.map((page: { canonicalUrl: string }) => page.canonicalUrl)).size, 1628)
  for (const page of pages) {
    assert.ok(page.directAnswer.length >= 80, page.canonicalUrl)
    assert.ok(page.sections.length >= 6, page.canonicalUrl)
    assert.equal(page.sources.length >= 1, true, page.canonicalUrl)
    assert.equal(page.boundedAnswers.length, 5, page.canonicalUrl)
    assert.equal(page.structuredData['@type'], 'TechArticle')
    assert.equal(page.structuredData.url, page.canonicalUrl)
    assert.deepEqual(page.adoption, { state: 'ready-for-owner-integration', blockedDependencies: [], routeFileCreated: false, exactRevisionReviewed: true, canonicallyReleased: false, crawlable: false })
    const { contentDigest, ...pageBody } = page
    assert.equal(contentDigest, digest(pageBody), page.canonicalUrl)
  }
})

test('source bindings retain locator, scope, boundary, and rights', () => {
  for (const name of propertyNames) for (const page of read(name).pages) for (const source of page.sources) {
    assert.ok(source.title)
    assert.ok(source.locator)
    assert.ok(source.establishes)
    assert.ok(source.doesNotEstablish)
    assert.ok(source.rightsBasis)
  }
})

test('manifests and pages verify and regenerate byte-identically', () => {
  const names = [registryName, ...propertyNames]
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-page-implementations-v2.ts'], { cwd: root })
  const before = names.map((name) => readFileSync(resolve(f, name), 'utf8'))
  for (const name of names) {
    const value = read(name)
    const { provenanceDigest, ...body } = value
    assert.equal(provenanceDigest, digest(body), name)
  }
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-page-implementations-v2.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(f, name), 'utf8')), before)
})

test('public and private boundaries remain closed before owner integration', () => {
  const registry = read(registryName)
  assert.equal(registry.counts.publicRoutesCreated, 0)
  assert.equal(registry.counts.nextBuildsRun, 0)
  assert.equal(registry.counts.vercelBuildsRun, 0)
  for (const name of [registryName, ...propertyNames]) {
    const serialized = readFileSync(resolve(f, name), 'utf8')
    for (const forbidden of ['passageText', 'fullText', 'sourceExcerpt', 'credentialValue', 'customerSubmission', 'reviewerIdentity', '/private/']) assert.equal(serialized.includes(forbidden), false, `${name}:${forbidden}`)
  }
})
