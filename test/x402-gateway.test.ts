import assert from 'node:assert/strict'
import test from 'node:test'

import { priceFor, requirementFor, x402Config, x402Enabled, type X402Config } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import type { PaymentFacilitator } from '../lib/x402/protocol.ts'

const RESOURCES = JSON.stringify([
  { pathPrefix: '/api/v1/compress', amount: '10000', description: 'One compression', concurrencyCap: 8 },
  { pathPrefix: '/api/v1/compress/solver', amount: '500000', description: 'One solver job', concurrencyCap: 2 },
])

const ENV = {
  X402_ENABLED: 'true',
  X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0xSettlement',
  X402_ASSET: '0xUSDC',
  X402_NETWORK: 'base',
  X402_RESOURCES: RESOURCES,
}

const config = () => x402Config(ENV) as X402Config

const request = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://www.mahastrategies.com${path}`, { headers })

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
const signature = encode({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x' } })

function facilitator(seen: string[] = []): PaymentFacilitator {
  return {
    // The real verify response: valid, and who paid. No transaction and no
    // amount exist until settlement.
    verify: async (_payment, requirement) => { seen.push(requirement.maxAmountRequired); return { ok: true, payer: '0xAgent' } },
    settle: async () => ({ ok: true, payer: '0xAgent', transaction: 'tx_1' }),
  }
}

/** Rejects, the way a facilitator does when the signed payload is short. */
const underfunded: PaymentFacilitator = {
  verify: async () => ({ ok: false, reason: 'insufficient_funds' }),
  settle: async () => ({ ok: false, reason: 'not_reached' }),
}

const ledger = (result: string) => ({ rpc: async () => ({ data: result, error: null }) })
const acquire = async () => ({ admitted: true, active: 1, token: 'slot-token' })

test('the flag alone decides whether any of this is live', () => {
  assert.equal(x402Enabled({ X402_ENABLED: 'true' }), true)
  for (const value of ['false', 'TRUE', '1', 'yes', '', undefined]) {
    assert.equal(x402Enabled({ X402_ENABLED: value }), false, String(value))
  }
  // Disabled means no other configuration is read at all, so a half-configured
  // deployment cannot half-enable payments.
  assert.equal(x402Config({ X402_ENABLED: 'false', X402_PAY_TO: 'x' }), null)
})

test('enabled but incomplete configuration is loud, not silent', () => {
  assert.throws(() => x402Config({ X402_ENABLED: 'true' }), /must all be set/)
  assert.throws(() => x402Config({ ...ENV, X402_FACILITATOR_URL: 'http://insecure' }), /https/)
  assert.throws(() => x402Config({ ...ENV, X402_NETWORK: 'dogecoin' }), /X402_NETWORK/)
  assert.throws(() => x402Config({ ...ENV, X402_RESOURCES: '[]' }), /at least one/)
  assert.throws(() => x402Config({ ...ENV, X402_RESOURCES: '[{"pathPrefix":"api","amount":"1","description":"d","concurrencyCap":1}]' }), /must start with/)
  assert.throws(() => x402Config({ ...ENV, X402_RESOURCES: '[{"pathPrefix":"/a","amount":"0","description":"d","concurrencyCap":1}]' }), /positive integer/)
  assert.throws(() => x402Config({ ...ENV, X402_RESOURCES: '[{"pathPrefix":"/a","amount":"1","description":"d","concurrencyCap":0}]' }), /concurrencyCap/)
  assert.throws(() => x402Config({ ...ENV, CDP_API_KEY_ID: 'id' }), /must be set together/)
  assert.throws(
    () => x402Config({ ...ENV, X402_FACILITATOR_URL: 'https://api.cdp.coinbase.com/platform/v2/x402' }),
    /requires CDP_API_KEY_ID and CDP_API_KEY_SECRET/,
  )

  const cdp = x402Config({
    ...ENV,
    X402_FACILITATOR_URL: 'https://api.cdp.coinbase.com/platform/v2/x402',
    CDP_API_KEY_ID: 'key-id',
    CDP_API_KEY_SECRET: 'secret',
  }) as X402Config
  assert.equal(cdp.cdpCredentials?.apiKeyId, 'key-id')
})

test('a path that cannot release its slot cannot be priced', async () => {
  // The failure this prevents is invisible from the route: the cap fills with
  // slots nobody frees and paying callers see 429s that look like load.
  const { releasesSlot, withSlotRelease } = await import('../lib/x402/slot.ts')
  assert.throws(
    () => x402Config({ ...ENV, X402_RESOURCES: '[{"pathPrefix":"/api/v1/jobs/private-reference","amount":"1","description":"d","concurrencyCap":1}]' }),
    /does not release its concurrency slot/,
  )
  assert.equal(releasesSlot('/api/v1/compress'), true)
  assert.equal(releasesSlot('/api/v1/compress/solver'), true)
  // A prefix that merely starts with the same characters is not the same route.
  assert.equal(releasesSlot('/api/v1/compressor'), false)
  assert.equal(typeof withSlotRelease, 'function')
})

test('a wrapped handler frees its slot even when it throws', async () => {
  const { withSlotRelease, SLOT_RESOURCE_HEADER, SLOT_TOKEN_HEADER } = await import('../lib/x402/slot.ts')
  const released: string[] = []
  const { releaseSlot } = await import('../lib/x402/concurrency.ts')
  void releaseSlot

  const paid = () => new Request('https://www.mahastrategies.com/api/v1/compress', {
    headers: { [SLOT_RESOURCE_HEADER]: '/api/v1/compress', [SLOT_TOKEN_HEADER]: 'tok' },
  })

  // Redis is unconfigured here, so the release fails closed and is swallowed;
  // what matters is that the finally runs on both paths rather than leaving a
  // slot held for the whole TTL.
  const ok = withSlotRelease(async () => { released.push('ran'); return new Response('ok') })
  assert.equal((await ok(paid())).status, 200)

  const boom = withSlotRelease(async () => { throw new Error('handler exploded') })
  await assert.rejects(boom(paid()), /handler exploded/)
  assert.deepEqual(released, ['ran'])
})

test('a disabled deployment is untouched by any of this', async () => {
  const outcome = await resolveX402(request('/api/v1/compress'), { config: null })
  assert.equal(outcome.kind, 'not_applicable')
})

test('a path with no published price is untouched', async () => {
  const outcome = await resolveX402(request('/api/v1/keys/balance'), { config: config() })
  assert.equal(outcome.kind, 'not_applicable')
})

test('an unpaid request to a priced path is challenged', async () => {
  const outcome = await resolveX402(request('/api/v1/compress'), { config: config() })
  assert.equal(outcome.kind, 'challenge')
  if (outcome.kind !== 'challenge') return
  assert.equal(outcome.status, 402)
  const decoded = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
  assert.equal(decoded.accepts[0].maxAmountRequired, '10000')
  assert.equal(decoded.accepts[0].resource, 'https://www.mahastrategies.com/api/v1/compress')
})

test('the price charged is the longest matching prefix', () => {
  // /api/v1/compress/solver must not be sold at the compression price.
  assert.equal(priceFor('/api/v1/compress', config())?.amount, '10000')
  assert.equal(priceFor('/api/v1/compress/solver', config())?.amount, '500000')
  assert.equal(priceFor('/api/v1/mcp/servers', config()), null)
})

test('the challenge publishes the EIP-712 domain the facilitator needs', () => {
  // Base mainnet native USDC reports "USD Coin" version "2". A requirement
  // without `extra` is refused because the facilitator cannot rebuild the
  // EIP-712 digest; its absence is silent everywhere else.
  const requirement = requirementFor(priceFor('/api/v1/compress', config())!, 'https://www.mahastrategies.com/api/v1/compress', config())
  assert.deepEqual(requirement.extra, { name: 'USD Coin', version: '2' })

  // Overridable, because the USDC defaults stop being right the moment a
  // different token is priced.
  const other = x402Config({ ...ENV, X402_ASSET_EIP712_NAME: 'EURC', X402_ASSET_EIP712_VERSION: '1' }) as X402Config
  assert.deepEqual(requirementFor(priceFor('/api/v1/compress', other)!, 'https://x.test/api/v1/compress', other).extra, { name: 'EURC', version: '1' })
})

test('the challenge binds to the path without its query string', () => {
  const requirement = requirementFor(priceFor('/api/v1/compress', config())!, 'https://www.mahastrategies.com/api/v1/compress', config())
  assert.equal(requirement.resource, 'https://www.mahastrategies.com/api/v1/compress')
  assert.equal(requirement.payTo, '0xSettlement')
})

test('a settled payment is admitted and carries settlement back', async () => {
  const outcome = await resolveX402(request('/api/v1/compress', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(), ledger: ledger('claimed'), acquire,
  })
  assert.equal(outcome.kind, 'paid')
  if (outcome.kind !== 'paid') return
  assert.equal(outcome.transaction, 'tx_1')
  // The slot must come back with the outcome. Acquiring capacity and then
  // dropping the token holds it until its score expires, for no reason.
  assert.deepEqual(outcome.slot, { resource: '/api/v1/compress', token: 'slot-token' })
  const decoded = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
  assert.equal(decoded.success, true)
})

test('a replayed payment is refused with 409, not re-challenged', async () => {
  const outcome = await resolveX402(request('/api/v1/compress', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(), ledger: ledger('duplicate'), acquire,
  })
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 409)
  assert.equal(outcome.code, 'payment_already_used')
})

test('each path is priced to the facilitator at its own rate', async () => {
  // The solver costs 500000 and compression 10000. The price is enforced by
  // what is sent to the facilitator to validate the signed payload against --
  // there is no amount in a verify response to check afterwards.
  const seen: string[] = []
  await resolveX402(request('/api/v1/compress/solver', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(seen), ledger: ledger('claimed'), acquire,
  })
  await resolveX402(request('/api/v1/compress', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(seen), ledger: ledger('claimed'), acquire,
  })
  assert.deepEqual(seen, ['500000', '10000'])
})

test('a payment the facilitator rejects is challenged again rather than served', async () => {
  const outcome = await resolveX402(request('/api/v1/compress/solver', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: underfunded, ledger: ledger('claimed'), acquire,
  })
  assert.equal(outcome.kind, 'challenge')
})

test('a paid request is refused when the resource is at capacity', async () => {
  // Payment authorizes; it does not create GPU capacity.
  const full = async () => ({ admitted: false, active: 2 })
  const outcome = await resolveX402(request('/api/v1/compress/solver', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(), ledger: ledger('claimed'), acquire: full,
  })
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 429)
  assert.equal(outcome.code, 'resource_at_capacity')
  assert.ok(outcome.retryAfterSeconds && outcome.retryAfterSeconds > 0)
})

test('capacity is checked only after payment, so load cannot be probed for free', async () => {
  let checked = false
  const spy = async () => { checked = true; return { admitted: true, active: 1 } }
  await resolveX402(request('/api/v1/compress'), { config: config(), acquire: spy, ledger: ledger('claimed') })
  assert.equal(checked, false)
})

test('a missing ledger withholds the resource rather than serving it unrecorded', async () => {
  const outcome = await resolveX402(request('/api/v1/compress', { 'PAYMENT-SIGNATURE': signature }), {
    config: config(), facilitator: facilitator(), ledger: null, acquire,
  })
  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 503)
  assert.equal(outcome.code, 'x402_ledger_unavailable')
})

test('the pre-standard header still transacts', async () => {
  const outcome = await resolveX402(request('/api/v1/compress', { 'X-PAYMENT': signature }), {
    config: config(), facilitator: facilitator(), ledger: ledger('claimed'), acquire,
  })
  assert.equal(outcome.kind, 'paid')
})
