import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { microHandlers } from '../lib/x402/micro-route.ts'
import { MICRO_MAX_REQUEST_BYTES, type MicroProductId } from '../lib/x402/micro-contracts.ts'
import { buildMicroProduct, verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { x402Config } from '../lib/x402/config.ts'
import type { OfferUsageInput } from '../lib/x402/offer-telemetry.ts'

// Provider, ledger, telemetry and slot effects are injected. Accidental HTTP is a test failure.
const originalFetch = globalThis.fetch
let httpCalls = 0
globalThis.fetch = async () => { httpCalls++; throw new Error('network-forbidden-in-local-micro-tests') }
after(() => { globalThis.fetch = originalFetch; assert.equal(httpCalls, 0) })
const config = x402Config({ X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402',
  X402_PAY_TO: '0x' + '2'.repeat(40), X402_ASSET: '0x' + '3'.repeat(40), X402_NETWORK: 'base',
  X402_RESOURCES: JSON.stringify(MICRO_OFFERS.map(o => ({ method: 'POST', path: o.path }))) })!
type Options = { rejected?: boolean; capacity?: boolean; noLedger?: boolean; chainFailed?: boolean; throwSettle?: boolean; telemetryFails?: boolean; releaseFails?: boolean; environment?: string }
function fixture(offer = MICRO_OFFERS[0], options: Options = {}) {
  const calls = { verify: 0, settle: 0, resolve: 0, release: 0, order: [] as string[], rpc: [] as Record<string, unknown>[], usage: [] as OfferUsageInput[] }
  const claimed = new Set<string>()
  const handlers = microHandlers(offer.id as MicroProductId, {
    environment: options.environment ?? 'test',
    record: async event => { calls.usage.push(event); if (options.telemetryFails) throw new Error('private-telemetry-marker') },
    release: async () => { calls.release++; if (options.releaseFails) throw new Error('private-release-marker') },
    resolve: request => { calls.resolve++; return resolveX402(request, { config,
      ledger: options.noLedger ? null : { rpc: async (name, args) => {
        calls.rpc.push({ name, ...args })
        if (name !== 'claim_x402_payment') return { data: null, error: null }
        const id = String(args.p_payment_id)
        if (claimed.has(id)) return { data: 'duplicate', error: null }
        claimed.add(id)
        return { data: 'claimed', error: null }
      } },
      facilitator: { verify: async (_payment, requirement) => {
        calls.verify++; assert.equal(requirement.amount, offer.amount)
        return options.rejected ? { ok: false, reason: 'synthetic-rejection' } : { ok: true, payer: '0x' + '4'.repeat(40) }
      }, settle: async () => { calls.order.push('settle'); calls.settle++; if (options.throwSettle) throw new Error('private-settlement-marker'); return { ok: true, payer: '0x' + '4'.repeat(40), transaction: '0x' + '5'.repeat(64) } } },
      confirmOnChain: async () => options.chainFailed ? { status: 'contradicted', reason: 'synthetic-mismatch' } : { status: 'confirmed', blockNumber: 1, amount: offer.amount },
      acquire: async () => { calls.order.push('acquire'); return { admitted: !options.capacity, active: 1, token: 'synthetic-slot' } },
      release: async () => { calls.release++ },
    }) },
  })
  const request = (body: unknown = offer.discovery.input, headers: Record<string, string> = {}, query = '') => new Request('https://www.mahastrategies.com' + offer.path + query, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
  const signature = async () => {
    const challenge = await handlers.POST(request())
    assert.equal(challenge.status, 402)
    const body = await challenge.json()
    return Buffer.from(JSON.stringify({ x402Version: 2, resource: body.resource, accepted: body.accepts[0], extensions: { 'declaration-integrity': body.extensions['declaration-integrity'] }, payload: { signature: '0xsynthetic' } })).toString('base64')
  }
  return { calls, handlers, request, signature }
}

for (const offer of MICRO_OFFERS) {
  test(`${offer.id}: GET is free, synthetic challenge has exact price, confirmed settlement gates the result`, async () => {
    const f = fixture(offer)
    const get = await f.handlers.GET(new Request('https://www.mahastrategies.com' + offer.path))
    assert.equal(get.status, 200); assert.equal(f.calls.resolve, 0)
    assert.equal((await get.json()).offer.status, offer.status)
    const signature = await f.signature()
    const paid = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(paid.status, 200)
    assert.equal(paid.headers.get('cache-control'), 'no-store')
    assert.equal(paid.headers.get('access-control-expose-headers')?.includes('PAYMENT-RESPONSE'), true)
    assert.ok(paid.headers.get('PAYMENT-RESPONSE'))
    assert.ok(await verifyMicroProduct(offer.id as MicroProductId, offer.discovery.input, await paid.json()))
    assert.equal(f.calls.settle, 1); assert.equal(f.calls.release, 1)
    assert.deepEqual(f.calls.order, ['acquire', 'settle'])
    const stored = JSON.stringify([f.calls.rpc, f.calls.usage])
    for (const field of ['inputDigest', 'receiptDigest', 'assessedAtUtc', 'bindings', 'sourceRevision', 'expectedRegistryDigest', 'expectedContentDigest', 'planDigest']) assert.ok(!stored.includes(field), field)
  })
  test(`${offer.id}: deployment gate admits only the reviewed cohort; unknown environments refuse`, async () => {
    for (const environment of ['production', 'preview', 'unknown']) {
      const f = fixture(offer, { environment })
      const r = await f.handlers.POST(f.request())
      const enabled = offer.availability.payableInProduction && environment !== 'unknown'
      assert.equal(r.status, enabled ? 402 : 503); assert.equal(f.calls.resolve, enabled ? 1 : 0); assert.equal(f.calls.settle, 0)
    }
  })
}

test('invalid inputs and unsupported corpus selectors refuse before a payment is considered', async () => {
  for (const offer of MICRO_OFFERS) {
    const f = fixture(offer)
    const r = await f.handlers.POST(f.request({ ...offer.discovery.input, customerSubmission: 'private-input-marker' }, { 'PAYMENT-SIGNATURE': 'synthetic' }))
    assert.equal(r.status, 400); assert.equal(f.calls.resolve, 0)
    assert.ok(!(await r.text()).includes('private-input-marker'))
  }
  const f = fixture(MICRO_OFFERS.find(o => o.id === 'release-bound-evidence-packet'))
  assert.equal((await f.handlers.POST(f.request({ ...MICRO_OFFERS.find(o => o.id === 'release-bound-evidence-packet')!.discovery.input, expectedContentDigest: 'sha256:' + '0'.repeat(64) }))).status, 400)
  assert.equal(f.calls.resolve, 0)
})

test('one signed authorization cannot buy two responses, even under concurrent replay', async () => {
  const f = fixture(), signature = await f.signature()
  const results = await Promise.all([1, 2].map(() => f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))))
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  assert.equal(f.calls.settle, 1)
  assert.equal(f.calls.release, 2)
})

test('a signature for a different offer or price cannot settle', async () => {
  const first = fixture(MICRO_OFFERS[0]), second = fixture(MICRO_OFFERS[1])
  const signature = await first.signature()
  assert.equal((await second.handlers.POST(second.request(undefined, { 'PAYMENT-SIGNATURE': signature }))).status, 402)
  assert.equal(second.calls.settle, 0)
  const payload = JSON.parse(Buffer.from(signature, 'base64').toString())
  payload.accepted.amount = '1'
  const bad = Buffer.from(JSON.stringify(payload)).toString('base64')
  assert.equal((await first.handlers.POST(first.request(undefined, { 'PAYMENT-SIGNATURE': bad }))).status, 402)
  assert.equal(first.calls.settle, 0)
})

test('rejection, missing ledger, chain contradiction and capacity failures never deliver results', async () => {
  for (const [options, expected, settlements] of [[{ rejected: true }, 402, 0], [{ noLedger: true }, 503, 0], [{ chainFailed: true }, 502, 1], [{ capacity: true }, 429, 0]] as const) {
    const f = fixture(undefined, options), signature = await f.signature()
    const r = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
    assert.equal(r.status, expected); assert.ok(!('result' in await r.json())); assert.equal(f.calls.settle, settlements)
  }
})

test('exceptional payment outcomes are sanitized, never represented as free retry authority', async () => {
  const f = fixture(undefined, { throwSettle: true }), signature = await f.signature()
  const response = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
  assert.ok(response.status >= 400); assert.equal(f.calls.release, 1)
  assert.ok(!(await response.text()).includes('private-settlement-marker'))
  const unknown = microHandlers('citation-binding-check', { environment: 'test', resolve: async () => { throw new Error('private-token-marker') } })
  const r = await unknown.POST(f.request())
  assert.equal(r.status, 503)
  assert.equal((await r.json()).error.code, 'payment_outcome_unknown_check_settlement_before_repaying')
})

test('telemetry or slot-release failure cannot swallow an already paid response', async () => {
  const f = fixture(undefined, { telemetryFails: true, releaseFails: true }), signature = await f.signature()
  const r = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
  assert.equal(r.status, 200)
  const text = await r.text()
  assert.ok(!text.includes('private-telemetry-marker') && !text.includes('private-release-marker'))
})

test('method, queries, enterprise keys and spoofed internal payment headers cannot bypass the gate', async () => {
  const f = fixture()
  for (const request of [f.request(undefined, {}, '?input=private-marker'), f.request(undefined, { Authorization: 'Bearer private-marker' }), f.request(undefined, { 'x-api-key': 'private-marker' }), new Request('https://www.mahastrategies.com' + MICRO_OFFERS[0].path, { method: 'GET' })]) {
    assert.equal((await f.handlers.POST(request)).status, 400)
  }
  assert.equal(f.calls.resolve, 0)
  assert.equal((await f.handlers.POST(f.request(undefined, { 'x-maha-access-mode': 'x402', 'x-maha-payment-transaction': 'forged' }))).status, 402)
  assert.equal(f.calls.settle, 0)
  assert.equal((await f.handlers.OPTIONS()).status, 204)
})

test('oversized streamed bodies, malformed UTF-8, compressed and non-JSON bodies refuse unpaid', async () => {
  const f = fixture(), url = 'https://www.mahastrategies.com' + MICRO_OFFERS[0].path
  assert.equal((await f.handlers.POST(f.request({ padding: 'x'.repeat(MICRO_MAX_REQUEST_BYTES) }))).status, 413)
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(MICRO_MAX_REQUEST_BYTES + 1)); controller.close() } })
  const streamed = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' } as RequestInit)
  assert.equal((await f.handlers.POST(streamed)).status, 413)
  assert.equal((await f.handlers.POST(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: new Uint8Array([0xff, 0xff]) }))).status, 400)
  assert.equal((await f.handlers.POST(f.request(undefined, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await f.handlers.POST(f.request(undefined, { 'Content-Encoding': 'gzip' }))).status, 415)
  assert.equal(f.calls.resolve, 0)
})

test('local pre-payment work cap refuses the fifth concurrent operation before settlement', async () => {
  let finish!: () => void
  const wait = new Promise<void>(r => { finish = r })
  const handlers = microHandlers('citation-binding-check', { environment: 'test', build: async (id, input) => { await wait; return buildMicroProduct(id, input) }, resolve: async () => ({ kind: 'not_applicable' }) })
  const f = fixture()
  const pending = [1, 2, 3, 4].map(() => handlers.POST(f.request()))
  assert.equal((await handlers.POST(f.request())).status, 429)
  finish(); await Promise.all(pending)
  assert.equal((await handlers.POST(f.request())).status, 503)
})

test('a body that never ends times out before payment and releases local work capacity', async () => {
  const f = fixture()
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  const request = new Request('https://www.mahastrategies.com' + MICRO_OFFERS[0].path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    duplex: 'half',
  } as RequestInit)
  const result = await f.handlers.POST(request)
  assert.equal(result.status, 408)
  assert.equal(cancelled, true)
  assert.equal(f.calls.resolve, 0)
  assert.equal((await f.handlers.POST(f.request())).status, 402)
})

test('a lost paid body cannot be recovered by reusing its authorization or silently charged twice', async () => {
  const f = fixture(), signature = await f.signature()
  const original = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
  assert.equal(original.status, 200)
  await original.body?.cancel() // Simulate a caller losing the delivered response.
  const replay = await f.handlers.POST(f.request(undefined, { 'PAYMENT-SIGNATURE': signature }))
  assert.equal(replay.status, 409)
  assert.equal(f.calls.settle, 1)
  assert.ok(MICRO_OFFERS[0].retention.note.includes('No stored-result recovery'))
})
