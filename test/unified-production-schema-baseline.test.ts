import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = process.cwd()
const read = (path: string) => readFile(`${root}/${path}`, 'utf8')

test('the unified Maha OS baseline is schema-only and least privilege', async () => {
  const sql = await read('supabase/migrations/20260809000250_maha_os_unified_schema_baseline.sql')

  assert.match(sql, /CREATE TABLE public\.nodes/)
  assert.match(sql, /CREATE TABLE public\.knowledge_network_gsc_connections/)
  assert.match(sql, /No customer data is included/)
  assert.doesNotMatch(sql, /GRANT ALL ON (?:FUNCTION )?public\.[^\n]+ TO (?:anon|authenticated)/)
  assert.match(sql, /auth\.role\(\) <> 'service_role'/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.purge_node_data\(uuid\) FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /REVOKE ALL ON TABLE[\s\S]+public\.knowledge_network_gsc_connections[\s\S]+FROM PUBLIC, anon, authenticated/)
})

test('the live reconciliation removes drift and closes the destructive RPC', async () => {
  const sql = await read('supabase/migrations/20260809000251_harden_unified_maha_os_access.sql')

  assert.match(sql, /DROP FUNCTION IF EXISTS public\.finalize_mps_credit_purchase/)
  assert.match(sql, /"sourceIndependenceReviewed":true/)
  assert.match(sql, /auth\.role\(\) <> 'service_role'/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.purge_node_data\(uuid\) FROM PUBLIC, anon, authenticated/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.purge_node_data\(uuid\) TO service_role/)
  assert.doesNotMatch(sql, /GRANT (?:ALL|EXECUTE) ON FUNCTION public\.purge_node_data\(uuid\) TO (?:anon|authenticated)/)
})

test('the Production workflow can only record the exact baseline without running schema SQL', async () => {
  const workflow = await read('.github/workflows/production-migrations.yml')

  assert.match(workflow, /- baseline/)
  assert.match(workflow, /test "\$CONFIRMATION" = 'RECORD PRODUCTION BASELINE'/)
  assert.match(workflow, /version='20260809000250'/)
  assert.match(workflow, /supabase migration repair "\$version" --status applied --linked/)
  assert.match(workflow, /if: \$\{\{ inputs\.mode == 'apply' \}\}[\s\S]+supabase db push --linked --yes/)
  assert.doesNotMatch(workflow, /inputs\.mode == 'baseline'[\s\S]{0,180}supabase db push --linked --yes/)
})
