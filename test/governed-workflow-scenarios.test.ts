import assert from 'node:assert/strict'
import test from 'node:test'

import { GWSG_SCENARIO_IDS, GWSG_SCENARIO_RUNNERS, runAllScenarios, type ScenarioId } from '../lib/governed-workflow/scenarios.ts'
import { GWSG_TRANSITIONS } from '../lib/governed-workflow/state-graph.ts'

/**
 * Scenario corpus coverage.
 *
 * These assert the documented outcome of each scenario. A scenario whose
 * behaviour drifts fails here rather than quietly turning the product
 * documentation into a false claim.
 */

const EXPECTED: Record<ScenarioId, { finalState: string; recovery: string; mustInclude: string[] }> = {
  approved_path: { finalState: 'closed', recovery: 'not_applicable', mustInclude: ['allowed'] },
  policy_denied: { finalState: 'denied', recovery: 'not_applicable', mustInclude: ['policy_denied'] },
  uncertainty_human_review: { finalState: 'needs_human_review', recovery: 'requires_human_review', mustInclude: ['uncertainty_blocks_decision'] },
  approval_expiry: { finalState: 'expired', recovery: 'requires_human_review', mustInclude: ['approval_expired'] },
  evidence_changed_after_approval: { finalState: 'needs_human_review', recovery: 'requires_human_review', mustInclude: ['approval_binding_stale'] },
  duplicate_replay: { finalState: 'action_authorized', recovery: 'indeterminate_side_effect', mustInclude: ['allowed'] },
  interrupted_recovery: { finalState: 'action_authorized', recovery: 'indeterminate_side_effect', mustInclude: ['allowed'] },
  policy_bypass_attempt: { finalState: 'denied', recovery: 'not_applicable', mustInclude: ['exception_invalid'] },
  policy_conflict_precedence: { finalState: 'denied', recovery: 'not_applicable', mustInclude: ['policy_denied'] },
  metadata_only_audit: { finalState: 'policy_evaluated', recovery: 'not_applicable', mustInclude: ['allowed'] },
}

test('the corpus covers all ten required scenarios', () => {
  assert.equal(GWSG_SCENARIO_IDS.length, 10)
  assert.deepEqual([...GWSG_SCENARIO_IDS].sort(), Object.keys(EXPECTED).sort())
})

for (const scenarioId of GWSG_SCENARIO_IDS) {
  test(`scenario ${scenarioId} reaches its documented outcome`, () => {
    const expected = EXPECTED[scenarioId]
    const result = GWSG_SCENARIO_RUNNERS[scenarioId]()
    assert.equal(result.instance.currentState, expected.finalState)
    assert.equal(result.recovery.classification, expected.recovery)
    const codes = result.timeline.flatMap((event) => event.reasonCodes)
    for (const code of expected.mustInclude) assert.ok(codes.includes(code as never), `${scenarioId} should record ${code}, got ${codes.join(',')}`)
  })
}

test('every recorded transition is a legal edge of the reference state graph', () => {
  for (const scenario of runAllScenarios()) {
    for (const event of scenario.timeline) {
      assert.ok(
        GWSG_TRANSITIONS[event.priorState].includes(event.nextState),
        `${scenario.scenarioId} recorded an illegal edge ${event.priorState} -> ${event.nextState}`,
      )
    }
  }
})

test('every denied or failed transition carries a machine-readable reason code', () => {
  for (const scenario of runAllScenarios()) {
    for (const event of scenario.timeline) {
      if (event.authorizationResult === 'denied' || event.nextState === 'denied' || event.nextState.startsWith('failed')) {
        assert.ok(event.reasonCodes.length > 0, `${scenario.scenarioId}#${event.sequence} has no reason code`)
        assert.ok(
          event.reasonCodes.some((code) => code !== 'allowed'),
          `${scenario.scenarioId}#${event.sequence} was denied but recorded only 'allowed'`,
        )
      }
    }
  }
})

test('every transition records the full required audit tuple', () => {
  for (const scenario of runAllScenarios()) {
    for (const event of scenario.timeline) {
      assert.match(event.transitionId, /^gwsg-transition-[0-9a-f]{32}$/)
      assert.match(event.policySha256, /^sha256:[0-9a-f]{64}$/)
      assert.match(event.inputSha256, /^sha256:[0-9a-f]{64}$/)
      assert.match(event.evidenceSetSha256, /^sha256:[0-9a-f]{64}$/)
      assert.ok(event.policyVersion.length > 0)
      assert.ok(event.idempotencyKey.length > 0)
      assert.ok(event.occurredAt.endsWith('Z'))
      assert.ok(['agent', 'human_reviewer', 'system'].includes(event.actor.actorKind))
      assert.ok(['none', 'declared_non_blocking', 'declared_blocking', 'unresolved'].includes(event.uncertaintyStatus))
      assert.ok(['allowed', 'denied', 'not_evaluated'].includes(event.authorizationResult))
      assert.ok(['not_required', 'pending', 'granted', 'denied', 'expired', 'bypassed'].includes(event.approvalState))
      assert.ok(event.recoveryClassification.length > 0)
    }
  }
})
