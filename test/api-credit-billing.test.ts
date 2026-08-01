import assert from 'node:assert/strict'
import test from 'node:test'

import { API_CREDIT_PACKS, billingRequestHash, isApiCreditPack, isTenantSubscriptionTier, tenantBillingConfig, tenantMonthlyCredits, validClientRequestId } from '../lib/api-credit-billing.ts'

test('API-credit checkout packs have fixed server-side credit quantities', () => {
  assert.deepEqual(API_CREDIT_PACKS, {
    starter: { environment: 'STRIPE_API_CREDITS_STARTER_PRICE_ID', credits: 100_000 },
    pro: { environment: 'STRIPE_API_CREDITS_PRO_PRICE_ID', credits: 600_000 },
    enterprise: { environment: 'STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID', credits: 3_000_000 },
  })
  assert.equal(isApiCreditPack('starter'), true)
  assert.equal(isApiCreditPack('credits-from-browser'), false)
})

test('tenant subscription policy is server-defined', () => {
  assert.equal(isTenantSubscriptionTier('builder'), true)
  assert.equal(isTenantSubscriptionTier('scale'), true)
  assert.equal(isTenantSubscriptionTier('enterprise'), false)
  assert.equal(tenantMonthlyCredits('builder'), 10_000)
  assert.equal(tenantMonthlyCredits('scale'), 60_000)
})

test('tenant billing configuration fails closed unless all Stripe values are valid', () => {
  const names = ['STRIPE_SECRET_KEY', 'STRIPE_API_KEY_WEBHOOK_SECRET', 'STRIPE_TENANT_BUILDER_PRICE_ID', 'STRIPE_TENANT_SCALE_PRICE_ID', 'STRIPE_TENANT_AUTO_TOPUP_PRICE_ID'] as const
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  try {
    for (const name of names) delete process.env[name]
    assert.equal(tenantBillingConfig(), null)
    process.env.STRIPE_SECRET_KEY = 'sk_test_value'; process.env.STRIPE_API_KEY_WEBHOOK_SECRET = 'whsec_value'; process.env.STRIPE_TENANT_BUILDER_PRICE_ID = 'price_builder'; process.env.STRIPE_TENANT_SCALE_PRICE_ID = 'price_scale'; process.env.STRIPE_TENANT_AUTO_TOPUP_PRICE_ID = 'price_topup'
    assert.deepEqual(tenantBillingConfig()?.prices, { builder: 'price_builder', scale: 'price_scale', autoTopup: 'price_topup' })
  } finally { for (const name of names) { const value = previous[name]; if (value === undefined) delete process.env[name]; else process.env[name] = value } }
})

test('API-credit idempotency hashes bind one API key and one client request ID', () => {
  assert.equal(validClientRequestId('checkout_12345678'), true)
  assert.equal(validClientRequestId('short'), false)
  assert.equal(validClientRequestId('contains spaces'), false)
  assert.notEqual(billingRequestHash('key_a', 'checkout_12345678'), billingRequestHash('key_b', 'checkout_12345678'))
  assert.equal(billingRequestHash('key_a', 'checkout_12345678'), billingRequestHash('key_a', 'checkout_12345678'))
})
