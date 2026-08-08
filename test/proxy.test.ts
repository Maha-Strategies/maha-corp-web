import assert from 'node:assert/strict'
import test from 'node:test'

import { API_CORS_HEADERS, apiAccessStatus, apiProxyGate, x402ChallengeHeaders } from '../lib/api-proxy-policy.ts'

test('API proxy policy fails closed, allows only self-managed key routes, and handles CORS preflight', () => {
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', false), 'unavailable') // proxy maps this to 503
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', true), 'protected') // proxy applies 401/402 credential outcomes
  assert.equal(apiProxyGate('/api/v1/keys/generate', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/rotate', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/revoke', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/future-route', 'POST', false), 'unavailable')
  assert.equal(apiProxyGate('/api/v1/compress', 'OPTIONS', false), 'preflight')
  assert.equal(apiAccessStatus('unavailable'), 503)
  assert.equal(apiAccessStatus('missing_key'), 401)
  assert.equal(apiAccessStatus('invalid_key'), 401)
  assert.equal(apiAccessStatus('depleted'), 402)
  assert.equal(API_CORS_HEADERS['Access-Control-Allow-Origin'], '*')
  assert.match(API_CORS_HEADERS['Access-Control-Allow-Headers'], /PAYMENT-SIGNATURE/)
  assert.match(API_CORS_HEADERS['Access-Control-Expose-Headers'], /PAYMENT-REQUIRED/)
  assert.match(API_CORS_HEADERS['Access-Control-Expose-Headers'], /PAYMENT-RESPONSE/)

  const challengeHeaders = x402ChallengeHeaders('encoded-challenge', 12.345)
  assert.equal(challengeHeaders['PAYMENT-REQUIRED'], 'encoded-challenge')
  assert.equal(challengeHeaders['Cache-Control'], 'no-store')
  assert.equal(challengeHeaders['Server-Timing'], 'x402-challenge;dur=12.3')
})
