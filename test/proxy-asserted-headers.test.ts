import './helpers/next-aliases.ts'

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { afterEach, beforeEach } from 'node:test'

import { accessModeFrom } from '../lib/context-compiler-metering.ts'
import { STANDARD_MAX_CONTEXT_PACK_BYTES } from '../lib/context-compiler.ts'
import { carriesProxyAssertedHeader, forwardedRequestHeaders, PROXY_ASSERTED_REQUEST_HEADERS } from '../lib/proxy-request-headers.ts'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'
import { paidRequestHeaders } from '../lib/x402/gateway.ts'
import { CONTEXT_COMPRESSION_DISCOVERY } from '../lib/x402/offer-schemas.ts'
import type { PaymentRequirement } from '../lib/x402/protocol.ts'

// A client can send any header. Routes read x-maha-api-key-tier, tenant, key id,
// access mode, payment and slot headers as facts that proxy.ts established, so
// a value arriving from outside must never reach them. proxy.ts is executed
// here through test/helpers/next-aliases.ts, with the network stubbed at fetch.

const FORGED: Record<string, string> = {
  'x-maha-api-key-id': 'key_forged',
  'x-maha-tenant-id': 'tenant_victim',
  'X-Maha-Api-Key-Tier': 'enterprise',
  'x-maha-zero-data-retention': 'true',
  'x-maha-credits-remaining': '999999',
  'x-maha-access-mode': 'x402',
  'x-maha-payment-transaction': '0xforged',
  'x-maha-payment-payer': '0xforged',
  'x-maha-payment-amount': '999999999',
  'x-maha-payment-replayed': 'true',
  'x-maha-slot-resource': 'context-compression',
  'x-maha-slot-token': 'forged-slot',
}

const CLIENT_INPUTS: Record<string, string> = {
  'x-maha-idempotency-key': 'req_client_0001',
  'x-maha-input-hash': 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  'x-maha-max-billable-credits': '5',
  'x-maha-task-id': 'task-1',
  'x-maha-cost-center': 'research',
  'x-maha-discovery-source': 'bazaar',
}

test('the asserted list covers every header the proxy sets on either authenticated path', () => {
  const paid = paidRequestHeaders({ kind: 'paid', header: 'h', transaction: 't', payer: 'p', amountPaid: '1', slot: { resource: 'r', token: 'k' } })
  for (const name of Object.keys(paid)) assert.ok(PROXY_ASSERTED_REQUEST_HEADERS.includes(name), name)
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  const keyBranch = proxy.slice(proxy.indexOf('const headers = forwardedRequestHeaders(request.headers, {'))
  for (const name of keyBranch.slice(0, keyBranch.indexOf('})')).matchAll(/'(x-maha-[a-z-]+)'/g)) {
    assert.ok(PROXY_ASSERTED_REQUEST_HEADERS.includes(name[1]), name[1])
  }
  for (const name of Object.keys(FORGED)) assert.ok(PROXY_ASSERTED_REQUEST_HEADERS.includes(name.toLowerCase()), name)
})

test('forwarding removes forged asserted headers in any case, keeps client inputs, and sets only proxy values', () => {
  const incoming = new Headers({ ...FORGED, ...CLIENT_INPUTS, authorization: 'Bearer key', 'content-type': 'application/json' })
  assert.equal(carriesProxyAssertedHeader(incoming), true)
  const stripped = forwardedRequestHeaders(incoming)
  for (const name of PROXY_ASSERTED_REQUEST_HEADERS) assert.equal(stripped.get(name), null, name)
  for (const [name, value] of Object.entries(CLIENT_INPUTS)) assert.equal(stripped.get(name), value, name)
  assert.equal(stripped.get('authorization'), 'Bearer key')
  assert.equal(carriesProxyAssertedHeader(stripped), false)

  const keyed = forwardedRequestHeaders(incoming, { 'x-maha-api-key-id': 'key_real', 'x-maha-api-key-tier': 'standard' })
  assert.equal(keyed.get('x-maha-api-key-tier'), 'standard')
  assert.equal(keyed.get('x-maha-tenant-id'), null, 'a forged tenant does not survive beside a real key')
  // A keyed caller cannot claim x402 mode and so skip metered billing.
  assert.deepEqual(accessModeFrom(keyed), { mode: 'api_key', credentialId: 'key_real' })
  assert.throws(() => forwardedRequestHeaders(incoming, { 'x-maha-new-privilege': 'yes' }), /not a proxy-asserted request header/)
})

test('proxy.ts forwards no request headers except through the stripping helper', () => {
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(proxy, /new Headers\(request\.headers\)/)
  const sites = [...proxy.matchAll(/NextResponse\.next\(/g)].map((match) => proxy.slice(match.index, match.index + 90).replace(/\s+/g, ' '))
  // forward() has the one unmodified pass-through, taken only when no asserted header is present.
  const passThrough = sites.filter((site) => !site.includes('request: { headers'))
  assert.equal(passThrough.length, 1, passThrough.join('\n'))
  assert.match(proxy, /if \(!carriesProxyAssertedHeader\(request\.headers\)\) return NextResponse\.next\(headers \? \{ headers \} : undefined\)/)
  assert.equal(sites.length, 4, 'a new forwarding site must be reviewed here')
  assert.match(proxy, /const paidHeaders = forwardedRequestHeaders\(request\.headers, paidRequestHeaders\(outcome\)\)/)
})

// ---------------------------------------------------------------------------
// Executed proxy
// ---------------------------------------------------------------------------

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_ENV = { ...process.env }
type Calls = { verify: number; settle: number; ledger: number; acquire: number; release: number }
let calls: Calls

function environment() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  process.env.MAHA_REDIS_NAMESPACE = 'test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ledger.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  process.env.X402_ENABLED = 'true'
  process.env.X402_FACILITATOR_URL = 'https://facilitator.example/x402'
  process.env.X402_PAY_TO = '0xSettlement'
  process.env.X402_ASSET = '0xUSDC'
  process.env.X402_NETWORK = 'base'
  process.env.X402_RESOURCES = JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }])
  process.env.X402_SLOT_TTL_SECONDS = '120'
}

beforeEach(() => {
  calls = { verify: 0, settle: 0, ledger: 0, acquire: 0, release: 0 }
  environment()
  globalThis.fetch = (async (input: string | URL | Request, init: { body?: string } = {}) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('facilitator.example')) {
      if (url.endsWith('/verify')) { calls.verify += 1; return json({ isValid: true, payer: '0xAgent' }) }
      if (url.endsWith('/settle')) { calls.settle += 1; return json({ success: true, payer: '0xAgent', transaction: 'tx_e2e', network: 'eip155:8453' }) }
      return json({}, 404)
    }
    if (url.includes('ledger.example')) { calls.ledger += 1; return json(url.includes('record_x402_settlement') ? 'recorded' : 'claimed') }
    if (url.includes('example.upstash.io')) {
      const batch = JSON.parse(init.body ?? '[]') as unknown[]
      const commands = (Array.isArray(batch[0]) ? batch : [batch]) as string[][]
      const results = commands.map((command) => {
        const script = String(command[1] ?? '')
        if (script.includes('ZADD')) { calls.acquire += 1; return { result: [1, 1] } }
        if (script.includes('ZREM')) { calls.release += 1; return { result: [1, 0] } }
        return { result: null }
      })
      const body = JSON.stringify(Array.isArray(batch[0]) ? results : results[0])
      return { ok: true, status: 200, headers: new Headers(), text: async () => body, json: async () => JSON.parse(body) } as unknown as Response
    }
    throw new Error(`unstubbed request to ${url}`)
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  for (const key of Object.keys(process.env)) if (!(key in ORIGINAL_ENV)) delete process.env[key]
  Object.assign(process.env, ORIGINAL_ENV)
})

environment()
const { NextRequest } = await import('next/server.js')
const { proxy } = await import('../proxy.ts')
const compressRoute = await import('../app/api/v1/compress/route.ts')
const event = { waitUntil: (promise: Promise<unknown>) => { void promise } } as never

const ORIGIN = 'https://www.mahastrategies.com'
const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
const priced = { offerId: 'context-compression', method: 'POST' as const, path: '/api/v1/compress', amount: '1000', description: 'One compression', concurrencyCap: 8 }
const accepted: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:8453', amount: '1000', payTo: '0xSettlement',
  maxTimeoutSeconds: 60, asset: '0xUSDC', extra: { name: 'USD Coin', version: '2' },
}
const signature = async () => encode({
  x402Version: 2,
  resource: resourceInfoFor(priced, `${ORIGIN}/api/v1/compress`),
  accepted,
  payload: { signature: '0xsigned' },
  extensions: await discoveryExtensionsFor(priced, `${ORIGIN}/api/v1/compress`, accepted),
})

/** The request the route receives, rebuilt the way Next applies a proxy's header override. */
function upstream(url: string, headers: Headers, response: Response, body?: string): Request {
  const override = response.headers.get('x-middleware-override-headers')
  const forwarded = new Headers(override === null ? headers : undefined)
  for (const name of override?.split(',') ?? []) {
    const value = response.headers.get(`x-middleware-request-${name}`)
    if (value !== null) forwarded.set(name, value)
  }
  return new Request(url, { method: 'POST', headers: forwarded, ...(body === undefined ? {} : { body }) })
}

/** A valid compression body padded with whitespace to an exact UTF-8 size. */
function bodyOfBytes(bytes: number): string {
  const json = JSON.stringify(CONTEXT_COMPRESSION_DISCOVERY.input)
  return `${' '.repeat(bytes - Buffer.byteLength(json, 'utf8'))}${json}`
}

test('page and self-managed requests lose forged asserted headers and keep everything else', async () => {
  for (const path of ['/knowledge/robotics', '/api/v1/keys/balance']) {
    const response = await proxy(new NextRequest(`${ORIGIN}${path}`, { headers: { ...FORGED, ...CLIENT_INPUTS } }), event)
    assert.equal(response.headers.get('x-middleware-next'), '1', path)
    const forwarded = upstream(`${ORIGIN}${path}`, new Headers(), response).headers
    for (const name of PROXY_ASSERTED_REQUEST_HEADERS) assert.equal(forwarded.get(name), null, `${path}: ${name}`)
    for (const [name, value] of Object.entries(CLIENT_INPUTS)) assert.equal(forwarded.get(name), value, `${path}: ${name}`)
  }
  // Ordinary traffic is passed through exactly as before, with no override.
  const plain = await proxy(new NextRequest(`${ORIGIN}/knowledge/robotics`, { headers: CLIENT_INPUTS }), event)
  assert.equal(plain.headers.get('x-middleware-override-headers'), null)
})

test('a paid caller reaches the route with proxy-established payment headers and none of its forged ones', async () => {
  const body = JSON.stringify(CONTEXT_COMPRESSION_DISCOVERY.input)
  const headers = new Headers({ ...FORGED, ...CLIENT_INPUTS, 'content-type': 'application/json', 'PAYMENT-SIGNATURE': await signature() })
  const response = await proxy(new NextRequest(`${ORIGIN}/api/v1/compress`, { method: 'POST', headers, body }), event)
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.ok(response.headers.get('PAYMENT-RESPONSE'))
  assert.deepEqual({ verify: calls.verify, settle: calls.settle }, { verify: 1, settle: 1 })

  const forwarded = upstream(`${ORIGIN}/api/v1/compress`, headers, response, body)
  assert.equal(forwarded.headers.get('x-maha-access-mode'), 'x402')
  assert.equal(forwarded.headers.get('x-maha-payment-transaction'), 'tx_e2e')
  assert.equal(forwarded.headers.get('x-maha-payment-replayed'), 'false')
  assert.notEqual(forwarded.headers.get('x-maha-slot-token'), 'forged-slot')
  for (const name of ['x-maha-api-key-id', 'x-maha-tenant-id', 'x-maha-api-key-tier', 'x-maha-zero-data-retention', 'x-maha-credits-remaining']) {
    assert.equal(forwarded.headers.get(name), null, name)
  }
  const delivered = await compressRoute.POST(forwarded)
  assert.equal(delivered.status, 201)
})

test('a forged enterprise tier cannot raise the paid byte limit, and nothing settles', async () => {
  const oversized = bodyOfBytes(STANDARD_MAX_CONTEXT_PACK_BYTES + 1)
  const headers = new Headers({ ...FORGED, 'content-type': 'application/json', 'PAYMENT-SIGNATURE': await signature() })
  const response = await proxy(new NextRequest(`${ORIGIN}/api/v1/compress`, { method: 'POST', headers, body: oversized }), event)
  assert.equal(response.status, 413)
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, 'payload_too_large')
  assert.deepEqual(calls, { verify: 0, settle: 0, ledger: 0, acquire: 0, release: 0 })
})

test('the route derives the limit from authenticated key mode, never from a tier header alone', async () => {
  const oversized = bodyOfBytes(STANDARD_MAX_CONTEXT_PACK_BYTES + 1)
  const post = (headers: Record<string, string>) => compressRoute.POST(new Request(`${ORIGIN}/api/v1/compress`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: oversized,
  }))
  assert.equal((await post({ 'x-maha-api-key-tier': 'enterprise' })).status, 413, 'tier without an authenticated key')
  assert.equal((await post({ 'x-maha-api-key-tier': 'enterprise', 'x-maha-access-mode': 'x402', 'x-maha-api-key-id': 'key_1' })).status, 413, 'tier beside x402 mode')
  assert.equal((await post({ 'x-maha-api-key-tier': 'enterprise', 'x-maha-api-key-id': 'key_1' })).status, 201, 'a proxy-authenticated enterprise key')
})

test('a signed malformed body is refused at the proxy with no verify, settle, ledger write or slot', async () => {
  const headers = { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': await signature() }
  for (const [body, status] of [['{', 400], [JSON.stringify({ ...CONTEXT_COMPRESSION_DISCOVERY.input, tokenBudget: 1 }), 400]] as const) {
    const response = await proxy(new NextRequest(`${ORIGIN}/api/v1/compress`, { method: 'POST', headers, body }), event)
    assert.equal(response.status, status)
    const payload = await response.json() as { error: { code: string; message: string } }
    assert.equal(payload.error.code, 'invalid_request')
    assert.match(payload.error.message, /No payment was taken\./)
    assert.equal(response.headers.get('PAYMENT-RESPONSE'), null)
  }
  const wrongType = await proxy(new NextRequest(`${ORIGIN}/api/v1/compress`, { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: '{}' }), event)
  assert.equal(wrongType.status, 415)
  assert.deepEqual(calls, { verify: 0, settle: 0, ledger: 0, acquire: 0, release: 0 })
})

test('an unsigned malformed request still receives the discovery 402', async () => {
  const response = await proxy(new NextRequest(`${ORIGIN}/api/v1/compress`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{' }), event)
  assert.equal(response.status, 402)
  assert.ok(response.headers.get('PAYMENT-REQUIRED'))
  assert.deepEqual({ verify: calls.verify, settle: calls.settle, acquire: calls.acquire }, { verify: 0, settle: 0, acquire: 0 })
})
