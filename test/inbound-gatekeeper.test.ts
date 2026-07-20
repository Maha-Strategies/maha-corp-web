import assert from 'node:assert/strict'
import test from 'node:test'

import { parseInboundSubmission, routeInboundSubmission } from '../lib/inbound-gatekeeper.ts'

const base = { idempotencyKey: 'inbound-test-001', offerId: 'rapid-intelligence-brief', requester: { name: 'Ada Example', email: 'ada@example.com', organization: 'Example Co' }, decision: 'Choose a market entry path for the next planning cycle.', question: 'Which evidence-backed market entry path best fits the current constraints?', requesterAuthorized: true }

test('qualified inbound research request remains human-scoped', () => {
  const submission = parseInboundSubmission(base)
  assert.deepEqual(routeInboundSubmission(submission), {
    status: 'qualified', qualificationReasons: ['defined_decision', 'specific_question', 'organization_identified'],
    nextStep: 'Queue for human scope and price review.', route: 'human_scope_review',
  })
})

test('self-service request routes to the existing checkout surface', () => {
  const submission = parseInboundSubmission({ ...base, offerId: 'mps-preflight' })
  assert.equal(routeInboundSubmission(submission).route, 'self_service_checkout')
})

test('honeypot input is rejected before qualification', () => {
  assert.throws(() => parseInboundSubmission({ ...base, website: 'https://spam.example' }), /Submission rejected/)
})
