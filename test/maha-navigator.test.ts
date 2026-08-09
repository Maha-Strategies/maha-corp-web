import assert from 'node:assert/strict'
import test from 'node:test'

import { buildNavigatorAssessment, parseNavigatorSubmission } from '../lib/maha-navigator.ts'

const base = {
  idempotencyKey: 'navigator-test-001',
  requester: { name: 'Ada Example', email: 'ada@example.com', organization: 'Example Systems', role: 'Security engineering lead' },
  stage: 'production', protocols: ['mcp', 'x402'], priority: 'payment_safety',
  primaryGoal: 'Bound agent tool calls and cumulative payments before expanding the production pilot.',
  controls: { tool_authorization: 'partial', agent_identity: 'enforced', task_budgets: 'absent', audit_receipts: 'partial', context_governance: 'unknown', reliability: 'enforced' },
  consentToAssessment: true, consentToFollowUp: true,
}

test('Navigator parses an explicit, consented infrastructure assessment', () => {
  const parsed = parseNavigatorSubmission(base)
  assert.equal(parsed.requester.email, 'ada@example.com')
  assert.deepEqual(parsed.protocols, ['mcp', 'x402'])
  assert.equal(parsed.consentToFollowUp, true)
})

test('Navigator refuses implicit consent and unsupported protocol values', () => {
  assert.throws(() => parseNavigatorSubmission({ ...base, consentToAssessment: false }), /consentToAssessment/)
  assert.throws(() => parseNavigatorSubmission({ ...base, protocols: ['mcp', 'invented'] }), /protocols item/)
  assert.throws(() => parseNavigatorSubmission({ ...base, website: 'spam' }), /Submission rejected/)
})

test('Navigator reports deterministic gaps without claiming certification', () => {
  const result = buildNavigatorAssessment(parseNavigatorSubmission(base))
  assert.equal(result.score, 50)
  assert.equal(result.band, 'developing')
  assert.equal(result.pilotCandidate, true)
  assert.equal(result.recommendedPilot.id, 'x402-buyer-policy')
  assert.deepEqual(result.strengths, ['agent_identity', 'reliability'])
  assert.ok(result.gaps.some((gap) => gap.domain === 'task_budgets' && gap.priority === 'high'))
  assert.ok(result.limits.some((item) => item.includes('not a security')))
})

test('fully enforced controls still retain assessment limits', () => {
  const controls = Object.fromEntries(Object.keys(base.controls).map((domain) => [domain, 'enforced']))
  const result = buildNavigatorAssessment(parseNavigatorSubmission({ ...base, controls }))
  assert.equal(result.score, 100)
  assert.equal(result.band, 'controlled')
  assert.equal(result.gaps.length, 0)
  assert.equal(result.pilotCandidate, false)
  assert.equal(result.limits.length, 3)
})
