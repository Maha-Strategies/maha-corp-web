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

test('the manuscript is retained while the public web edition is unavailable', () => {
  const maintenance = readFileSync(new URL('app/books/the-maha-principle/page.tsx', root), 'utf8')
  const index = readFileSync(new URL('app/books/page.tsx', root), 'utf8')
  const sitemap = readFileSync(new URL('app/sitemap.ts', root), 'utf8')
  const llms = readFileSync(new URL('lib/llms-manifest.ts', root), 'utf8')

  assert.match(maintenance, /temporarily unavailable/i)
  assert.match(maintenance, /robots: \{ index: false, follow: false \}/)
  assert.doesNotMatch(maintenance, /OpenBook|readOpenBook|complete (?:free )?(?:web )?edition/i)
  assert.equal(existsSync(new URL('app/books/the-maha-principle/read/page.tsx', root)), false)
  assert.equal(existsSync(new URL('app/books/the-maha-principle/read/[section]/page.tsx', root)), false)
  assert.doesNotMatch(index, /The Maha Principle/)
  assert.match(index, /Seven works/)
  assert.match(sitemap, /books\/the-maha-principle\/reader-faq/)
  assert.doesNotMatch(sitemap, /books\/the-maha-principle\/read(?:\/|[\x27\x22`])/)
  assert.doesNotMatch(llms, /books\/the-maha-principle\/read(?:\/|[\x27\x22`])/)
  assert.equal(existsSync(new URL('content/books/the-maha-principle/The-Maha-Principle.md', root)), true)
  assert.equal(existsSync(new URL('public/books/the-maha-principle/The-Maha-Principle-Free-Edition.epub', root)), false)
  assert.equal(existsSync(new URL('public/books/the-maha-principle/cover.jpg', root)), true)
})
