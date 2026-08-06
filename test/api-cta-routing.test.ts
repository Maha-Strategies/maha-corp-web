import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('production solver API-key CTAs route to self-service provisioning', () => {
  for (const page of ['geometric-optimization', 'tensor-opt']) {
    const source = readFileSync(join(root, 'app', page, 'page.tsx'), 'utf8')
    assert.match(source, /href="\/dashboard"[^>]*>Get an API key</)
    assert.doesNotMatch(source, /href="\/start"[^>]*>Get an API key</)
  }

  const dashboard = readFileSync(join(root, 'app', 'dashboard', 'ApiKeyManagementPanel.tsx'), 'utf8')
  assert.match(dashboard, /fetch\('\/api\/v1\/keys\/generate'/)
})
