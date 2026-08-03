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
const settled = { transaction: 'tx_1', payer: '0xAgent', amountPaid: '10000' }

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
  assert.equal(await guard.claim(settled), true)
})

test('a repeat presentation is refused', async () => {
  const guard = createReplayGuard(ledger({ data: 'duplicate' }), context, requirement)
  assert.equal(await guard.claim(settled), false)
})

test('the claim records the resource that was actually paid for', async () => {
  // Recording the requirement's resource rather than anything the caller sent
  // is what stops a payment for one endpoint being argued to cover another.
  const calls: Record<string, unknown>[] = []
  const guard = createReplayGuard(ledger({ data: 'claimed' }, calls), context, requirement)
  await guard.claim(settled)
  assert.equal(calls[0].p_resource, 'https://www.mahastrategies.com/api/mps-audits')
  assert.equal(calls[0].p_transaction_id, 'tx_1')
  assert.equal(calls[0].p_payer, '0xAgent')
  assert.equal(calls[0].p_amount_paid, '10000')
})

test('a database failure withholds the resource rather than serving it unrecorded', async () => {
  // Failing open would serve paid resources with no record of payment. A payer
  // wrongly refused still holds their settled payment and can retry; a
  // resource served without a record cannot be recovered.
  for (const error of [{ code: 'PGRST202' }, { code: '42501' }, {}]) {
    const guard = createReplayGuard(ledger({ error }), context, requirement)
    assert.equal(await guard.claim(settled), false)
  }
})

test('an unexpected return value is treated as unclaimed', async () => {
  for (const data of [null, undefined, '', 'unexpected', 0]) {
    const guard = createReplayGuard(ledger({ data }), context, requirement)
    assert.equal(await guard.claim(settled), false)
  }
})
