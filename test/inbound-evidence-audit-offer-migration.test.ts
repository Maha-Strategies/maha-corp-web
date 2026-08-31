import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')
const migrationName = '20260831164500_allow_evidence_audit_inbound_offer.sql'
const migrationPath = join(ROOT, 'supabase/migrations', migrationName)
const workflowPath = join(ROOT, '.github/workflows/production-evidence-audit-intake-migration.yml')

test('Evidence Audit is admitted by both private commercial ledgers', () => {
  const migration = readFileSync(migrationPath, 'utf8')
  assert.match(migration, /drop constraint if exists inbound_submissions_offer_id_check/i)
  assert.match(migration, /add constraint inbound_submissions_offer_id_check[\s\S]*'mps-evidence-audit'/i)
  assert.match(migration, /drop constraint if exists revenue_opportunities_offer_id_check/i)
  assert.match(migration, /add constraint revenue_opportunities_offer_id_check[\s\S]*'mps-evidence-audit'/i)
  assert.match(migration, /'utility-receipts-to-csv'/, 'the existing utility revenue offer must remain admitted')
  assert.doesNotMatch(migration, /grant\s/i, 'the migration must not broaden database privileges')
})

test('the dedicated Production workflow binds one immutable migration', () => {
  const migration = readFileSync(migrationPath)
  const workflow = readFileSync(workflowPath, 'utf8')
  const digest = createHash('sha256').update(migration).digest('hex')
  assert.match(workflow, new RegExp(`MIGRATION: ${migrationName.replaceAll('.', '\\.')}`))
  assert.match(workflow, new RegExp(`MIGRATION_SHA256: ${digest}`))
  assert.match(workflow, /production='uhwuullakihgszxhiygz'/)
  assert.match(workflow, /APPLY EVIDENCE AUDIT INTAKE CONSTRAINTS/)
  assert.match(workflow, /--single-transaction -f "supabase\/migrations\/\$MIGRATION"/)
  assert.doesNotMatch(workflow, /supabase db push/, 'the dedicated workflow must not apply the unrelated migration backlog')
})
