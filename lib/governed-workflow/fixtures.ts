import { createHash } from 'node:crypto'
import { GOVERNANCE_SCHEMA_VERSION, type GovernancePolicy } from '../governance/envelope.ts'
import type { GovernancePolicyLayer } from '../governance/policy-inheritance.ts'
import { describeProvenance } from './evidence.ts'
import type { GwsgPolicyChain } from './policy.ts'
import type { ActorIdentity, EvidenceReference, Sha256, UncertaintyDeclaration } from './types.ts'

/**
 * The frozen synthetic corpus.
 *
 * Every value here is invented for evaluation. There is no real claimant, no
 * real policy document, no real reviewer, and no real payer. The workflow
 * modelled is a claims/policy-review style document approval because that is
 * the shape buyers recognise — not because any customer data was involved.
 *
 * Nothing in this file may be replaced with real records. The whole point of
 * a metadata-only durable model is that it can be demonstrated in public, and
 * that stops being true the moment the corpus stops being synthetic.
 */

export const GWSG_FIXTURE_CORPUS_VERSION = '2026-08-21'

/** Deterministic digest so fixtures are stable across runs and machines. */
function syntheticDigest(label: string): Sha256 {
  return `sha256:${createHash('sha256').update(`gwsg-synthetic:${label}`, 'utf8').digest('hex')}`
}

export function syntheticActor(role: string, kind: ActorIdentity['actorKind'] = 'agent'): ActorIdentity {
  return { actorKind: kind, actorIdSha256: syntheticDigest(`actor:${role}`), actorRole: role }
}

export const GWSG_ACTORS = {
  intakeAgent: syntheticActor('intake-agent'),
  reviewAgent: syntheticActor('review-agent'),
  humanReviewer: syntheticActor('claims-adjudicator', 'human_reviewer'),
  system: syntheticActor('workflow-runner', 'system'),
} as const

export function syntheticEvidence(input: {
  evidenceId: string
  kind: EvidenceReference['kind']
  contentBytes?: number
  labels?: Record<string, string>
  /** Distinguishes a changed document from the original in the same slot. */
  revision?: string
}): EvidenceReference {
  return {
    evidenceId: input.evidenceId,
    kind: input.kind,
    contentSha256: syntheticDigest(`evidence:${input.evidenceId}:${input.revision ?? 'r1'}`),
    contentBytes: input.contentBytes ?? 18_432,
    provenance: describeProvenance({ trustedPassThrough: ['contentSha256', 'contentBytes'] }),
    labels: { corpus: 'synthetic', ...input.labels },
  }
}

export const GWSG_EVIDENCE = {
  claimForm: syntheticEvidence({ evidenceId: 'ev-claim-form', kind: 'claim_form', labels: { section: 'intake' } }),
  policyDocument: syntheticEvidence({ evidenceId: 'ev-policy-document', kind: 'policy_document', labels: { section: 'coverage' } }),
  assessorNote: syntheticEvidence({ evidenceId: 'ev-assessor-note', kind: 'assessment_note', labels: { section: 'assessment' } }),
  /** The same slot, different bytes: used to prove approval invalidation. */
  claimFormRevised: syntheticEvidence({ evidenceId: 'ev-claim-form', kind: 'claim_form', labels: { section: 'intake' }, revision: 'r2' }),
} as const

export const GWSG_UNCERTAINTIES: Record<string, UncertaintyDeclaration> = {
  missingAssessment: {
    uncertaintyId: 'unc-missing-assessment',
    kind: 'missing_evidence',
    blocksAutomatedDecision: true,
    note: 'Assessment note absent from the submitted evidence set.',
  },
  minorAmbiguity: {
    uncertaintyId: 'unc-minor-ambiguity',
    kind: 'low_confidence',
    blocksAutomatedDecision: false,
    note: 'Coverage clause matched with low margin over the next candidate.',
  },
}

/**
 * Evidence kinds this template requires before any automated decision.
 *
 * Declared rather than inferred, so that "the assessment note is missing" is a
 * fact the engine can act on instead of something a caller has to remember to
 * mention.
 */
export const GWSG_REQUIRED_EVIDENCE_KINDS = ['claim_form', 'policy_document', 'assessment_note'] as const

/** The operations this template may ever perform. */
export const GWSG_OPERATIONS = {
  collectEvidence: 'transition:evidence_collected',
  evaluatePolicy: 'transition:policy_evaluated',
  requestApproval: 'transition:approval_pending',
  approve: 'transition:approved',
  deny: 'transition:denied',
  escalate: 'transition:needs_human_review',
  failFinal: 'transition:failed_final',
  completeAction: 'transition:action_completed',
  close: 'transition:closed',
  issueDecisionLetter: 'workflow.issue_decision_letter',
  releasePayment: 'workflow.release_payment',
} as const

/**
 * Organization/tenant root policy.
 *
 * `payment.mode` is `forbid` at the root, which no child layer can undo. The
 * prototype must not make payments, and the cleanest way to guarantee that is
 * a policy the inheritance rules make impossible to widen.
 */
export const GWSG_ROOT_POLICY: GovernancePolicy = {
  schemaVersion: GOVERNANCE_SCHEMA_VERSION,
  policyId: 'gwsg-tenant-root',
  policyVersion: '2026-08-21',
  allowedTenantIds: ['tenant-synthetic-claims'],
  allowedAgentIds: [GWSG_ACTORS.intakeAgent.actorIdSha256, GWSG_ACTORS.reviewAgent.actorIdSha256, GWSG_ACTORS.system.actorIdSha256],
  allowedTransports: ['mcp'],
  allowedTargetIds: ['target-synthetic-review-queue'],
  allowedResources: ['resource-synthetic-claim'],
  allowedOperations: [
    GWSG_OPERATIONS.collectEvidence,
    GWSG_OPERATIONS.evaluatePolicy,
    GWSG_OPERATIONS.requestApproval,
    GWSG_OPERATIONS.approve,
    GWSG_OPERATIONS.deny,
    GWSG_OPERATIONS.escalate,
    GWSG_OPERATIONS.failFinal,
    GWSG_OPERATIONS.completeAction,
    GWSG_OPERATIONS.close,
    GWSG_OPERATIONS.issueDecisionLetter,
  ],
  allowedCapabilities: ['workflow.review'],
  maxInputBytes: 262_144,
  maxHops: 4,
  maxTimeoutMs: 30_000,
  review: { operations: [GWSG_OPERATIONS.issueDecisionLetter], capabilities: [] },
  payment: { mode: 'forbid', allowedBuyerPolicyIds: [] },
}

/** Workflow template layer: narrows the root to this workflow's operations. */
export const GWSG_TEMPLATE_LAYER: GovernancePolicyLayer = {
  policyId: 'gwsg-template-claims-review',
  policyVersion: '2026-08-21',
  parentPolicyId: GWSG_ROOT_POLICY.policyId,
  scope: 'workflow',
  constraints: {
    allowedOperations: [
      GWSG_OPERATIONS.collectEvidence,
      GWSG_OPERATIONS.evaluatePolicy,
      GWSG_OPERATIONS.requestApproval,
      GWSG_OPERATIONS.approve,
      GWSG_OPERATIONS.deny,
      GWSG_OPERATIONS.escalate,
      GWSG_OPERATIONS.failFinal,
      GWSG_OPERATIONS.completeAction,
      GWSG_OPERATIONS.close,
      GWSG_OPERATIONS.issueDecisionLetter,
    ],
    maxTimeoutMs: 20_000,
  },
}

/** Workflow instance layer. */
export const GWSG_INSTANCE_LAYER: GovernancePolicyLayer = {
  policyId: 'gwsg-instance-default',
  policyVersion: '2026-08-21',
  parentPolicyId: GWSG_TEMPLATE_LAYER.policyId,
  scope: 'instance',
  constraints: { maxTimeoutMs: 15_000 },
}

/** Transition/action layer. */
export const GWSG_ACTION_LAYER: GovernancePolicyLayer = {
  policyId: 'gwsg-action-default',
  policyVersion: '2026-08-21',
  parentPolicyId: GWSG_INSTANCE_LAYER.policyId,
  scope: 'action',
  constraints: {},
}

export const GWSG_DEFAULT_CHAIN: GwsgPolicyChain = {
  root: GWSG_ROOT_POLICY,
  layers: [GWSG_TEMPLATE_LAYER, GWSG_INSTANCE_LAYER, GWSG_ACTION_LAYER],
}

/**
 * A conflicting instance layer, for the precedence scenario.
 *
 * The template permits `issue_decision_letter`; this instance removes it. The
 * expected outcome is denial: the most restrictive applicable rule wins, and a
 * lower layer cannot restore what a higher one allowed but a peer removed.
 */
export const GWSG_RESTRICTIVE_INSTANCE_LAYER: GovernancePolicyLayer = {
  policyId: 'gwsg-instance-restricted',
  policyVersion: '2026-08-21',
  parentPolicyId: GWSG_TEMPLATE_LAYER.policyId,
  scope: 'instance',
  constraints: {
    allowedOperations: [
      GWSG_OPERATIONS.collectEvidence,
      GWSG_OPERATIONS.evaluatePolicy,
      GWSG_OPERATIONS.requestApproval,
      GWSG_OPERATIONS.approve,
      GWSG_OPERATIONS.deny,
      GWSG_OPERATIONS.escalate,
      GWSG_OPERATIONS.failFinal,
      GWSG_OPERATIONS.completeAction,
      GWSG_OPERATIONS.close,
    ],
  },
}

/**
 * An action layer that tries to restore the removed operation.
 *
 * It cannot. `intersect` only ever filters the parent set, so re-listing a
 * removed operation in a child is a no-op. This fixture exists so a test can
 * demonstrate that rather than assert it.
 */
export const GWSG_WIDENING_ACTION_LAYER: GovernancePolicyLayer = {
  policyId: 'gwsg-action-widening',
  policyVersion: '2026-08-21',
  parentPolicyId: GWSG_RESTRICTIVE_INSTANCE_LAYER.policyId,
  scope: 'action',
  constraints: {
    allowedOperations: [
      GWSG_OPERATIONS.collectEvidence,
      GWSG_OPERATIONS.evaluatePolicy,
      GWSG_OPERATIONS.requestApproval,
      GWSG_OPERATIONS.approve,
      GWSG_OPERATIONS.deny,
      GWSG_OPERATIONS.escalate,
      GWSG_OPERATIONS.failFinal,
      GWSG_OPERATIONS.completeAction,
      GWSG_OPERATIONS.close,
      GWSG_OPERATIONS.issueDecisionLetter,
    ],
  },
}

export const GWSG_CONFLICTING_CHAIN: GwsgPolicyChain = {
  root: GWSG_ROOT_POLICY,
  layers: [GWSG_TEMPLATE_LAYER, GWSG_RESTRICTIVE_INSTANCE_LAYER, GWSG_WIDENING_ACTION_LAYER],
}

/** Fixed clock so every fixture-driven run produces identical digests. */
export const GWSG_FIXTURE_EPOCH = new Date('2026-08-21T12:00:00.000Z')

export function fixedClock(start: Date = GWSG_FIXTURE_EPOCH, stepMs = 1_000) {
  let current = start.getTime()
  return () => {
    const value = new Date(current)
    current += stepMs
    return value
  }
}

/** Synthetic declared input. Scalars only; no document text. */
export const GWSG_DECLARED_INPUT = {
  claimReference: 'SYNTH-CLAIM-0001',
  coverageCategory: 'category-b',
  requestedAmountMinor: 125_000,
  submittedComplete: true,
} as const

export const GWSG_ACTION_REQUEST_SHA256 = syntheticDigest('action:issue-decision-letter:request')
