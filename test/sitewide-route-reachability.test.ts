import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const baseline = JSON.parse(read('content/federation/federation-route-baseline-v1.json'))
const released = JSON.parse(read('content/federation/public/federation-public-route-index-v1.json'))
const implementation = JSON.parse(read('content/federation/implementations/maha-strategies-pages-v2.json'))
const mythology = implementation.pages.filter((page: { path: string }) => page.path.startsWith('/knowledge/religion/mythology/'))

test('the signed federation inventory contains exactly 4,000 unique canonical routes', () => {
  const urls = new Set(baseline.observedProperties.flatMap((property: { routes: string[] }) => property.routes))
  for (const entry of released.entries) urls.add(entry.canonicalUrl)
  assert.equal(urls.size, 4_000)
})

test('the homepage links the complete directory and the directory emits every federation property', () => {
  assert.match(read('app/page.tsx'), /href="\/directory"/)
  assert.match(read('components/SiteFooter.tsx'), /href: '\/directory'/)
  assert.match(read('app/directory/page.tsx'), /siteDirectoryProperties\(\)/)
  assert.match(read('lib/site-directory.ts'), /routeCount !== 4_000/)
})

test('knowledge and religion both link the mythology hub', () => {
  for (const path of ['app/knowledge/page.tsx', 'app/knowledge/religion/page.tsx']) {
    assert.match(read(path), /MYTHOLOGY_PATH/)
  }
})

test('all released mythology articles are grouped under tradition hubs without changing their URLs', () => {
  assert.equal(mythology.length, 85)
  assert.equal(new Set(mythology.map((page: { path: string }) => page.path)).size, 85)
  assert.match(read('app/knowledge/religion/mythology/[tradition]/page.tsx'), /subject\.pages\.map/)
  assert.match(read('components/federation/FederationReleasedPage.tsx'), /mythologySubjectSiblings/)
})

test('each Greek and Roman subject links its complete three-article set', () => {
  const pages = mythology.filter((page: { path: string }) => page.path.includes('/greek-roman/'))
  const groups = Map.groupBy(pages, (page: { path: string }) => page.path.split('/')[5])
  assert.equal(groups.size, 12)
  assert.equal(pages.length, 36)
  for (const siblings of groups.values()) assert.equal(siblings.length, 3)
})

test('the sitemap includes the directory, mythology hub, and every tradition hub', () => {
  const sitemap = read('app/sitemap.ts')
  assert.match(sitemap, /SITE_DIRECTORY_PATH/)
  assert.match(sitemap, /MYTHOLOGY_PATH/)
  assert.match(sitemap, /mythologyTraditions\(\)\.map/)
})

test('the new hubs remain isolated to their canonical Maha Strategies host', () => {
  const routing = read('lib/federation-host-routing.ts')
  assert.match(routing, /pathname === '\/directory'/)
  assert.match(routing, /pathname === '\/knowledge\/religion\/mythology'/)
})

test('protected Preview deployments can inspect every host-bound federation route', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /federationPreviewInspection = federationHost !== null/)
  assert.match(proxy, /process\.env\.VERCEL_ENV === 'preview'/)
  assert.match(proxy, /requestHost\.endsWith\('\.vercel\.app'\)/)
  assert.doesNotMatch(proxy, /policyPreviewInspection/)
})
