import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveGovernancePolicy, type GovernancePolicyLayer } from '../lib/governance/policy-inheritance.ts'
import type { GovernancePolicy } from '../lib/governance/envelope.ts'
import { approvalIdFor, MemoryApprovalStore } from '../lib/workflows/approvals.ts'
import { MemoryRecoveryStore, workflowActionIdForExternal } from '../lib/workflows/recovery.ts'

const D1 = `sha256:${'1'.repeat(64)}`
const D2 = `sha256:${'2'.repeat(64)}`
const root: GovernancePolicy = {
  schemaVersion: '0.1.0', policyId: 'governance.root.0001', policyVersion: 'v1',
  allowedTenantIds: ['tenant.one.0001', 'tenant.two.0002'], allowedAgentIds: ['agent.one.0001'], allowedTransports: ['a2a', 'mcp'],
  allowedTargetIds: ['target.one.0001', 'target.two.0002'], allowedResources: ['https://one.example/rpc', 'https://two.example/rpc'],
  allowedOperations: ['tools/call', 'message/send'], allowedCapabilities: ['risk.read', 'risk.write'], maxInputBytes: 65_536, maxHops: 3, maxTimeoutMs: 30_000,
  review: { operations: [], capabilities: [] }, payment: { mode: 'delegate', allowedBuyerPolicyIds: ['buyer.one.0001', 'buyer.two.0002'] },
}
const layer: GovernancePolicyLayer = { policyId: 'governance.tenant.0001', policyVersion: 'source-v1', parentPolicyId: root.policyId, scope: 'tenant', constraints: { allowedTenantIds: ['tenant.one.0001'], allowedTransports: ['mcp'], allowedOperations: ['tools/call'], allowedCapabilities: ['risk.read'], maxInputBytes: 4096, maxTimeoutMs: 5000, reviewCapabilities: ['risk.read'], payment: { mode: 'delegate', allowedBuyerPolicyIds: ['buyer.one.0001'] } } }

test('policy inheritance only narrows authority and binds a content-derived version', () => {
  const policy = resolveGovernancePolicy(root, [layer])
  assert.deepEqual(policy.allowedTenantIds, ['tenant.one.0001'])
  assert.deepEqual(policy.allowedTransports, ['mcp'])
  assert.deepEqual(policy.allowedOperations, ['tools/call'])
  assert.deepEqual(policy.allowedCapabilities, ['risk.read'])
  assert.equal(policy.maxInputBytes, 4096); assert.equal(policy.maxTimeoutMs, 5000)
  assert.deepEqual(policy.review.capabilities, ['risk.read'])
  assert.deepEqual(policy.payment.allowedBuyerPolicyIds, ['buyer.one.0001'])
  assert.match(policy.policyVersion, /^sha256:[a-f0-9]{64}$/)
  const child = resolveGovernancePolicy(root, [layer, { policyId: 'governance.action.0001', policyVersion: 'v1', parentPolicyId: layer.policyId, scope: 'action', constraints: { allowedCapabilities: ['risk.write'], payment: { mode: 'forbid' } } }])
  assert.deepEqual(child.allowedCapabilities, [])
  assert.deepEqual(child.payment, { mode: 'forbid', allowedBuyerPolicyIds: [] })
})

test('policy inheritance rejects cycles, broken ancestry, and excessive depth', () => {
  assert.throws(() => resolveGovernancePolicy(root, [{ ...layer, parentPolicyId: 'governance.other.0001' }]), /contiguous/)
  assert.throws(() => resolveGovernancePolicy(root, [layer, { ...layer, parentPolicyId: layer.policyId }]), /cycle|duplicate/)
  let parent = root.policyId
  const layers = Array.from({ length: 9 }, (_, index) => { const value: GovernancePolicyLayer = { policyId: `governance.layer.${index.toString().padStart(4, '0')}`, policyVersion: 'v1', parentPolicyId: parent, scope: 'workflow', constraints: {} }; parent = value.policyId; return value })
  assert.throws(() => resolveGovernancePolicy(root, layers), /exceeds 8/)
})

test('approval is exact-bound, expiring, idempotently decided, and single use', async () => {
  const store = new MemoryApprovalStore(); const approvalId = approvalIdFor(D1, D2)
  await store.request({ approvalId, tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', actionSha256: D1, policySha256: D2, createdAt: '2026-08-18T12:00:00.000Z', expiresAt: '2026-08-18T12:15:00.000Z' })
  const decided = await store.decide({ tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', approvalId, decision: 'approve', reviewerSha256: D1, reasonCode: 'reviewed', idempotencyKey: 'decision-key.0001', decidedAt: '2026-08-18T12:01:00.000Z' })
  assert.equal(decided.accepted, true)
  assert.equal((await store.decide({ tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', approvalId, decision: 'approve', reviewerSha256: D1, reasonCode: 'reviewed', idempotencyKey: 'decision-key.0001' })).idempotent, true)
  assert.equal((await store.consume({ tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', approvalId, actionSha256: D2, policySha256: D2, consumedAt: '2026-08-18T12:02:00.000Z' })).reason, 'binding_mismatch')
  assert.equal((await store.consume({ tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', approvalId, actionSha256: D1, policySha256: D2, consumedAt: '2026-08-18T12:02:00.000Z' })).consumed, true)
  assert.equal((await store.consume({ tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', approvalId, actionSha256: D1, policySha256: D2, consumedAt: '2026-08-18T12:03:00.000Z' })).reason, 'not_approved')
  assert.deepEqual((await store.list('tenant.one.0001', 'workflow-task-1234567890abcdef1234567890abcdef')).map((record) => record.approvalId), [approvalId])
  assert.equal((await store.list('tenant.two.0002', 'workflow-task-1234567890abcdef1234567890abcdef')).length, 0)
})

test('recovery claims prevent redispatch and preserve metadata-only outcome evidence', async () => {
  const store = new MemoryRecoveryStore(); const actionId = workflowActionIdForExternal('external-action.0001')
  const input = { tenantId: 'tenant.one.0001', taskId: 'workflow-task-1234567890abcdef1234567890abcdef', actionId, actionSha256: D1, policySha256: D2 }
  assert.equal((await store.claim(input)).execute, true)
  assert.equal((await store.claim(input)).execute, false)
  const done = await store.finish({ tenantId: input.tenantId, taskId: input.taskId, actionId, status: 'succeeded', responseStatus: 200, responseSha256: D1 })
  assert.equal(done.status, 'succeeded'); assert.equal(done.responseSha256, D1)
  assert.equal(JSON.stringify(done).includes('private'), false)
  assert.deepEqual((await store.list(input.tenantId, input.taskId)).map((record) => record.actionId), [actionId])
  assert.equal((await store.list('tenant.two.0002', input.taskId)).length, 0)
})
