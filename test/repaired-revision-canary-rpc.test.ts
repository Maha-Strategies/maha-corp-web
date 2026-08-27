import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync('supabase/migrations/20260827161500_repaired_revision_canary_rpc.sql', 'utf8')
const store = readFileSync('lib/epistemic-store.ts', 'utf8')

test('the repaired canary uses its exact two-record persistence RPC', () => {
  assert.match(store, /batch\.adapterId === 'repaired-revision-canary'[\s\S]*'record_repaired_revision_canary_targets'/)
  assert.match(migration, /adapterId',''\) <> 'repaired-revision-canary'/)
  assert.match(migration, /sourceDatasetVersion',''\) <> 'maha-repaired-revision-canary\/1\.0'/)
  assert.match(migration, /recordCount',''\) <> '2'/)
  assert.match(migration, /jsonb_array_length\(p_records\) <> 2/)
  assert.match(migration, /count\(distinct record->>'sourceRecordId'\)[\s\S]*<> 2/)
})

test('the RPC persists drafts without review or release authority', () => {
  assert.ok(migration.includes("candidateSnapshot,publication,requestedPublicPromotion}','') <> 'false'"))
  assert.ok(migration.includes("candidateSnapshot,publication,reviewState}','') <> 'draft'"))
  assert.match(migration, /public_eligible[\s\S]*false/)
  assert.doesNotMatch(migration, /epistemic_(?:expert_)?reviews|epistemic_canonical_releases/)
  assert.doesNotMatch(migration, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
})

test('the RPC is service-role only and preserves idempotency across exact revisions', () => {
  assert.match(migration, /idempotency cannot cross dataset revisions/)
  assert.match(migration, /revoke all on function public\.record_repaired_revision_canary_targets[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.record_repaired_revision_canary_targets[\s\S]*to service_role/)
})
