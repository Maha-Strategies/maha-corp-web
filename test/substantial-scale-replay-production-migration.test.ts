import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const ROOT = new URL('../', import.meta.url)

test('Production replay migration is pinned to one file, digest, project, and confirmation', async () => {
  const workflow = await readFile(new URL('.github/workflows/production-substantial-scale-replay-migration.yml', ROOT), 'utf8')

  assert.match(workflow, /20260830203000_substantial_scale_idempotent_replay\.sql/)
  assert.match(workflow, /a9bba91119c4b9a138a38ab05e15c1b4f382959c908a19a538e6a171d0285a7e/)
  assert.match(workflow, /production='uhwuullakihgszxhiygz'/)
  assert.match(workflow, /APPLY SUBSTANTIAL SCALE REPLAY/)
  assert.match(workflow, /--single-transaction -f "supabase\/migrations\/\$MIGRATION"/)
  assert.doesNotMatch(workflow, /supabase db push|EPISTEMIC_(?:OPERATIONS|RELEASE_AUTHORITY)_TOKEN/)
})

test('Production verification proves history, RPC and service-role-only execution', async () => {
  const workflow = await readFile(new URL('.github/workflows/production-substantial-scale-replay-migration.yml', ROOT), 'utf8')

  for (const marker of ['history=', 'rpc=', 'service-role=', 'anon-denied=']) assert.match(workflow, new RegExp(marker))
  assert.match(workflow, /record_substantial_scale_release_targets_v2\(jsonb,jsonb,text,text\)/)
  assert.match(workflow, /targetFingerprint: sha256:/)
  assert.doesNotMatch(workflow, /echo.*SUPABASE_DB_PASSWORD|record_snapshot|batch_snapshot/)
})
