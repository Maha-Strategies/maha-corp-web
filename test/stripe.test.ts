import assert from 'node:assert/strict'
import test from 'node:test'

import Stripe from 'stripe'

import { isInvoicePaymentIntent, POST } from '../app/api/webhooks/stripe/route.ts'

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

test('Stripe webhook ignores non-billing events without touching the credit ledger', async () => {
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret
  try {
    const ignored = await POST(signedRequest({ ...event(), type: 'payment_intent.created' }))
    assert.equal(ignored.status, 200)
    assert.deepEqual(await ignored.json(), { received: true, ignored: true })
  } finally {
    globalThis.fetch = originalFetch
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalSecret
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_API_KEY_WEBHOOK_SECRET; else process.env.STRIPE_API_KEY_WEBHOOK_SECRET = originalWebhookSecret
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl
    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken
  }
})

test('invoice-backed PaymentIntents are classified before prepaid-credit reversal', async () => {
  const calls: unknown[] = []
  const stripe = {
    invoicePayments: {
      list: async (params: unknown) => {
        calls.push(params)
        return { data: [{ id: 'inpay_123' }] }
      },
    },
  } as unknown as Pick<Stripe, 'invoicePayments'>

  assert.equal(await isInvoicePaymentIntent(stripe, 'pi_subscription_123'), true)
  assert.deepEqual(calls, [{
    payment: { type: 'payment_intent', payment_intent: 'pi_subscription_123' },
    limit: 1,
  }])

  const prepaid = {
    invoicePayments: { list: async () => ({ data: [] }) },
  } as unknown as Pick<Stripe, 'invoicePayments'>
  assert.equal(await isInvoicePaymentIntent(prepaid, 'pi_prepaid_123'), false)
})

test('invoice.paid resets only the tenant subscription bucket exactly once', async () => {
  const commands: unknown[][] = []
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret; process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 'token'; process.env.STRIPE_TENANT_BUILDER_PRICE_ID = 'price_builder'; process.env.STRIPE_TENANT_SCALE_PRICE_ID = 'price_scale'; process.env.STRIPE_TENANT_AUTO_TOPUP_PRICE_ID = 'price_topup'
  globalThis.fetch = async (_input, init) => { const command = JSON.parse(String(init?.body)) as unknown[]; commands.push(command); return new Response(JSON.stringify({ result: 1 })) }
  try {
    const payload = { id: 'evt_invoice_paid_123', object: 'event', api_version: '2026-06-24.dahlia', created: 1, livemode: false, type: 'invoice.paid', data: { object: { id: 'in_123', object: 'invoice', customer: 'cus_123', period_end: 123456, lines: { data: [{ pricing: { type: 'price_details', price_details: { price: 'price_builder', product: 'prod_builder' } } }] }, parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_123', metadata: { tenant_id: 'tenant_key_123', tier: 'builder' } } } } } }
    const result = await POST(signedRequest(payload))
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { received: true, duplicate: false })
    assert.equal(commands[0][0], 'HSET')
    assert.equal(commands[1][0], 'EVAL')
    assert.ok(JSON.stringify(commands[1]).includes('subscription_credits'))
    assert.ok(JSON.stringify(commands[1]).includes('10000'))
  } finally { globalThis.fetch = originalFetch }
})

test('successful automatic top-up credits 5,000 rollover credits idempotently', async () => {
  const commands: unknown[][] = []
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret; process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  globalThis.fetch = async (_input, init) => { const command = JSON.parse(String(init?.body)) as unknown[]; commands.push(command); return new Response(JSON.stringify({ result: 5000 })) }
  try {
    const payload = { id: 'evt_topup_123', object: 'event', api_version: '2026-06-24.dahlia', created: 1, livemode: false, type: 'payment_intent.succeeded', data: { object: { id: 'pi_123', object: 'payment_intent', amount_received: 1000, currency: 'usd', metadata: { billing_kind: 'tenant_auto_topup', tenant_id: 'tenant_key_123', attempt_id: 'autotopup_123', credits: '5000' } } } }
    const result = await POST(signedRequest(payload))
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { received: true, duplicate: false })
    assert.equal(commands[0][0], 'EVAL')
    assert.ok(JSON.stringify(commands[0]).includes('topup_credits'))
    assert.ok(JSON.stringify(commands[0]).includes('autotopup_123'))
  } finally {
    globalThis.fetch = originalFetch
    if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalSecret
    if (originalWebhookSecret === undefined) delete process.env.STRIPE_API_KEY_WEBHOOK_SECRET; else process.env.STRIPE_API_KEY_WEBHOOK_SECRET = originalWebhookSecret
    if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl
    if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken
  }
})

test('subscription deletion clears monthly credits and disables automatic top-up', async () => {
  const commands: unknown[][] = []
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret; process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  globalThis.fetch = async (_input, init) => { const command = JSON.parse(String(init?.body)) as unknown[]; commands.push(command); return new Response(JSON.stringify({ result: 1 })) }
  try {
    const payload = { id: 'evt_subscription_deleted_123', object: 'event', api_version: '2026-06-24.dahlia', created: 1, livemode: false, type: 'customer.subscription.deleted', data: { object: { id: 'sub_123', object: 'subscription', customer: 'cus_123', metadata: { tenant_id: 'tenant_key_123', tier: 'builder' }, items: { data: [] }, status: 'canceled' } } }
    const result = await POST(signedRequest(payload))
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { received: true, ignored: false })
    assert.equal(commands[0][0], 'EVAL')
    assert.ok(JSON.stringify(commands[0]).includes('subscription_credits'))
    assert.ok(JSON.stringify(commands[0]).includes('auto_topup_enabled'))
    assert.ok(JSON.stringify(commands[0]).includes('rate_limit_per_minute'))
    assert.ok(JSON.stringify(commands[0]).includes('starter'))
  } finally { globalThis.fetch = originalFetch }
})

test('automatic top-up success refuses an event without the matching pending attempt', async () => {
  process.env.STRIPE_SECRET_KEY = secret; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = webhookSecret; process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'; process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  globalThis.fetch = async () => new Response(JSON.stringify({ result: -1 }))
  try {
    const payload = { id: 'evt_topup_mismatch_123', object: 'event', api_version: '2026-06-24.dahlia', created: 1, livemode: false, type: 'payment_intent.succeeded', data: { object: { id: 'pi_mismatch_123', object: 'payment_intent', amount_received: 1000, currency: 'usd', metadata: { billing_kind: 'tenant_auto_topup', tenant_id: 'tenant_key_123', attempt_id: 'autotopup_wrong', credits: '5000' } } } }
    const result = await POST(signedRequest(payload))
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { received: true, warning: 'auto_topup_attempt_mismatch' })
  } finally { globalThis.fetch = originalFetch }
})
