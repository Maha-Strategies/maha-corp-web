import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { GwsgEngine, MemoryGwsgEventLog } from '../lib/governed-workflow/engine.ts'
import {
  GWSG_ACTORS, GWSG_CONFLICTING_CHAIN, GWSG_DECLARED_INPUT, GWSG_EVIDENCE,
  GWSG_OPERATIONS, GWSG_REQUIRED_EVIDENCE_KINDS, fixedClock,
} from '../lib/governed-workflow/fixtures.ts'
import { resolveGwsgPolicy, signPolicyException, verifyPolicyException } from '../lib/governed-workflow/policy.ts'
import { GWSG_STATES } from '../lib/governed-workflow/types.ts'
import { GWSG_SAFE_CHECKPOINTS, GWSG_TRANSITIONS } from '../lib/governed-workflow/state-graph.ts'

/**
 * The signed-exception mechanism, in both directions.
 *
 * The bypass scenario proves a forged exception is refused — but that test
 * would also pass if exceptions never worked at all. This positive control is
 * what makes the negative result meaningful.
 */

const SECRET = 'gwsg-test-exception-secret'
const INSTANCE = 'gwsg-instance-exception'
const TRANSITION_ID = `gwsg-action-${GWSG_OPERATIONS.issueDecisionLetter}`

function harness() {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(), clock: fixedClock(), exceptionSecret: SECRET,
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  engine.createWorkflow({ workflowInstanceId: INSTANCE, workflowTemplateId: 't', tenantId: 'tenant-synthetic-claims' })
  const resolved = resolveGwsgPolicy(GWSG_CONFLICTING_CHAIN)
  const evidence = [GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]
  const go = (intendedState: (typeof GWSG_STATES)[number], key: string, exception?: ReturnType<typeof signPolicyException>) =>
    engine.applyTransition({
      request: {
        workflowInstanceId: INSTANCE, intendedState, actor: GWSG_ACTORS.intakeAgent, idempotencyKey: key,
        declaredInput: { ...GWSG_DECLARED_INPUT }, evidence, uncertainties: [], exception,
        action: intendedState === 'action_authorized' ? { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_EVIDENCE.claimForm.contentSha256 } : undefined,
      },
      resolved,
    })
  go('evidence_collected', 'a'); go('policy_evaluated', 'b'); go('approved', 'c')
  return { engine, go }
}

function exceptionFor(overrides: Partial<Parameters<typeof signPolicyException>[0]> = {}, secret = SECRET) {
  return signPolicyException({
    exceptionId: 'exc-valid',
    issuedBy: GWSG_ACTORS.humanReviewer,
    workflowInstanceId: INSTANCE,
    transitionId: TRANSITION_ID,
    relaxes: { operation: GWSG_OPERATIONS.issueDecisionLetter },
    expiresAt: '2026-08-21T13:00:00.000Z',
    ...overrides,
  }, secret)
}

test('positive control: a correctly signed exception does relax a denied operation', () => {
  const { go } = harness()
  const result = go('action_authorized', 'd', exceptionFor())
  assert.equal(result.transition.nextState, 'action_authorized', 'a valid exception must authorize the action')
  assert.equal(result.transition.authorizationResult, 'allowed')
  assert.ok(result.transition.reasonCodes.includes('allowed'))
})

test('an exception is refused when the signature, target, or window is wrong', () => {
  const now = new Date('2026-08-21T12:00:00.000Z')
  const base = { secret: SECRET, workflowInstanceId: INSTANCE, transitionId: TRANSITION_ID, operation: GWSG_OPERATIONS.issueDecisionLetter, now }
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor() }).valid, true)
  // Wrong signing key.
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor({}, 'wrong-secret') }).valid, false)
  // Addressed to a different workflow.
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor({ workflowInstanceId: 'gwsg-instance-other' }) }).valid, false)
  // Addressed to a different transition.
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor({ transitionId: 'gwsg-action-other' }) }).valid, false)
  // Relaxes a different operation.
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor({ relaxes: { operation: 'workflow.something_else' } }) }).valid, false)
  // Already expired.
  assert.equal(verifyPolicyException({ ...base, exception: exceptionFor({ expiresAt: '2026-08-21T11:00:00.000Z' }) }).valid, false)
  // Body tampered after signing.
  const tampered = { ...exceptionFor(), relaxes: { operation: 'workflow.release_payment' } }
  assert.equal(verifyPolicyException({ ...base, exception: tampered, operation: 'workflow.release_payment' }).valid, false)
})

test('an exception cannot override a blocking uncertainty', () => {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(), clock: fixedClock(), exceptionSecret: SECRET,
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  const id = 'gwsg-instance-exception-uncertain'
  engine.createWorkflow({ workflowInstanceId: id, workflowTemplateId: 't', tenantId: 'tenant-synthetic-claims' })
  const resolved = resolveGwsgPolicy(GWSG_CONFLICTING_CHAIN)
  // An incomplete evidence set: the assessment note is absent.
  const evidence = [GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument]
  const go = (intendedState: (typeof GWSG_STATES)[number], key: string, exception?: ReturnType<typeof signPolicyException>) =>
    engine.applyTransition({
      request: {
        workflowInstanceId: id, intendedState, actor: GWSG_ACTORS.intakeAgent, idempotencyKey: key,
        declaredInput: { ...GWSG_DECLARED_INPUT }, evidence, uncertainties: [], exception,
        action: intendedState === 'action_authorized' ? { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_EVIDENCE.claimForm.contentSha256 } : undefined,
      },
      resolved,
    })
  go('evidence_collected', 'a')
  const evaluated = go('policy_evaluated', 'b')
  // Incomplete evidence is detected without anyone declaring it.
  assert.equal(evaluated.transition.uncertaintyStatus, 'unresolved')
  assert.equal(evaluated.transition.nextState, 'needs_human_review')
  assert.ok(evaluated.transition.reasonCodes.includes('uncertainty_unresolved'))
})

test('the published schemas match the state graph the engine enforces', () => {
  const graph = JSON.parse(readFileSync(new URL('../public/schemas/governed-workflow/state-graph-1.0.0.instance.json', import.meta.url), 'utf8'))
  assert.deepEqual(graph.states, [...GWSG_STATES])
  assert.deepEqual(graph.transitions, GWSG_TRANSITIONS)
  assert.deepEqual(graph.safeCheckpoints, [...GWSG_SAFE_CHECKPOINTS])
  const transition = JSON.parse(readFileSync(new URL('../public/schemas/governed-workflow/transition-1.0.0.json', import.meta.url), 'utf8'))
  assert.deepEqual(transition.properties.priorState.enum, [...GWSG_STATES])
  assert.deepEqual(transition.properties.nextState.enum, [...GWSG_STATES])
  // The schema must not permit a property that could carry document content.
  assert.equal(transition.additionalProperties, false)
  const evidenceSchema = JSON.parse(readFileSync(new URL('../public/schemas/governed-workflow/evidence-reference-1.0.0.json', import.meta.url), 'utf8'))
  assert.equal(evidenceSchema.additionalProperties, false)
  // The three trust-boundary fields are pinned to false in the schema itself,
  // so a conforming record cannot assert truth, authorship, or execution.
  assert.equal(evidenceSchema.properties.provenance.properties.sourceAuthenticityVerified.const, false)
  assert.equal(evidenceSchema.properties.provenance.properties.factualTruthEstablished.const, false)
  assert.equal(evidenceSchema.properties.provenance.properties.providerExecutionVerified.const, false)
})
