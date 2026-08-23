import assert from 'node:assert/strict'
import test from 'node:test'

test('Redis configuration is deferred until a Redis-backed operation runs', async () => {
  const priorUrl = process.env.UPSTASH_REDIS_REST_URL
  const priorToken = process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN

  try {
    const { RedisConfigurationError, getRedis } = await import('../lib/redis.ts')
    assert.throws(() => getRedis(), RedisConfigurationError)
  } finally {
    if (priorUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = priorUrl
    if (priorToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = priorToken
  }
})
