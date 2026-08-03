import assert from 'node:assert/strict'
import test from 'node:test'

import { createFacilitator, readResponse } from '../lib/x402/facilitator.ts'
import {
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  buildPaymentRequired,
  encodeChallengeHeader,
  encodePaymentResponse,
  parsePaymentHeader,
  readPaymentSignature,
  type PaymentRequirement,
} from '../lib/x402/protocol.ts'

const requirement: PaymentRequirement = {
  scheme: 'exact', network: 'base', maxAmountRequired: '10000',
  resource: 'https://www.mahastrategies.com/api/mps-audits',
  description: 'One MPS audit', mimeType: 'application/json',
  payTo: '0xSettlement', maxTimeoutSeconds: 60, asset: '0xUSDC',
}

test('the challenge round-trips through the PAYMENT-REQUIRED header', () => {
  const body = buildPaymentRequired([requirement])
  const header = encodeChallengeHeader(body)
  const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
  assert.equal(decoded.x402Version, 1)
  assert.equal(decoded.accepts[0].resource, requirement.resource)
  assert.equal(PAYMENT_REQUIRED_HEADER, 'PAYMENT-REQUIRED')
})

test('the standard signature header is read, and the pre-standard one still works', () => {
  const payload = Buffer.from(JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' } })).toString('base64')

  const standard = new Headers({ [PAYMENT_SIGNATURE_HEADER]: payload })
  assert.equal(readPaymentSignature(standard), payload)

  // An agent built against earlier material still transacts rather than
  // failing in a way neither side can diagnose.
  const legacy = new Headers({ 'X-PAYMENT': payload })
  assert.equal(readPaymentSignature(legacy), payload)

  assert.equal(readPaymentSignature(new Headers()), null)
  assert.equal(parsePaymentHeader(readPaymentSignature(standard)).ok, true)
})

test('the standard header wins when both are present', () => {
  const headers = new Headers({ [PAYMENT_SIGNATURE_HEADER]: 'standard', 'X-PAYMENT': 'legacy' })
  assert.equal(readPaymentSignature(headers), 'standard')
})

test('the settlement confirmation encodes for PAYMENT-RESPONSE', () => {
  const encoded = encodePaymentResponse({ transaction: 'tx_1', network: 'eip155:8453', payer: '0xAgent' })
  const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  assert.equal(decoded.success, true)
  assert.equal(decoded.transaction, 'tx_1')
})

test('a facilitator success is read across the field names implementations use', () => {
  for (const body of [
    { isValid: true, payer: '0xA', transaction: 'tx_1', amountPaid: '10000' },
    { success: true, from: '0xA', txHash: 'tx_1', amount: '10000' },
    { valid: true, payerAddress: '0xA', transactionHash: 'tx_1', value: '10000' },
  ]) {
    const result = readResponse('verify', body)
    assert.equal(result.ok, true, JSON.stringify(body))
    if (result.ok) {
      assert.equal(result.transaction, 'tx_1')
      assert.equal(result.payer, '0xA')
      assert.equal(result.amountPaid, '10000')
    }
  }
})

test('a rejection carries the facilitator\'s own reason', () => {
  const result = readResponse('verify', { isValid: false, invalidReason: 'insufficient_funds' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'insufficient_funds')
})

test('a response that does not clearly state success is a failure', () => {
  // Ambiguity in a payment response must never resolve to "paid".
  for (const body of [null, undefined, 'ok', 42, {}, { isValid: 'true' }, { success: 1 }]) {
    assert.equal(readResponse('verify', body).ok, false, JSON.stringify(body))
  }
})

test('a success without a transaction identifier is refused', () => {
  // Without one there is nothing to record, and replay protection would
  // silently do nothing.
  const missing = readResponse('settle', { isValid: true, payer: '0xA', amountPaid: '10000' })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.reason, 'facilitator_settle_missing_transaction')

  const noPayer = readResponse('settle', { isValid: true, transaction: 'tx_1', amountPaid: '10000' })
  assert.equal(noPayer.ok, false)

  const badAmount = readResponse('settle', { isValid: true, transaction: 'tx_1', payer: '0xA', amountPaid: '1.5' })
  assert.equal(badAmount.ok, false)
})

test('the facilitator url must be https', () => {
  assert.throws(() => createFacilitator({ url: 'http://facilitator.example' }), /https/)
  assert.throws(() => createFacilitator({ url: '' }), /required/)
  assert.doesNotThrow(() => createFacilitator({ url: 'https://x402.org/facilitator' }))
})
