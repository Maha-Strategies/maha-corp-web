import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../', import.meta.url)

test('Batch 2 persistence is exact, draft-only, and separate from release', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260827050000_substantial_internal_review_targets.sql', ROOT), 'utf8')
  const ingestionStore = await readFile(new URL('lib/epistemic-ingestion-store.ts', ROOT), 'utf8')
  assert.match(migration, /record_substantial_batch2_internal_review_targets/)
  assert.match(migration, /adapterId',''\) <> 'substantial-batch-2-internal-review'/)
  assert.match(migration, /sourceDatasetVersion',''\) <> 'maha-internal-review-batch-2\/1\.0'/)
  assert.match(migration, /recordCount',''\) <> '27'/)
  assert.match(migration, /jsonb_array_length\(p_records\) <> 27/)
  assert.match(migration, /count\(distinct record->>'sourceRecordId'\).*<> 27/)
  assert.match(migration, /publicEligible}','false'\) <> 'false'/)
  assert.match(migration, /reviewState}',''\) <> 'draft'/)
  assert.match(migration, /requestedPublicPromotion}',''\) <> 'false'/)
  assert.doesNotMatch(migration, /insert into public\.epistemic_expert_reviews/i)
  assert.doesNotMatch(migration, /insert into public\.epistemic_canonical_releases/i)
  assert.match(ingestionStore, /batch\.adapterId === 'substantial-batch-2-internal-review'/)
  assert.match(ingestionStore, /record_substantial_batch2_internal_review_targets/)
})
