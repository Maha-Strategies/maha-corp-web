import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { COLLECTION_HUB_PATHS, isCollectionHub } from '../lib/collection-hub-paths.ts'
import { collectionModel, COLLECTION_ORIGIN } from '../lib/collection-hubs.ts'
import { federationHostAllowsPath } from '../lib/federation-host-routing.ts'
import { crawlNavigation, inspectNavigationHtml, type CrawledPage } from '../lib/navigation-crawl.ts'

test('hub rewrites remain path-only after host protection, with no network rewrite', () => {
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8')
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.ok(config.includes('COLLECTION_HUB_PATHS.map(source => ({ source, destination: COLLECTION_INTERNAL_PATH + source }))'))
  assert.ok(proxy.includes('pathname.startsWith(COLLECTION_INTERNAL_PATH'))
  assert.equal(proxy.includes('NextResponse.rewrite('), false)
})

test('all 180 measured missing parents resolve exactly and refuse other hosts', () => {
  assert.equal(COLLECTION_HUB_PATHS.length, 180)
  assert.equal(new Set(COLLECTION_HUB_PATHS).size, 180)
  for (const path of COLLECTION_HUB_PATHS) {
    assert.ok(isCollectionHub(path))
    assert.ok(federationHostAllowsPath('www.mahastrategies.com', path))
    assert.equal(federationHostAllowsPath('policy.mahastrategies.com', path), false)
    assert.equal(isCollectionHub(path + '/unlisted-child'), false)
  }
})
test('collections link only supplied public articles and known intermediate hubs', () => {
  const a = '/clearing/tamil-religion/mayon/source-identity'
  const rows = [{ url: COLLECTION_ORIGIN + a }, { url: 'https://policy.mahastrategies.com/clearing/tamil-religion/mayon/other' }]
  const root = collectionModel('/clearing', rows)!
  assert.equal(root.articleCount, 1)
  assert.ok(root.subcollections.includes('/clearing/tamil-religion'))
  assert.deepEqual(collectionModel('/clearing/tamil-religion/mayon', rows)!.articles, [a])
  assert.deepEqual(collectionModel('/clearing/tamil-religion/mayon', [])!.articles, [])
  assert.equal(collectionModel('/admin', rows), null)
})
test('HTML inspection ignores script and RSC strings posing as links', () => {
  const result = inspectNavigationHtml('<a href="/real">Real</a><script>"<a href=\'/fake\'>"</script><link href="https://www.mahastrategies.com/" rel="canonical">', COLLECTION_ORIGIN)
  assert.deepEqual(result.links, ['/real'])
  assert.equal(result.canonical, COLLECTION_ORIGIN + '/')
})
test('crawl fails on unreachable sitemap pages, broken responses, and wrong canonicals', async () => {
  const pages = new Map<string, CrawledPage>([
    ['/', { status: 200, links: ['/hub'], canonical: COLLECTION_ORIGIN + '/', soft404: false }],
    ['/hub', { status: 404, links: ['/article'], canonical: null, soft404: true }],
  ])
  const result = await crawlNavigation(['/', '/hub', '/article'], async p => pages.get(p)!, COLLECTION_ORIGIN)
  assert.equal(result.verdict, 'fail')
  assert.deepEqual(result.unreachable, ['/article'])
  assert.equal(result.failures[0].path, '/hub')
  pages.set('/hub', { status: 200, links: ['/article'], canonical: COLLECTION_ORIGIN + '/wrong', soft404: false })
  pages.set('/article', { status: 200, links: [], canonical: COLLECTION_ORIGIN + '/article', soft404: false })
  assert.equal((await crawlNavigation(['/', '/hub', '/article'], async p => pages.get(p)!, COLLECTION_ORIGIN)).verdict, 'fail')
  pages.set('/hub', { status: 200, links: ['/article'], canonical: COLLECTION_ORIGIN + '/hub', soft404: false })
  assert.equal((await crawlNavigation(['/', '/hub', '/article'], async p => pages.get(p)!, COLLECTION_ORIGIN)).verdict, 'pass')
})
