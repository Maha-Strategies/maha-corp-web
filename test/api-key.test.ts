import assert from 'node:assert/strict'
import test from 'node:test'

import { apiKeyDataRedisKey, apiKeyServiceConfigured, bearerApiKey, consumeProvisioningLimit, getApiKeyRecordForRawKey, hashApiKey, provisionStarterKey } from '../lib/api-key.ts'

const originalUrl = process.env.UPSTASH_REDIS_REST_URL
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN
const originalFetch = globalThis.fetch

test('Upstash API-key configuration accepts sanitized Vercel environment values', () => {
  try {
    process.env.UPSTASH_REDIS_REST_URL = '  "https://example.upstash.io"\n'
    process.env.UPSTASH_REDIS_REST_TOKEN = "  'token-value'  "
    assert.equal(apiKeyServiceConfigured(), true)
    process.env.UPSTASH_REDIS_REST_TOKEN = '  \n '
    assert.equal(apiKeyServiceConfigured(), false)
  } finally {
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
  }
})

test('API-key hashing and bearer extraction use the same raw key in every runtime', async () => {
  const rawKey = 'mha_live_ExampleKey-123'
  assert.equal(bearerApiKey(new Request('https://example.test', { headers: { authorization: `  bEaReR\t ${rawKey}  ` } })), rawKey)
  assert.equal(await hashApiKey(rawKey), 'd119888447296d78fc9a4309f08b3cd4a64941f457358cccbf57f5e860d38558')
  assert.equal(apiKeyDataRedisKey(await hashApiKey(rawKey)), 'key:data:d119888447296d78fc9a4309f08b3cd4a64941f457358cccbf57f5e860d38558')
})

test('Upstash REST calls serialize numeric Redis arguments as strings', async () => {
  const requests: Array<{ url: string; args: unknown[] }> = []
  try {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-value'
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), args: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ result: requests.length === 1 ? 1 : 1 }), { status: 200 })
    }
    assert.equal(await consumeProvisioningLimit('127.0.0.1'), true)
    assert.equal(requests[0].url, 'https://example.upstash.io')
    assert.equal(requests[0].args[0], 'INCR')
    assert.equal(requests[1].args[0], 'EXPIRE')
    assert.equal(requests[1].args[2], '3600')
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
  }
})

test('key provisioning and raw-key lookup resolve the identical Redis record key', async () => {
  const commands: unknown[][] = []
  try {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-value'
    globalThis.fetch = async (_input, init) => {
      const command = JSON.parse(String(init?.body)) as unknown[]
      commands.push(command)
      return new Response(JSON.stringify({ result: command[0] === 'HGETALL' ? { key_id: 'key_test', balance_credits: '20000', tier: 'starter', status: 'active', rate_limit_per_minute: '30', email_hash: 'hash', created_at: 'now' } : 'OK' }), { status: 200 })
    }
    const provisioned = await provisionStarterKey('owner@example.com')
    const expectedRecordKey = apiKeyDataRedisKey(await hashApiKey(provisioned.key))
    assert.equal(commands[0][0], 'HSET')
    assert.equal(commands[0][1], expectedRecordKey)
    assert.equal((await getApiKeyRecordForRawKey(provisioned.key))?.key_id, 'key_test')
    assert.equal(commands.at(-1)?.[0], 'HGETALL')
    assert.equal(commands.at(-1)?.[1], expectedRecordKey)
  } finally {
    globalThis.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalUrl
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
  }
})
