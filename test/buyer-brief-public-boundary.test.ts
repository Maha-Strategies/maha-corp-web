import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

test('paid Buyer-Brief contents are absent from the public source tree', () => {
  for (const path of [
    'content/buyer-brief/bundle.json',
    'examples/buyer-brief/BUYER-BRIEF.md',
    'examples/buyer-brief/RUNBOOK.md',
    'examples/buyer-brief/offer.json',
    'examples/buyer-brief/purchase.ts',
    'examples/buyer-brief/run-report.template.json',
    'examples/buyer-brief/run.ts',
    'scripts/package-buyer-brief.ts',
    'test/buyer-brief.test.ts',
  ]) assert.equal(existsSync(path), false, path)
  assert.ok(existsSync('examples/buyer-brief/buy-pack.ts'), 'free procurement client stays public')
  assert.doesNotMatch(readFileSync('next.config.ts', 'utf8'), /content\/buyer-brief/)
  const loader = readFileSync('lib/x402/buyer-brief-delivery.ts', 'utf8')
  assert.match(loader, /storage\.from\('buyer-brief-private'\)\.download/)
  assert.doesNotMatch(loader, /readFile|content\/buyer-brief/)
})
