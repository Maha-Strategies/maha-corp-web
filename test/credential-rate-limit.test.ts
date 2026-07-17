import assert from 'node:assert/strict'
import test from 'node:test'

import { consumeCredentialRateLimit } from '../lib/credential-rate-limit.ts'

test('shared limiter accepts a consumed slot', async () => {
  const decision = await consumeCredentialRateLimit('cred_test', 12, async () => ({ data: true, error: null }))
  assert.deepEqual(decision, { kind: 'accepted' })
})

test('shared limiter reports an exhausted window', async () => {
  const decision = await consumeCredentialRateLimit('cred_test', 12, async () => ({ data: false, error: null }))
  assert.deepEqual(decision, { kind: 'rate_limited' })
})

test('shared limiter fails closed on database errors', async () => {
  const decision = await consumeCredentialRateLimit('cred_test', 12, async () => ({ data: null, error: { code: 'database_error' } }))
  assert.deepEqual(decision, { kind: 'unavailable', errorCode: 'database_error' })
})

test('shared limiter fails closed on network errors', async () => {
  const decision = await consumeCredentialRateLimit('cred_test', 12, async () => { throw new Error('network error') })
  assert.deepEqual(decision, { kind: 'unavailable', errorCode: 'rate_limit_request_failed' })
})

test('shared limiter rejects malformed RPC responses', async () => {
  const decision = await consumeCredentialRateLimit('cred_test', 12, async () => ({ data: null, error: null }))
  assert.deepEqual(decision, { kind: 'unavailable', errorCode: 'invalid_rate_limit_response' })
})
