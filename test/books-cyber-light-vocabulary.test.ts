import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const stylesheet = readFileSync(
  new URL('../app/intelligence/intelligence-cyber-light.module.css', import.meta.url),
  'utf8',
)

const scopes = ['apps', 'books', 'docs', 'intelligence'] as const

test('Apps, Books, Docs, and Intelligence share one canonical cyber-light vocabulary', () => {
  for (const scope of scopes) {
    const layout = readFileSync(new URL(`../app/${scope}/layout.tsx`, import.meta.url), 'utf8')
    assert.match(layout, /intelligence-cyber-light\.module\.css/)
    assert.match(layout, /data-visual-system="cyber-light"/)
    assert.match(layout, new RegExp(`data-visual-scope="${scope}"`))
  }
})

test('the shared vocabulary keeps the accepted analytical accent and semantic states', () => {
  const frozenTokens = new Map([
    ['--intel-surface', '#e9edf3'],
    ['--intel-raised', '#f7f9fc'],
    ['--intel-accent', '#24509a'],
    ['--intel-accent-strong', '#17376e'],
    ['--intel-verified', '#1b6146'],
    ['--intel-sourced', '#24509a'],
    ['--intel-boundary', '#6f4a0e'],
    ['--intel-illustrative', '#54407f'],
    ['--intel-unverified', '#93321f'],
  ])

  for (const [token, value] of frozenTokens) {
    assert.match(stylesheet, new RegExp(`${token}: ${value};`))
  }
})

test('the shared vocabulary adapts Evidence Paper and preserves bounded motion', () => {
  assert.match(stylesheet, /:global\(\.evidence-card\)/)
  assert.match(stylesheet, /:global\(\.evidence-action--primary\)/)
  assert.match(stylesheet, /background-size: 40px 40px;/)
  assert.match(stylesheet, /background-size: 28px 28px;/)
  assert.match(stylesheet, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(stylesheet, /operator|admin/i)
})
