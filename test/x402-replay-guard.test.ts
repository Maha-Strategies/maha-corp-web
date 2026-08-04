import assert from 'node:assert/strict'
import test from 'node:test'

import { createReplayGuard, type SettlementContext } from '../lib/x402/replay-guard.ts'
import type { PaymentRequirement } from '../lib/x402/protocol.ts'

const requirement: PaymentRequirement = {
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '10000',
  resource: 'https://www.mahastrategies.com/api/mps-audits',
  description: 'One MPS audit',
  mimeType: 'application/json',
  payTo: '0xSettlement',
  maxTimeoutSeconds: 60,
  asset: '0xUSDC',
}

const context: SettlementContext = { network: 'eip155:8453', asset: '0xUSDC' }
const claimInput = { paymentId: 'a'.repeat(64), payer: '0xAgent' }

function ledger(result: { data?: unknown; error?: { code?: string } | null }, calls: Record<string, unknown>[] = []) {
  return {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      calls.push(args)
      return { data: result.data ?? null, error: result.error ?? null }
    },
  }
}

test('a first presentation is claimed', async () => {
  const guard = createReplayGuard(ledger({ data: 'claimed' }), context, requirement)
  assert.equal(await guard.claim(claimInput), 'claimed')
})

test('a repeat presentation is refused', async () => {
  const guard = createReplayGuard(ledger({ data: 'duplicate' }), context, requirement)
  assert.equal(await guard.claim(claimInput), 'duplicate')
})

test('the claim records the resource that was actually paid for', async () => {
  // Recording the requirement's resource rather than anything the caller sent
  // is what stops a payment for one endpoint being argued to cover another.
  const calls: Record<string, unknown>[] = []
  const guard = createReplayGuard(ledger({ data: 'claimed' }, calls), context, requirement)
  await guard.claim(claimInput)
  assert.equal(calls[0].p_resource, 'https://www.mahastrategies.com/api/mps-audits')
  assert.equal(calls[0].p_payment_id, 'a'.repeat(64))
  assert.equal(calls[0].p_payer, '0xAgent')
  // The price comes from the requirement, never from the caller or the
  // facilitator response -- neither of which reports a settled amount.
  assert.equal(calls[0].p_amount_paid, '10000')
})

test('settlement is recorded separately and never gates access', async () => {
  const calls: Record<string, unknown>[] = []
  const guard = createReplayGuard(ledger({ error: { code: '42501' } }, calls), context, requirement)
  // A failed settlement write must not throw: the resource was already paid
  // for and admitted by the claim above it.
  await assert.doesNotReject(guard.recordSettlement({ paymentId: 'b'.repeat(64), transaction: 'tx_1' }))
  assert.equal(calls[0].p_transaction_id, 'tx_1')
  assert.equal(calls[0].p_payment_id, 'b'.repeat(64))
})

test('a database failure withholds the resource, and says so accurately', async () => {
  // Failing open would serve paid resources with no record of payment. A payer
  // wrongly refused still holds their signed authorization and can retry; a
  // resource served without a record cannot be recovered.
  //
  // PGRST202 is "function not found" -- the shape a missing migration takes.
  // It must not be reported as a replay.
  for (const error of [{ code: 'PGRST202' }, { code: '42501' }, {}]) {
    const guard = createReplayGuard(ledger({ error }), context, requirement)
    assert.equal(await guard.claim(claimInput), 'unavailable')
  }
})

test('an unexpected return value never reads as claimed', async () => {
  for (const data of [null, undefined, '', 'unexpected', 0]) {
    const guard = createReplayGuard(ledger({ data }), context, requirement)
    assert.notEqual(await guard.claim(claimInput), 'claimed')
  }
})
