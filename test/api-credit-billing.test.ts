import assert from 'node:assert/strict'
import test from 'node:test'

import { API_CREDIT_PACKS, billingRequestHash, isApiCreditPack, validClientRequestId } from '../lib/api-credit-billing.ts'

test('API-credit checkout packs have fixed server-side credit quantities', () => {
  assert.deepEqual(API_CREDIT_PACKS, {
    starter: { environment: 'STRIPE_API_CREDITS_STARTER_PRICE_ID', credits: 100_000 },
    pro: { environment: 'STRIPE_API_CREDITS_PRO_PRICE_ID', credits: 600_000 },
    enterprise: { environment: 'STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID', credits: 3_000_000 },
  })
  assert.equal(isApiCreditPack('starter'), true)
  assert.equal(isApiCreditPack('credits-from-browser'), false)
})

test('API-credit idempotency hashes bind one API key and one client request ID', () => {
  assert.equal(validClientRequestId('checkout_12345678'), true)
  assert.equal(validClientRequestId('short'), false)
  assert.equal(validClientRequestId('contains spaces'), false)
  assert.notEqual(billingRequestHash('key_a', 'checkout_12345678'), billingRequestHash('key_b', 'checkout_12345678'))
  assert.equal(billingRequestHash('key_a', 'checkout_12345678'), billingRequestHash('key_a', 'checkout_12345678'))
})
