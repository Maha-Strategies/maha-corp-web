import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

import { getOpenBookSection, openBookEditions, readOpenBookManuscript } from '../lib/open-book-editions.ts'

const root = new URL('../', import.meta.url)
const book = openBookEditions['the-maha-principle']

test('The Maha Principle is a complete 40-section web edition', () => {
  assert.equal(book.title, 'The Maha Principle')
  assert.equal(book.subtitle, 'The Architecture of Human Flourishing')
  assert.equal(book.manuscriptFiles.length, 1)
  assert.equal(book.sections.length, 40)
  assert.equal(book.sections[0]?.slug, 'medical-disclaimer')
  assert.equal(book.sections.at(-1)?.slug, 'notes-and-references')

  const manuscript = readOpenBookManuscript(book)
  assert.ok(manuscript.split(/\s+/).length > 85_000)
  assert.match(manuscript, /^# MEDICAL DISCLAIMER AND NOTICE OF LIABILITY/m)
  assert.match(manuscript, /^# CHAPTER 11: Architecting the Maha Nation/m)
  assert.match(manuscript, /^# Notes and References/m)
  assert.doesNotMatch(manuscript, /<\/?(?:div|span|label|sup)(?:\s[^>]*)?>/)

  for (const section of book.sections) {
    const found = getOpenBookSection(book, section.slug)
    assert.ok(found, `${section.slug} should resolve`)
    assert.ok(found.markdown.startsWith(section.marker), `${section.slug} should begin at its canonical marker`)
  }
})

test('the edition is discoverable as web reading without publishing the source EPUB', () => {
  const hub = readFileSync(new URL('app/books/the-maha-principle/page.tsx', root), 'utf8')
  const index = readFileSync(new URL('app/books/page.tsx', root), 'utf8')
  const sitemap = readFileSync(new URL('app/sitemap.ts', root), 'utf8')
  const llms = readFileSync(new URL('lib/llms-manifest.ts', root), 'utf8')

  assert.match(hub, /Complete free web edition/)
  assert.match(hub, /Read the complete edition/)
  assert.match(hub, /Copyright retained/)
  assert.match(hub, /not medical advice/i)
  assert.doesNotMatch(hub, /\.epub|download/i)
  assert.match(index, /The Maha Principle/)
  assert.match(index, /Seven works/)
  assert.match(sitemap, /books\/the-maha-principle/)
  assert.match(llms, /The Maha Principle — complete free web edition/)
  assert.equal(existsSync(new URL('public/books/the-maha-principle/The-Maha-Principle-Free-Edition.epub', root)), false)
  assert.equal(existsSync(new URL('public/books/the-maha-principle/cover.jpg', root)), true)
})
