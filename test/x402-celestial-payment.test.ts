import assert from 'node:assert/strict'
import test from 'node:test'
import { CELESTIAL_OFFERS } from '../lib/x402/celestial-offers.ts'
import { celestialHandlers } from '../lib/x402/celestial-route.ts'
import { verifyCelestialProduct, type CelestialProductId } from '../lib/x402/celestial-products.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { x402Config } from '../lib/x402/config.ts'
import type { OfferUsageInput } from '../lib/x402/offer-telemetry.ts'

const config = x402Config({ X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0x' + '2'.repeat(40), X402_ASSET: '0x' + '3'.repeat(40), X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify(CELESTIAL_OFFERS.map(o => ({ method: 'POST', path: o.path }))) })!
// Inject every external effect. This file never settles on Base or calls a provider.
function fixture(offer = CELESTIAL_OFFERS[0], options: { rejected?: boolean; chainFailed?: boolean; duplicate?: boolean; noLedger?: boolean; capacity?: boolean; thrown?: boolean } = {}) {
  const calls = { verify: 0, settle: 0, release: 0, rpc: [] as Record<string, unknown>[], usage: [] as OfferUsageInput[] }
  const handlers = celestialHandlers(offer.id as CelestialProductId, {
    environment: 'test', record: async input => { calls.usage.push(input) }, release: async () => { calls.release++ },
    resolve: request => resolveX402(request, { config,
      ledger: options.noLedger ? null : { rpc: async (name, args) => { calls.rpc.push({ name, ...args }); return { data: options.duplicate ? 'duplicate' : 'claimed', error: null } } },
      facilitator: {
        verify: async (_payment, requirement) => { calls.verify++; assert.equal(requirement.amount, offer.amount); return options.rejected ? { ok: false, reason: 'synthetic_rejection' } : { ok: true, payer: '0x' + '4'.repeat(40) } },
        settle: async () => { calls.settle++; if (options.thrown) throw new Error('synthetic-sensitive-marker'); return { ok: true, payer: '0x' + '4'.repeat(40), transaction: '0x' + '5'.repeat(64) } },
      },
      confirmOnChain: async () => options.chainFailed ? { status: 'contradicted', reason: 'synthetic_mismatch' } : { status: 'confirmed', blockNumber: 1, amount: offer.amount },
      acquire: async () => { assert.equal(calls.settle, 0); return { admitted: !options.capacity, active: 1, token: 'synthetic-slot' } },
      release: async () => { calls.release++ },
    }),
  })
  const request = (body: unknown = offer.discovery.input, headers: Record<string, string> = {}, query = '') => new Request('https://www.mahastrategies.com' + offer.path + query,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const signature = async () => {
    const challenge = await handlers.POST(request())
    assert.equal(challenge.status, 402)
    const body = await challenge.json()
    // Standard digest binding keeps the signed header bounded.
    return Buffer.from(JSON.stringify({ x402Version: 2, resource: body.resource, accepted: body.accepts[0],
      extensions: { 'declaration-integrity': body.extensions['declaration-integrity'] }, payload: { signature: '0xsynthetic' } })).toString('base64')
  }
  return { calls, handlers, request, signature }
}

test('discovery/payment: each free GET and unpaid 402 matches its own declared price and request', async () => {
  for (const offer of CELESTIAL_OFFERS) {
    const f = fixture(offer)
    const get = await f.handlers.GET(new Request('https://www.mahastrategies.com' + offer.path))
    assert.equal(get.status, 200)
    assert.equal((await get.json()).offer.status, 'available')
    const challenge = await f.handlers.POST(f.request())
    assert.equal(challenge.status, 402)
    const body = await challenge.json()
    assert.deepEqual(JSON.parse(Buffer.from(challenge.headers.get('PAYMENT-REQUIRED')!, 'base64').toString()), body)
    assert.equal(body.accepts[0].amount, offer.amount)
    assert.deepEqual(body.extensions.bazaar.info.input.body, offer.discovery.input)
    assert.equal(f.calls.settle, 0)
  }
})

test('payment then delivery: synthetic settled result carries payload and receipt, frees its slot, and records no calculation data', async () => {
  for (const offer of CELESTIAL_OFFERS) {
    const f = fixture(offer)
    const signature = await f.signature()
    const paid = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(paid.status, 200)
    assert.equal(paid.headers.get('cache-control'), 'no-store')
    assert.ok(paid.headers.get('PAYMENT-RESPONSE'))
    const product = await paid.json()
    assert.ok(verifyCelestialProduct(offer.id as CelestialProductId, offer.discovery.input, product))
    assert.equal(f.calls.settle, 1)
    assert.equal(f.calls.release, 1)
    const persisted = JSON.stringify([f.calls.rpc, f.calls.usage])
    for (const field of ['instantUtc', 'referenceInstantUtc', 'latitudeDegrees', 'longitudeDegrees', 'inputDigest', 'receiptDigest', 'conventions']) assert.ok(!persisted.includes(field), field)
    assert.ok(!persisted.includes(String(offer.discovery.input.instantUtc)))
  }
})

test('payment rejection, missing ledger, duplicate and chain contradiction never deliver a calculation', async () => {
  for (const [options, expected, settlements] of [[{ rejected: true }, 402, 0], [{ noLedger: true }, 503, 0], [{ duplicate: true }, 409, 0], [{ chainFailed: true }, 502, 1]] as const) {
    const f = fixture(undefined, options)
    const signature = await f.signature()
    const rejected = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(rejected.status, expected)
    assert.ok(!('result' in await rejected.json()))
    assert.equal(f.calls.settle, settlements)
    assert.equal(f.calls.release, options.noLedger ? 0 : 1)
  }
})

test('privacy and billing: query strings, enterprise keys and invalid inputs are rejected before payment', async () => {
  const f = fixture()
  const signed = { 'PAYMENT-SIGNATURE': await f.signature() }
  for (const request of [f.request(undefined, signed, '?birth=synthetic-sensitive-marker'),
    f.request(undefined, { ...signed, Authorization: 'Bearer synthetic-enterprise-key' }),
    f.request(undefined, { ...signed, 'x-api-key': 'synthetic-enterprise-key' }),
    f.request({ ...CELESTIAL_OFFERS[0].discovery.input, name: 'synthetic-sensitive-marker' }, signed)]) {
    const result = await f.handlers.POST(request)
    assert.equal(result.status, 400)
    assert.ok(!(await result.text()).includes('synthetic-sensitive-marker'))
  }
  assert.equal(f.calls.settle, 0)
  assert.equal((await f.handlers.POST(f.request({ text: 'x'.repeat(3000) }, signed))).status, 413)
  const spoofed = await f.handlers.POST(f.request(undefined, { 'x-maha-access-mode': 'x402', 'x-maha-payment-transaction': 'fake' }))
  assert.equal(spoofed.status, 402)
  const unavailable = celestialHandlers('celestial-position-snapshot', { environment: 'test', resolve: async () => { throw new Error('synthetic-sensitive-marker') } })
  const failed = await unavailable.POST(f.request())
  assert.equal(failed.status, 503)
  assert.ok(!(await failed.text()).includes('synthetic-sensitive-marker'))
})

test('capacity refusal never settles; exceptional settlement frees the reservation without leaking input', async () => {
  const full = fixture(undefined, { capacity: true })
  const refused = await full.handlers.POST(full.request(undefined, { 'PAYMENT-SIGNATURE': await full.signature() }))
  assert.equal(refused.status, 429)
  assert.equal(full.calls.settle, 0)
  assert.equal(full.calls.release, 0)
  const broken = fixture(undefined, { thrown: true })
  const response = await broken.handlers.POST(broken.request(undefined, { 'PAYMENT-SIGNATURE': await broken.signature() }))
  assert.ok(response.status >= 400)
  assert.equal(broken.calls.release, 1)
  assert.ok(!(await response.text()).includes('synthetic-sensitive-marker'))
})
