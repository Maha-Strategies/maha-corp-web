import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createUtilityCheckoutId, isKnownUtility, REVENUE_OFFER_FOR_UTILITY,
  utilityCatalogConfig, validUtilityCheckoutId,
} from '../lib/utility-billing.ts'
import { RECEIPT_UTILITY } from '../lib/receipt-utility.ts'

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const keys = ['STRIPE_SECRET_KEY', 'STRIPE_UTILITY_WEBHOOK_SECRET', 'STRIPE_UTILITY_PRICE_MAP', 'UTILITY_CHECKOUT_ENABLED']
  const prior = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  try {
    for (const k of keys) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
    run()
  } finally {
    for (const k of keys) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k] }
  }
}

const ENABLED = {
  STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_UTILITY_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_UTILITY_PRICE_MAP: JSON.stringify({ price_ABC123: RECEIPT_UTILITY }), UTILITY_CHECKOUT_ENABLED: 'true',
}

test('isKnownUtility and offer mapping', () => {
  assert.equal(isKnownUtility(RECEIPT_UTILITY), true)
  assert.equal(isKnownUtility('nope'), false)
  assert.equal(REVENUE_OFFER_FOR_UTILITY[RECEIPT_UTILITY], 'utility-receipts-to-csv')
})

test('checkout id round-trips its own validator', () => {
  const id = createUtilityCheckoutId()
  assert.match(id, /^util_checkout_[a-f0-9]{32}$/)
  assert.equal(validUtilityCheckoutId(id), true)
  assert.equal(validUtilityCheckoutId('util_checkout_short'), false)
  assert.equal(validUtilityCheckoutId('book_checkout_deadbeef'), false)
})

test('utilityCatalogConfig returns null unless fully enabled', () => {
  withEnv({}, () => assert.equal(utilityCatalogConfig(), null))
  withEnv({ ...ENABLED, UTILITY_CHECKOUT_ENABLED: 'false' }, () => assert.equal(utilityCatalogConfig(), null))
  withEnv({ ...ENABLED, STRIPE_UTILITY_WEBHOOK_SECRET: undefined }, () => assert.equal(utilityCatalogConfig(), null))
})

test('utilityCatalogConfig parses the price map both directions', () => {
  withEnv(ENABLED, () => {
    const config = utilityCatalogConfig()
    assert.ok(config)
    assert.equal(config!.utilityByPrice.price_ABC123, RECEIPT_UTILITY)
    assert.equal(config!.priceByUtility[RECEIPT_UTILITY], 'price_ABC123')
  })
})

test('utilityCatalogConfig rejects malformed price maps', () => {
  withEnv({ ...ENABLED, STRIPE_UTILITY_PRICE_MAP: 'not json' }, () => assert.throws(() => utilityCatalogConfig(), /valid JSON/))
  withEnv({ ...ENABLED, STRIPE_UTILITY_PRICE_MAP: JSON.stringify({ notaprice: RECEIPT_UTILITY }) }, () => assert.throws(() => utilityCatalogConfig(), /not a Stripe Price ID/))
  withEnv({ ...ENABLED, STRIPE_UTILITY_PRICE_MAP: JSON.stringify({ price_ABC123: 'unknown-utility' }) }, () => assert.throws(() => utilityCatalogConfig(), /unknown utility/))
  withEnv({ ...ENABLED, STRIPE_UTILITY_PRICE_MAP: JSON.stringify({}) }, () => assert.throws(() => utilityCatalogConfig(), /at least one/))
})
