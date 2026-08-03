import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { RECOVERY_CRITICAL_LEDGERS, evaluateRestoreRehearsal, type LedgerObservation } from '../lib/restore-rehearsal.ts'

const BASE = {
  recoveryPoint: '2026-08-01T00:00:00.000Z',
  restoreStartedAt: '2026-08-01T01:00:00.000Z',
  restoreCompletedAt: '2026-08-01T01:20:00.000Z',
  verifiedAt: '2026-08-01T01:30:00.000Z',
}

const observed = (overrides: Partial<LedgerObservation> & { table: string }): LedgerObservation => ({
  rows: 10, latestAt: '2026-07-31T23:00:00.000Z', ...overrides,
})

const allHealthy = () => RECOVERY_CRITICAL_LEDGERS.map((ledger) => observed({ table: ledger.table }))

test('every declared ledger and timestamp column exists in the migration tree', () => {
  const dir = 'supabase/migrations'
  const sql = readdirSync(dir).filter((name) => name.endsWith('.sql'))
    .map((name) => readFileSync(path.join(dir, name), 'utf8')).join('\n').toLowerCase()
  for (const ledger of RECOVERY_CRITICAL_LEDGERS) {
    assert.ok(new RegExp(`create table[^;]*\\b${ledger.table}\\b`).test(sql), `${ledger.table} is never created`)
    assert.ok(new RegExp(`\\b${ledger.timestampColumn}\\b`).test(sql), `${ledger.table}.${ledger.timestampColumn} is never declared`)
  }
})

test('a clean rehearsal reports measured RTO and RPO', () => {
  const report = evaluateRestoreRehearsal({ ...BASE, restored: allHealthy() })
  assert.equal(report.ok, true)
  assert.deepEqual(report.findings, [])
  assert.equal(report.rtoSeconds, 20 * 60)
  // Everything written after the recovery point would have been lost.
  assert.equal(report.rpoSeconds, 90 * 60)
})

test('an unreadable or unobserved ledger fails the rehearsal', () => {
  const missing = allHealthy().filter((entry) => entry.table !== 'book_entitlements')
  assert.equal(evaluateRestoreRehearsal({ ...BASE, restored: missing }).findings[0].code, 'ledger_not_observed')

  const unreadable = allHealthy().map((entry) => entry.table === 'stripe_webhook_events'
    ? { ...entry, rows: null, latestAt: null, error: 'relation does not exist' } : entry)
  const report = evaluateRestoreRehearsal({ ...BASE, restored: unreadable })
  assert.equal(report.ok, false)
  assert.equal(report.findings.some((finding) => finding.code === 'ledger_unreadable'), true)
})

test('a record newer than the recovery point invalidates the run', () => {
  const restored = allHealthy().map((entry) => entry.table === 'api_credit_ledger_entries'
    ? { ...entry, latestAt: '2026-08-01T00:00:01.000Z' } : entry)
  const report = evaluateRestoreRehearsal({ ...BASE, restored })
  assert.equal(report.findings.some((finding) => finding.code === 'record_after_recovery_point'), true)
})

test('a quiet ledger is not mistaken for data loss', () => {
  // Last written three weeks before the recovery point, and still complete.
  const restored = allHealthy().map((entry) => entry.table === 'book_entitlements'
    ? { ...entry, latestAt: '2026-07-10T00:00:00.000Z' } : entry)
  const report = evaluateRestoreRehearsal({
    ...BASE, restored,
    source: [{ table: 'book_entitlements', rows: 10, latestAt: '2026-07-10T00:00:00.000Z' }],
  })
  assert.equal(report.ok, true)
})

test('comparing against the live database detects loss', () => {
  const restored = allHealthy().map((entry) => entry.table === 'book_entitlements' ? { ...entry, rows: 0 } : entry)
  const report = evaluateRestoreRehearsal({
    ...BASE, restored,
    source: [{ table: 'book_entitlements', rows: 42, latestAt: '2026-07-31T00:00:00.000Z' }],
  })
  assert.equal(report.findings.some((finding) => finding.code === 'ledger_empty_after_restore'), true)

  const inflated = allHealthy().map((entry) => entry.table === 'mps_credit_ledger_entries' ? { ...entry, rows: 99 } : entry)
  const second = evaluateRestoreRehearsal({
    ...BASE, restored: inflated,
    source: [{ table: 'mps_credit_ledger_entries', rows: 12, latestAt: '2026-07-31T00:00:00.000Z' }],
  })
  assert.equal(second.findings.some((finding) => finding.code === 'restored_exceeds_source'), true)
})

test('targets are evaluated only when supplied', () => {
  const slow = { ...BASE, restored: allHealthy() }
  assert.equal(evaluateRestoreRehearsal(slow).ok, true)
  const graded = evaluateRestoreRehearsal({ ...slow, maxRtoSeconds: 600, maxRpoSeconds: 3_600 })
  assert.deepEqual(graded.findings.map((finding) => finding.code).sort(), ['rpo_exceeded', 'rto_exceeded'])
  assert.equal(graded.targets.maxRtoSeconds, 600)
})

test('incoherent timings are rejected rather than reported as a result', () => {
  assert.throws(() => evaluateRestoreRehearsal({ ...BASE, restoreCompletedAt: '2026-08-01T00:30:00.000Z', restored: [] }), /precedes/)
  assert.throws(() => evaluateRestoreRehearsal({ ...BASE, recoveryPoint: '2026-08-02T00:00:00.000Z', restored: [] }), /after the restore completed/)
  assert.throws(() => evaluateRestoreRehearsal({ ...BASE, recoveryPoint: 'yesterday', restored: [] }), /ISO 8601/)
})
