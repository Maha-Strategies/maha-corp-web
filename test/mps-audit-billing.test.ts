import assert from 'node:assert/strict'
import test from 'node:test'

import { billingDecision } from '../lib/mps-audit-billing.ts'

test('internal meter credentials bypass prepaid reservation', async () => {
  let reservationCalled = false
  const decision = await billingDecision('internal_meter', async () => {
    reservationCalled = true
    return { accepted: false }
  })

  assert.deepEqual(decision, { kind: 'allow', creditReserved: false })
  assert.equal(reservationCalled, false)
})

test('prepaid credentials are allowed only after atomic reservation', async () => {
  const decision = await billingDecision('prepaid', async () => ({ accepted: true }))
  assert.deepEqual(decision, { kind: 'allow', creditReserved: true })
})

test('zero-balance prepaid credentials require payment', async () => {
  const decision = await billingDecision('prepaid', async () => ({ accepted: false }))
  assert.deepEqual(decision, { kind: 'payment_required', creditReserved: false })
})

test('ledger failures fail closed before model execution', async () => {
  const decision = await billingDecision('prepaid', async () => ({ accepted: false, errorCode: 'ledger_timeout' }))
  assert.deepEqual(decision, { kind: 'unavailable', creditReserved: false, errorCode: 'ledger_timeout' })
})

test('reservation exceptions fail closed before model execution', async () => {
  const decision = await billingDecision('prepaid', async () => { throw new Error('network failure') })
  assert.deepEqual(decision, { kind: 'unavailable', creditReserved: false, errorCode: 'reservation_failed' })
})
