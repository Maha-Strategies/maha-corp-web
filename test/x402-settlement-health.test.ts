import assert from 'node:assert/strict'
import test from 'node:test'
import { settlementHealth } from '../lib/x402/settlement-health.ts'
import { bundledLedger } from '../lib/x402/settlement-live-store.ts'

test('health requires a fresh, caught-up scheduled snapshot; fallback is never healthy', () => {
  const fresh = { ledger: bundledLedger, source: 'scheduled_snapshot' as const, stale: false, caughtUp: true }
  assert.equal(settlementHealth(fresh).status, 'healthy')
  for (const view of [{ ...fresh, stale: true }, { ...fresh, caughtUp: false }, { ...fresh, source: 'bundled_fallback' as const }]) {
    assert.equal(settlementHealth(view).status, 'degraded')
    assert.equal(settlementHealth(view).observedAt, bundledLedger.observedAt)
  }
})
