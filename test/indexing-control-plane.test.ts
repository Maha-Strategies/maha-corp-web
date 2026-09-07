import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  INDEXING_SEGMENTS,
  indexingHost,
  indexingSegmentForUrl,
  renderSitemapIndex,
  renderSitemapXml,
  segmentSitemapRows,
} from '../lib/indexing-control-plane.ts'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const baseline = read('../content/federation/federation-route-baseline-v1.json')
const routeIndex = read('../content/federation/public/federation-public-route-index-v1.json')
const allUrls = [
  ...baseline.observedProperties.flatMap((property: { routes: string[] }) => property.routes),
  ...routeIndex.entries.map((entry: { canonicalUrl: string }) => entry.canonicalUrl),
]

test('the indexing ledger partitions all 4,000 canonical URLs exactly once', () => {
  const rows = allUrls.map((url: string) => ({ url, lastModified: new Date('2026-09-07') }))
  const segments = segmentSitemapRows(rows)
  const partitioned = [...segments.values()].flat()
  assert.equal(allUrls.length, 4_000)
  assert.equal(partitioned.length, 4_000)
  assert.equal(new Set(partitioned.map((row) => row.url)).size, 4_000)
  assert.ok([...segments.keys()].every((segment) => INDEXING_SEGMENTS.includes(segment)))
})

test('semantic route families receive stable sitemap segments', () => {
  assert.equal(indexingSegmentForUrl('https://www.mahastrategies.com/knowledge/religion/mayon'), 'knowledge')
  assert.equal(indexingSegmentForUrl('https://research.mahastrategies.com/federation/research/provenance/definition'), 'research')
  assert.equal(indexingSegmentForUrl('https://policy.mahastrategies.com/policy/evidence/claim-boundary'), 'policy')
  assert.equal(indexingSegmentForUrl('https://publish.mahastrategies.com/agentic-publishing/release/guide'), 'publishing')
  assert.equal(indexingSegmentForUrl('https://www.mahastrategies.com/books/the-maha-principle'), 'books')
  assert.equal(indexingSegmentForUrl('https://www.mahastrategies.com/tools/evidence-preflight'), 'machine')
  assert.equal(indexingSegmentForUrl('https://www.mahastrategies.com/consulting/evidence-policy'), 'commercial')
})

test('unknown host input cannot enter sitemap or robots output', () => {
  assert.equal(indexingHost('policy.mahastrategies.com'), 'policy.mahastrategies.com')
  assert.equal(indexingHost('ATTACKER.INVALID:443'), 'www.mahastrategies.com')
  assert.equal(indexingHost('www.mahastrategies.com, attacker.invalid'), 'www.mahastrategies.com')
})

test('XML output escapes URLs and carries accurate last modification timestamps', () => {
  const xml = renderSitemapXml([{ url: 'https://www.mahastrategies.com/search?a=1&b=2', lastModified: new Date('2026-09-07T00:00:00.000Z') }])
  assert.match(xml, /a=1&amp;b=2/)
  assert.match(xml, /2026-09-07T00:00:00\.000Z/)
  assert.doesNotMatch(xml, /changefreq|priority/)
  const index = renderSitemapIndex('www.mahastrategies.com', ['knowledge', 'books'], new Date('2026-09-07T00:00:00.000Z'))
  assert.match(index, /\/sitemaps\/knowledge\.xml/)
  assert.match(index, /\/sitemaps\/books\.xml/)
})

test('duplicates fail closed rather than being hidden across sitemap segments', () => {
  const row = { url: 'https://www.mahastrategies.com/knowledge/religion/mayon' }
  assert.throws(() => segmentSitemapRows([row, row]), /indexing-sitemap-duplicate/)
})

test('robots advertises the host-specific sitemap index and legacy sitemap', () => {
  const source = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8')
  assert.match(source, /sitemap-index\.xml/)
  assert.match(source, /sitemap\.xml/)
  assert.match(source, /indexingHost/)
})
