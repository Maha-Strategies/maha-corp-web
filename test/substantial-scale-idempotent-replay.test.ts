import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../', import.meta.url)

test('substantial-scale persistence replays by request and immutable dataset revision', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260830203000_substantial_scale_idempotent_replay.sql', ROOT), 'utf8')
  const store = await readFile(new URL('lib/epistemic-store.ts', ROOT), 'utf8')

  assert.match(store, /record_substantial_scale_release_targets_v2/)
  assert.match(migration, /where idempotency_hash = p_idempotency_hash/)
  assert.match(migration, /v_existing\.source_dataset_sha256 <> p_batch->>'sourceDatasetSha256'/)
  assert.match(migration, /'idempotentReplay', true/)
  assert.doesNotMatch(migration, /v_existing\.batch_sha256/)
})

test('a new request still traverses the original 64-record validation boundary', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260830203000_substantial_scale_idempotent_replay.sql', ROOT), 'utf8')

  assert.match(migration, /return public\.record_substantial_scale_release_targets\(/)
  assert.match(migration, /adapter_id <> 'substantial-scale-release'/)
  assert.match(migration, /cannot cross dataset revisions/)
  assert.match(migration, /revoke all .* from public, anon, authenticated/)
  assert.match(migration, /grant execute .* to service_role/)
})
