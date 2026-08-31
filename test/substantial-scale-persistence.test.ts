import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../', import.meta.url)

test('release-scale persistence is exact, draft-only, and separate from review and release', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260830200000_substantial_scale_release_targets.sql', ROOT), 'utf8')
  const publicStore = await readFile(new URL('lib/epistemic-store.ts', ROOT), 'utf8')
  const ingestionStore = await readFile(new URL('lib/epistemic-ingestion-store.ts', ROOT), 'utf8')

  assert.match(migration, /record_substantial_scale_release_targets/)
  assert.match(migration, /adapterId',''\) <> 'substantial-scale-release'/)
  assert.match(migration, /sourceDatasetVersion',''\) <> 'maha-substantial-scale-review\/1\.0'/)
  assert.match(migration, /recordCount',''\) <> '64'/)
  assert.match(migration, /jsonb_array_length\(p_records\) <> 64/)
  assert.match(migration, /count\(distinct record->>'sourceRecordId'\).*<> 64/)
  assert.match(migration, /publicEligible}','false'\) <> 'false'/)
  assert.match(migration, /reviewState}',''\) <> 'draft'/)
  assert.match(migration, /requestedPublicPromotion}',''\) <> 'false'/)
  assert.doesNotMatch(migration, /insert into public\.epistemic_(?:expert_)?reviews/i)
  assert.doesNotMatch(migration, /insert into public\.epistemic_canonical_releases/i)
  assert.match(ingestionStore, /batch\.adapterId === 'substantial-scale-release'/)
  assert.match(ingestionStore, /record_substantial_scale_release_targets/)
  assert.doesNotMatch(publicStore, /insertEpistemicIngestionBatch/)
})

test('adapter constraints preserve prior adapters and add the release-scale adapter only', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260830200000_substantial_scale_release_targets.sql', ROOT), 'utf8')
  const adapters = [
    'semiconductor',
    'mathematics',
    'astronomy',
    'religion',
    'neuromorphic-biocomputing',
    'frontier-canary',
    'substantial-batch-2-internal-review',
    'repaired-revision-canary',
    'mcp-private-canary',
    'source-override-revision-canary',
    'substantial-scale-release',
  ]

  for (const adapter of adapters) {
    assert.equal((migration.match(new RegExp(`'${adapter}'`, 'g')) ?? []).length >= 2, true, adapter)
  }
  assert.match(migration, /epistemic_ingestion_batches_adapter_id_check/)
  assert.match(migration, /epistemic_ingestion_records_adapter_id_check/)
})

test('the release-scale RPC is service-role only and cannot widen release authority', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260830200000_substantial_scale_release_targets.sql', ROOT), 'utf8')

  assert.match(migration, /revoke all on function public\.record_substantial_scale_release_targets[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.record_substantial_scale_release_targets[\s\S]*to service_role/)
  assert.doesNotMatch(migration, /EPISTEMIC_(?:OPERATIONS|RELEASE_AUTHORITY)_TOKEN/)
  assert.doesNotMatch(migration, /published-canonical/)
})
