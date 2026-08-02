import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import test from 'node:test'

import { auditMigrations, checkAppendOnly, checkDestructive, checkNaming, checkOrderAgainstBase } from '../lib/migration-integrity.ts'

const codes = (findings: { code: string }[]) => findings.map((finding) => finding.code).sort()

test('the committed migration tree satisfies the naming contract', () => {
  const names = readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql'))
  assert.ok(names.length > 0, 'expected committed migrations')
  assert.deepEqual(checkNaming(names), [])
})

test('bare dates, unreal timestamps, and duplicate versions are rejected', () => {
  assert.deepEqual(codes(checkNaming(['20260716_agent_inquiry_ledger.sql'])), ['invalid_name'])
  assert.deepEqual(codes(checkNaming(['20260716000000_Agent_Ledger.sql'])), ['invalid_name'])
  assert.deepEqual(codes(checkNaming(['20261340000000_bad_month.sql'])), ['invalid_timestamp'])
  assert.deepEqual(codes(checkNaming(['20260229000000_not_a_leap_day.sql'])), ['invalid_timestamp'])
  assert.deepEqual(codes(checkNaming(['20260716000000_first.sql', '20260716000000_second.sql'])), ['duplicate_timestamp'])
})

test('already-committed migrations may not be edited, renamed, or deleted', () => {
  assert.deepEqual(checkAppendOnly([{ name: '20260716000000_new.sql', status: 'added' }]), [])
  assert.deepEqual(
    codes(checkAppendOnly([
      { name: '20260716000000_edited.sql', status: 'modified' },
      { name: '20260716000100_gone.sql', status: 'deleted' },
      { name: '20260716000200_moved.sql', status: 'renamed' },
    ])),
    ['migration_deleted', 'migration_modified', 'migration_renamed'],
  )
})

test('a new migration must sort after everything already on the base branch', () => {
  const base = ['20260716000000_first.sql', '20260730000100_latest.sql']
  assert.deepEqual(checkOrderAgainstBase(['20260731000000_next.sql'], base), [])
  assert.deepEqual(codes(checkOrderAgainstBase(['20260720000000_backdated.sql'], base)), ['out_of_order'])
  // A branch cut before any migration existed has nothing to sort against.
  assert.deepEqual(checkOrderAgainstBase(['20260720000000_backdated.sql'], []), [])
})

test('destructive DDL is flagged unless it is explicitly justified', () => {
  const drop = 'alter table public.mps_credit_ledger drop column amount;'
  assert.deepEqual(codes(checkDestructive([{ name: '20260801000000_drop.sql', sql: drop }])), ['destructive_drop_column'])
  assert.deepEqual(
    checkDestructive([{ name: '20260801000000_drop.sql', sql: `-- migration-allow-destructive: column never carried data\n${drop}` }]),
    [],
  )
})

test('prose about a statement is not mistaken for the statement', () => {
  const sql = '-- This replaces the old drop table approach.\n/* truncate is never used here */\ncreate table public.example (id text primary key);'
  assert.deepEqual(checkDestructive([{ name: '20260801000000_safe.sql', sql }]), [])
})

test('a legitimate delete inside a function body is not destructive DDL', () => {
  const sql = 'create function public.cleanup() returns void as $$ begin delete from public.utility_upload_objects where draft_id = p_draft_id; end; $$ language plpgsql;'
  assert.deepEqual(checkDestructive([{ name: '20260801000000_cleanup.sql', sql }]), [])
})

test('the audit reports whether it could compare against a base branch', () => {
  const names = ['20260716000000_first.sql']
  assert.equal(auditMigrations({ names }).comparedToBase, false)
  assert.equal(auditMigrations({ names, changes: [], baseNames: names }).comparedToBase, true)
  assert.equal(auditMigrations({ names, changes: [], baseNames: names }).ok, true)
})

test('the audit fails and reports every distinct problem at once', () => {
  const audit = auditMigrations({
    names: ['20260716_bare_date.sql', '20260716000000_first.sql'],
    changes: [{ name: '20260716000000_first.sql', status: 'modified' }],
    baseNames: ['20260730000100_latest.sql'],
    addedFiles: [{ name: '20260716000000_first.sql', sql: 'drop table public.book_entitlements;' }],
  })
  assert.equal(audit.ok, false)
  assert.deepEqual(codes(audit.findings), ['destructive_drop_table', 'invalid_name', 'migration_modified'])
})
