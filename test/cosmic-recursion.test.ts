import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { getOpenBookSection, openBookEditions, readOpenBookManuscript } from '../lib/open-book-editions.ts'

const root = new URL('../', import.meta.url)
const book = openBookEditions['the-cosmic-recursion']

test('The Cosmic Recursion is a complete 16-section open web edition', () => {
  assert.equal(book.title, 'The Cosmic Recursion')
  assert.equal(book.subtitle, 'What Survives the Compression')
  assert.equal(book.manuscriptFiles.length, 1)
  assert.equal(book.sections.length, 16)
  assert.equal(book.sections[0]?.slug, 'introduction')
  assert.equal(book.sections.at(-1)?.slug, 'sources-and-verification')

  const manuscript = readOpenBookManuscript(book)
  assert.ok(manuscript.split(/\s+/).length > 45_000)
  assert.match(manuscript, /^# Chapter Eleven$/m)
  assert.match(manuscript, /^## SOURCES AND VERIFICATION$/m)

  for (const section of book.sections) {
    const found = getOpenBookSection(book, section.slug)
    assert.ok(found, `${section.slug} should resolve`)
    assert.ok(found.markdown.startsWith(section.marker), `${section.slug} should begin at its canonical marker`)
  }
})

test('The Cosmic Recursion is visible in the catalogue, sitemap and machine manifest', () => {
  const hub = readFileSync(new URL('app/books/the-cosmic-recursion/page.tsx', root), 'utf8')
  const index = readFileSync(new URL('app/books/page.tsx', root), 'utf8')
  const sitemap = readFileSync(new URL('app/sitemap.ts', root), 'utf8')
  const llms = readFileSync(new URL('lib/llms-manifest.ts', root), 'utf8')

  assert.equal(existsSync(new URL('content/books/the-cosmic-recursion/THE-COSMIC-RECURSION-manuscript.md', root)), true)
  assert.match(hub, /The complete edition includes a provenance index/)
  assert.match(index, /Eight works/)
  assert.match(index, /The Cosmic Recursion/)
  assert.match(sitemap, /books\/the-cosmic-recursion/)
  assert.match(llms, /The Cosmic Recursion — complete open web edition/)
  assert.match(llms, /empirical, inferred and analogical claims remain explicitly separated/i)
})
