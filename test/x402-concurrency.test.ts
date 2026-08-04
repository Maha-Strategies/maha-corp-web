import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'

// The Upstash client speaks HTTP, so stubbing fetch is enough to see exactly
// what command is issued. The Lua itself is exercised against a real Redis in
// scripts/verify-x402-limiter.ts, which needs credentials CI does not have;
// what is asserted here is the wiring around it, which is where the mistakes
// that survive review actually live.

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_ENV = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, ns: process.env.MAHA_REDIS_NAMESPACE }

let commands: unknown[][] = []
let reply: unknown = [1, 1]
let fail = false

beforeEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  process.env.MAHA_REDIS_NAMESPACE = 'test'
  commands = []
  fail = false
  reply = [1, 1]
  globalThis.fetch = (async (_url: string, init: { body?: string }) => {
    if (fail) throw new Error('redis unreachable')
    // The client auto-pipelines, so the body is an array of commands and the
    // response an array of results.
    const batch = JSON.parse(init.body ?? '[]') as unknown[][]
    for (const command of batch) commands.push(command)
    const body = JSON.stringify(batch.map(() => ({ result: reply })))
    return { ok: true, status: 200, headers: new Headers(), text: async () => body, json: async () => JSON.parse(body) }
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  for (const [key, value] of [['UPSTASH_REDIS_REST_URL', ORIGINAL_ENV.url], ['UPSTASH_REDIS_REST_TOKEN', ORIGINAL_ENV.token], ['MAHA_REDIS_NAMESPACE', ORIGINAL_ENV.ns]] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

const limiter = () => import('../lib/x402/concurrency.ts')

test('an admitted request gets a token it can later release', async () => {
  const { acquireSlot } = await limiter()
  reply = [1, 1]
  const slot = await acquireSlot('/api/v1/jobs/tensor-opt', 2, 60)
  assert.equal(slot.admitted, true)
  assert.equal(slot.active, 1)
  assert.match(slot.token ?? '', /^[0-9a-f-]{36}$/)
})

test('a refused request gets no token, so it cannot release a slot it never held', async () => {
  const { acquireSlot } = await limiter()
  reply = [0, 2]
  const slot = await acquireSlot('/api/v1/jobs/tensor-opt', 2, 60)
  assert.equal(slot.admitted, false)
  assert.equal(slot.active, 2)
  assert.equal(slot.token, undefined)
})

test('the token is scored with its own expiry, not the key', async () => {
  const { acquireSlot } = await limiter()
  const before = Date.now()
  const slot = await acquireSlot('/api/v1/compress', 8, 30)
  const [, , keyCount, key, now, cap, expiresAt, token, ttlMs] = commands[0] as string[]

  assert.equal(String(keyCount), '1')
  assert.equal(key, 'maha:test:x402:concurrency:/api/v1/compress')
  assert.equal(cap, '8')
  assert.equal(token, slot.token)
  assert.equal(ttlMs, '30000')
  // The score is this token's own deadline. A counter would instead put one TTL
  // on the whole key and drop every holder at once when it fired.
  assert.ok(Number(expiresAt) - Number(now) === 30_000)
  assert.ok(Number(now) >= before)
})

test('a Redis failure refuses the request rather than admitting unbounded GPU work', async () => {
  const { acquireSlot } = await limiter()
  fail = true
  const slot = await acquireSlot('/api/v1/jobs/tensor-opt', 2, 60)
  assert.equal(slot.admitted, false)
  assert.equal(slot.token, undefined)
})

test('release names the token, so it can only free the slot it holds', async () => {
  const { releaseSlot } = await limiter()
  await releaseSlot('/api/v1/compress', 'token-abc')
  const [, script, , key, , member] = commands[0] as string[]
  assert.match(script, /ZREM/)
  assert.equal(key, 'maha:test:x402:concurrency:/api/v1/compress')
  assert.equal(member, 'token-abc')
})

test('releasing without a token touches nothing', async () => {
  const { releaseSlot } = await limiter()
  // Every credit-authenticated request takes this path. It must not cost a
  // round trip, and must never issue a ZREM that could hit another holder.
  await releaseSlot('/api/v1/compress', '')
  assert.equal(commands.length, 0)
})

test('a failed release is swallowed, because the work already finished', async () => {
  const { releaseSlot } = await limiter()
  fail = true
  // The slot expires on its own score. Throwing here would turn a recoverable
  // Redis blip into a failed job callback.
  await assert.doesNotReject(releaseSlot('/api/v1/compress', 'token-abc'))
})
