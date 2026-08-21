import assert from 'node:assert/strict'
import test from 'node:test'

import { GwsgEngine, MemoryGwsgEventLog } from '../lib/governed-workflow/engine.ts'
import { GWSG_TRANSITIONS, canTransition, isHalted, isTerminal } from '../lib/governed-workflow/state-graph.ts'
import { GWSG_HALTED_STATES, GWSG_STATES, type GwsgState } from '../lib/governed-workflow/types.ts'
import {
  GWSG_ACTORS, GWSG_DECLARED_INPUT, GWSG_DEFAULT_CHAIN, GWSG_EVIDENCE,
  GWSG_REQUIRED_EVIDENCE_KINDS, GWSG_UNCERTAINTIES, fixedClock,
} from '../lib/governed-workflow/fixtures.ts'
import { resolveGwsgPolicy } from '../lib/governed-workflow/policy.ts'

/**
 * Escalation must be an escalation, not a dead end.
 *
 * `needs_human_review`, `expired` and `replay_blocked` exist to hand control to
 * a person. If the engine refused every transition out of them, the state graph
 * would declare edges nothing could traverse and a workflow routed to review
 * could never be resolved. These tests hold that door open — and hold the
 * terminal states shut.
 */

const EVIDENCE = [GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]

function engineFor(instanceId: string) {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(), clock: fixedClock(), exceptionSecret: 's',
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  engine.createWorkflow({ workflowInstanceId: instanceId, workflowTemplateId: 't', tenantId: 'tenant-synthetic-claims' })
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  const go = (intendedState: GwsgState, key: string, options: { actor?: typeof GWSG_ACTORS.intakeAgent; uncertainties?: (typeof GWSG_UNCERTAINTIES)[string][] } = {}) =>
    engine.applyTransition({
      request: {
        workflowInstanceId: instanceId, intendedState, actor: options.actor ?? GWSG_ACTORS.intakeAgent,
        idempotencyKey: key, declaredInput: { ...GWSG_DECLARED_INPUT }, evidence: EVIDENCE,
        uncertainties: options.uncertainties ?? [],
      },
      resolved,
    })
  return { engine, go }
}

test('every state that declares an outgoing edge is one the engine can actually leave', () => {
  for (const state of GWSG_STATES) {
    const edges = GWSG_TRANSITIONS[state]
    if (isTerminal(state)) {
      assert.equal(edges.length, 0, `${state} is terminal but declares outgoing edges`)
      continue
    }
    if (edges.length === 0) continue
    // A non-terminal state with declared edges must be traversable by someone.
    // Halted states are traversable only by a human reviewer.
    assert.ok(
      !isHalted(state) || GWSG_HALTED_STATES.includes(state),
      `${state} declares edges but nothing can traverse them`,
    )
  }
})

test('a human reviewer can resolve an escalation; an agent cannot', () => {
  const { go } = engineFor('gwsg-instance-escalation')
  go('evidence_collected', 'a')
  const blocked = go('policy_evaluated', 'b', { uncertainties: [GWSG_UNCERTAINTIES.missingAssessment] })
  assert.equal(blocked.transition.nextState, 'needs_human_review')

  // The agent that caused the escalation cannot clear it.
  const agentAttempt = go('policy_evaluated', 'c')
  assert.equal(agentAttempt.accepted, false)
  assert.ok(agentAttempt.reasonCodes.includes('approval_bypass_attempted'))
  assert.equal(agentAttempt.transition.nextState, 'needs_human_review', 'a refused attempt must not extend the log')

  // A human reviewer can.
  const resolved = go('policy_evaluated', 'd', { actor: GWSG_ACTORS.humanReviewer })
  assert.equal(resolved.accepted, true)
  assert.equal(resolved.transition.nextState, 'policy_evaluated')
  assert.equal(resolved.transition.actor.actorKind, 'human_reviewer')
})

test('a human reviewer can close out an escalated workflow', () => {
  const { go } = engineFor('gwsg-instance-escalation-close')
  go('evidence_collected', 'a')
  go('policy_evaluated', 'b', { uncertainties: [GWSG_UNCERTAINTIES.missingAssessment] })
  const denied = go('denied', 'c', { actor: GWSG_ACTORS.humanReviewer })
  assert.equal(denied.transition.nextState, 'denied')
  // And once denied, the door is shut to everyone including the reviewer.
  const after = go('policy_evaluated', 'd', { actor: GWSG_ACTORS.humanReviewer })
  assert.equal(after.accepted, false)
  assert.ok(after.reasonCodes.includes('terminal_state'))
})

test('a human reviewer still cannot take an illegal edge', () => {
  const { go } = engineFor('gwsg-instance-escalation-illegal')
  go('evidence_collected', 'a')
  go('policy_evaluated', 'b', { uncertainties: [GWSG_UNCERTAINTIES.missingAssessment] })
  assert.equal(canTransition('needs_human_review', 'action_authorized'), false)
  const attempt = go('action_authorized', 'c', { actor: GWSG_ACTORS.humanReviewer })
  assert.ok(!attempt.reasonCodes.includes('allowed'))
  assert.notEqual(attempt.transition.nextState, 'action_authorized')
})

test('idempotency keys are scoped per workflow instance', () => {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(), clock: fixedClock(), exceptionSecret: 's',
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  for (const id of ['wf-alpha', 'wf-beta']) {
    engine.createWorkflow({ workflowInstanceId: id, workflowTemplateId: 't', tenantId: 'tenant-synthetic-claims' })
  }
  const submit = (id: string) => engine.applyTransition({
    request: {
      workflowInstanceId: id, intendedState: 'evidence_collected', actor: GWSG_ACTORS.intakeAgent,
      // The same ordinary key name in two unrelated workflows.
      idempotencyKey: 'intake-1', declaredInput: { ...GWSG_DECLARED_INPUT }, evidence: EVIDENCE, uncertainties: [],
    },
    resolved,
  })
  assert.equal(submit('wf-alpha').accepted, true)
  const beta = submit('wf-beta')
  assert.equal(beta.accepted, true, 'an unrelated workflow must not be blocked by another workflow key')
  assert.equal(beta.transition.nextState, 'evidence_collected')
  // Within one workflow the key still deduplicates.
  const repeat = submit('wf-alpha')
  assert.equal(repeat.idempotent, true)
})
