import { createHash } from 'node:crypto'

import { GOVERNANCE_SCHEMA_VERSION, type GovernancePolicy } from '../../governance/envelope.ts'
import type { GovernancePolicyLayer } from '../../governance/policy-inheritance.ts'
import { assessRecovery, GwsgEngine, MemoryGwsgEventLog, verifyEventChain } from '../engine.ts'
import { declaredInputDigest, describeProvenance, evidenceSetDigest } from '../evidence.ts'
import { resolveGwsgPolicy, type GwsgPolicyChain } from '../policy.ts'
import { sanitizeTimeline } from '../audit.ts'
import type {
  ActorIdentity, ApprovalBinding, EvidenceReference, GwsgState, GwsgTransition, UncertaintyDeclaration,
} from '../types.ts'

/**
 * A customer-shaped evaluation: one claims exception approval.
 *
 * This is configuration over the Governed Workflow State Graph, not an
 * extension of it. Nothing here adds a state, a reason code, a policy rule or
 * an engine capability — it declares one insurer's decision, its evidence
 * requirements and its authority model, and runs the existing engine against
 * them. If this file needed a new platform feature to express a real claims
 * decision, that would be a finding about the platform, and it did not.
 *
 * Everything is synthetic. The corpus models the *shape* of a claims exception,
 * never a claim: there is no claimant, no policy number, no monetary
 * instruction, and no document text anywhere in this file.
 */

export const CLAIMS_EXCEPTION_EVALUATION_VERSION = '2026-08-22'
export const CLAIMS_EXCEPTION_TEMPLATE_ID = 'claims-exception-review'
export const CLAIMS_EXCEPTION_TENANT_ID = 'tenant-synthetic-insurer'

function syntheticDigest(label: string) {
  return `sha256:${createHash('sha256').update(`claims-exception:${label}`, 'utf8').digest('hex')}` as `sha256:${string}`
}

/**
 * The decision under evaluation.
 *
 * An exception is the right unit: a standard claim is a rules engine's job, and
 * nobody needs an approval graph to record one. An exception is where a human
 * must take responsibility, where the evidence set is contested, and where an
 * auditor later asks who allowed it — which is the question this model answers.
 */
export const CLAIMS_EXCEPTION_DECISION = {
  decisionId: 'claims.exception.approve_or_deny',
  statement: 'Approve or deny an out-of-rule claims exception, and authorise the decision letter that follows from it.',
  authorisedAction: 'workflow.issue_decision_letter',
  /** The action the workflow may authorise. It prepares; it never sends. */
  actionIsSimulated: true,
} as const

/**
 * Evidence the adjudicator must have before an automated decision is possible.
 *
 * `prior_decision` is required here and is not in the base template. An
 * exception is by definition a departure from a previous position, so deciding
 * one without the position being departed from is the specific failure this
 * requirement exists to prevent.
 */
export const CLAIMS_EXCEPTION_REQUIRED_EVIDENCE = [
  'claim_form', 'policy_document', 'assessment_note', 'prior_decision',
] as const

/**
 * Declared inputs. Bounded scalars only.
 *
 * Every field is a code, a flag or an integer. There is no field for a name, a
 * date of birth, an address, a diagnosis, or an adjuster's narrative, because
 * a field that could hold one would eventually hold one.
 */
export type ClaimsExceptionInput = {
  claimReference: string
  coverageCategory: 'category-a' | 'category-b' | 'category-c'
  exceptionGroundsCode: 'late_notification' | 'out_of_network' | 'policy_lapse_grace' | 'documentation_shortfall'
  requestedAmountMinor: number
  priorDecisionWasDenial: boolean
  submittedComplete: boolean
}

/** Field names that would carry a person or a payment instruction. */
export const CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS = [
  'claimantName', 'name', 'dateOfBirth', 'dob', 'address', 'postcode', 'nationalId', 'ssn',
  'policyNumber', 'memberId', 'diagnosis', 'treatment', 'adjusterNotes', 'narrative',
  'iban', 'accountNumber', 'sortCode', 'cardNumber', 'payee', 'paymentInstruction',
] as const

export function assertNoProhibitedInput(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    const lowered = key.toLowerCase()
    if (CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS.some((banned) => lowered === banned.toLowerCase())) {
      throw new Error(`${key} is prohibited in a claims-exception workflow input; declare a bounded code instead.`)
    }
  }
}

export const CLAIMS_EXCEPTION_INPUT: ClaimsExceptionInput = {
  claimReference: 'SYNTH-EXC-0042',
  coverageCategory: 'category-b',
  exceptionGroundsCode: 'late_notification',
  requestedAmountMinor: 480_000,
  priorDecisionWasDenial: true,
  submittedComplete: true,
}

export const CLAIMS_EXCEPTION_ACTORS: Record<string, ActorIdentity> = {
  intakeAgent: { actorKind: 'agent', actorIdSha256: syntheticDigest('actor:intake'), actorRole: 'claims-intake-agent' },
  assessmentAgent: { actorKind: 'agent', actorIdSha256: syntheticDigest('actor:assessment'), actorRole: 'claims-assessment-agent' },
  adjudicator: { actorKind: 'human_reviewer', actorIdSha256: syntheticDigest('actor:adjudicator'), actorRole: 'claims-exception-adjudicator' },
  runner: { actorKind: 'system', actorIdSha256: syntheticDigest('actor:runner'), actorRole: 'workflow-runner' },
}

function evidence(id: string, kind: EvidenceReference['kind'], revision = 'r1', bytes = 24_576): EvidenceReference {
  return {
    evidenceId: id, kind,
    contentSha256: syntheticDigest(`evidence:${id}:${revision}`),
    contentBytes: bytes,
    provenance: describeProvenance({ trustedPassThrough: ['contentSha256', 'contentBytes'] }),
    labels: { corpus: 'synthetic', vertical: 'claims-exception' },
  }
}

export const CLAIMS_EXCEPTION_EVIDENCE = {
  claimForm: evidence('ev-claim-form', 'claim_form'),
  policyDocument: evidence('ev-policy-schedule', 'policy_document'),
  assessmentNote: evidence('ev-assessment-note', 'assessment_note'),
  priorDecision: evidence('ev-prior-decision', 'prior_decision'),
  /** Same slot, later revision: the adverse path where evidence moves. */
  assessmentNoteRevised: evidence('ev-assessment-note', 'assessment_note', 'r2'),
} as const

export const CLAIMS_EXCEPTION_UNCERTAINTIES: Record<string, UncertaintyDeclaration> = {
  contestedAssessment: {
    uncertaintyId: 'unc-contested-assessment',
    kind: 'conflicting_evidence',
    blocksAutomatedDecision: true,
    note: 'Assessment note and prior decision reach opposite conclusions on the same ground.',
  },
}

const OPERATIONS = {
  collect: 'transition:evidence_collected',
  evaluate: 'transition:policy_evaluated',
  requestApproval: 'transition:approval_pending',
  approve: 'transition:approved',
  deny: 'transition:denied',
  escalate: 'transition:needs_human_review',
  complete: 'transition:action_completed',
  close: 'transition:closed',
  issueDecisionLetter: 'workflow.issue_decision_letter',
} as const

/**
 * Insurer-level policy.
 *
 * Payment is forbidden at the root. An exception approval decides entitlement;
 * disbursing against it is a separate system with separate authority, and the
 * inheritance rules make that impossible for any lower layer to blur.
 */
export const CLAIMS_EXCEPTION_ROOT_POLICY: GovernancePolicy = {
  schemaVersion: GOVERNANCE_SCHEMA_VERSION,
  policyId: 'claims-exception-tenant-root',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  allowedTenantIds: [CLAIMS_EXCEPTION_TENANT_ID],
  allowedAgentIds: [
    CLAIMS_EXCEPTION_ACTORS.intakeAgent.actorIdSha256,
    CLAIMS_EXCEPTION_ACTORS.assessmentAgent.actorIdSha256,
    CLAIMS_EXCEPTION_ACTORS.runner.actorIdSha256,
  ],
  allowedTransports: ['mcp'],
  allowedTargetIds: ['target-synthetic-adjudication-queue'],
  allowedResources: ['resource-synthetic-claim-exception'],
  allowedOperations: Object.values(OPERATIONS),
  allowedCapabilities: ['workflow.review'],
  maxInputBytes: 262_144,
  maxHops: 4,
  maxTimeoutMs: 30_000,
  // The decision letter always needs a human. That is the whole control.
  review: { operations: [OPERATIONS.issueDecisionLetter], capabilities: [] },
  payment: { mode: 'forbid', allowedBuyerPolicyIds: [] },
}

export const CLAIMS_EXCEPTION_TEMPLATE_LAYER: GovernancePolicyLayer = {
  policyId: 'claims-exception-template',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  parentPolicyId: CLAIMS_EXCEPTION_ROOT_POLICY.policyId,
  scope: 'workflow',
  constraints: { allowedOperations: Object.values(OPERATIONS), maxTimeoutMs: 20_000 },
}

export const CLAIMS_EXCEPTION_INSTANCE_LAYER: GovernancePolicyLayer = {
  policyId: 'claims-exception-instance',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  parentPolicyId: CLAIMS_EXCEPTION_TEMPLATE_LAYER.policyId,
  scope: 'instance',
  constraints: { maxTimeoutMs: 15_000 },
}

export const CLAIMS_EXCEPTION_ACTION_LAYER: GovernancePolicyLayer = {
  policyId: 'claims-exception-action',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  parentPolicyId: CLAIMS_EXCEPTION_INSTANCE_LAYER.policyId,
  scope: 'action',
  constraints: {},
}

export const CLAIMS_EXCEPTION_CHAIN: GwsgPolicyChain = {
  root: CLAIMS_EXCEPTION_ROOT_POLICY,
  layers: [CLAIMS_EXCEPTION_TEMPLATE_LAYER, CLAIMS_EXCEPTION_INSTANCE_LAYER, CLAIMS_EXCEPTION_ACTION_LAYER],
}

/**
 * A branch office that may prepare an exception but never issue the letter.
 *
 * Used by the authority scenario. The operation is removed at the instance
 * layer, and the action layer below tries to put it back — which inheritance
 * does not permit.
 */
export const CLAIMS_EXCEPTION_BRANCH_INSTANCE_LAYER: GovernancePolicyLayer = {
  policyId: 'claims-exception-instance-branch',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  parentPolicyId: CLAIMS_EXCEPTION_TEMPLATE_LAYER.policyId,
  scope: 'instance',
  constraints: {
    allowedOperations: Object.values(OPERATIONS).filter((operation) => operation !== OPERATIONS.issueDecisionLetter),
  },
}

export const CLAIMS_EXCEPTION_BRANCH_ACTION_LAYER: GovernancePolicyLayer = {
  policyId: 'claims-exception-action-branch',
  policyVersion: CLAIMS_EXCEPTION_EVALUATION_VERSION,
  parentPolicyId: CLAIMS_EXCEPTION_BRANCH_INSTANCE_LAYER.policyId,
  scope: 'action',
  constraints: { allowedOperations: Object.values(OPERATIONS) },
}

export const CLAIMS_EXCEPTION_BRANCH_CHAIN: GwsgPolicyChain = {
  root: CLAIMS_EXCEPTION_ROOT_POLICY,
  layers: [CLAIMS_EXCEPTION_TEMPLATE_LAYER, CLAIMS_EXCEPTION_BRANCH_INSTANCE_LAYER, CLAIMS_EXCEPTION_BRANCH_ACTION_LAYER],
}

const EPOCH = new Date('2026-08-22T09:00:00.000Z')

function clock(stepMs = 1_000) {
  let current = EPOCH.getTime()
  return () => { const value = new Date(current); current += stepMs; return value }
}

export type ClaimsScenarioId =
  | 'exception_approved'
  | 'assessment_revised_after_approval'
  | 'adjudicator_approval_expired'
  | 'interrupted_after_authorisation'
  | 'branch_office_lacks_authority'
  | 'contested_evidence_needs_adjudicator'

export type ClaimsScenarioResult = {
  scenarioId: ClaimsScenarioId
  title: string
  /** What an evaluator should conclude, and what they should not. */
  demonstrates: string
  finalState: GwsgState
  timeline: GwsgTransition[]
  recovery: ReturnType<typeof assessRecovery>
  chainIntegrity: ReturnType<typeof verifyEventChain>
}

type Harness = ReturnType<typeof harness>

function harness(scenarioId: ClaimsScenarioId, chain: GwsgPolicyChain = CLAIMS_EXCEPTION_CHAIN, approvalTtlMs?: number) {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(),
    clock: clock(),
    exceptionSecret: 'claims-exception-evaluation-secret',
    approvalTtlMs,
    requiredEvidenceKinds: CLAIMS_EXCEPTION_REQUIRED_EVIDENCE,
  })
  const instanceId = `claims-exception-${scenarioId}`
  engine.createWorkflow({ workflowInstanceId: instanceId, workflowTemplateId: CLAIMS_EXCEPTION_TEMPLATE_ID, tenantId: CLAIMS_EXCEPTION_TENANT_ID })
  return { engine, instanceId, resolved: resolveGwsgPolicy(chain) }
}

function fullEvidence(): EvidenceReference[] {
  return [
    CLAIMS_EXCEPTION_EVIDENCE.claimForm,
    CLAIMS_EXCEPTION_EVIDENCE.policyDocument,
    CLAIMS_EXCEPTION_EVIDENCE.assessmentNote,
    CLAIMS_EXCEPTION_EVIDENCE.priorDecision,
  ]
}

function step(h: Harness, input: {
  intendedState: GwsgState
  key: string
  actor?: ActorIdentity
  evidence?: EvidenceReference[]
  uncertainties?: UncertaintyDeclaration[]
  action?: boolean
  receipt?: GwsgTransition['sideEffect']['receipt']
}) {
  assertNoProhibitedInput(CLAIMS_EXCEPTION_INPUT as unknown as Record<string, unknown>)
  return h.engine.applyTransition({
    request: {
      workflowInstanceId: h.instanceId,
      intendedState: input.intendedState,
      actor: input.actor ?? CLAIMS_EXCEPTION_ACTORS.intakeAgent,
      idempotencyKey: input.key,
      declaredInput: { ...CLAIMS_EXCEPTION_INPUT },
      evidence: input.evidence ?? fullEvidence(),
      uncertainties: input.uncertainties ?? [],
      action: input.action
        ? { operation: OPERATIONS.issueDecisionLetter, requestSha256: syntheticDigest('action:decision-letter:request') }
        : undefined,
    },
    resolved: h.resolved,
    receipt: input.receipt,
  })
}

function binding(h: Harness, evidenceSet: EvidenceReference[]): ApprovalBinding {
  return {
    workflowInstanceId: h.instanceId,
    transitionId: `gwsg-action-${OPERATIONS.issueDecisionLetter}`,
    policyVersion: h.resolved.policyVersion,
    policySha256: h.resolved.policySha256,
    inputSha256: declaredInputDigest({ ...CLAIMS_EXCEPTION_INPUT }),
    evidenceSetSha256: evidenceSetDigest(evidenceSet),
  }
}

function finish(h: Harness, scenarioId: ClaimsScenarioId, title: string, demonstrates: string): ClaimsScenarioResult {
  const timeline = h.engine.timeline(h.instanceId)
  return {
    scenarioId, title, demonstrates,
    finalState: h.engine.instance(h.instanceId).currentState,
    timeline,
    recovery: assessRecovery(timeline),
    chainIntegrity: verifyEventChain(timeline),
  }
}

/** Intake, assessment, and referral to the adjudicator. */
function advance(h: Harness, evidenceSet = fullEvidence()) {
  step(h, { intendedState: 'evidence_collected', key: 'k-intake', evidence: evidenceSet })
  step(h, { intendedState: 'policy_evaluated', key: 'k-assess', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, evidence: evidenceSet })
  step(h, { intendedState: 'approval_pending', key: 'k-refer', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, evidence: evidenceSet })
}

/**
 * The adjudicator decides, then the file moves.
 *
 * Order matters for the evidence to be readable: the approval record is created
 * and decided first, and the state advances because of that decision. Advancing
 * the state first and binding an approval afterwards would produce a timeline in
 * which the file was approved before anyone approved it.
 */
function adjudicate(h: Harness, evidenceSet = fullEvidence()) {
  const approval = h.engine.requestApproval(binding(h, evidenceSet))
  h.engine.recordApprovalDecision({ approvalId: approval.approvalId, decision: 'grant', decidedBy: CLAIMS_EXCEPTION_ACTORS.adjudicator })
  step(h, { intendedState: 'approved', key: 'k-adjudicated', actor: CLAIMS_EXCEPTION_ACTORS.adjudicator, evidence: evidenceSet })
  return approval
}

export function runExceptionApproved(): ClaimsScenarioResult {
  const h = harness('exception_approved')
  advance(h)
  adjudicate(h)
  step(h, {
    intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, action: true,
    receipt: { intentId: 'observed', receiptId: 'receipt-synthetic-letter', outcome: 'succeeded', responseSha256: null, observedAt: '2026-08-22T09:00:12.000Z', simulated: true },
  })
  step(h, { intendedState: 'action_completed', key: 'k-complete', actor: CLAIMS_EXCEPTION_ACTORS.runner })
  step(h, { intendedState: 'closed', key: 'k-close', actor: CLAIMS_EXCEPTION_ACTORS.runner })
  return finish(h, 'exception_approved', 'Normal path: exception approved and letter authorised',
    'The adjudicator’s approval is bound to the exact four-document evidence set and policy version that produced it, and one action is authorised against that binding.')
}

export function runAssessmentRevisedAfterApproval(): ClaimsScenarioResult {
  const h = harness('assessment_revised_after_approval')
  const original = fullEvidence()
  advance(h, original)
  adjudicate(h, original)
  // The assessor files a revision after the adjudicator has signed off.
  const revised = [
    CLAIMS_EXCEPTION_EVIDENCE.claimForm, CLAIMS_EXCEPTION_EVIDENCE.policyDocument,
    CLAIMS_EXCEPTION_EVIDENCE.assessmentNoteRevised, CLAIMS_EXCEPTION_EVIDENCE.priorDecision,
  ]
  step(h, { intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, evidence: revised, action: true })
  return finish(h, 'assessment_revised_after_approval', 'Adverse: assessment revised after approval',
    'The approval does not carry over to the revised evidence set. No letter is authorised and the file returns to the adjudicator.')
}

export function runApprovalExpired(): ClaimsScenarioResult {
  const h = harness('adjudicator_approval_expired', CLAIMS_EXCEPTION_CHAIN, 2_500)
  advance(h)
  adjudicate(h)
  step(h, { intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, action: true })
  return finish(h, 'adjudicator_approval_expired', 'Adverse: approval aged out before the letter was raised',
    'A granted approval that has passed its window cannot authorise the letter. The decision is not issued on a stale sign-off.')
}

export function runInterruptedAfterAuthorisation(): ClaimsScenarioResult {
  const h = harness('interrupted_after_authorisation')
  advance(h)
  adjudicate(h)
  // Authorised, then the run dies before any receipt is observed.
  step(h, { intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, action: true })
  // The retry a naive runner would attempt.
  const retry = step(h, { intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, action: true })
  if (!retry.idempotent) throw new Error('The retry should have been served from the original record.')
  return finish(h, 'interrupted_after_authorisation', 'Recovery: interrupted with no receipt',
    'Whether the letter went out is unknowable from the log, so the file is classified indeterminate and routed to a human. The retry returns the original record and raises no second letter.')
}

export function runBranchOfficeLacksAuthority(): ClaimsScenarioResult {
  const h = harness('branch_office_lacks_authority', CLAIMS_EXCEPTION_BRANCH_CHAIN)
  advance(h)
  adjudicate(h)
  step(h, { intendedState: 'action_authorized', key: 'k-authorise', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent, action: true })
  return finish(h, 'branch_office_lacks_authority', 'Authority: branch instance may prepare but not issue',
    'The instance layer removes the letter operation and the action layer below cannot restore it. Preparation is permitted; issuance is not.')
}

export function runContestedEvidence(): ClaimsScenarioResult {
  const h = harness('contested_evidence_needs_adjudicator')
  step(h, { intendedState: 'evidence_collected', key: 'k-intake' })
  step(h, {
    intendedState: 'policy_evaluated', key: 'k-assess', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent,
    uncertainties: [CLAIMS_EXCEPTION_UNCERTAINTIES.contestedAssessment],
  })
  const agentRetry = step(h, { intendedState: 'policy_evaluated', key: 'k-retry', actor: CLAIMS_EXCEPTION_ACTORS.assessmentAgent })
  if (agentRetry.accepted) throw new Error('An agent must not clear its own escalation.')
  return finish(h, 'contested_evidence_needs_adjudicator', 'Adverse: assessment and prior decision conflict',
    'A conflict the agent cannot resolve stops the automated path. The agent cannot clear its own escalation; only the adjudicator can.')
}

export const CLAIMS_EXCEPTION_SCENARIOS: Record<ClaimsScenarioId, () => ClaimsScenarioResult> = {
  exception_approved: runExceptionApproved,
  assessment_revised_after_approval: runAssessmentRevisedAfterApproval,
  adjudicator_approval_expired: runApprovalExpired,
  interrupted_after_authorisation: runInterruptedAfterAuthorisation,
  branch_office_lacks_authority: runBranchOfficeLacksAuthority,
  contested_evidence_needs_adjudicator: runContestedEvidence,
}

export const CLAIMS_EXCEPTION_SCENARIO_IDS = Object.keys(CLAIMS_EXCEPTION_SCENARIOS) as ClaimsScenarioId[]

export function runClaimsExceptionEvaluation(): ClaimsScenarioResult[] {
  return CLAIMS_EXCEPTION_SCENARIO_IDS.map((id) => CLAIMS_EXCEPTION_SCENARIOS[id]())
}

/** The metadata-only report an evaluator receives. Digests, codes, states. */
export function claimsExceptionEvidenceReport() {
  const resolved = resolveGwsgPolicy(CLAIMS_EXCEPTION_CHAIN)
  return {
    evaluation: {
      version: CLAIMS_EXCEPTION_EVALUATION_VERSION,
      vertical: 'claims-exception-approval',
      templateId: CLAIMS_EXCEPTION_TEMPLATE_ID,
      decision: CLAIMS_EXCEPTION_DECISION,
      synthetic: true,
      notice: 'Synthetic evaluation corpus. No claimant, policy, document, or payment is real, and no effect leaves this process.',
    },
    authority: {
      scopeChain: resolved.scopeChain,
      policyVersion: resolved.policyVersion,
      policySha256: resolved.policySha256,
      approvalRequiredFor: resolved.policy.review.operations,
      paymentMode: resolved.policy.payment.mode,
    },
    inputs: {
      declaredFields: Object.keys(CLAIMS_EXCEPTION_INPUT).sort(),
      inputSha256: declaredInputDigest({ ...CLAIMS_EXCEPTION_INPUT }),
      prohibitedFields: [...CLAIMS_EXCEPTION_PROHIBITED_INPUT_FIELDS],
    },
    evidence: {
      requiredKinds: [...CLAIMS_EXCEPTION_REQUIRED_EVIDENCE],
      evidenceSetSha256: evidenceSetDigest(fullEvidence()),
      references: fullEvidence().map((entry) => ({ evidenceId: entry.evidenceId, kind: entry.kind, contentSha256: entry.contentSha256, contentBytes: entry.contentBytes })),
    },
    scenarios: runClaimsExceptionEvaluation().map((scenario) => ({
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      demonstrates: scenario.demonstrates,
      finalState: scenario.finalState,
      recovery: scenario.recovery.classification,
      chainVerified: scenario.chainIntegrity.valid,
      transitions: sanitizeTimeline(scenario.timeline),
    })),
  }
}
