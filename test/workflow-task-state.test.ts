import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryWorkflowTaskStore, nextWorkflowStatus, workflowResponseHeaders, workflowTaskIdForExternal, workflowTransitionId, type WorkflowTransitionEvent } from '../lib/workflows/task-state.ts'

const tenantId = 'tenant.workflow.0001'
const taskId = 'task.workflow.0001'
const evidenceSha256 = `sha256:${'a'.repeat(64)}`
const actor = { transport: 'orchestrator' as const, targetId: 'orchestrator.primary', operation: 'workflow.advance' }

function input(event: WorkflowTransitionEvent, suffix: string = event) {
  return { tenantId, taskId, transitionId: `transition.${suffix}.0001`, event, actor, evidenceSha256, occurredAt: '2026-08-18T12:00:00.000Z' }
}

test('workflow state machine advances through review, payment, input and completion', async () => {
  const store = new MemoryWorkflowTaskStore()
  assert.equal((await store.transition(input('review_required'))).state.status, 'awaiting_review')
  assert.equal((await store.transition(input('review_approved'))).state.status, 'running')
  assert.equal((await store.transition(input('payment_required'))).state.status, 'awaiting_payment')
  assert.equal((await store.transition(input('payment_authorized'))).state.status, 'running')
  assert.equal((await store.transition(input('input_required'))).state.status, 'awaiting_input')
  assert.equal((await store.transition(input('input_received'))).state.status, 'running')
  const completed = await store.transition(input('task_completed'))
  assert.equal(completed.state.status, 'completed')
  assert.equal(completed.state.version, 7)
  assert.deepEqual(workflowResponseHeaders(completed.state), { 'X-Maha-Workflow-State': 'completed', 'X-Maha-Workflow-Version': '7' })
  assert.equal((await store.events(tenantId, taskId)).length, 7)
})

test('transition identifiers are idempotent and do not append duplicate events', async () => {
  const store = new MemoryWorkflowTaskStore()
  const first = await store.transition(input('action_dispatched'))
  const replay = await store.transition(input('action_dispatched'))
  assert.equal(first.idempotent, false)
  assert.equal(replay.idempotent, true)
  assert.equal(replay.state.version, 1)
  assert.equal((await store.events(tenantId, taskId)).length, 1)
})

test('terminal tasks reject every new transition and preserve terminal state', async () => {
  const store = new MemoryWorkflowTaskStore()
  await store.transition(input('action_dispatched'))
  await store.transition(input('task_failed'))
  const rejected = await store.transition(input('action_dispatched', 'after-terminal'))
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.reason, 'invalid_transition')
  assert.equal(rejected.state.status, 'failed')
  assert.equal(rejected.state.version, 2)
})

test('one tenant task records actors from different protocols in one ordered history', async () => {
  const store = new MemoryWorkflowTaskStore()
  await store.transition({ ...input('action_dispatched', 'a2a'), actor: { transport: 'a2a', targetId: 'a2a.agent.0001', operation: 'message/send' } })
  await store.transition({ ...input('action_succeeded', 'a2a-success'), actor: { transport: 'a2a', targetId: 'a2a.agent.0001', operation: 'message/send' } })
  await store.transition({ ...input('participant_completed', 'a2a-complete'), actor: { transport: 'a2a', targetId: 'a2a.agent.0001', operation: 'message/send' } })
  await store.transition({ ...input('action_dispatched', 'mcp'), actor: { transport: 'mcp', targetId: 'mcp.server.0001', operation: 'tools/call' } })
  await store.transition({ ...input('action_succeeded', 'mcp-success'), actor: { transport: 'mcp', targetId: 'mcp.server.0001', operation: 'tools/call' } })
  const events = await store.events(tenantId, taskId)
  assert.deepEqual(events.map((event) => event.actor.transport), ['a2a', 'a2a', 'a2a', 'mcp', 'mcp'])
  assert.deepEqual(events.map((event) => event.version), [1, 2, 3, 4, 5])
  assert.equal((await store.get(tenantId, taskId))?.status, 'running')
})

test('state tables expose only allowed transitions and transition ids are deterministic', () => {
  assert.equal(nextWorkflowStatus('awaiting_payment', 'payment_authorized'), 'running')
  assert.equal(nextWorkflowStatus('awaiting_payment', 'action_dispatched'), null)
  const value = { taskId, requestId: 'request-1', targetId: 'mcp.server.0001', operation: 'tools/call', event: 'action_dispatched' as const }
  assert.equal(workflowTransitionId(value), workflowTransitionId(value))
  assert.match(workflowTransitionId(value), /^workflow-transition-[a-f0-9]{64}$/)
  assert.equal(workflowTaskIdForExternal('customer-workflow-1'), workflowTaskIdForExternal('customer-workflow-1'))
  assert.notEqual(workflowTaskIdForExternal('customer-workflow-1'), workflowTaskIdForExternal('customer-workflow-2'))
  assert.match(workflowTaskIdForExternal('customer-workflow-1'), /^workflow-task-[a-f0-9]{32}$/)
})

test('metadata validation rejects payload-shaped evidence and malformed identifiers', async () => {
  const store = new MemoryWorkflowTaskStore()
  await assert.rejects(() => store.transition({ ...input('action_dispatched'), evidenceSha256: 'private payload' }), /evidenceSha256/)
  await assert.rejects(() => store.transition({ ...input('action_dispatched'), taskId: 'bad task id' }), /taskId/)
})

test('task creation is durable, idempotent and cannot be repeated with a new transition', async () => {
  const store = new MemoryWorkflowTaskStore()
  const created = await store.transition(input('task_created', 'create'))
  assert.equal(created.accepted, true)
  assert.equal(created.state.version, 1)
  assert.equal((await store.transition(input('task_created', 'create'))).idempotent, true)
  const duplicate = await store.transition(input('task_created', 'create-again'))
  assert.equal(duplicate.accepted, false)
  assert.equal(duplicate.state.version, 1)
  assert.equal((await store.events(tenantId, taskId)).length, 1)
})

test('task indexes are tenant scoped, ordered by update and bounded', async () => {
  const store = new MemoryWorkflowTaskStore()
  await store.transition(input('task_created', 'first'))
  await store.transition({ ...input('task_created', 'other'), tenantId: 'tenant.workflow.0002', taskId: 'task.workflow.0002', occurredAt: '2026-08-18T12:01:00.000Z' })
  await store.transition({ ...input('task_created', 'second'), taskId: 'task.workflow.0003', occurredAt: '2026-08-18T12:02:00.000Z' })
  assert.deepEqual((await store.list(tenantId)).map((state) => state.taskId), ['task.workflow.0003', taskId])
  assert.equal((await store.list(tenantId, 1)).length, 1)
  await assert.rejects(() => store.list(tenantId, 101), /limit/)
})
