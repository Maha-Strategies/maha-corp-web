import assert from 'node:assert/strict'
import test from 'node:test'

import { REVENUE_OFFER_FOR_BOOK, reconciliationFailure, revenueWebhookFingerprint } from '../lib/revenue-reconciliation.ts'

test('every paid book maps to its matching canonical revenue offer', () => {
  assert.deepEqual(REVENUE_OFFER_FOR_BOOK, {
    'the-imagined-life': 'book-the-imagined-life',
    'the-orbital-mind': 'book-the-orbital-mind',
    'the-synthetic-self': 'book-the-synthetic-self',
    'the-unfinished-species': 'book-the-unfinished-species',
  })
})

test('revenue reconciliation uses a stable non-secret webhook actor fingerprint', () => {
  assert.match(revenueWebhookFingerprint(), /^sha256:[a-f0-9]{64}$/)
  assert.equal(revenueWebhookFingerprint(), revenueWebhookFingerprint())
})

test('only a dependency retry or failure asks Stripe to retry reconciliation', () => {
  assert.equal(reconciliationFailure('processed'), null)
  assert.equal(reconciliationFailure('duplicate'), null)
  assert.equal(reconciliationFailure('ignored'), null)
  assert.equal(reconciliationFailure('retry')?.status, 503)
  assert.equal(reconciliationFailure('unavailable')?.status, 503)
})
