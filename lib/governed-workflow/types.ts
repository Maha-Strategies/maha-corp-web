/**
 * The Governed Workflow State Graph domain model.
 *
 * A governed, evidence-bounded representation of one operational workflow. It
 * records what an agent believes, what evidence supports it, what remains
 * uncertain, which actions are permitted, which approvals are required, and
 * how interrupted work recovers.
 *
 * What it is not: a world model, a simulation engine, an agent memory store,
 * or an autonomous runner. It decides and records. It does not act — every
 * side effect in this library is an *intent* plus a *receipt*, and the
 * reference implementation simulates the middle.
 */
export const GWSG_SCHEMA_VERSION = '1.0.0'

/** Bumped whenever a change could alter a transition decision. */
export const GWSG_POLICY_MODEL_VERSION = '2026-08-21'

export type Sha256 = `sha256:${string}`

/** The reference flow, plus its terminal and recovery states. */
export const GWSG_STATES = [
  'draft',
  'evidence_collected',
  'policy_evaluated',
  'approval_pending',
  'approved',
  'action_authorized',
  'action_completed',
  'closed',
  // Terminal and recovery
  'denied',
  'expired',
  'failed_recoverable',
  'failed_final',
  'needs_human_review',
  'replay_blocked',
] as const

export type GwsgState = (typeof GWSG_STATES)[number]

export const GWSG_TERMINAL_STATES: readonly GwsgState[] = ['closed', 'denied', 'failed_final'] as const

/** States from which no further progress is attempted without a human. */
export const GWSG_HALTED_STATES: readonly GwsgState[] = [
  'closed', 'denied', 'failed_final', 'expired', 'needs_human_review', 'replay_blocked',
] as const

export type ActorKind = 'agent' | 'human_reviewer' | 'system'

/**
 * Who acted.
 *
 * The identity is a digest, not a name. A workflow audit trail that carries
 * reviewer names becomes a personal-data store, and this one is designed to
 * be retainable indefinitely.
 */
export type ActorIdentity = {
  actorKind: ActorKind
  actorIdSha256: Sha256
  /** Bounded, non-identifying label such as a role. Never a person's name. */
  actorRole: string
}

/**
 * A reference to evidence, never the evidence itself.
 *
 * `contentSha256` is a commitment to bytes the caller holds. It proves that
 * two parties are talking about the same bytes. It does not prove the bytes
 * are true, that the document is authentic, or that anyone executed anything —
 * see `provenance`.
 */
export type EvidenceReference = {
  evidenceId: string
  /** Bounded classification, not content. */
  kind: 'policy_document' | 'claim_form' | 'assessment_note' | 'prior_decision' | 'external_attestation'
  contentSha256: Sha256
  /** Bytes, so a reviewer can tell a page from a library without seeing either. */
  contentBytes: number
  provenance: EvidenceProvenance
  /** Caller-supplied safe metadata. Bounded and never free text from a document. */
  labels: Record<string, string>
}

/**
 * What is actually established about a piece of evidence.
 *
 * `structureVerifiedLocally` means this library checked the shape and digest
 * form. `trustedPassThrough` means the value was accepted from the caller and
 * carried forward unverified. Conflating the two is how a workflow ends up
 * asserting a provider executed something nobody checked.
 */
export type EvidenceProvenance = {
  structureVerifiedLocally: boolean
  digestFormatVerified: boolean
  /** Fields accepted from the caller without verification, named explicitly. */
  trustedPassThrough: string[]
  sourceAuthenticityVerified: false
  factualTruthEstablished: false
  providerExecutionVerified: false
}

/** What the workflow does not know, stated rather than implied. */
export type UncertaintyDeclaration = {
  uncertaintyId: string
  /** Bounded classification of what is unresolved. */
  kind: 'missing_evidence' | 'conflicting_evidence' | 'stale_evidence' | 'out_of_scope' | 'low_confidence'
  /** Whether this alone forces human review. */
  blocksAutomatedDecision: boolean
  note: string
}

export type UncertaintyStatus = 'none' | 'declared_non_blocking' | 'declared_blocking' | 'unresolved'

export type ApprovalState = 'not_required' | 'pending' | 'granted' | 'denied' | 'expired' | 'bypassed'

/**
 * An approval bound to exactly one decision.
 *
 * The binding is the point. An approval that does not name the instance, the
 * transition, the policy version, the input and the evidence set is an
 * approval of nothing in particular, and a changed input silently inherits it.
 */
export type ApprovalBinding = {
  workflowInstanceId: string
  transitionId: string
  policyVersion: string
  policySha256: Sha256
  inputSha256: Sha256
  evidenceSetSha256: Sha256
}

export type ApprovalRequirement = {
  required: boolean
  reason: string
  binding: ApprovalBinding | null
  expiresAt: string | null
}

export type ApprovalDecisionRecord = {
  approvalId: string
  state: ApprovalState
  binding: ApprovalBinding
  decidedBy: ActorIdentity | null
  decidedAt: string | null
  expiresAt: string
  reasonCode: GwsgReasonCode | null
}

/** What the workflow is permitted to do next, under the resolved policy. */
export type PermittedAction = {
  actionId: string
  operation: string
  requiresApproval: boolean
  /** True only where the resolved policy allows it *and* uncertainty is clear. */
  authorized: boolean
}

/**
 * An intent to cause an effect outside the graph, and the receipt for it.
 *
 * Separated because the interesting failure is the gap between them: an intent
 * with no receipt is exactly the state recovery has to reason about, and
 * collapsing them into one field makes that state unrepresentable.
 */
export type SideEffectIntent = {
  intentId: string
  operation: string
  /** Digest of the request the caller would send. Never the request itself. */
  requestSha256: Sha256
  simulated: true
}

export type SideEffectReceipt = {
  intentId: string
  receiptId: string
  outcome: 'succeeded' | 'failed' | 'indeterminate'
  /** Digest of the response, where one was observed. */
  responseSha256: Sha256 | null
  observedAt: string
  simulated: true
}

export type RecoveryClassification =
  | 'not_applicable'
  | 'safe_to_retry'
  | 'requires_human_review'
  | 'indeterminate_side_effect'
  | 'blocked_duplicate'

export type GwsgReasonCode =
  | 'allowed'
  | 'policy_denied'
  | 'policy_missing'
  | 'uncertainty_blocks_decision'
  | 'uncertainty_unresolved'
  | 'approval_required'
  | 'approval_pending'
  | 'approval_denied'
  | 'approval_expired'
  | 'approval_binding_stale'
  | 'approval_bypass_attempted'
  | 'action_not_authorized'
  | 'evidence_missing'
  | 'evidence_changed'
  | 'replay_duplicate_returned'
  | 'replay_material_change_rejected'
  | 'invalid_transition'
  | 'terminal_state'
  | 'side_effect_indeterminate'
  | 'exception_invalid'

/**
 * One recorded transition. Append-only, metadata only.
 *
 * There is no field here that can hold document text, and that is deliberate:
 * a shape that cannot represent source content cannot leak it by accident.
 */
export type GwsgTransition = {
  schemaVersion: typeof GWSG_SCHEMA_VERSION
  transitionId: string
  workflowInstanceId: string
  sequence: number
  priorState: GwsgState
  nextState: GwsgState
  occurredAt: string
  actor: ActorIdentity
  policyVersion: string
  policySha256: Sha256
  inputSha256: Sha256
  evidenceRefs: { evidenceId: string; contentSha256: Sha256 }[]
  evidenceSetSha256: Sha256
  uncertaintyStatus: UncertaintyStatus
  authorizationResult: 'allowed' | 'denied' | 'not_evaluated'
  approvalState: ApprovalState
  idempotencyKey: string
  recoveryClassification: RecoveryClassification
  reasonCodes: GwsgReasonCode[]
  sideEffect: { intent: SideEffectIntent | null; receipt: SideEffectReceipt | null }
  /** Links this record to the one before it, so a gap or edit is detectable. */
  previousTransitionSha256: Sha256 | null
  transitionSha256: Sha256
}

export type GwsgWorkflowInstance = {
  schemaVersion: typeof GWSG_SCHEMA_VERSION
  workflowInstanceId: string
  workflowTemplateId: string
  tenantId: string
  createdAt: string
  currentState: GwsgState
  sequence: number
  headSha256: Sha256 | null
  terminal: boolean
}

/** What a caller may declare when proposing a transition. */
export type TransitionRequest = {
  workflowInstanceId: string
  intendedState: GwsgState
  actor: ActorIdentity
  idempotencyKey: string
  declaredInput: Record<string, string | number | boolean>
  evidence: EvidenceReference[]
  uncertainties: UncertaintyDeclaration[]
  /** Present only when the caller is exercising a signed policy exception. */
  exception?: SignedPolicyException
  /** Present only on an action transition. */
  action?: { operation: string; requestSha256: Sha256 }
}

/**
 * The only way to loosen a resolved policy.
 *
 * Most-restrictive-wins has no override by design, so an exception must be an
 * explicit, signed, narrowly-scoped object rather than a flag. It names what
 * it relaxes and for which single transition.
 */
export type SignedPolicyException = {
  exceptionId: string
  issuedBy: ActorIdentity
  workflowInstanceId: string
  /** The exact transition this exception may be used for. Once. */
  transitionId: string
  relaxes: { operation: string }
  expiresAt: string
  /** HMAC over the canonical exception body, keyed by the governance secret. */
  signature: string
}
