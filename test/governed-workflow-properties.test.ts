import assert from 'node:assert/strict'
import test from 'node:test'

import { findUnboundedStrings, sanitizeTimeline } from '../lib/governed-workflow/audit.ts'
import { GwsgDemoError, parseDemoRequest, runDemoProgram } from '../lib/governed-workflow/demo-api.ts'
import { GwsgEngine, MemoryGwsgEventLog, computeTransitionDigest, replayWorkflow, verifyEventChain } from '../lib/governed-workflow/engine.ts'
import { evidenceSetDigest } from '../lib/governed-workflow/evidence.ts'
import {
  GWSG_ACTORS, GWSG_CONFLICTING_CHAIN, GWSG_DEFAULT_CHAIN, GWSG_OPERATIONS, GWSG_ROOT_POLICY,
} from '../lib/governed-workflow/fixtures.ts'
import { resolveGwsgPolicy } from '../lib/governed-workflow/policy.ts'
import { runAllScenarios, runApprovedPath, runDuplicateReplay, runEvidenceChangedAfterApproval } from '../lib/governed-workflow/scenarios.ts'

/**
 * The six properties the governed workflow state graph claims.
 *
 * Each test attacks its property rather than restating it: replay is proved by
 * running twice and comparing digests, the metadata guarantee by trying to
 * smuggle content past the API, and chain integrity by tampering with a record
 * and requiring the verifier to notice.
 */

test('property 1: replay is deterministic across independent runs', () => {
  const first = runAllScenarios()
  const second = runAllScenarios()
  assert.equal(first.length, second.length)
  for (const [index, scenario] of first.entries()) {
    const other = second[index]
    assert.equal(scenario.scenarioId, other.scenarioId)
    assert.equal(scenario.instance.currentState, other.instance.currentState)
    assert.equal(scenario.instance.headSha256, other.instance.headSha256)
    assert.deepEqual(
      scenario.timeline.map((event) => event.transitionSha256),
      other.timeline.map((event) => event.transitionSha256),
      `${scenario.scenarioId} is not deterministic`,
    )
  }
})

test('property 1b: state reconstructed from the event log matches the live instance', () => {
  for (const scenario of runAllScenarios()) {
    const rebuilt = replayWorkflow(scenario.timeline, {
      workflowInstanceId: scenario.instance.workflowInstanceId,
      workflowTemplateId: scenario.instance.workflowTemplateId,
      tenantId: scenario.instance.tenantId,
      createdAt: scenario.instance.createdAt,
    })
    assert.deepEqual(rebuilt, scenario.instance, `${scenario.scenarioId} does not reconstruct from its log`)
  }
})

test('property 2: a replayed transition produces no second event and no second side effect', () => {
  const scenario = runDuplicateReplay()
  assert.equal(scenario.replayWasIdempotent, true)
  // The action was attempted twice. Exactly one authorization exists, and
  // exactly one intent — a second intent would be a second side effect.
  const authorized = scenario.timeline.filter((event) => event.nextState === 'action_authorized')
  assert.equal(authorized.length, 1)
  const intents = scenario.timeline.filter((event) => event.sideEffect.intent !== null)
  assert.equal(intents.length, 1)
})

test('property 2b: a replayed key with changed material inputs is rejected, not silently re-run', () => {
  const engine = new GwsgEngine({ log: new MemoryGwsgEventLog(), clock: () => new Date('2026-08-21T12:00:00.000Z'), exceptionSecret: 's' })
  const id = 'gwsg-instance-material-change'
  engine.createWorkflow({ workflowInstanceId: id, workflowTemplateId: 't', tenantId: 'tenant-synthetic-claims' })
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  const base = {
    workflowInstanceId: id, intendedState: 'evidence_collected' as const, actor: GWSG_ACTORS.intakeAgent,
    idempotencyKey: 'same-key', evidence: [], uncertainties: [],
  }
  const first = engine.applyTransition({ request: { ...base, declaredInput: { amount: 100 } }, resolved })
  assert.equal(first.accepted, true)
  const changed = engine.applyTransition({ request: { ...base, declaredInput: { amount: 999 } }, resolved })
  assert.equal(changed.idempotent, false)
  assert.ok(changed.reasonCodes.includes('replay_material_change_rejected'))
  assert.equal(changed.transition.nextState, 'replay_blocked')
})

test('property 3: no durable event, API response, or view fixture carries source document text', () => {
  // Affirmative bound: every string in every projection must be short enough
  // that it cannot be a sentence of source content. This deliberately does not
  // search for banned words — a keyword list would pass a document that simply
  // avoided them.
  for (const scenario of runAllScenarios()) {
    const durable = findUnboundedStrings(scenario.timeline)
    assert.deepEqual(durable, [], `${scenario.scenarioId} durable events contain an unbounded string`)
    const projected = findUnboundedStrings(sanitizeTimeline(scenario.timeline))
    assert.deepEqual(projected, [], `${scenario.scenarioId} sanitized timeline contains an unbounded string`)
  }
  const response = runDemoProgram(parseDemoRequest({
    program: [
      { operation: 'create_workflow' },
      { operation: 'submit_evidence', evidence: ['claim_form', 'policy_document', 'assessment_note'] },
      { operation: 'evaluate_policy' },
      { operation: 'audit_timeline' },
    ],
  }))
  assert.deepEqual(findUnboundedStrings(response), [])
})

test('property 3b: the demo API refuses a payload that tries to carry document content', () => {
  const withContentField = { program: [{ operation: 'create_workflow', content: 'the claimant states that' }] }
  assert.throws(() => parseDemoRequest(withContentField), (error: unknown) => {
    assert.ok(error instanceof GwsgDemoError)
    assert.equal(error.code, 'payload_not_metadata')
    return true
  })
  const withLongString = { program: [{ operation: 'create_workflow', idempotencyKey: 'x'.repeat(500) }] }
  assert.throws(() => parseDemoRequest(withLongString), /metadata length bound/)
})

test('property 4: changing evidence after approval invalidates the binding', () => {
  const scenario = runEvidenceChangedAfterApproval()
  const authorized = scenario.timeline.filter((event) => event.nextState === 'action_authorized')
  assert.equal(authorized.length, 0, 'a stale approval must not authorize an action')
  const codes = scenario.timeline.flatMap((event) => event.reasonCodes)
  assert.ok(codes.includes('approval_binding_stale'))
  // The approved run and the changed run bind to different evidence digests,
  // which is the mechanism: the approval id is derived from the binding.
  const approved = runApprovedPath()
  const approvedSet = approved.timeline.at(-1)?.evidenceSetSha256
  const changedSet = scenario.timeline.at(-1)?.evidenceSetSha256
  assert.notEqual(approvedSet, changedSet)
})

test('property 4b: an agent cannot record its own approval', () => {
  const engine = new GwsgEngine({ log: new MemoryGwsgEventLog(), clock: () => new Date('2026-08-21T12:00:00.000Z'), exceptionSecret: 's' })
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  const record = engine.requestApproval({
    workflowInstanceId: 'gwsg-instance-selfapprove',
    transitionId: `gwsg-action-${GWSG_OPERATIONS.issueDecisionLetter}`,
    policyVersion: resolved.policyVersion, policySha256: resolved.policySha256,
    inputSha256: 'sha256:'.concat('0'.repeat(64)) as `sha256:${string}`,
    evidenceSetSha256: evidenceSetDigest([]),
  })
  assert.throws(
    () => engine.recordApprovalDecision({ approvalId: record.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.reviewAgent }),
    /Only a human reviewer/,
  )
  const decided = engine.recordApprovalDecision({ approvalId: record.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  assert.equal(decided.state, 'granted')
})

test('property 5: the most restrictive applicable rule wins and a child cannot restore it', () => {
  const permissive = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  assert.ok(permissive.policy.allowedOperations.includes(GWSG_OPERATIONS.issueDecisionLetter))
  // The instance layer removes the operation; the action layer re-lists it.
  const conflicted = resolveGwsgPolicy(GWSG_CONFLICTING_CHAIN)
  assert.ok(
    !conflicted.policy.allowedOperations.includes(GWSG_OPERATIONS.issueDecisionLetter),
    'a lower layer must not restore authority a higher layer removed',
  )
  // Ceilings only ever lower.
  assert.ok(conflicted.policy.maxTimeoutMs <= GWSG_ROOT_POLICY.maxTimeoutMs)
  assert.equal(permissive.scopeChain.join('>'), 'tenant>workflow>instance>action')
  // Payment is forbidden at the root, so no chain can enable it.
  assert.equal(conflicted.policy.payment.mode, 'forbid')
  assert.equal(permissive.policy.payment.mode, 'forbid')
})

test('property 6: the event chain detects removal, edit, and re-digest', () => {
  const scenario = runApprovedPath()
  assert.deepEqual(verifyEventChain(scenario.timeline), { valid: true, brokenAt: null, reason: null })

  const removed = scenario.timeline.filter((_, index) => index !== 1)
  assert.equal(verifyEventChain(removed).valid, false, 'removing an event must break the chain')

  const edited = scenario.timeline.map((event, index) => (index === 2 ? { ...event, nextState: 'closed' as const } : event))
  const editedResult = verifyEventChain(edited)
  assert.equal(editedResult.valid, false)
  assert.equal(editedResult.reason, 'digest_mismatch')

  // Re-digesting the edited record repairs its own hash but orphans the next
  // record's back-link, which is the point of chaining rather than hashing.
  const resealed = edited.map((event, index) => {
    if (index !== 2) return event
    const { transitionSha256, ...body } = event
    void transitionSha256
    return { ...body, transitionSha256: computeTransitionDigest(body) }
  })
  const resealedResult = verifyEventChain(resealed)
  assert.equal(resealedResult.valid, false)
  assert.equal(resealedResult.reason, 'chain_link_mismatch')
})

test('property 6b: the append-only log rejects an out-of-order or unlinked write', () => {
  const log = new MemoryGwsgEventLog()
  const scenario = runApprovedPath()
  log.append(scenario.timeline[0])
  assert.throws(() => log.append(scenario.timeline[0]), /out of order/)
  assert.throws(() => log.append(scenario.timeline[2]), /out of order/)
  assert.throws(() => log.append({ ...scenario.timeline[1], previousTransitionSha256: null }), /chain is broken/)
})

test('the prototype performs no real side effect: every intent and receipt is marked simulated', () => {
  for (const scenario of runAllScenarios()) {
    for (const event of scenario.timeline) {
      if (event.sideEffect.intent) assert.equal(event.sideEffect.intent.simulated, true)
      if (event.sideEffect.receipt) assert.equal(event.sideEffect.receipt.simulated, true)
    }
  }
})
