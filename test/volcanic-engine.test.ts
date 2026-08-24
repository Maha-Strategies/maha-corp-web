import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getOpenBookSection, openBookEditions, readOpenBookManuscript } from '../lib/open-book-editions.ts'

const root = new URL('../', import.meta.url)
const book = openBookEditions['the-volcanic-engine']

test('The Volcanic Engine publishes one canonical 17-section research edition', () => {
  assert.equal(book.title, 'The Volcanic Engine')
  assert.equal(book.subtitle, 'Living on a Firing Planet')
  assert.equal(book.manuscriptFiles.length, 17)
  assert.equal(book.sections.length, 17)
  assert.deepEqual(book.sections.map((section) => section.slug).slice(0, 3), [
    'introduction',
    'the-rock-that-flows',
    'the-physics-of-the-cork',
  ])
  assert.equal(book.sections.at(-1)?.slug, 'sources-and-further-reading')
})

test('every Volcanic Engine section resolves without leaking repeated file headers or part headings', () => {
  const manuscript = readOpenBookManuscript(book)
  assert.equal((manuscript.match(/^# The Volcanic Engine$/gm) ?? []).length, 0)
  assert.equal((manuscript.match(/^# Part [IVXLCDM]+ —/gm) ?? []).length, 0)

  for (const section of book.sections) {
    const found = getOpenBookSection(book, section.slug)
    assert.ok(found, `${section.slug} should resolve`)
    assert.ok(found.markdown.startsWith(section.marker), `${section.slug} should begin at its canonical marker`)
    assert.doesNotMatch(found.markdown, /^# The Volcanic Engine$/m)
    assert.doesNotMatch(found.markdown, /^# Part [IVXLCDM]+ —/m)
  }
})

test('the book hub, companion articles, sitemap and llms manifest expose the research boundary', async () => {
  const [hub, booksIndex, eruptionGuide, yellowstoneGuide, sitemap, llms] = await Promise.all([
    readFile(new URL('app/books/the-volcanic-engine/page.tsx', root), 'utf8'),
    readFile(new URL('app/books/page.tsx', root), 'utf8'),
    readFile(new URL('app/books/the-volcanic-engine/why-volcanoes-explode/page.tsx', root), 'utf8'),
    readFile(new URL('app/books/the-volcanic-engine/is-yellowstone-overdue/page.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('lib/llms-manifest.ts', root), 'utf8'),
  ])

  assert.match(hub, /Open research edition/)
  assert.match(hub, /The verification register remains visible/)
  assert.match(hub, /sources-and-further-reading/)
  assert.match(booksIndex, /Six works/)
  assert.match(booksIndex, /The Volcanic Engine/)
  assert.match(eruptionGuide, /U\.S\. Geological Survey/)
  assert.match(eruptionGuide, /does not, by itself, predict/)
  assert.match(yellowstoneGuide, /two intervals do not make a reliable volcanic schedule/i)
  assert.match(yellowstoneGuide, /Not supported/)
  assert.match(sitemap, /the-volcanic-engine\/why-volcanoes-explode/)
  assert.match(sitemap, /the-volcanic-engine\/is-yellowstone-overdue/)
  assert.match(llms, /Do not upgrade a draft verification note into an established claim/)
})
