import assert from 'node:assert/strict'
import test from 'node:test'

import { API_CORS_HEADERS, apiAccessStatus, apiProxyGate } from '../lib/api-proxy-policy.ts'

test('API proxy policy fails closed, allows only self-managed key routes, and handles CORS preflight', () => {
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', false), 'unavailable') // proxy maps this to 503
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', true), 'protected') // proxy applies 401/402 credential outcomes
  assert.equal(apiProxyGate('/api/v1/keys/generate', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/future-route', 'POST', false), 'unavailable')
  assert.equal(apiProxyGate('/api/v1/compress', 'OPTIONS', false), 'preflight')
  assert.equal(apiAccessStatus('unavailable'), 503)
  assert.equal(apiAccessStatus('missing_key'), 401)
  assert.equal(apiAccessStatus('invalid_key'), 401)
  assert.equal(apiAccessStatus('depleted'), 402)
  assert.equal(API_CORS_HEADERS['Access-Control-Allow-Origin'], '*')
})
