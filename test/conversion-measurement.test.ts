import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateConversionMeasurements, parsePublicConversionEvent, validSourcePath } from '../lib/conversion-measurement.ts'

const experimentId = 'experiment_1234567890abcdef1234567890abcdef'

test('parses only bounded, non-identifying client conversion events', () => {
  const parsed = parsePublicConversionEvent({
    eventId: 'conv_12345678-1234-1234-1234-123456789abc', eventName: 'cta_homepage_start_inquiry', eventType: 'cta_click',
    experimentId, sourcePath: '/rapid-intelligence-brief',
  })
  assert.equal(parsed.experimentId, experimentId)
  assert.equal(parsed.sourcePath, '/rapid-intelligence-brief')
  assert.throws(() => parsePublicConversionEvent({ ...parsed, sourcePath: '/contact?email=private@example.com' }), /sourcePath/)
  assert.throws(() => parsePublicConversionEvent({ ...parsed, eventName: 'click me!' }), /eventName/)
  assert.throws(() => parsePublicConversionEvent({ ...parsed, eventType: 'paid_conversion' }), /eventType/)
  assert.equal(validSourcePath('https://example.com/'), false)
})

test('summarizes unverified browser signals separately from Stripe outcomes', () => {
  const summary = aggregateConversionMeasurements([
    { experiment_id: experimentId, event_type: 'cta_click', source_kind: 'client_unverified' },
    { experiment_id: experimentId, event_type: 'inquiry_submitted', source_kind: 'client_unverified' },
    { experiment_id: experimentId, event_type: 'checkout_started', source_kind: 'server_checkout' },
    { experiment_id: experimentId, event_type: 'paid_conversion', source_kind: 'stripe_verified' },
    { experiment_id: null, event_type: 'paid_conversion', source_kind: 'stripe_verified' },
  ])
  assert.deepEqual(summary.byExperiment[experimentId], { ctaClicks: 1, inquiries: 1, checkoutStarts: 1, paidConversions: 1, unverifiedClientSignals: 2 })
  assert.equal(summary.unattributed.paidConversions, 1)
  assert.equal(summary.unattributed.unverifiedClientSignals, 0)
})
