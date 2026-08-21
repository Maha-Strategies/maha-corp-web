import assert from 'node:assert/strict'
import test from 'node:test'

import { findUnboundedStrings } from '../lib/governed-workflow/audit.ts'
import { GwsgDemoError, parseDemoRequest, runDemoProgram } from '../lib/governed-workflow/demo-api.ts'

/**
 * The demo surface.
 *
 * These lock the operation-to-state mapping, which is the part a reader is
 * most likely to rely on, and re-attack the metadata guarantee at the API
 * boundary rather than only in the durable model.
 */

const EVIDENCE = ['claim_form', 'policy_document', 'assessment_note']

function run(program: unknown[]) {
  return runDemoProgram(parseDemoRequest({ program }))
}

test('the approved program walks the full reference state machine', () => {
  const result = run([
    { operation: 'create_workflow' },
    { operation: 'submit_evidence', evidence: EVIDENCE },
    { operation: 'evaluate_policy' },
    { operation: 'request_approval' },
    { operation: 'record_approval', decision: 'grant' },
    { operation: 'authorize_action' },
  ])
  assert.deepEqual(
    result.timeline.map((event) => `${event.priorState}>${event.nextState}`),
    ['draft>evidence_collected', 'evidence_collected>policy_evaluated', 'policy_evaluated>approval_pending', 'approval_pending>approved', 'approved>action_authorized'],
  )
  assert.equal(result.finalState, 'action_authorized')
  assert.equal(result.timeline.at(-1)?.approvalState, 'granted')
  assert.equal(result.chainIntegrity.valid, true)
  // No receipt was supplied, so the run is correctly unsure whether the
  // simulated effect landed.
  assert.equal(result.recovery.classification, 'indeterminate_side_effect')
})

test('a reviewer denial ends the workflow at denied without authorizing an action', () => {
  const result = run([
    { operation: 'create_workflow' },
    { operation: 'submit_evidence', evidence: EVIDENCE },
    { operation: 'evaluate_policy' },
    { operation: 'request_approval' },
    { operation: 'record_approval', decision: 'deny' },
    { operation: 'authorize_action' },
  ])
  assert.equal(result.finalState, 'denied')
  assert.equal(result.timeline.some((event) => event.nextState === 'action_authorized'), false)
  // The attempt after denial is refused without extending the log.
  assert.equal(result.timeline.length, 4)
})

test('an action cannot be authorized without a policy decision first', () => {
  const result = run([{ operation: 'create_workflow' }, { operation: 'submit_evidence', evidence: EVIDENCE }, { operation: 'authorize_action' }])
  assert.equal(result.timeline.some((event) => event.nextState === 'action_authorized'), false)
  assert.ok(result.timeline.flatMap((event) => event.reasonCodes).includes('invalid_transition'))
})

test('the demo program is deterministic: identical input yields identical digests', () => {
  const program = [
    { operation: 'create_workflow' },
    { operation: 'submit_evidence', evidence: EVIDENCE },
    { operation: 'evaluate_policy' },
    { operation: 'audit_timeline' },
  ]
  const first = run(program)
  const second = run(program)
  assert.deepEqual(first.timeline, second.timeline)
  assert.deepEqual(first.steps, second.steps)
})

test('a program must begin by creating a workflow', () => {
  assert.throws(() => run([{ operation: 'evaluate_policy' }]), (error: unknown) => {
    assert.ok(error instanceof GwsgDemoError)
    assert.equal(error.code, 'workflow_not_created')
    return true
  })
})

test('the API rejects unknown operations and off-catalog evidence', () => {
  assert.throws(() => run([{ operation: 'delete_everything' }]), /operation must be one of/)
  assert.throws(() => run([{ operation: 'create_workflow' }, { operation: 'submit_evidence', evidence: ['customer_file'] }]), /synthetic catalog/)
  assert.throws(() => parseDemoRequest({ program: [] }), /non-empty array/)
  assert.throws(() => parseDemoRequest({ program: new Array(25).fill({ operation: 'create_workflow' }) }), /at most 24 steps/)
})

test('every demo response is metadata only and marked synthetic', () => {
  const result = run([
    { operation: 'create_workflow' },
    { operation: 'submit_evidence', evidence: EVIDENCE },
    { operation: 'evaluate_policy' },
    { operation: 'request_approval' },
    { operation: 'record_approval', decision: 'grant' },
    { operation: 'authorize_action' },
    { operation: 'replay_recover' },
    { operation: 'audit_timeline' },
  ])
  assert.equal(result.synthetic, true)
  assert.ok(result.notice.length > 0)
  assert.deepEqual(findUnboundedStrings(result), [])
  // No response field anywhere carries a content-bearing key name.
  const serialized = JSON.stringify(result)
  for (const forbidden of ['"content"', '"excerpt"', '"passage"', '"rawText"']) {
    assert.ok(!serialized.includes(forbidden), `response exposes a ${forbidden} field`)
  }
})
