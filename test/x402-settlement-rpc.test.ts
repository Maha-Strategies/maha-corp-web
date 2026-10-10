import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { settlementRefreshFailure, settlementRpcQueue, settlementRpcUrl } from '../lib/x402/settlement-rpc.ts'
import { baseSettlementReader } from '../lib/x402/settlement-refresh.ts'

test('all concurrent RPC reads are serialized and paced, including retry after failure', async () => {
  let now = 0, active = 0, peak = 0
  const starts: number[] = [], sleeps: number[] = []
  const queue = settlementRpcQueue(350, { now: () => now, sleep: async ms => { sleeps.push(ms); now += ms } })
  const request = (fail = false) => queue(async () => {
    starts.push(now); active++; peak = Math.max(peak, active)
    await Promise.resolve(); now += 50; active--
    if (fail) throw new Error('test_failure')
    return starts.length
  })
  const results = await Promise.allSettled([request(), request(true), request(), request()])
  assert.equal(peak, 1)
  assert.deepEqual(starts, [0, 350, 700, 1050])
  assert.deepEqual(sleeps, [300, 300, 300])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled', 'fulfilled'])
})

test('production requires a configured secure RPC; local public fallback remains available', () => {
  assert.throws(() => settlementRpcUrl({ VERCEL_ENV: 'production' }), /configuration_missing/)
  for (const url of ['http://mainnet.base.org', 'ftp://example.com', 'https://user:password@example.com', 'bad']) {
    assert.throws(() => settlementRpcUrl({ VERCEL_ENV: 'production', BASE_RPC_URL: url }), /configuration_invalid/)
  }
  assert.equal(settlementRpcUrl({}), 'https://mainnet.base.org')
  assert.equal(settlementRpcUrl({ VERCEL_ENV: 'production', BASE_RPC_URL: ' https://example.com/key ' }), 'https://example.com/key')
  assert.equal(settlementRpcUrl({ BASE_RPC_URL: 'http://127.0.0.1:1234' }), 'http://127.0.0.1:1234')
})

test('diagnostics classify nested errors without exposing a provider credential', () => {
  const secret = 'https://provider.example/private-key'
  for (const [message, category] of [
    [`HTTP 429 ${secret}`, 'rate_limited'], [`request limit reached ${secret}`, 'rate_limited'],
    [`timed out ${secret}`, 'timeout'], ['settlement_rpc_configuration_missing', 'configuration'],
    ['settlement_rpc_chain_mismatch', 'configuration'], ['refresh_lock_expired', 'concurrent_refresh'],
    ['scan_requires_offline_backfill', 'requires_backfill'], ['invalid_saved_snapshot', 'invalid_evidence'],
    [`block range limit exceeded ${secret}`, 'range_limit'], [`fetch failed ${secret}`, 'unavailable'],
  ]) {
    const error = new Error('scan incomplete', { cause: new Error(message) })
    assert.equal(settlementRefreshFailure(error), category)
    assert.ok(!settlementRefreshFailure(error).includes(secret))
  }
})

test('Base reader checks chain identity once and rejects a wrong-network endpoint', async () => {
  const methods: string[] = []
  let chain = '0x2105'
  let throttled = false
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk
    const body = JSON.parse(raw); methods.push(body.method)
    const result = body.method === 'eth_chainId' ? chain : body.method === 'eth_getLogs' ? [] : { number: '0x64', timestamp: '0x6553f100' }
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(throttled
      ? { jsonrpc: '2.0', id: body.id, error: { code: -32011, message: 'request limit reached https://provider.example/private-key' } }
      : { jsonrpc: '2.0', id: body.id, result }))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const originalUrl = process.env.BASE_RPC_URL, originalEnv = process.env.VERCEL_ENV
  try {
    process.env.BASE_RPC_URL = `http://127.0.0.1:${address.port}`; process.env.VERCEL_ENV = 'development'
    const reader = baseSettlementReader({ minRpcIntervalMs: 0 })
    assert.equal(await reader.finalizedBlock(), BigInt(100))
    assert.equal(await reader.finalizedBlock(), BigInt(100))
    assert.equal(await reader.timestamp(BigInt(100)), '2023-11-14T22:13:20.000Z')
    assert.deepEqual(await reader.transfers(BigInt(1), BigInt(100)), [])
    assert.deepEqual(methods, ['eth_chainId', 'eth_getBlockByNumber', 'eth_getBlockByNumber', 'eth_getBlockByNumber', 'eth_getLogs'])
    chain = '0x1'
    await assert.rejects(baseSettlementReader({ minRpcIntervalMs: 0 }).finalizedBlock(), /chain_mismatch/)
    assert.equal(methods.at(-1), 'eth_chainId')
    throttled = true
    await assert.rejects(baseSettlementReader({ minRpcIntervalMs: 0 }).finalizedBlock(), error => {
      assert.equal((error as Error).message, 'settlement_rpc_rate_limited')
      assert.doesNotMatch((error as Error).stack ?? '', /private-key|provider\.example/)
      return true
    })
  } finally {
    if (originalUrl === undefined) delete process.env.BASE_RPC_URL; else process.env.BASE_RPC_URL = originalUrl
    if (originalEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = originalEnv
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('scheduled publisher and independent watch use safe configured RPC reads', () => {
  const route = readFileSync('app/api/cron/x402-settlements/route.ts', 'utf8')
  assert.match(route, /reason: settlementRefreshFailure\(error\)/)
  assert.match(route, /status: 503, headers: \{ 'Cache-Control': 'no-store' \}/)
  assert.doesNotMatch(route, /console\.error\([^\n]*,\s*error\s*\)|error\.message/)
  const workflow = readFileSync('.github/workflows/x402-settlement-watch.yml', 'utf8')
  assert.match(workflow, /secrets\.BASE_RPC_URL \|\| vars\.BASE_RPC_URL/)
  assert.match(workflow, /VERCEL_ENV: production/)
  const watch = readFileSync('scripts/watch-x402-settlements.ts', 'utf8')
  assert.match(watch, /baseSettlementReader\(\)/)
  assert.doesNotMatch(watch, /createPublicClient|client\.getLogs/)
})
