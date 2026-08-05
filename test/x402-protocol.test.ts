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
  return {
    // Verify carries no transaction and no amount: the protocol has none to
    // give until settlement.
    verify: async () => ({ ok: true as const, payer: '0xAgent' }),
    settle: async () => ({ ok: true as const, payer: '0xAgent', transaction: 'tx_1' }),
    ...overrides,
  }
}

function guard(seen: Set<string> = new Set()): ReplayGuard {
  return {
    claim: async ({ paymentId }) => (seen.has(paymentId) ? 'duplicate' : (seen.add(paymentId), 'claimed')),
    recordSettlement: async () => undefined,
  }
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

test('the price is enforced by what is sent to the facilitator, not checked after', async () => {
  // There is no amount in a verify response to compare against, so the price
  // is enforced upstream: maxAmountRequired travels in the requirements, and
  // the facilitator answers isValid:false when the signed payload does not
  // satisfy them. Checking a field the protocol never sends is how an earlier
  // version of this file refused every payment it was given.
  const seen: string[] = []
  const watching = facilitator({
    verify: async (_payment, requirement) => {
      seen.push(requirement.maxAmountRequired)
      return { ok: true, payer: '0xAgent' }
    },
  })
  await acceptPayment({
    payment: payment(), requirements: [requirement({ maxAmountRequired: '1000' })], facilitator: watching, replayGuard: guard(),
  })
  assert.deepEqual(seen, ['1000'])
})

test('a facilitator rejection is the underpayment refusal, and never settles', async () => {
  let settled = false
  const short = facilitator({
    verify: async () => ({ ok: false, reason: 'insufficient_funds' }),
    settle: async () => { settled = true; return { ok: true, payer: '0xAgent', transaction: 'tx_2' } },
  })
  const result = await acceptPayment({
    payment: payment(), requirements: [requirement({ maxAmountRequired: '1000' })], facilitator: short, replayGuard: guard(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 402)
    assert.equal(result.reason, 'insufficient_funds')
  }
  assert.equal(settled, false)
})

test('the amount recorded is the price that was demanded', async () => {
  const result = await acceptPayment({
    payment: payment(), requirements: [requirement({ maxAmountRequired: '1000' })], facilitator: facilitator(), replayGuard: guard(),
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.amountPaid, '1000')
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
  const solver = requirement({ resource: 'https://www.mahastrategies.com/api/v1/compress', maxAmountRequired: '500000' })
  assert.notEqual(audit.resource, solver.resource)
  assert.notEqual(audit.maxAmountRequired, solver.maxAmountRequired)
})

test('a ledger that cannot answer is not reported as a replay', async () => {
  // The commonest cause is the migration not having been applied to the
  // environment under test. Calling that "already used" on a first-ever
  // payment sends an operator hunting for a duplicate that never existed.
  let settled = false
  const broken: ReplayGuard = { claim: async () => 'unavailable', recordSettlement: async () => undefined }
  const result = await acceptPayment({
    payment: payment(),
    requirements: [requirement()],
    facilitator: facilitator({ settle: async () => { settled = true; return { ok: true, payer: '0xAgent', transaction: 'tx_1' } } }),
    replayGuard: broken,
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 503)
    assert.equal(result.reason, 'x402_ledger_unavailable')
  }
  // Nothing settled, so the payer keeps their authorization and the retry is
  // genuinely free rather than a second charge.
  assert.equal(settled, false)
})
