import assert from 'node:assert/strict'
import test from 'node:test'

import { findUnboundedStrings } from '../lib/governed-workflow/audit.ts'
import { GWSG_TRANSITIONS } from '../lib/governed-workflow/state-graph.ts'
import {
  CLAIMS_EXCEPTION_ACTORS, CLAIMS_EXCEPTION_BRANCH_CHAIN, CLAIMS_EXCEPTION_CHAIN,
  CLAIMS_EXCEPTION_INPUT, CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS, CLAIMS_EXCEPTION_REQUIRED_EVIDENCE,
  CLAIMS_EXCEPTION_SCENARIO_IDS, assertNoProhibitedInput, claimsExceptionEvidenceReport,
  runClaimsExceptionEvaluation, type ClaimsScenarioId,
} from '../lib/governed-workflow/evaluations/claims-exception.ts'
import { resolveGwsgPolicy } from '../lib/governed-workflow/policy.ts'

/**
 * The claims-exception evaluation package.
 *
 * These assert the outcomes the package promises a customer. A scenario that
 * drifts fails here rather than quietly turning the evaluation document into a
 * claim nobody checked.
 */

const EXPECTED: Record<ClaimsScenarioId, { finalState: string; recovery: string; reason: string | null }> = {
  exception_approved: { finalState: 'closed', recovery: 'not_applicable', reason: null },
  assessment_revised_after_approval: { finalState: 'needs_human_review', recovery: 'requires_human_review', reason: 'approval_binding_stale' },
  adjudicator_approval_expired: { finalState: 'expired', recovery: 'requires_human_review', reason: 'approval_expired' },
  interrupted_after_authorisation: { finalState: 'action_authorized', recovery: 'indeterminate_side_effect', reason: null },
  branch_office_lacks_authority: { finalState: 'denied', recovery: 'not_applicable', reason: 'policy_denied' },
  contested_evidence_needs_adjudicator: { finalState: 'needs_human_review', recovery: 'requires_human_review', reason: 'uncertainty_blocks_decision' },
}

test('the package covers a normal path and at least two adverse or recovery paths', () => {
  assert.equal(CLAIMS_EXCEPTION_SCENARIO_IDS.length, 6)
  const adverse = CLAIMS_EXCEPTION_SCENARIO_IDS.filter((id) => id !== 'exception_approved')
  assert.ok(adverse.length >= 2, 'at least two adverse or recovery scenarios are required')
})

for (const scenarioId of CLAIMS_EXCEPTION_SCENARIO_IDS) {
  test(`scenario ${scenarioId} reaches its documented outcome`, () => {
    const expected = EXPECTED[scenarioId]
    const result = runClaimsExceptionEvaluation().find((entry) => entry.scenarioId === scenarioId)!
    assert.equal(result.finalState, expected.finalState)
    assert.equal(result.recovery.classification, expected.recovery)
    assert.equal(result.chainIntegrity.valid, true)
    if (expected.reason) {
      assert.ok(result.timeline.flatMap((event) => event.reasonCodes).includes(expected.reason as never),
        `${scenarioId} should record ${expected.reason}`)
    }
  })
}

test('only the adjudicator ever approves, and only a human closes an escalation', () => {
  for (const scenario of runClaimsExceptionEvaluation()) {
    for (const event of scenario.timeline) {
      if (event.approvalState === 'granted') {
        // The approval that authorised the action must trace to a human.
        assert.ok(scenario.timeline.some((entry) => entry.actor.actorKind === 'human_reviewer'),
          `${scenario.scenarioId} authorised on a granted approval with no human in the timeline`)
      }
      if (event.priorState === 'needs_human_review' && event.nextState !== 'needs_human_review') {
        assert.equal(event.actor.actorKind, 'human_reviewer')
      }
    }
  }
})

test('an approval never authorises a letter against a changed evidence set', () => {
  const revised = runClaimsExceptionEvaluation().find((s) => s.scenarioId === 'assessment_revised_after_approval')!
  assert.equal(revised.timeline.some((event) => event.nextState === 'action_authorized'), false)
})

test('an interrupted run raises no second letter', () => {
  const interrupted = runClaimsExceptionEvaluation().find((s) => s.scenarioId === 'interrupted_after_authorisation')!
  assert.equal(interrupted.timeline.filter((event) => event.nextState === 'action_authorized').length, 1)
  assert.equal(interrupted.timeline.filter((event) => event.sideEffect.intent !== null).length, 1)
})

test('the branch instance cannot restore the authority its parent removed', () => {
  const full = resolveGwsgPolicy(CLAIMS_EXCEPTION_CHAIN)
  const branch = resolveGwsgPolicy(CLAIMS_EXCEPTION_BRANCH_CHAIN)
  assert.ok(full.policy.allowedOperations.includes('workflow.issue_decision_letter'))
  assert.ok(!branch.policy.allowedOperations.includes('workflow.issue_decision_letter'))
  assert.equal(full.scopeChain.join('>'), 'tenant>workflow>instance>action')
})

test('the evaluation is not connected to payment', () => {
  for (const chain of [CLAIMS_EXCEPTION_CHAIN, CLAIMS_EXCEPTION_BRANCH_CHAIN]) {
    const resolved = resolveGwsgPolicy(chain)
    assert.equal(resolved.policy.payment.mode, 'forbid')
    for (const operation of resolved.policy.allowedOperations) {
      assert.ok(!/pay|settle|disburse|transfer|remit/i.test(operation), `${operation} must not be a payment operation`)
    }
  }
})

test('prohibited personal and payment fields are refused, not merely absent', () => {
  // Absence proves nothing on its own; the guard has to reject one.
  for (const field of ['claimantName', 'dateOfBirth', 'iban', 'diagnosis', 'policyNumber']) {
    assert.throws(() => assertNoProhibitedInput({ ...CLAIMS_EXCEPTION_INPUT, [field]: 'x' }), new RegExp(field))
  }
  assert.doesNotThrow(() => assertNoProhibitedInput({ ...CLAIMS_EXCEPTION_INPUT }))
  // And the declared input carries none of them.
  const declared = Object.keys(CLAIMS_EXCEPTION_INPUT).map((k) => k.toLowerCase())
  for (const banned of CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS) {
    assert.ok(!declared.includes(banned.toLowerCase()), `${banned} must not be a declared input`)
  }
})

test('the evidence report is metadata only', () => {
  const report = claimsExceptionEvidenceReport()
  assert.deepEqual(findUnboundedStrings(report.scenarios), [], 'no transition may carry an unbounded string')
  assert.deepEqual(report.evidence.requiredKinds, [...CLAIMS_EXCEPTION_REQUIRED_EVIDENCE])
  // Digests, not documents.
  for (const reference of report.evidence.references) {
    assert.match(reference.contentSha256, /^sha256:[0-9a-f]{64}$/)
    assert.ok(!('text' in reference) && !('content' in reference))
  }
  assert.equal(report.evaluation.synthetic, true)
  assert.equal(report.authority.paymentMode, 'forbid')
})

test('every recorded transition is a legal edge, and the report is deterministic', () => {
  const first = claimsExceptionEvidenceReport()
  const second = claimsExceptionEvidenceReport()
  assert.deepEqual(first, second, 'the evaluation report must be reproducible')
  for (const scenario of runClaimsExceptionEvaluation()) {
    for (const event of scenario.timeline) {
      assert.ok(GWSG_TRANSITIONS[event.priorState].includes(event.nextState),
        `${scenario.scenarioId} recorded an illegal edge ${event.priorState} -> ${event.nextState}`)
    }
  }
})

test('a prior decision is required, which the base template does not require', () => {
  assert.ok(CLAIMS_EXCEPTION_REQUIRED_EVIDENCE.includes('prior_decision'))
  assert.equal(CLAIMS_EXCEPTION_REQUIRED_EVIDENCE.length, 4)
  // The adjudicator is the only human role in the model, and is a digest.
  assert.equal(CLAIMS_EXCEPTION_ACTORS.adjudicator.actorKind, 'human_reviewer')
  assert.match(CLAIMS_EXCEPTION_ACTORS.adjudicator.actorIdSha256, /^sha256:[0-9a-f]{64}$/)
})
