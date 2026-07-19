import assert from 'node:assert/strict'
import test from 'node:test'

import { bookCatalogConfig, createBookCheckoutId, createBookEntitlementId, isKnownBook, validBookCheckoutId } from '../lib/books.ts'

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const original: Record<string, string | undefined> = {}
  for (const key of Object.keys(values)) original[key] = process.env[key]
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try { run() } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const ENABLED = {
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_BOOKS_WEBHOOK_SECRET: 'whsec_x',
  BOOK_CHECKOUT_ENABLED: 'true',
}

test('catalog membership and id formats', () => {
  assert.ok(isKnownBook('the-imagined-life'))
  assert.equal(isKnownBook('not-a-book'), false)
  assert.equal(isKnownBook('The-Imagined-Life'), false)
  assert.match(createBookCheckoutId(), /^book_checkout_[a-f0-9]{32}$/)
  assert.match(createBookEntitlementId(), /^bent_[a-f0-9]{32}$/)
  assert.ok(validBookCheckoutId('book_checkout_' + 'a'.repeat(32)))
  assert.equal(validBookCheckoutId('book_checkout_zzz'), false)
})

test('bookCatalogConfig returns null when disabled or incomplete', () => {
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{"price_A1":"the-imagined-life"}', BOOK_CHECKOUT_ENABLED: 'false' }, () => {
    assert.equal(bookCatalogConfig(), null)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: undefined }, () => {
    assert.equal(bookCatalogConfig(), null)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{"price_A1":"the-imagined-life"}', STRIPE_BOOKS_WEBHOOK_SECRET: undefined }, () => {
    assert.equal(bookCatalogConfig(), null)
  })
})

test('bookCatalogConfig parses a valid map both directions', () => {
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{"price_A1":"the-imagined-life","price_B2":"the-orbital-mind"}' }, () => {
    const config = bookCatalogConfig()
    assert.ok(config)
    assert.equal(config.bookByPrice.price_A1, 'the-imagined-life')
    assert.equal(config.bookByPrice.price_B2, 'the-orbital-mind')
    assert.equal(config.priceByBook['the-imagined-life'], 'price_A1')
    assert.equal(config.webhookSecret, 'whsec_x')
  })
})

test('bookCatalogConfig throws on malformed configuration', () => {
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: 'not json' }, () => {
    assert.throws(() => bookCatalogConfig(), /valid JSON/)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{"bad_key":"the-imagined-life"}' }, () => {
    assert.throws(() => bookCatalogConfig(), /not a Stripe Price ID/)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{"price_A1":"unknown-book"}' }, () => {
    assert.throws(() => bookCatalogConfig(), /unknown book/)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '{}' }, () => {
    assert.throws(() => bookCatalogConfig(), /at least one/)
  })
  withEnv({ ...ENABLED, STRIPE_BOOK_PRICE_MAP: '["price_A1"]' }, () => {
    assert.throws(() => bookCatalogConfig(), /JSON object/)
  })
})
