import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../', import.meta.url)

test('the Production workflow applies only the reviewed substantial-scale migration', async () => {
  const workflow = await readFile(new URL('.github/workflows/production-substantial-scale-migration.yml', ROOT), 'utf8')

  assert.match(workflow, /MIGRATION: 20260830200000_substantial_scale_release_targets\.sql/)
  assert.match(workflow, /MIGRATION_SHA256: 72143cd514cabab926a84d9be9eaf76a4ddf5b2f3117294b1483fd01f686f8dd/)
  assert.match(workflow, /APPLY SUBSTANTIAL SCALE PERSISTENCE/)
  assert.match(workflow, /production='uhwuullakihgszxhiygz'/)
  assert.match(workflow, /--single-transaction -f "supabase\/migrations\/\$MIGRATION"/)
  assert.doesNotMatch(workflow, /supabase db push/)
  assert.doesNotMatch(workflow, /20260828110000|20260829000100|20260830173000|20260830174500|20260830190000/)
})

test('the bounded workflow verifies history, RPC, and both adapter constraints', async () => {
  const workflow = await readFile(new URL('.github/workflows/production-substantial-scale-migration.yml', ROOT), 'utf8')

  for (const marker of ['history=', 'rpc=', 'batch-adapter=', 'record-adapter=']) {
    assert.match(workflow, new RegExp(marker))
  }
  assert.match(workflow, /record_substantial_scale_release_targets\(jsonb,jsonb,text,text\)/)
  assert.match(workflow, /epistemic_ingestion_batches_adapter_id_check/)
  assert.match(workflow, /epistemic_ingestion_records_adapter_id_check/)
  assert.match(workflow, /Migration history already contains the exact version; entering verification-only replay\./)
})

test('the workflow publishes only sanitized operational evidence', async () => {
  const workflow = await readFile(new URL('.github/workflows/production-substantial-scale-migration.yml', ROOT), 'utf8')

  assert.match(workflow, /targetFingerprint: sha256:/)
  assert.doesNotMatch(workflow, /echo.*SUPABASE_DB_PASSWORD/)
  assert.doesNotMatch(workflow, /schema-before|schema-after|record_snapshot|batch_snapshot/)
  assert.doesNotMatch(workflow, /EPISTEMIC_(?:OPERATIONS|RELEASE_AUTHORITY)_TOKEN/)
})
