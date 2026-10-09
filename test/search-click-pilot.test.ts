import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SEARCH_CLICK_PILOT, searchClickCopy, searchClickMetadata } from '../lib/search-click-pilot.ts'
import { unreadItems } from '../lib/reader-section-deduplication.ts'

test('pilot is ten exact paths with distinct titles and no URL aliases', () => {
  const entries = Object.entries(SEARCH_CLICK_PILOT)
  assert.equal(entries.length, 10)
  assert.equal(new Set(entries.map(([, copy]) => copy.title)).size, 10)
  for (const [path, copy] of entries) {
    assert.ok(path.startsWith('/knowledge/') || path.startsWith('/guides/'))
    assert.ok(copy.description.length > 60)
    assert.equal(searchClickCopy(`${path}/`), undefined)
    assert.equal(searchClickCopy(`${path}?preview=1`), undefined)
  }
  assert.equal(searchClickCopy('constructor'), undefined)
})

test('unselected pages are unchanged, including object identity', () => {
  const original = { title: 'Control', description: 'Control description' }
  assert.equal(searchClickMetadata('/knowledge/control', original), original)
})

test('all pilot metadata preserves canonical, robots, images, dates and verification', () => {
  for (const path of Object.keys(SEARCH_CLICK_PILOT)) {
    const original = {
      alternates: { canonical: path }, robots: { index: false },
      verification: { google: 'test-only' },
      openGraph: { type: 'article' as const, url: path, images: ['/image.png'], publishedTime: '2026-08-01' },
      twitter: { card: 'summary' as const, images: ['/image.png'] },
    }
    const before = JSON.stringify(original)
    const result = searchClickMetadata(path, original)
    assert.deepEqual(result.alternates, original.alternates)
    assert.deepEqual(result.robots, original.robots)
    assert.deepEqual(result.verification, original.verification)
    assert.deepEqual(result.openGraph, { ...original.openGraph, ...SEARCH_CLICK_PILOT[path] })
    assert.deepEqual(result.twitter, { ...original.twitter, ...SEARCH_CLICK_PILOT[path] })
    assert.deepEqual(result.title, { absolute: `${SEARCH_CLICK_PILOT[path].title} | Maha` })
    assert.equal(JSON.stringify(original), before)
    assert.deepEqual(result, searchClickMetadata(path, original))
  }
})

test('reference descriptions do not promise unsupported calculators or review tiers', () => {
  assert.match(SEARCH_CLICK_PILOT['/knowledge/astrology/calculations/placidus-houses'].description, /not a calculator/)
  assert.match(SEARCH_CLICK_PILOT['/guides/retrieval-augmented-generation-lewis-2020'].description, /summary/)
  for (const copy of Object.values(SEARCH_CLICK_PILOT)) {
    assert.doesNotMatch(`${copy.title} ${copy.description}`, /expert.reviewed|guaranteed|peer.reviewed|best in|#1/i)
  }
})

test('release resolution and revision guard precede the record metadata override', () => {
  const page = readFileSync(new URL('../app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx', import.meta.url), 'utf8')
  const metadata = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default'))
  assert.ok(metadata.indexOf('if (!record) return {}') < metadata.indexOf('searchClickMetadata(path,'))
  assert.match(page, /contractRecordRevision: page.contract.recordRevisionSha256/)
  assert.match(page, /liveRecordRevision: epistemicReviewTargetHash\(record\)/)
})

test('exact duplicate removal retains changed wording, limitations, and original arrays', () => {
  const original = ['Existing answer.', 'Existing answer. With a limitation.', '/knowledge/example']
  assert.deepEqual(unreadItems(original, ['Existing answer.']), original.slice(1))
  assert.deepEqual(unreadItems(original, []), original)
  assert.equal(original.length, 3)
  assert.deepEqual(unreadItems(['Existing answer.'], ['Existing answer.']), [])
})

test('no measurement data or raw GSC export is imported into runtime pilot', () => {
  const code = readFileSync(new URL('../lib/search-click-pilot.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(code, /from ['"].*(content|operations|Downloads)|readFile|fetch\(/)
})
