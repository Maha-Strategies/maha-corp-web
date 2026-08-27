import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  'supabase/migrations/20260827153000_repaired_revision_canary_adapter.sql',
  'utf8',
)

test('the repaired-revision adapter is admitted to both immutable ingestion tables', () => {
  assert.match(migration, /epistemic_ingestion_batches_adapter_id_check/)
  assert.match(migration, /epistemic_ingestion_records_adapter_id_check/)
  assert.equal((migration.match(/'repaired-revision-canary'/g) ?? []).length, 2)
})

test('the migration does not widen publication or review authority', () => {
  assert.doesNotMatch(migration, /epistemic_(?:expert_)?reviews|epistemic_canonical_releases/)
  assert.doesNotMatch(migration, /grant\s|security\s+definer/i)
})
