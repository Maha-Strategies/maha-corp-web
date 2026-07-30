import assert from 'node:assert/strict'
import test from 'node:test'

import Stripe from 'stripe'

import { POST } from '../app/api/webhooks/stripe/route.ts'

const secret = 'sk_test_123'
const webhookSecret = 'whsec_test_123'
const originalSecret = process.env.STRIPE_SECRET_KEY
const originalWebhookSecret = process.env.STRIPE_API_KEY_WEBHOOK_SECRET
const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL
const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const originalFetch = globalThis.fetch

function signedRequest(payload: Record<string, unknown>, signature = true) {
  const raw = JSON.stringify(payload)
  return new Request('https://www.mahastrategies.com/api/webhooks/stripe', {
    method: 'POST', headers: signature ? { 'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload: raw, secret: webhookSecret }) } : undefined, body: raw,
  })
}

function event(metadata: Record<string, string> = { api_key_id: 'key_123', pack: 'starter', credits: '100000' }) {
  return { id: 'evt_api_credit_123', object: 'event', api_version: '2025-02-24.acacia', created: 1, livemode: false, type: 'checkout.session.completed', data: { object: { id: 'cs_123', object: 'checkout.session', payment_status: 'paid', metadata } } }
}

test('Stripe webhook rejects missing signatures and acknowledges malformed signed events', async () => {
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret
  try {
    assert.equal((await POST(signedRequest(event(), false))).status, 400)
    const malformed = await POST(signedRequest(event({ pack: 'starter', credits: '100000' })))
    assert.equal(malformed.status, 200)
    assert.deepEqual(await malformed.json(), { received: true, warning: 'malformed_payload' })
  } finally { globalThis.fetch = originalFetch }
})

test('Stripe webhook reports duplicate credit events without another credit grant', async () => {
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example'; process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  let credits = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/get')) return new Response(JSON.stringify({ result: 'key-hash' }))
    credits += 1
    return new Response(JSON.stringify({ result: credits === 1 ? 100_000 : false }))
  }
  try {
    const first = await POST(signedRequest(event()))
    assert.equal(first.status, 200)
    assert.equal((await first.json()).duplicate, false)
    const duplicate = await POST(signedRequest(event()))
    assert.equal(duplicate.status, 200)
    assert.equal((await duplicate.json()).duplicate, true)
  } finally {
    globalThis.fetch = originalFetch
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalSecret
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_API_KEY_WEBHOOK_SECRET; else process.env.STRIPE_API_KEY_WEBHOOK_SECRET = originalWebhookSecret
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl
    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken
  }
})
