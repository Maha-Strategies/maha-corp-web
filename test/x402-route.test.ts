import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { discoveryExtensionsFor, resourceInfoFor } from '../lib/x402/discovery.ts'

// End to end with every outbound dependency stubbed at the network boundary
// rather than injected: the facilitator's HTTP shape, the Supabase RPC that
// claims the payment, and Upstash's Lua. The unit tests in x402-gateway.test.ts
// inject fakes and exercise the decision logic; this file exists to catch what
// only breaks once the pieces are wired together -- a response field read under
// the wrong name, a slot token acquired and then dropped, a flag read too early.
//
// proxy.ts itself cannot be imported here: it resolves `next/server` and `@/`
// aliases that only exist inside the Next build. Its whole contribution beyond
// routing is paidRequestHeaders(), which is asserted directly.

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_ENV = { ...process.env }

const RESOURCES = JSON.stringify([
  { method: 'POST', path: '/api/v1/compress' },
])

type Calls = { verify: number; settle: number; claim: number; record: number; acquire: number; release: number }
let calls: Calls
let claimResult: string
let admitted: boolean

function enableX402() {
  process.env.X402_ENABLED = 'true'
  process.env.X402_FACILITATOR_URL = 'https://facilitator.example/x402'
  process.env.X402_PAY_TO = '0xSettlement'
  process.env.X402_ASSET = '0xUSDC'
  process.env.X402_NETWORK = 'base'
  process.env.X402_RESOURCES = RESOURCES
  process.env.X402_SLOT_TTL_SECONDS = '120'
}

beforeEach(() => {
  calls = { verify: 0, settle: 0, claim: 0, record: 0, acquire: 0, release: 0 }
  claimResult = 'claimed'
  admitted = true

  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  process.env.MAHA_REDIS_NAMESPACE = 'test'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ledger.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  delete process.env.X402_ENABLED
  delete process.env.X402_RESOURCES

  globalThis.fetch = (async (input: string | URL | Request, init: { body?: string } = {}) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

    if (url.includes('facilitator.example')) {
      // These are the real response shapes: verify carries no transaction,
      // settle carries no amount, and settle's network field is required.
      if (url.endsWith('/verify')) { calls.verify += 1; return json({ isValid: true, payer: '0xAgent' }) }
      if (url.endsWith('/settle')) { calls.settle += 1; return json({ success: true, payer: '0xAgent', transaction: 'tx_e2e', network: 'eip155:8453' }) }
      return json({}, 404)
    }

    if (url.includes('ledger.example')) {
      if (url.includes('record_x402_settlement')) { calls.record += 1; return json('recorded') }
      calls.claim += 1
      return json(claimResult)
    }

    if (url.includes('example.upstash.io')) {
      const batch = JSON.parse(init.body ?? '[]') as string[][]
      const results = batch.map((command) => {
        const script = String(command[1] ?? '')
        if (script.includes('ZADD')) { calls.acquire += 1; return { result: admitted ? [1, 1] : [0, 8] } }
        if (script.includes('ZREM')) { calls.release += 1; return { result: [1, 0] } }
        return { result: null }
      })
      const body = JSON.stringify(results)
      return { ok: true, status: 200, headers: new Headers(), text: async () => body, json: async () => results } as unknown as Response
    }

    throw new Error(`unstubbed request to ${url}`)
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  for (const key of Object.keys(process.env)) if (!(key in ORIGINAL_ENV)) delete process.env[key]
  Object.assign(process.env, ORIGINAL_ENV)
})

const gateway = () => import('../lib/x402/gateway.ts')

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
const priced = { offerId: 'context-compression', method: 'POST' as const, path: '/api/v1/compress', amount: '1000', description: 'One compression', concurrencyCap: 8 }
const resourceUrl = 'https://www.mahastrategies.com/api/v1/compress'
const SIGNATURE = async () => encode({
  x402Version: 2,
  resource: resourceInfoFor(priced, resourceUrl),
  accepted: {
    scheme: 'exact', network: 'eip155:8453', amount: '1000', payTo: '0xSettlement',
    maxTimeoutSeconds: 60, asset: '0xUSDC', extra: { name: 'USD Coin', version: '2' },
  },
  payload: { signature: '0xsigned' },
  extensions: await discoveryExtensionsFor(priced, resourceUrl),
})

function post(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://www.mahastrategies.com${path}`, { method: 'POST', headers })
}

test('with the flag off nothing is read, called, or emitted', async () => {
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress'))

  // `not_applicable` is what makes the endpoint indistinguishable from how it
  // behaved before x402 existed: proxy.ts falls through to its usual 401.
  assert.equal(outcome.kind, 'not_applicable')
  assert.deepEqual(calls, { verify: 0, settle: 0, claim: 0, record: 0, acquire: 0, release: 0 })
})

test('an unpaid request is challenged with terms it can actually pay', async () => {
  enableX402()
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress'))

  assert.equal(outcome.kind, 'challenge')
  if (outcome.kind !== 'challenge') return
  assert.equal(outcome.status, 402)

  const challenge = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
  assert.equal(challenge.x402Version, 2)
  const [requirement] = challenge.accepts
  assert.equal(requirement.amount, '1000')
  assert.equal(requirement.payTo, '0xSettlement')
  assert.equal(requirement.asset, '0xUSDC')
  assert.equal(requirement.network, 'eip155:8453')
  assert.equal(challenge.resource.url, resourceUrl)
  assert.equal(challenge.extensions.bazaar.info.input.method, 'POST')
  // Answering a challenge costs nothing and reserves nothing.
  assert.deepEqual(calls, { verify: 0, settle: 0, claim: 0, record: 0, acquire: 0, release: 0 })
})

test('a signed payment is verified, claimed, settled, and admitted -- in that order', async () => {
  enableX402()
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))

  assert.equal(outcome.kind, 'paid')
  if (outcome.kind !== 'paid') return
  assert.deepEqual(calls, { verify: 1, claim: 1, settle: 1, record: 1, acquire: 1, release: 0 })
  assert.equal(outcome.transaction, 'tx_e2e')

  const receipt = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
  assert.equal(receipt.success, true)
  assert.equal(receipt.transaction, 'tx_e2e')
  // CAIP-2, not the human-facing name, so a client can tell Base from Base Sepolia.
  assert.equal(receipt.network, 'eip155:8453')
})

test('the handler is told it is serving a paid caller, and handed the slot to release', async () => {
  enableX402()
  const { resolveX402, paidRequestHeaders } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))
  assert.equal(outcome.kind, 'paid')
  if (outcome.kind !== 'paid') return

  const headers = paidRequestHeaders(outcome)
  // A paid caller has no key, tenant, or balance, so the handler is told what
  // it is serving rather than left to infer it from an absence.
  assert.equal(headers['x-maha-access-mode'], 'x402')
  assert.equal(headers['x-maha-payment-transaction'], 'tx_e2e')
  assert.equal(headers['x-maha-payment-payer'], '0xAgent')
  assert.equal(headers['x-maha-payment-amount'], '1000')
  assert.equal(headers['x-maha-slot-resource'], 'context-compression')
  assert.match(headers['x-maha-slot-token'], /^[0-9a-f-]{36}$/)
})

test('the slot the handler is handed is the one that was acquired', async () => {
  enableX402()
  const { resolveX402, paidRequestHeaders } = await gateway()
  const { slotFromRequest } = await import('../lib/x402/slot.ts')

  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))
  assert.equal(outcome.kind, 'paid')
  if (outcome.kind !== 'paid') return

  // Round-trip the token through the headers, exactly as it travels from
  // proxy.ts to the route. A token dropped anywhere along this path costs a
  // slot until its score expires, with nothing in the logs to say why.
  const downstream = new Request('https://www.mahastrategies.com/api/v1/compress', { headers: paidRequestHeaders(outcome) })
  assert.deepEqual(slotFromRequest(downstream), { resource: 'context-compression', token: outcome.slot.token })
})

test('a credit-authenticated request holds no slot to release', async () => {
  const { slotFromRequest } = await import('../lib/x402/slot.ts')
  const request = new Request('https://www.mahastrategies.com/api/v1/compress', { headers: { 'x-maha-api-key-id': 'key_1' } })
  assert.equal(slotFromRequest(request), null)
})

test('a replayed payment is refused without settling a second time', async () => {
  enableX402()
  claimResult = 'duplicate'
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))

  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 409)
  assert.equal(outcome.code, 'payment_already_used')
  assert.equal(calls.settle, 0, 'a duplicate must never reach settlement')
  assert.equal(calls.acquire, 0, 'and must never consume capacity')
})

test('a paid request is refused when the resource is full, and told when to retry', async () => {
  enableX402()
  admitted = false
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))

  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 429)
  assert.equal(outcome.code, 'resource_at_capacity')
  assert.ok((outcome.retryAfterSeconds ?? 0) > 0)
  // The payment settled and was recorded. Saying so is what stops a caller
  // re-presenting it and getting a 409 they cannot interpret.
  assert.match(outcome.message, /not consumed again/)
})

test('a path with no published price is untouched even while payment is live', async () => {
  enableX402()
  const { resolveX402 } = await gateway()
  assert.equal((await resolveX402(post('/api/v1/mcp/servers'))).kind, 'not_applicable')
})

test('broken configuration withholds the resource instead of serving it free', async () => {
  enableX402()
  process.env.X402_PAY_TO = ''
  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))

  assert.equal(outcome.kind, 'refused')
  if (outcome.kind !== 'refused') return
  assert.equal(outcome.status, 503)
  assert.equal(outcome.code, 'x402_misconfigured')
})

test('a facilitator that cannot be reached does not admit the request', async () => {
  enableX402()
  const stubbed = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(typeof input === 'object' && 'url' in input ? input.url : input).includes('facilitator.example')) {
      throw new Error('facilitator unreachable')
    }
    return stubbed(input as never, init as never)
  }) as unknown as typeof fetch

  const { resolveX402 } = await gateway()
  const outcome = await resolveX402(post('/api/v1/compress', { 'PAYMENT-SIGNATURE': await SIGNATURE() }))
  assert.notEqual(outcome.kind, 'paid')
  assert.equal(calls.acquire, 0)
})
