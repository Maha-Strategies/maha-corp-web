import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const apiDocs = readFileSync(new URL('../app/docs/ApiDocs.tsx', import.meta.url), 'utf8')
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('Scalar docs map to the shared cyber-light tokens without a second mode switch', () => {
  assert.match(apiDocs, /customCss: scalarCyberLightCss/)
  assert.match(apiDocs, /--scalar-background-1: var\(--intel-raised\)/)
  assert.match(apiDocs, /--scalar-color-1: var\(--text-primary\)/)
  assert.match(apiDocs, /--scalar-color-accent: var\(--intel-accent\)/)
  assert.match(apiDocs, /--scalar-radius: 0px/)
  assert.match(apiDocs, /background-size: 40px 40px/)
  assert.match(apiDocs, /darkMode: false/)
})

test('the site dark-mode contract updates every section sharing Intelligence vocabulary', () => {
  for (const scope of ['apps', 'books', 'docs', 'intelligence']) {
    assert.match(globals, new RegExp(`data-visual-scope='${scope}'`))
  }
  assert.match(globals, /--intel-surface:\s*#0c131b/)
  assert.match(globals, /--intel-accent:\s*#82b2ff/)
})
