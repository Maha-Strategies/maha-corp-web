import assert from 'node:assert/strict'
import test from 'node:test'

import { redisNamespace, scopedRedisKey } from '../lib/redis-namespace.ts'

test('Production preserves the historical Redis keyspace', () => {
  assert.equal(redisNamespace({ VERCEL_ENV: 'production' }), null)
  assert.equal(scopedRedisKey('tenant:data:tenant_1', { VERCEL_ENV: 'production' }), 'tenant:data:tenant_1')
})

test('Preview and Development Redis keys are isolated automatically', () => {
  assert.equal(scopedRedisKey('tenant:data:tenant_1', { VERCEL_ENV: 'preview' }), 'maha:preview:tenant:data:tenant_1')
  assert.equal(scopedRedisKey('job:pending', { VERCEL_ENV: 'development' }), 'maha:development:job:pending')
})

test('an explicit namespace overrides deployment defaults and rejects unsafe values', () => {
  assert.equal(scopedRedisKey('ledger:tenant:t:entries', { VERCEL_ENV: 'production', MAHA_REDIS_NAMESPACE: 'Staging_2' }), 'maha:staging_2:ledger:tenant:t:entries')
  assert.throws(() => redisNamespace({ MAHA_REDIS_NAMESPACE: 'not valid' }))
})
