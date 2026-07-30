import assert from 'node:assert/strict'
import test from 'node:test'

import { apiKeyServiceConfigured } from '../lib/api-key.ts'

const originalUrl = process.env.UPSTASH_REDIS_REST_URL
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN

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
