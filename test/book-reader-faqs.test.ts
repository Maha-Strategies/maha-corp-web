import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)

test('The Cosmic Recursion reader FAQ is public, bounded and discoverable', () => {
  const faq = readFileSync(new URL('app/books/the-cosmic-recursion/reader-faq/page.tsx', root), 'utf8')
  const hub = readFileSync(new URL('app/books/the-cosmic-recursion/page.tsx', root), 'utf8')
  const sitemap = readFileSync(new URL('app/sitemap.ts', root), 'utf8')

  assert.match(faq, /'@type': 'FAQPage'/)
  assert.match(faq, /empirical findings, scientific inference, and structural analogy/i)
  assert.match(faq, /does not establish that the universe literally is a computer/i)
  assert.match(faq, /does not by itself prove/i)
  assert.match(hub, /the-cosmic-recursion\/reader-faq/)
  assert.match(sitemap, /books\/the-cosmic-recursion\/reader-faq/)
})

test('The Maha Principle reader FAQ is public without republishing the manuscript', () => {
  const faq = readFileSync(new URL('app/books/the-maha-principle/reader-faq/page.tsx', root), 'utf8')
  const hub = readFileSync(new URL('app/books/the-maha-principle/page.tsx', root), 'utf8')
  const sitemap = readFileSync(new URL('app/sitemap.ts', root), 'utf8')

  assert.match(faq, /'@type': 'FAQPage'/)
  assert.match(faq, /not medical advice/i)
  assert.match(faq, /does not reproduce the manuscript/i)
  assert.match(faq, /Visit the book page for current edition availability/i)
  assert.doesNotMatch(faq, /Read the complete edition|isAccessibleForFree/)
  assert.match(hub, /the-maha-principle\/reader-faq/)
  assert.match(hub, /temporarily unavailable/i)
  assert.match(sitemap, /books\/the-maha-principle\/reader-faq/)
})
