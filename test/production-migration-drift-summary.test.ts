import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync('.github/workflows/production-migrations.yml', 'utf8')
const guide = readFileSync('docs/database-migrations.md', 'utf8')

test('expected pending schema deltas are informational rather than warnings', () => {
  assert.match(workflow, /::notice::Expected schema delta from pending migrations/)
  assert.doesNotMatch(workflow, /::warning::The live schema differs from the migration tree\. See drift-before\.sql/)
  assert.match(workflow, /::warning::The live schema differs from the migration tree and no pending migration explains the delta/)
})

test('the final summary distinguishes pre-apply, residual, and convergence states', () => {
  assert.match(workflow, /## Production migration drift summary/)
  assert.match(workflow, /Pre-apply schema comparison/)
  assert.match(workflow, /Residual post-apply comparison/)
  assert.match(workflow, /Convergence status/)
  for (const state of ['expected-pending-delta', 'unexplained-drift', 'not-reached', 'residual-drift', 'converged']) {
    assert.match(workflow, new RegExp(state))
  }
})

test('the workflow and operator guide pin the smoke-tested Supabase CLI', () => {
  assert.match(workflow, /supabase@2\.116\.0/)
  assert.match(guide, /pinned to 2\.116\.0/)
})
