import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(new URL('../app/books/layout.tsx', import.meta.url), 'utf8')
const stylesheet = readFileSync(
  new URL('../app/books/books-cyber-light.module.css', import.meta.url),
  'utf8',
)

test('Books owns the cyber-light visual scope at its nested layout', () => {
  assert.match(layout, /data-visual-system="cyber-light"/)
  assert.match(layout, /data-visual-scope="books"/)
  assert.match(layout, /books-cyber-light\.module\.css/)
})

test('cyber-light v1 keeps the accepted accent and restrained status palette', () => {
  const frozenTokens = new Map([
    ['--book-cyber-accent', '#1f715f'],
    ['--book-cyber-accent-strong', '#155347'],
    ['--book-cyber-accent-soft', 'rgb(31 113 95 / 8%)'],
    ['--book-cyber-grid', 'rgb(31 113 95 / 5%)'],
    ['--book-cyber-line', 'rgb(31 113 95 / 24%)'],
    ['--status-sourced', '#1f715f'],
    ['--status-verified', '#47704e'],
    ['--status-boundary', '#94642f'],
    ['--status-unverified', '#8b4c44'],
  ])

  for (const [token, value] of frozenTokens) {
    assert.match(stylesheet, new RegExp(`${token}: ${value.replace(/[()]/g, '\\$&')};`))
  }
})

test('cyber-light v1 keeps its grid bounded and its motion optional', () => {
  assert.match(stylesheet, /background-size: 40px 40px;/)
  assert.match(stylesheet, /background-size: 28px 28px;/)
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(stylesheet, /knowledge|intelligence|operator|admin/i)
})
