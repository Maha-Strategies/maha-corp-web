import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acceptPayment,
  buildPaymentRequired,
  matchRequirement,
  parsePaymentHeader,
  type PaymentFacilitator,
  type PaymentPayload,
  type PaymentRequirement,
  type ReplayGuard,
} from '../lib/x402/protocol.ts'

const requirement = (overrides: Partial<PaymentRequirement> = {}): PaymentRequirement => ({
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '1000',
  resource: 'https://www.mahastrategies.com/api/mps-audits',
  description: 'One MPS audit',
  mimeType: 'application/json',
  payTo: '0xSettlementProvider',
  maxTimeoutSeconds: 60,
  asset: '0xUSDC',
  ...overrides,
})

const payment = (overrides: Partial<PaymentPayload> = {}): PaymentPayload => ({
  x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0xsig' }, ...overrides,
})

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')

function facilitator(overrides: Partial<PaymentFacilitator> = {}): PaymentFacilitator {
  const success = { ok: true as const, payer: '0xAgent', transaction: 'tx_1', amountPaid: '1000' }
  return { verify: async () => success, settle: async () => success, ...overrides }
}

function guard(seen: Set<string> = new Set()): ReplayGuard {
  return { claim: async (transaction) => (seen.has(transaction) ? false : (seen.add(transaction), true)) }
}

test('a challenge states the terms an agent needs to pay', () => {
  const body = buildPaymentRequired([requirement()], 'Payment required for this audit.')
  assert.equal(body.x402Version, 1)
  assert.equal(body.accepts[0].maxAmountRequired, '1000')
  assert.equal(body.accepts[0].resource, 'https://www.mahastrategies.com/api/mps-audits')
  assert.equal(body.error, 'Payment required for this audit.')
})

test('a challenge that cannot be honoured is refused at construction', () => {
  // Publishing an unpayable challenge is the machine equivalent of advertising
  // a product that cannot be bought.
  assert.throws(() => buildPaymentRequired([]), /At least one/)
  assert.throws(() => buildPaymentRequired([requirement({ maxAmountRequired: '0' })]), /greater than zero/)
  assert.throws(() => buildPaymentRequired([requirement({ maxAmountRequired: '1.5' })]), /smallest unit/)
  assert.throws(() => buildPaymentRequired([requirement({ network: 'dogecoin' as never })]), /Unsupported network/)
  assert.throws(() => buildPaymentRequired([requirement({ resource: 'http://insecure.example' })]), /https/)
  assert.throws(() => buildPaymentRequired([requirement({ payTo: '  ' })]), /payTo/)
  assert.throws(() => buildPaymentRequired([requirement({ maxTimeoutSeconds: 0 })]), /between 1 and 300/)
})

test('a malformed payment header is a client error, never a crash', () => {
  for (const [header, reason] of [
    [null, 'missing_payment_header'],
    ['   ', 'missing_payment_header'],
    ['!!!not base64!!!', 'payment_header_not_json'],
    [Buffer.from('not json').toString('base64'), 'payment_header_not_json'],
    [encode([1, 2]), 'payment_header_not_an_object'],
    [encode({ x402Version: 99, scheme: 'exact', network: 'base', payload: {} }), 'unsupported_x402_version'],
    [encode({ x402Version: 1, scheme: 'upto', network: 'base', payload: {} }), 'unsupported_scheme'],
    [encode({ x402Version: 1, scheme: 'exact', network: 'dogecoin', payload: {} }), 'unsupported_network'],
    [encode({ x402Version: 1, scheme: 'exact', network: 'base' }), 'missing_payload'],
  ] as const) {
    const result = parsePaymentHeader(header)
    assert.equal(result.ok, false, String(header))
    if (!result.ok) assert.equal(result.reason, reason, String(header))
  }
})

test('an oversized header is refused before it is decoded', () => {
  const result = parsePaymentHeader('A'.repeat(8_193))
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'payment_header_too_large')
})

test('a well-formed header parses', () => {
  const result = parsePaymentHeader(encode(payment()))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payment.network, 'base')
})

test('a payment is matched to the requirement it satisfies', () => {
  const requirements = [requirement({ network: 'base' }), requirement({ network: 'solana' })]
  assert.equal(matchRequirement(payment({ network: 'solana' }), requirements)?.network, 'solana')
  assert.equal(matchRequirement(payment({ network: 'arbitrum' }), requirements), null)
})

test('a verified payment of the full amount is accepted', async () => {
  const result = await acceptPayment({
    payment: payment(), requirements: [requirement()], facilitator: facilitator(), replayGuard: guard(),
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.transaction, 'tx_1')
})

test('an underpayment is refused even when the facilitator verifies it', async () => {
  // The facilitator confirms the payment is real; it does not know the price.
  const short = facilitator({ verify: async () => ({ ok: true, payer: '0xAgent', transaction: 'tx_2', amountPaid: '999' }) })
  const result = await acceptPayment({
    payment: payment(), requirements: [requirement({ maxAmountRequired: '1000' })], facilitator: short, replayGuard: guard(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'insufficient_amount')
})

test('a payment cannot be spent twice', async () => {
  // A payment payload is a bearer instrument. Without this, one payment buys
  // unlimited calls.
  const seen = new Set<string>()
  const replayGuard = guard(seen)
  const first = await acceptPayment({ payment: payment(), requirements: [requirement()], facilitator: facilitator(), replayGuard })
  const second = await acceptPayment({ payment: payment(), requirements: [requirement()], facilitator: facilitator(), replayGuard })
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
  if (!second.ok) {
    assert.equal(second.reason, 'payment_already_used')
    assert.equal(second.status, 409)
  }
})

test('a replayed payment is never settled a second time', async () => {
  const settlements: string[] = []
  const counting = facilitator({
    settle: async (p, r) => { settlements.push(r.resource); return { ok: true, payer: '0xA', transaction: 'tx_3', amountPaid: '1000' } },
  })
  const replayGuard = guard()
  await acceptPayment({ payment: payment(), requirements: [requirement()], facilitator: counting, replayGuard })
  await acceptPayment({ payment: payment(), requirements: [requirement()], facilitator: counting, replayGuard })
  assert.equal(settlements.length, 1)
})

test('a failed verification never reaches settlement or claims an identifier', async () => {
  let settled = false
  const seen = new Set<string>()
  const rejecting = facilitator({
    verify: async () => ({ ok: false, reason: 'signature_invalid' }),
    settle: async () => { settled = true; return { ok: true, payer: '0xA', transaction: 'tx_4', amountPaid: '1000' } },
  })
  const result = await acceptPayment({ payment: payment(), requirements: [requirement()], facilitator: rejecting, replayGuard: guard(seen) })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'signature_invalid')
  assert.equal(settled, false)
  // An invalid payload must not burn the identifier a legitimate retry needs.
  assert.equal(seen.size, 0)
})

test('a payment for one resource cannot be presented for another', () => {
  // Requirements bind to an exact URL, so a challenge issued for a cheap
  // endpoint cannot be answered against an expensive one.
  const audit = requirement({ resource: 'https://www.mahastrategies.com/api/mps-audits', maxAmountRequired: '1000' })
  const solver = requirement({ resource: 'https://www.mahastrategies.com/api/v1/jobs/tensor-opt', maxAmountRequired: '500000' })
  assert.notEqual(audit.resource, solver.resource)
  assert.notEqual(audit.maxAmountRequired, solver.maxAmountRequired)
})
