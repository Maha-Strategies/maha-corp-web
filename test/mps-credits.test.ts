import assert from 'node:assert/strict'
import test from 'node:test'

import { stripeWebhookPayloadHash, validStripeEventId } from '../lib/mps-credits.ts'

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
