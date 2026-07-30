import assert from 'node:assert/strict'
import test from 'node:test'

import { apiKeyServiceConfigured, consumeProvisioningLimit } from '../lib/api-key.ts'

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
