import assert from 'node:assert/strict'
import test from 'node:test'

import { creditPackAvailable, stripeWebhookPayloadHash, validStripeEventId } from '../lib/mps-credits.ts'

test('Stripe event IDs require the evt_ prefix and an alphanumeric identifier', () => {
  assert.equal(validStripeEventId('evt_1Q9ZQ2A1b2C3d4E5'), true)
  assert.equal(validStripeEventId('pi_1Q9ZQ2A1b2C3d4E5'), false)
  assert.equal(validStripeEventId('evt_bad-id'), false)
  assert.equal(validStripeEventId('evt_'), false)
})

test('Stripe webhook payloads are logged by hash rather than raw contents', () => {
  assert.equal(
    stripeWebhookPayloadHash('hello'),
    'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  )
  assert.notEqual(stripeWebhookPayloadHash('hello'), stripeWebhookPayloadHash('hello '))
})

test('the purchase page gate opens only when the pack can actually be sold', () => {
  const keys = ['STRIPE_SECRET_KEY', 'STRIPE_MPS_AUDIT_CREDIT_PRICE_ID', 'STRIPE_MPS_CREDITS_WEBHOOK_SECRET', 'MPS_AUDIT_CREDIT_PACK_UNITS', 'MPS_AUDIT_CREDIT_CHECKOUT_ENABLED'] as const
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  const restore = () => { for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key] } }

  try {
    Object.assign(process.env, {
      STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_MPS_AUDIT_CREDIT_PRICE_ID: 'price_ABC123',
      STRIPE_MPS_CREDITS_WEBHOOK_SECRET: 'whsec_x', MPS_AUDIT_CREDIT_PACK_UNITS: '100',
      MPS_AUDIT_CREDIT_CHECKOUT_ENABLED: 'true',
    })
    assert.equal(creditPackAvailable(), true)

    // The production fault this guards: flag on, webhook secret absent.
    delete process.env.STRIPE_MPS_CREDITS_WEBHOOK_SECRET
    assert.equal(creditPackAvailable(), false)

    // Deliberately switched off is closed too, without being an error.
    process.env.STRIPE_MPS_CREDITS_WEBHOOK_SECRET = 'whsec_x'
    process.env.MPS_AUDIT_CREDIT_CHECKOUT_ENABLED = 'false'
    assert.equal(creditPackAvailable(), false)

    // Present but invalid throws inside creditPackConfig; the gate must treat
    // that as closed rather than propagating into the page render.
    process.env.MPS_AUDIT_CREDIT_CHECKOUT_ENABLED = 'true'
    process.env.STRIPE_MPS_AUDIT_CREDIT_PRICE_ID = 'not-a-price-id'
    assert.equal(creditPackAvailable(), false)
  } finally {
    restore()
  }
})
