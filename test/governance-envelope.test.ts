import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { evaluateGovernedAction, governanceDigest, isGovernanceEnvelope, isGovernancePolicy, type GovernanceEnvelope, type GovernancePolicy } from '../lib/governance/envelope.ts'
import { validate } from './helpers/json-schema.ts'

const NOW = new Date('2026-08-18T08:01:00Z')
const SHA_A = `sha256:${'a'.repeat(64)}`
const SHA_B = `sha256:${'b'.repeat(64)}`

function policy(overrides: Partial<GovernancePolicy> = {}): GovernancePolicy {
  return {
    schemaVersion: '0.1.0', policyId: 'policy.test.0001', policyVersion: '1',
    allowedTenantIds: ['tenant.test.0001'], allowedAgentIds: ['agent.test.0001'],
    allowedTransports: ['a2a', 'mcp', 'http-x402'], allowedTargetIds: ['target.test.0001'],
    allowedResources: ['https://agent.example/actions'], allowedOperations: ['tools/call'],
    allowedCapabilities: ['research.summarize'], maxInputBytes: 1000, maxHops: 2, maxTimeoutMs: 5000,
    review: { operations: [], capabilities: [] }, payment: { mode: 'delegate', allowedBuyerPolicyIds: ['buyer.test.0001'] },
    ...overrides,
  }
}

function envelope(overrides: Partial<GovernanceEnvelope> = {}): GovernanceEnvelope {
  return {
    schemaVersion: '0.1.0', requestId: 'request.test.0001', taskId: 'task.test.0001',
    issuedAt: '2026-08-18T08:00:00Z', expiresAt: '2026-08-18T08:05:00Z',
    subject: { tenantId: 'tenant.test.0001', agentId: 'agent.test.0001' },
    action: { transport: 'mcp', targetId: 'target.test.0001', resource: 'https://agent.example/actions', operation: 'tools/call', capability: 'research.summarize' },
    context: { inputSha256: SHA_A, inputBytes: 900, contentRetained: false }, execution: { hopCount: 1, timeoutMs: 4000 },
    payment: { status: 'authorized', buyerPolicyId: 'buyer.test.0001', buyerPolicyVersion: '1', buyerDecisionCode: 'allowed', authorizationSha256: SHA_B },
    ...overrides,
  }
}

test('allows an exact action and produces deterministic metadata-only evidence', () => {
  const first = evaluateGovernedAction(policy(), envelope(), NOW)
  const second = evaluateGovernedAction(policy(), envelope(), NOW)
  assert.deepEqual(first, second)
  assert.equal(first.outcome, 'proceed')
  assert.deepEqual(first.reasonCodes, ['allowed'])
  assert.match(first.evidenceSha256, /^sha256:[a-f0-9]{64}$/)
  assert.equal(first.evidence.contentRetained, false)
  assert.equal(first.evidence.paymentEvaluatedBy, 'maha-x402-buyer-policy')
  assert.equal(JSON.stringify(first).includes('research.summarize'), false)
})

test('canonical digests do not depend on object key order', () => {
  assert.equal(governanceDigest({ b: 2, a: { d: 4, c: 3 } }), governanceDigest({ a: { c: 3, d: 4 }, b: 2 }))
})

test('fails closed on malformed and extended inputs', () => {
  const withPayload = { ...envelope(), prompt: 'do not retain me' }
  const decision = evaluateGovernedAction(policy(), withPayload, NOW)
  assert.equal(isGovernanceEnvelope(withPayload), false)
  assert.equal(decision.outcome, 'deny')
  assert.deepEqual(decision.reasonCodes, ['envelope_invalid'])
  assert.equal(JSON.stringify(decision).includes('do not retain me'), false)
})

test('reports every deterministic boundary violation in stable order', () => {
  const decision = evaluateGovernedAction(policy(), envelope({
    expiresAt: '2026-08-18T08:00:30Z',
    action: { transport: 'mcp', targetId: 'target.other.0001', resource: 'https://other.example/actions', operation: 'resources/read', capability: 'private.export' },
    context: { inputSha256: SHA_A, inputBytes: 1001, contentRetained: false },
    execution: { hopCount: 3, timeoutMs: 5001 }, payment: { status: 'not_checked', buyerDecisionCode: 'not_checked' },
  }), NOW)
  assert.equal(decision.outcome, 'deny')
  assert.deepEqual(decision.reasonCodes, [
    'envelope_expired', 'target_not_allowed', 'resource_not_allowed', 'operation_not_allowed',
    'capability_not_allowed', 'input_limit_exceeded', 'hop_limit_exceeded', 'timeout_limit_exceeded', 'payment_not_authorized',
  ])
})

test('binds tenant and agent identity and rejects future-dated envelopes', () => {
  const wrongIdentity = evaluateGovernedAction(policy(), envelope({
    issuedAt: '2026-08-18T08:02:00Z',
    subject: { tenantId: 'tenant.other.0001', agentId: 'agent.other.0001' },
  }), NOW)
  assert.equal(wrongIdentity.outcome, 'deny')
  assert.deepEqual(wrongIdentity.reasonCodes, ['envelope_not_yet_valid', 'tenant_not_allowed', 'agent_not_allowed'])
})

test('requires review without weakening any denial', () => {
  const reviewPolicy = policy({ review: { operations: ['tools/call'], capabilities: [] } })
  assert.equal(evaluateGovernedAction(reviewPolicy, envelope(), NOW).outcome, 'require_review')
  const denied = evaluateGovernedAction(reviewPolicy, envelope({ context: { inputSha256: SHA_A, inputBytes: 1001, contentRetained: false } }), NOW)
  assert.equal(denied.outcome, 'deny')
})

test('forbid mode permits only explicitly unpaid actions', () => {
  const noPayment = policy({ payment: { mode: 'forbid', allowedBuyerPolicyIds: [] } })
  assert.equal(evaluateGovernedAction(noPayment, envelope({ payment: { status: 'not_required' } }), NOW).outcome, 'proceed')
  const paid = evaluateGovernedAction(noPayment, envelope(), NOW)
  assert.equal(paid.outcome, 'deny')
  assert.deepEqual(paid.reasonCodes, ['payment_forbidden'])
})

test('rejects payment attestations from an unapproved buyer policy', () => {
  const decision = evaluateGovernedAction(policy(), envelope({ payment: {
    status: 'authorized', buyerPolicyId: 'buyer.other.0001', buyerPolicyVersion: '1', buyerDecisionCode: 'allowed', authorizationSha256: SHA_B,
  } }), NOW)
  assert.equal(decision.outcome, 'deny')
  assert.deepEqual(decision.reasonCodes, ['buyer_policy_not_allowed'])
})

test('public examples validate independently against both schemas', () => {
  const example = JSON.parse(fs.readFileSync('public/governance/maha-governance-example.json', 'utf8'))
  const policySchema = JSON.parse(fs.readFileSync('public/schemas/maha-governance-policy-0.1.0.json', 'utf8'))
  const envelopeSchema = JSON.parse(fs.readFileSync('public/schemas/maha-governance-envelope-0.1.0.json', 'utf8'))
  const withoutMeta = (schema: Record<string, unknown>) => Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== '$schema' && key !== '$id'),
  )
  assert.deepEqual(validate(example.policy, withoutMeta(policySchema)), [])
  assert.deepEqual(validate(example.envelope, withoutMeta(envelopeSchema)), [])
  assert.notDeepEqual(validate({ ...example.envelope, payment: { status: 'authorized' } }, withoutMeta(envelopeSchema)), [])
  assert.equal(isGovernancePolicy(example.policy), true)
  assert.equal(isGovernanceEnvelope(example.envelope), true)
})
