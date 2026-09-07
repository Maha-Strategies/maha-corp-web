import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const css = readFileSync(resolve(import.meta.dirname, '../app/internal/evidence-dossier/dossier-report.module.css'), 'utf8')

test('print link annotations remain locally scoped for CSS modules', () => {
  assert.match(css, /\.page a\[href\]::after/)
  assert.doesNotMatch(css, /\n\s*a\[href\]::after/)
})
