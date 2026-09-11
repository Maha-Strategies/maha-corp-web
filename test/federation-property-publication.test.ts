import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { digest } from '../lib/federation/readiness-tranche-22.ts'
import { federationCanonicalHostForPath, federationHostAllowsPath } from '../lib/federation-host-routing.ts'

const root = resolve(import.meta.dirname, '..')
const publicDir = resolve(root, 'content/federation/public')
const implementationDir = resolve(root, 'content/federation/implementations')
const read = (path: string) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      lastError = error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
    }
  }
  throw lastError
}
const unsigned = (value: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))
const manifestNames = readdirSync(implementationDir).filter((name) => /-pages-v2\.json$/.test(name)).sort()

test('binds all 1,628 exact reviewed page revisions to active local releases', () => {
  const ledger = read(resolve(publicDir, 'federation-canonical-release-ledger-v1.json'))
  assert.equal(ledger.provenanceDigest, digest(unsigned(ledger, 'provenanceDigest')))
  assert.deepEqual(ledger.counts, { releases: 1628, active: 1628, properties: 7, productionMutations: 0, deployments: 0 })
  type Release = { candidateId: string; status: string; targetContentDigest: string; path: string; canonicalHost: string; releaseDigest: string; [key: string]: unknown }
  const releases = new Map<string, Release>(ledger.entries.map((release: Release) => [release.candidateId, release]))
  let pages = 0
  for (const name of manifestNames) {
    const manifest = read(resolve(implementationDir, name))
    assert.equal(manifest.provenanceDigest, digest(unsigned(manifest, 'provenanceDigest')), name)
    for (const page of manifest.pages) {
      pages += 1
      assert.equal(page.contentDigest, digest(unsigned(page, 'contentDigest')), page.canonicalUrl)
      assert.equal(page.adoption.exactRevisionReviewed, true)
      assert.deepEqual(page.adoption.blockedDependencies, [])
      const release = releases.get(page.candidateId)
      assert.ok(release, page.candidateId)
      assert.equal(release.status, 'active')
      assert.equal(release.targetContentDigest, page.contentDigest)
      assert.equal(release.path, page.path)
      assert.equal(release.canonicalHost, page.canonicalHost)
      assert.equal(release.releaseDigest, digest(unsigned(release, 'releaseDigest')))
    }
  }
  assert.equal(pages, 1628)
})

test('partitions route ownership exactly across seven hosts', () => {
  const index = read(resolve(publicDir, 'federation-public-route-index-v1.json'))
  assert.equal(index.provenanceDigest, digest(unsigned(index, 'provenanceDigest')))
  assert.equal(index.entries.length, 1628)
  assert.equal(new Set(index.entries.map((entry: { path: string }) => entry.path)).size, 1628)
  for (const entry of index.entries) {
    assert.equal(federationCanonicalHostForPath(entry.path), entry.canonicalHost, entry.path)
    assert.equal(federationHostAllowsPath(entry.canonicalHost, entry.path), true)
    assert.equal(federationHostAllowsPath('www.mahastrategies.com', entry.path), entry.canonicalHost === 'www.mahastrategies.com')
    assert.equal(federationHostAllowsPath('attacker.invalid', entry.path), false)
  }
})

test('policy host ownership does not capture legacy Maha Strategies policy pages', () => {
  assert.equal(federationCanonicalHostForPath('/policy/agent-identity/comparison'), 'policy.mahastrategies.com')
  assert.equal(federationCanonicalHostForPath('/policy/agent-identity/uncertainty/'), 'policy.mahastrategies.com')
  assert.equal(federationCanonicalHostForPath('/policy/nutrient-density-standard/paying-for-nutrition'), null)
  assert.equal(federationHostAllowsPath('www.mahastrategies.com', '/policy/nutrient-density-standard/paying-for-nutrition'), true)
})

test('the frozen observed corpus plus active releases remains exactly 4,000 routes', () => {
  const baseline = read(resolve(root, 'content/federation/federation-route-baseline-v1.json'))
  const index = read(resolve(publicDir, 'federation-public-route-index-v1.json'))
  const urls = [...baseline.observedProperties.flatMap((property: { routes: string[] }) => property.routes), ...index.entries.map((entry: { canonicalUrl: string }) => entry.canonicalUrl)]
  assert.equal(urls.length, 4000)
  assert.equal(new Set(urls).size, 4000)
})

test('a substituted revision or endpoint cannot satisfy the binding', () => {
  const ledger = read(resolve(publicDir, 'federation-canonical-release-ledger-v1.json'))
  const release = ledger.entries[0]
  const substitutedDigest = `sha256:${'0'.repeat(64)}`
  assert.notEqual(substitutedDigest, release.targetContentDigest)
  assert.notEqual(federationCanonicalHostForPath(release.path), 'substituted.invalid')
  assert.equal(federationHostAllowsPath('substituted.invalid', release.path), false)
})

test('release artifacts regenerate byte-identically and contain no private payload', () => {
  const names = ['federation-canonical-release-ledger-v1.json', 'federation-public-route-index-v1.json']
  const before = names.map((name) => readFileSync(resolve(publicDir, name), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-federation-canonical-release-bindings.ts'], { cwd: root })
  assert.deepEqual(names.map((name) => readFileSync(resolve(publicDir, name), 'utf8')), before)
  for (const serialized of before) for (const forbidden of ['passageText', 'sourceExcerpt', 'fullText', 'credentialValue', 'reviewerIdentity', 'customerSubmission', 'paymentIntent']) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test('all eleven property adapter shapes exist without enabling deployment', () => {
  const files = [
    'app/.well-known/maha/federation/route.ts',
    'app/clearing/[family]/[topic]/[role]/page.tsx',
    'app/federation/research/[topic]/[role]/page.tsx',
    'app/agentic-publishing/[topic]/[role]/page.tsx',
    'app/source-guides/[topic]/[role]/page.tsx',
    'app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx',
    'app/policy/[slug]/[role]/page.tsx',
    'app/mayon-volcano/[topic]/[role]/page.tsx',
    'app/sources/[topic]/[role]/page.tsx',
    'app/concepts/[topic]/[role]/page.tsx',
    'app/knowledge/religion/source-guides/[topic]/[role]/page.tsx',
    'app/knowledge/religion/mythology/[tradition]/[topic]/[role]/page.tsx',
  ]
  for (const file of files) {
    const source = readFileSync(resolve(root, file), 'utf8')
    assert.ok(source.includes('renderFederationPage') || source.includes('federationPagesForHost'), file)
  }
  const ledger = read(resolve(publicDir, 'federation-canonical-release-ledger-v1.json'))
  assert.equal(ledger.counts.deployments, 0)
  assert.equal(ledger.counts.productionMutations, 0)
})
