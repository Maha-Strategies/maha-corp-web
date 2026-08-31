import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync('app/api/inbound-submissions/route.ts', 'utf8')

test('the evidence-audit origin is retained without violating the production ledger constraint', () => {
  assert.match(route, /source_path: inboundLedgerSourcePath\(\)/)
  assert.match(route, /SOURCE: \$\{metadata\.sourcePath\}/)
  assert.match(route, /through \$\{metadata\.sourcePath\} passed deterministic validation/)
})
