import assert from 'node:assert/strict'
import test from 'node:test'

import { API_CORS_HEADERS, apiAccessStatus, apiProxyGate, x402ChallengeHeaders } from '../lib/api-proxy-policy.ts'
import { authorizeRegistry } from '../lib/celestial-hypotheses/authorization.ts'

const REGISTRY_TOKEN = 'proxy-registry-test-token-at-least-32-bytes-long'

test('API proxy policy fails closed, allows only self-managed key routes, and handles CORS preflight', () => {
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', false), 'unavailable') // proxy maps this to 503
  assert.equal(apiProxyGate('/api/v1/compress', 'POST', true), 'protected') // proxy applies 401/402 credential outcomes
  assert.equal(apiProxyGate('/api/v1/keys/generate', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/rotate', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/keys/revoke', 'POST', false), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/celestial-hypotheses/drafts', 'POST', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/celestial-hypotheses/exp_abc/provenance', 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/celestial-corpus/corpora', 'POST', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/celestial-corpus/corpora/corp_abc/observations', 'GET', true), 'self_managed')
  assert.equal(apiProxyGate('/api/v1/celestial-hypotheses', 'POST', true), 'protected')
  assert.equal(apiProxyGate('/api/v1/celestial-corpus', 'POST', true), 'protected')
  assert.equal(apiProxyGate('/api/v1/celestial-hypotheses-impersonator/drafts', 'POST', true), 'protected')
  assert.equal(apiProxyGate('/api/v1/celestial-corpus-impersonator/corpora', 'POST', true), 'protected')
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

test('the registry bearer reaches a celestial corpus route without entering the customer key gate', () => {
  const before = process.env.CELESTIAL_REGISTRY_TOKEN
  process.env.CELESTIAL_REGISTRY_TOKEN = REGISTRY_TOKEN
  try {
    const request = new Request('https://mahastrategies.com/api/v1/celestial-corpus/corpora', {
      method: 'POST',
      headers: { authorization: `Bearer ${REGISTRY_TOKEN}` },
    })

    assert.equal(apiProxyGate(new URL(request.url).pathname, request.method, true), 'self_managed')
    assert.equal(authorizeRegistry(request).kind, 'authorized')
  } finally {
    if (before === undefined) delete process.env.CELESTIAL_REGISTRY_TOKEN
    else process.env.CELESTIAL_REGISTRY_TOKEN = before
  }
})
