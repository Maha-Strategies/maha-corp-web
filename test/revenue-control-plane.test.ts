import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRevenueControlAction, routeRevenueSignal } from '../lib/revenue-control-plane.ts'

test('self-service revenue signals route directly to their existing checkout surface', () => {
  const route = routeRevenueSignal({ sourceType: 'website_contact', sourceReference: 'contact-1042', offerId: 'mps-preflight' })
  assert.equal(route.route, 'self_service_checkout')
  assert.equal(route.humanReviewRequired, false)
  assert.equal(route.offer.href, '/mps/preflight')
})

test('high-ticket revenue signals remain subject to human scope review', () => {
  const route = routeRevenueSignal({ sourceType: 'agent_inquiry', sourceReference: 'inq_0123456789abcdef0123456789abcdef', offerId: 'verified-research-brief', hasDefinedDecision: true, hasSpecificQuestion: true, hasOrganization: true })
  assert.equal(route.route, 'human_scope_review')
  assert.equal(route.qualified, true)
  assert.equal(route.humanReviewRequired, true)
})

test('paid outcomes require an amount, currency, and operator idempotency key', () => {
  assert.throws(() => parseRevenueControlAction({ action: 'record_outcome', opportunityId: 'revopp_0123456789abcdef0123456789abcdef', outcome: 'paid', idempotencyKey: 'payment-1042', reason: 'Stripe payment confirmed.', referenceId: 'pi_123' }))
  const action = parseRevenueControlAction({ action: 'record_outcome', opportunityId: 'revopp_0123456789abcdef0123456789abcdef', outcome: 'paid', amountCents: 4900, currency: 'USD', idempotencyKey: 'payment-1042', reason: 'Stripe payment confirmed.', referenceId: 'pi_123' })
  assert.equal(action.action, 'record_outcome')
  if (action.action === 'record_outcome') assert.equal(action.currency, 'usd')
})
