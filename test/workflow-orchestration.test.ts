import assert from 'node:assert/strict'
import test from 'node:test'
import { approvalIdFor, MemoryApprovalStore } from '../lib/workflows/approvals.ts'
import { WorkflowOrchestrator } from '../lib/workflows/orchestration.ts'
import { MemoryRecoveryStore, workflowActionIdForExternal } from '../lib/workflows/recovery.ts'
import { MemoryWorkflowTaskStore } from '../lib/workflows/task-state.ts'

const tenantId = 'tenant.operator.0001'
const taskId = 'workflow-task-1234567890abcdef1234567890abcdef'
const D1 = `sha256:${'1'.repeat(64)}`
const D2 = `sha256:${'2'.repeat(64)}`

test('orchestrator creates metadata-only tasks and returns a complete operator snapshot', async () => {
  const tasks = new MemoryWorkflowTaskStore(); const approvals = new MemoryApprovalStore(); const recovery = new MemoryRecoveryStore()
  const orchestrator = new WorkflowOrchestrator(tasks, approvals, recovery)
  const created = await orchestrator.create({ tenantId, taskId, transitionId: 'operator-create.0001', evidenceSha256: D1 })
  assert.equal(created.accepted, true); assert.equal(created.state.status, 'pending')
  const approvalId = approvalIdFor(D1, D2)
  await approvals.request({ tenantId, taskId, approvalId, actionSha256: D1, policySha256: D2, createdAt: '2026-08-18T12:00:00.000Z', expiresAt: '2026-08-18T12:15:00.000Z' })
  const actionId = workflowActionIdForExternal('operator-action.0001')
  await recovery.claim({ tenantId, taskId, actionId, actionSha256: D1, policySha256: D2 })
  const snapshot = await orchestrator.snapshot(tenantId, taskId)
  assert.equal(snapshot?.contentRetained, false)
  assert.deepEqual(snapshot?.events.map((event) => event.event), ['task_created'])
  assert.deepEqual(snapshot?.approvals.map((record) => record.approvalId), [approvalId])
  assert.deepEqual(snapshot?.recoveryActions.map((record) => record.actionId), [actionId])
  assert.equal(JSON.stringify(snapshot).includes('payload'), false)
})

test('operator authority is restricted to lifecycle decisions and honors the state machine', async () => {
  const orchestrator = new WorkflowOrchestrator(new MemoryWorkflowTaskStore(), new MemoryApprovalStore(), new MemoryRecoveryStore())
  await orchestrator.create({ tenantId, taskId, transitionId: 'operator-create.0001', evidenceSha256: D1 })
  const completed = await orchestrator.transition({ tenantId, taskId, transitionId: 'operator-complete.0001', event: 'task_completed', evidenceSha256: D2 })
  assert.equal(completed.accepted, false, 'pending tasks cannot skip dispatch and complete')
  await assert.rejects(() => orchestrator.transition({ tenantId, taskId, transitionId: 'operator-pay.0001', event: 'payment_authorized' as never, evidenceSha256: D2 }), /operator-controlled/)
})
