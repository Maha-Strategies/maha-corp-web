import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import manifest from '../content/federation/implementations/maha-policy-pages-v2.json' with { type: 'json' }
import { federationHostAllowsPath } from '../lib/federation-host-routing.ts'
import {
  POLICY_COMMERCIAL_LINKS,
  POLICY_DISCOVERY_GROUPS,
  POLICY_FEDERATION_LINKS,
  POLICY_PAGES,
  POLICY_SITE_URL,
  POLICY_TOPICS,
  policyFrontDoorSitemapRows,
  policyPagesForDiscovery,
} from '../lib/policy-front-door.ts'

const root = resolve(import.meta.dirname, '..')

test('the front door wraps exactly 300 unchanged canonical Policy articles', () => {
  assert.equal(POLICY_PAGES.length, 300)
  assert.equal(manifest.pages.length, 300)
  assert.deepEqual(POLICY_PAGES.map((page) => page.canonicalUrl).sort(), manifest.pages.map((page) => page.canonicalUrl).sort())
  for (const page of POLICY_PAGES) {
    assert.equal(page.canonicalHost, 'policy.mahastrategies.com')
    assert.equal(page.canonicalUrl, `${POLICY_SITE_URL}${page.path}`)
  }
})

test('seven discovery indexes classify pages by route role without transferring authority', () => {
  assert.equal(POLICY_DISCOVERY_GROUPS.length, 7)
  for (const group of POLICY_DISCOVERY_GROUPS) {
    const pages = policyPagesForDiscovery(group.slug)
    assert.ok(pages.length > 0, group.slug)
    const roles = new Set<string>(group.roles)
    for (const page of pages) assert.ok(roles.has(page.path.split('/').at(-1) ?? ''), `${group.slug}:${page.path}`)
  }
  assert.equal(policyPagesForDiscovery('unknown').length, 0)
})

test('priority topics and federation links resolve to explicit properties', () => {
  assert.equal(POLICY_TOPICS.length, 8)
  const knownUrls = new Set(POLICY_PAGES.map((page) => page.canonicalUrl))
  for (const topic of POLICY_TOPICS) assert.ok(knownUrls.has(`${POLICY_SITE_URL}/policy/${topic.slug}/definition`), topic.slug)
  assert.deepEqual(POLICY_FEDERATION_LINKS.map((link) => new URL(link.href).hostname).sort(), ['publish.mahastrategies.com', 'research.mahastrategies.com', 'www.maha-os.com'])
  assert.equal(POLICY_COMMERCIAL_LINKS.every((link) => new URL(link.href).hostname === 'www.mahastrategies.com'), true)
})

test('Policy discovery paths are isolated to the canonical host', () => {
  for (const group of POLICY_DISCOVERY_GROUPS) {
    const path = `/discover/${group.slug}`
    assert.equal(federationHostAllowsPath('policy.mahastrategies.com', path), true)
    assert.equal(federationHostAllowsPath('www.mahastrategies.com', path), false)
    assert.equal(federationHostAllowsPath('research.mahastrategies.com', path), false)
  }
})

test('the Policy sitemap adds one front door and seven discovery indexes', () => {
  const rows = policyFrontDoorSitemapRows()
  assert.equal(rows.length, 8)
  assert.equal(rows[0]?.url, POLICY_SITE_URL)
  assert.equal(new Set(rows.map((row) => row.url)).size, 8)
  assert.equal(rows.every((row) => new URL(row.url).hostname === 'policy.mahastrategies.com'), true)
})

test('host routing, metadata, and Policy chrome are explicit and private artifacts stay absent', () => {
  const paths = [
    'next.config.ts',
    'proxy.ts',
    'components/policy/PolicyFrontDoor.tsx',
    'components/policy/PolicyDiscoveryPage.tsx',
    'components/Navbar.tsx',
    'components/SiteFooter.tsx',
    'components/federation/FederationReleasedPage.tsx',
  ]
  const source = paths.map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n')
  assert.match(source, /policy\.mahastrategies\.com/)
  assert.match(source, /Maha Policy/)
  assert.match(source, /CollectionPage/)
  assert.match(source, /Not legal advice|not legal advice/)
  assert.match(source, /policyFrontDoorMetadata/)
  assert.match(source, /policyPreviewInspection/)
  for (const forbidden of ['reviewerIdentity', 'customerSubmission', 'credentialValue', 'sourceExcerpt', 'fullText', 'audit corpus']) assert.doesNotMatch(source, new RegExp(forbidden, 'i'), forbidden)
})
