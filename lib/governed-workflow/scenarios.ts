import { GwsgEngine, MemoryGwsgEventLog, assessRecovery, type RecoveryAssessment } from './engine.ts'
import { evidenceSetDigest, declaredInputDigest } from './evidence.ts'
import {
  GWSG_ACTION_REQUEST_SHA256,
  GWSG_ACTORS,
  GWSG_CONFLICTING_CHAIN,
  GWSG_DECLARED_INPUT,
  GWSG_DEFAULT_CHAIN,
  GWSG_EVIDENCE,
  GWSG_OPERATIONS,
  GWSG_REQUIRED_EVIDENCE_KINDS,
  GWSG_UNCERTAINTIES,
  fixedClock,
} from './fixtures.ts'
import { resolveGwsgPolicy, signPolicyException, type GwsgPolicyChain } from './policy.ts'
import type { ApprovalBinding, EvidenceReference, GwsgTransition, GwsgWorkflowInstance, UncertaintyDeclaration } from './types.ts'

/**
 * The ten scenarios the governed workflow state graph is evaluated against.
 *
 * These are executable rather than described. Each one drives the real engine
 * and returns the real timeline, so the documentation, the operator view and
 * the test suite all read the same source of truth — a scenario that stops
 * behaving as documented fails a test rather than quietly becoming a lie in
 * the docs.
 */

/** Secret for signed exceptions in the synthetic corpus only. */
export const GWSG_SCENARIO_EXCEPTION_SECRET = 'gwsg-synthetic-exception-secret'

export type ScenarioId =
  | 'approved_path'
  | 'policy_denied'
  | 'uncertainty_human_review'
  | 'approval_expiry'
  | 'evidence_changed_after_approval'
  | 'duplicate_replay'
  | 'interrupted_recovery'
  | 'policy_bypass_attempt'
  | 'policy_conflict_precedence'
  | 'metadata_only_audit'

export type ScenarioResult = {
  scenarioId: ScenarioId
  title: string
  /** What a buyer should conclude from this run. */
  demonstrates: string
  instance: GwsgWorkflowInstance
  timeline: GwsgTransition[]
  recovery: RecoveryAssessment
  /** Set where the scenario turns on a second attempt returning the first result. */
  replayWasIdempotent: boolean | null
}

type Harness = {
  engine: GwsgEngine
  instanceId: string
  resolved: ReturnType<typeof resolveGwsgPolicy>
}

function harness(scenarioId: ScenarioId, chain: GwsgPolicyChain = GWSG_DEFAULT_CHAIN, approvalTtlMs?: number): Harness {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(),
    clock: fixedClock(),
    exceptionSecret: GWSG_SCENARIO_EXCEPTION_SECRET,
    approvalTtlMs,
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  const instanceId = `gwsg-instance-${scenarioId}`
  engine.createWorkflow({ workflowInstanceId: instanceId, workflowTemplateId: 'gwsg-template-claims-review', tenantId: 'tenant-synthetic-claims' })
  return { engine, instanceId, resolved: resolveGwsgPolicy(chain) }
}

function baseEvidence(): EvidenceReference[] {
  return [GWSG_EVIDENCE.claimForm, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]
}

function step(
  h: Harness,
  input: {
    intendedState: GwsgTransition['nextState']
    key: string
    evidence?: EvidenceReference[]
    uncertainties?: UncertaintyDeclaration[]
    actor?: GwsgTransition['actor']
    action?: { operation: string; requestSha256: typeof GWSG_ACTION_REQUEST_SHA256 }
    exception?: Parameters<typeof signPolicyException>[0] & { signature: string }
    receipt?: GwsgTransition['sideEffect']['receipt']
    declaredInput?: Record<string, string | number | boolean>
  },
) {
  return h.engine.applyTransition({
    request: {
      workflowInstanceId: h.instanceId,
      intendedState: input.intendedState,
      actor: input.actor ?? GWSG_ACTORS.intakeAgent,
      idempotencyKey: input.key,
      declaredInput: input.declaredInput ?? { ...GWSG_DECLARED_INPUT },
      evidence: input.evidence ?? baseEvidence(),
      uncertainties: input.uncertainties ?? [],
      exception: input.exception,
      action: input.action,
    },
    resolved: h.resolved,
    receipt: input.receipt,
  })
}

function bindingFor(h: Harness, evidence: EvidenceReference[], declaredInput = { ...GWSG_DECLARED_INPUT }): ApprovalBinding {
  return {
    workflowInstanceId: h.instanceId,
    transitionId: `gwsg-action-${GWSG_OPERATIONS.issueDecisionLetter}`,
    policyVersion: h.resolved.policyVersion,
    policySha256: h.resolved.policySha256,
    inputSha256: declaredInputDigest(declaredInput),
    evidenceSetSha256: evidenceSetDigest(evidence),
  }
}

function finish(h: Harness, scenarioId: ScenarioId, title: string, demonstrates: string, replayWasIdempotent: boolean | null = null): ScenarioResult {
  const timeline = h.engine.timeline(h.instanceId)
  return {
    scenarioId,
    title,
    demonstrates,
    instance: h.engine.instance(h.instanceId),
    timeline,
    recovery: assessRecovery(timeline),
    replayWasIdempotent,
  }
}

/** Advances to `approved`, the common prefix of the action scenarios. */
function advanceToApproved(h: Harness, evidence: EvidenceReference[] = baseEvidence()) {
  step(h, { intendedState: 'evidence_collected', key: 'k-evidence', evidence })
  step(h, { intendedState: 'policy_evaluated', key: 'k-policy', evidence })
  step(h, { intendedState: 'approved', key: 'k-approved', evidence })
}

export function runApprovedPath(): ScenarioResult {
  const h = harness('approved_path')
  advanceToApproved(h)
  const approval = h.engine.requestApproval(bindingFor(h, baseEvidence()))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
    receipt: {
      intentId: 'observed',
      receiptId: 'gwsg-receipt-synthetic',
      outcome: 'succeeded',
      responseSha256: null,
      observedAt: '2026-08-21T12:00:10.000Z',
      simulated: true,
    },
  })
  step(h, { intendedState: 'action_completed', key: 'k-complete' })
  step(h, { intendedState: 'closed', key: 'k-close' })
  return finish(h, 'approved_path', 'Normal approved path', 'A complete run: evidence, policy, human approval bound to that exact evidence set, one authorized action, close.')
}

export function runPolicyDenied(): ScenarioResult {
  // The conflicting chain removes `issue_decision_letter` at the instance
  // layer. Denial here is the policy working, not an error.
  const h = harness('policy_denied', GWSG_CONFLICTING_CHAIN)
  advanceToApproved(h)
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
  })
  return finish(h, 'policy_denied', 'Denied policy path', 'An operation removed by a policy layer is denied with a machine-readable reason code, and no action is authorized.')
}

export function runUncertaintyHumanReview(): ScenarioResult {
  const h = harness('uncertainty_human_review')
  step(h, { intendedState: 'evidence_collected', key: 'k-evidence' })
  step(h, { intendedState: 'policy_evaluated', key: 'k-policy', uncertainties: [GWSG_UNCERTAINTIES.missingAssessment] })
  return finish(h, 'uncertainty_human_review', 'Uncertainty requiring human review', 'A blocking uncertainty routes to human review instead of being resolved by the agent in its own favour.')
}

export function runApprovalExpiry(): ScenarioResult {
  // The TTL is long enough for the reviewer to grant, short enough that the
  // fixed clock has passed it by the authorization step.
  const h = harness('approval_expiry', GWSG_DEFAULT_CHAIN, 1_500)
  advanceToApproved(h)
  const approval = h.engine.requestApproval(bindingFor(h, baseEvidence()))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
  })
  return finish(h, 'approval_expiry', 'Approval expiry', 'A granted approval that has aged past its window cannot authorize an action; the workflow moves to expired.')
}

export function runEvidenceChangedAfterApproval(): ScenarioResult {
  const h = harness('evidence_changed_after_approval')
  const original = baseEvidence()
  advanceToApproved(h, original)
  const approval = h.engine.requestApproval(bindingFor(h, original))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  // The claim form is revised after the approval was granted. The binding is
  // content-addressed, so the granted approval no longer applies.
  const revised = [GWSG_EVIDENCE.claimFormRevised, GWSG_EVIDENCE.policyDocument, GWSG_EVIDENCE.assessorNote]
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    evidence: revised,
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
  })
  return finish(h, 'evidence_changed_after_approval', 'Changed evidence after approval', 'Revising evidence after approval invalidates the binding; the granted approval does not carry over to the new evidence set.')
}

export function runDuplicateReplay(): ScenarioResult {
  const h = harness('duplicate_replay')
  advanceToApproved(h)
  const approval = h.engine.requestApproval(bindingFor(h, baseEvidence()))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  const action = { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 }
  const first = step(h, { intendedState: 'action_authorized', key: 'k-authorize', action })
  const second = step(h, { intendedState: 'action_authorized', key: 'k-authorize', action })
  const idempotent = second.idempotent && second.transition.transitionId === first.transition.transitionId
  return finish(h, 'duplicate_replay', 'Duplicate or replayed action', 'Repeating a transition with the same idempotency key returns the original record. No second event is appended and no second intent is produced.', idempotent)
}

export function runInterruptedRecovery(): ScenarioResult {
  const h = harness('interrupted_recovery')
  advanceToApproved(h)
  const approval = h.engine.requestApproval(bindingFor(h, baseEvidence()))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: GWSG_ACTORS.humanReviewer })
  // Authorized, then interrupted: an intent exists with no receipt. Whether
  // the effect landed is unknowable from the log, which is the point.
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
  })
  return finish(h, 'interrupted_recovery', 'Interrupted execution and recovery', 'An authorized action with no receipt is classified indeterminate and routed to a human rather than retried.')
}

export function runPolicyBypassAttempt(): ScenarioResult {
  const h = harness('policy_bypass_attempt', GWSG_CONFLICTING_CHAIN)
  advanceToApproved(h)
  // An exception signed with the wrong secret — the shape of a forged
  // authorization. It must not widen the resolved policy.
  const forged = signPolicyException(
    {
      exceptionId: 'exc-forged',
      issuedBy: GWSG_ACTORS.reviewAgent,
      workflowInstanceId: h.instanceId,
      transitionId: `gwsg-action-${GWSG_OPERATIONS.issueDecisionLetter}`,
      relaxes: { operation: GWSG_OPERATIONS.issueDecisionLetter },
      expiresAt: '2026-08-21T13:00:00.000Z',
    },
    'not-the-real-secret',
  )
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
    exception: forged,
  })
  return finish(h, 'policy_bypass_attempt', 'Attempted policy bypass', 'An exception object that is not correctly signed does not widen the policy; the transition is denied with exception_invalid.')
}

export function runPolicyConflictPrecedence(): ScenarioResult {
  const h = harness('policy_conflict_precedence', GWSG_CONFLICTING_CHAIN)
  advanceToApproved(h)
  // The action layer re-lists the operation the instance layer removed.
  // Inheritance filters rather than unions, so it stays removed.
  step(h, {
    intendedState: 'action_authorized',
    key: 'k-authorize',
    action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
  })
  return finish(h, 'policy_conflict_precedence', 'Tenant, template and instance policy conflict', 'A lower layer cannot restore authority a higher layer removed. The most restrictive applicable rule wins.')
}

export function runMetadataOnlyAudit(): ScenarioResult {
  const h = harness('metadata_only_audit')
  // Labels carry the maximum metadata the model permits, so the audit
  // guarantee is exercised at its boundary rather than on an empty record.
  const labelled = [
    { ...GWSG_EVIDENCE.claimForm, labels: { corpus: 'synthetic', section: 'intake', classification: 'restricted', retention: 'reference-only' } },
    GWSG_EVIDENCE.policyDocument,
    GWSG_EVIDENCE.assessorNote,
  ]
  step(h, { intendedState: 'evidence_collected', key: 'k-evidence', evidence: labelled })
  step(h, { intendedState: 'policy_evaluated', key: 'k-policy', evidence: labelled, uncertainties: [GWSG_UNCERTAINTIES.minorAmbiguity] })
  return finish(h, 'metadata_only_audit', 'Metadata-only audit guarantee', 'A fully populated timeline contains references, digests, bounded classifications and caller labels — and no source document text.')
}

export const GWSG_SCENARIO_RUNNERS: Record<ScenarioId, () => ScenarioResult> = {
  approved_path: runApprovedPath,
  policy_denied: runPolicyDenied,
  uncertainty_human_review: runUncertaintyHumanReview,
  approval_expiry: runApprovalExpiry,
  evidence_changed_after_approval: runEvidenceChangedAfterApproval,
  duplicate_replay: runDuplicateReplay,
  interrupted_recovery: runInterruptedRecovery,
  policy_bypass_attempt: runPolicyBypassAttempt,
  policy_conflict_precedence: runPolicyConflictPrecedence,
  metadata_only_audit: runMetadataOnlyAudit,
}

export const GWSG_SCENARIO_IDS = Object.keys(GWSG_SCENARIO_RUNNERS) as ScenarioId[]

export function runAllScenarios(): ScenarioResult[] {
  return GWSG_SCENARIO_IDS.map((id) => GWSG_SCENARIO_RUNNERS[id]())
}
