import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeWorkflowControl, readBoundedJson, workflowTenantId, WorkflowControlInputError } from '../lib/workflows/control.ts'

test('workflow control fails closed and accepts only the exact dedicated bearer', () => {
  const previous = process.env.WORKFLOW_CONTROL_TOKEN
  try {
    delete process.env.WORKFLOW_CONTROL_TOKEN
    assert.deepEqual(authorizeWorkflowControl(new Request('https://maha.example/control')), { ok: false, status: 503 })
    process.env.WORKFLOW_CONTROL_TOKEN = 'workflow-control-token-000000000001'
    assert.deepEqual(authorizeWorkflowControl(new Request('https://maha.example/control', { headers: { authorization: 'Bearer wrong-token' } })), { ok: false, status: 401 })
    const allowed = authorizeWorkflowControl(new Request('https://maha.example/control', { headers: { authorization: `Bearer ${process.env.WORKFLOW_CONTROL_TOKEN}` } }))
    assert.equal(allowed.ok, true)
    if (allowed.ok) assert.match(allowed.reviewerSha256, /^sha256:[a-f0-9]{64}$/)
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_CONTROL_TOKEN
    else process.env.WORKFLOW_CONTROL_TOKEN = previous
  }
})

test('tenant attribution is explicit and bounded', () => {
  assert.equal(workflowTenantId(new Request('https://maha.example/control', { headers: { 'x-maha-tenant-id': 'tenant.operator.0001' } })), 'tenant.operator.0001')
  assert.equal(workflowTenantId(new Request('https://maha.example/control', { headers: { 'x-maha-tenant-id': 'bad tenant' } })), null)
  assert.equal(workflowTenantId(new Request('https://maha.example/control')), null)
})

test('operator JSON is content-typed and byte bounded before parsing', async () => {
  assert.deepEqual(await readBoundedJson(new Request('https://maha.example/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ok":true}' })), { ok: true })
  await assert.rejects(() => readBoundedJson(new Request('https://maha.example/control', { method: 'POST', body: '{}' })), (error: unknown) => error instanceof WorkflowControlInputError && error.status === 415)
  await assert.rejects(() => readBoundedJson(new Request('https://maha.example/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(80) }) }), 32), (error: unknown) => error instanceof WorkflowControlInputError && error.status === 413)
})
