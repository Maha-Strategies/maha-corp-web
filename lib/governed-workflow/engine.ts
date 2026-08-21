import { governanceDigest } from '../governance/envelope.ts'
import { declaredInputDigest, evidenceSetDigest, evidenceSetIsComplete, validateEvidenceReference } from './evidence.ts'
import { evaluateTransitionPolicy, verifyPolicyException, type ResolvedGwsgPolicy } from './policy.ts'
import { canTransition, GWSG_SAFE_CHECKPOINTS, isHalted, isTerminal, requiresPriorAuthorization } from './state-graph.ts'
import {
  GWSG_SCHEMA_VERSION,
  type ApprovalBinding,
  type ApprovalDecisionRecord,
  type ApprovalState,
  type GwsgReasonCode,
  type GwsgState,
  type GwsgTransition,
  type GwsgWorkflowInstance,
  type RecoveryClassification,
  type EvidenceReference,
  type Sha256,
  type SideEffectIntent,
  type SideEffectReceipt,
  type TransitionRequest,
} from './types.ts'

/**
 * The governed workflow engine.
 *
 * Everything here is deterministic given the event history plus an injected
 * clock. There is no ambient time, no ambient randomness, and no network. That
 * is what makes replay a proof rather than a hope: the same events must
 * reconstruct the same state, and a test can assert it.
 *
 * This engine never performs a side effect. `SideEffectIntent` records what
 * *would* be sent and `SideEffectReceipt` records what a caller observed. The
 * reference implementation simulates the middle, and the `simulated: true`
 * literal on both types means a real receipt cannot be forged into this shape
 * without changing the type.
 */

export type GwsgClock = () => Date

export type IdempotencyRecord = {
  idempotencyKey: string
  /** Digest over the inputs whose change would make a replay a new decision. */
  materialSha256: Sha256
  transitionId: string
  recordedAt: string
}

/**
 * Append-only storage.
 *
 * There is no update or delete method, and that is the interface's whole
 * point. A store that cannot rewrite history cannot be asked to.
 */
export interface GwsgEventLog {
  append(event: GwsgTransition): void
  list(workflowInstanceId: string): GwsgTransition[]
  head(workflowInstanceId: string): GwsgTransition | null
}

export class MemoryGwsgEventLog implements GwsgEventLog {
  readonly #events = new Map<string, GwsgTransition[]>()

  append(event: GwsgTransition): void {
    const existing = this.#events.get(event.workflowInstanceId) ?? []
    const head = existing.at(-1) ?? null
    if (event.sequence !== existing.length) throw new Error('Event sequence is out of order.')
    if (event.previousTransitionSha256 !== (head?.transitionSha256 ?? null)) throw new Error('Event chain is broken.')
    existing.push(Object.freeze(event))
    this.#events.set(event.workflowInstanceId, existing)
  }

  list(workflowInstanceId: string): GwsgTransition[] {
    return [...(this.#events.get(workflowInstanceId) ?? [])]
  }

  head(workflowInstanceId: string): GwsgTransition | null {
    return this.#events.get(workflowInstanceId)?.at(-1) ?? null
  }
}

/** The body a transition digest covers — everything except the digest itself. */
function transitionBody(event: Omit<GwsgTransition, 'transitionSha256'>) {
  return { ...event }
}

export function computeTransitionDigest(event: Omit<GwsgTransition, 'transitionSha256'>): Sha256 {
  return governanceDigest(transitionBody(event)) as Sha256
}

/**
 * Verifies the hash chain.
 *
 * Checks sequence contiguity, back-links, and each record's own digest. A
 * removed record breaks the sequence; an edited one breaks its digest; a
 * re-digested one breaks the next record's back-link.
 */
export function verifyEventChain(events: GwsgTransition[]): { valid: boolean; brokenAt: number | null; reason: string | null } {
  let previous: Sha256 | null = null
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event.sequence !== index) return { valid: false, brokenAt: index, reason: 'sequence_mismatch' }
    if (event.previousTransitionSha256 !== previous) return { valid: false, brokenAt: index, reason: 'chain_link_mismatch' }
    const { transitionSha256, ...body } = event
    if (computeTransitionDigest(body) !== transitionSha256) return { valid: false, brokenAt: index, reason: 'digest_mismatch' }
    previous = transitionSha256
  }
  return { valid: true, brokenAt: null, reason: null }
}

/**
 * Rebuilds instance state from the event history alone.
 *
 * Nothing is read from a cached instance record. If the projection and the log
 * ever disagree, the log is right — it is the only thing with integrity
 * verification attached.
 */
export function replayWorkflow(
  events: GwsgTransition[],
  seed: Pick<GwsgWorkflowInstance, 'workflowInstanceId' | 'workflowTemplateId' | 'tenantId' | 'createdAt'>,
): GwsgWorkflowInstance {
  const chain = verifyEventChain(events)
  if (!chain.valid) throw new Error(`Event chain is not replayable: ${chain.reason} at ${chain.brokenAt}.`)
  const head = events.at(-1) ?? null
  const currentState: GwsgState = head?.nextState ?? 'draft'
  return {
    schemaVersion: GWSG_SCHEMA_VERSION,
    ...seed,
    currentState,
    sequence: events.length,
    headSha256: head?.transitionSha256 ?? null,
    terminal: isTerminal(currentState),
  }
}

export type RecoveryAssessment = {
  classification: RecoveryClassification
  /** The last state a resume may safely restart from, if any. */
  lastSafeCheckpoint: { sequence: number; state: GwsgState; transitionSha256: Sha256 } | null
  currentState: GwsgState
  reasonCodes: GwsgReasonCode[]
}

/**
 * Works out where an interrupted workflow can safely resume.
 *
 * The hard case is an authorized action with no receipt. The side effect may
 * or may not have landed, and nothing in the log can distinguish those. So it
 * is classified `indeterminate_side_effect` and routed to a human rather than
 * retried — a retry here is precisely how one authorization becomes two
 * effects.
 */
export function assessRecovery(events: GwsgTransition[]): RecoveryAssessment {
  const head = events.at(-1) ?? null
  const currentState: GwsgState = head?.nextState ?? 'draft'
  const reasonCodes: GwsgReasonCode[] = []

  let lastSafeCheckpoint: RecoveryAssessment['lastSafeCheckpoint'] = null
  for (const event of events) {
    if (GWSG_SAFE_CHECKPOINTS.includes(event.nextState)) {
      lastSafeCheckpoint = { sequence: event.sequence, state: event.nextState, transitionSha256: event.transitionSha256 }
    }
  }

  const authorizedWithoutReceipt = events.some(
    (event) => event.nextState === 'action_authorized' && event.sideEffect.intent !== null && event.sideEffect.receipt === null,
  )
  const completed = events.some((event) => event.nextState === 'action_completed')

  let classification: RecoveryClassification = 'not_applicable'
  if (authorizedWithoutReceipt && !completed) {
    classification = 'indeterminate_side_effect'
    reasonCodes.push('side_effect_indeterminate')
  } else if (currentState === 'replay_blocked') {
    classification = 'blocked_duplicate'
    reasonCodes.push('replay_duplicate_returned')
  } else if (currentState === 'needs_human_review') {
    classification = 'requires_human_review'
  } else if (currentState === 'expired') {
    // An expired approval leaves a decision half-made. Resuming it is a
    // human's call, not an automatic retry.
    classification = 'requires_human_review'
    reasonCodes.push('approval_expired')
  } else if (currentState === 'failed_recoverable') {
    classification = lastSafeCheckpoint ? 'safe_to_retry' : 'requires_human_review'
  }

  return { classification, lastSafeCheckpoint, currentState, reasonCodes }
}

export type TransitionOutcome = {
  accepted: boolean
  idempotent: boolean
  transition: GwsgTransition
  reasonCodes: GwsgReasonCode[]
}

export type GwsgEngineOptions = {
  log: GwsgEventLog
  clock: GwsgClock
  /** Secret used to verify signed policy exceptions. Never logged or returned. */
  exceptionSecret: string
  approvalTtlMs?: number
  /** Evidence kinds the workflow template requires before an automated decision. */
  requiredEvidenceKinds?: readonly EvidenceReference['kind'][]
}

const DEFAULT_APPROVAL_TTL_MS = 15 * 60 * 1000

export class GwsgEngine {
  readonly #log: GwsgEventLog
  readonly #clock: GwsgClock
  readonly #exceptionSecret: string
  readonly #approvalTtlMs: number
  readonly #requiredEvidenceKinds: readonly EvidenceReference['kind'][]
  readonly #instances = new Map<string, Pick<GwsgWorkflowInstance, 'workflowInstanceId' | 'workflowTemplateId' | 'tenantId' | 'createdAt'>>()
  /**
   * Keyed by workflow instance *and* key. An engine holds many workflows, and
   * callers reuse ordinary key names like `intake-1`, so an engine-wide map
   * would let one workflow's key block an unrelated workflow's transition.
   */
  readonly #idempotency = new Map<string, IdempotencyRecord>()
  readonly #approvals = new Map<string, ApprovalDecisionRecord>()

  constructor(options: GwsgEngineOptions) {
    this.#log = options.log
    this.#clock = options.clock
    this.#exceptionSecret = options.exceptionSecret
    this.#approvalTtlMs = options.approvalTtlMs ?? DEFAULT_APPROVAL_TTL_MS
    this.#requiredEvidenceKinds = options.requiredEvidenceKinds ?? []
  }

  createWorkflow(input: { workflowInstanceId: string; workflowTemplateId: string; tenantId: string }): GwsgWorkflowInstance {
    if (this.#instances.has(input.workflowInstanceId)) throw new Error('Workflow instance already exists.')
    const seed = { ...input, createdAt: this.#clock().toISOString() }
    this.#instances.set(input.workflowInstanceId, seed)
    return replayWorkflow([], seed)
  }

  instance(workflowInstanceId: string): GwsgWorkflowInstance {
    const seed = this.#instances.get(workflowInstanceId)
    if (!seed) throw new Error('Workflow instance is unknown.')
    return replayWorkflow(this.#log.list(workflowInstanceId), seed)
  }

  timeline(workflowInstanceId: string): GwsgTransition[] {
    return this.#log.list(workflowInstanceId)
  }

  approval(approvalId: string): ApprovalDecisionRecord | null {
    return this.#approvals.get(approvalId) ?? null
  }

  /**
   * Derives the approval id from the binding.
   *
   * Content-addressed, following `approvalIdFor` in `lib/workflows/approvals`:
   * an approval for a different input or a different evidence set is a
   * different id, so a stale approval cannot be looked up and reused for a
   * changed decision — it simply is not there.
   */
  static approvalIdFor(binding: ApprovalBinding): string {
    return `gwsg-approval-${governanceDigest(binding).replace('sha256:', '')}`
  }

  requestApproval(binding: ApprovalBinding): ApprovalDecisionRecord {
    const approvalId = GwsgEngine.approvalIdFor(binding)
    const existing = this.#approvals.get(approvalId)
    if (existing) return existing
    const record: ApprovalDecisionRecord = {
      approvalId,
      state: 'pending',
      binding,
      decidedBy: null,
      decidedAt: null,
      expiresAt: new Date(this.#clock().getTime() + this.#approvalTtlMs).toISOString(),
      reasonCode: null,
    }
    this.#approvals.set(approvalId, record)
    return record
  }

  recordApprovalDecision(input: {
    approvalId: string
    decision: 'grant' | 'deny'
    decidedBy: GwsgTransition['actor']
  }): ApprovalDecisionRecord {
    const record = this.#approvals.get(input.approvalId)
    if (!record) throw new Error('Approval is unknown.')
    // An agent cannot approve its own work. This is the bypass the model is
    // built to prevent, so it is an exception rather than a reason code: there
    // is no legitimate caller for it.
    if (input.decidedBy.actorKind !== 'human_reviewer') throw new Error('Only a human reviewer may decide an approval.')
    if (record.state !== 'pending') return record
    const now = this.#clock()
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      const expired: ApprovalDecisionRecord = { ...record, state: 'expired', reasonCode: 'approval_expired' }
      this.#approvals.set(record.approvalId, expired)
      return expired
    }
    const decided: ApprovalDecisionRecord = {
      ...record,
      state: input.decision === 'grant' ? 'granted' : 'denied',
      decidedBy: input.decidedBy,
      decidedAt: now.toISOString(),
      reasonCode: input.decision === 'grant' ? 'allowed' : 'approval_denied',
    }
    this.#approvals.set(record.approvalId, decided)
    return decided
  }

  /**
   * Evaluates and records one transition.
   *
   * The order of checks below is the security model, so it is worth reading as
   * a sequence: terminal state, then replay, then structural validity, then
   * legality of the state edge, then policy, then approval, then authorization.
   * Each gate can only narrow what the next one sees.
   */
  applyTransition(input: {
    request: TransitionRequest
    resolved: ResolvedGwsgPolicy
    /** Supplied by the caller for an action transition it has already observed. */
    receipt?: SideEffectReceipt | null
  }): TransitionOutcome {
    const { request, resolved } = input
    const seed = this.#instances.get(request.workflowInstanceId)
    if (!seed) throw new Error('Workflow instance is unknown.')

    const events = this.#log.list(request.workflowInstanceId)
    const head = events.at(-1) ?? null
    const priorState: GwsgState = head?.nextState ?? 'draft'
    const now = this.#clock()

    const idempotencyScope = `${request.workflowInstanceId}\n${request.idempotencyKey}`
    const inputSha256 = declaredInputDigest(request.declaredInput)
    const evidenceSetSha256 = evidenceSetDigest(request.evidence)
    const operation = request.action?.operation ?? `transition:${request.intendedState}`

    // Material inputs: anything whose change makes a repeat a different
    // decision rather than the same one. Timestamps and actor are excluded —
    // a retry from the same caller is still the same decision.
    const materialSha256 = governanceDigest({
      workflowInstanceId: request.workflowInstanceId,
      intendedState: request.intendedState,
      operation,
      inputSha256,
      evidenceSetSha256,
      policySha256: resolved.policySha256,
    }) as Sha256

    const record = (
      nextState: GwsgState,
      fields: {
        reasonCodes: GwsgReasonCode[]
        authorizationResult: GwsgTransition['authorizationResult']
        approvalState: ApprovalState
        recoveryClassification: RecoveryClassification
        uncertaintyStatus: GwsgTransition['uncertaintyStatus']
        intent?: SideEffectIntent | null
        receipt?: SideEffectReceipt | null
      },
    ): TransitionOutcome => {
      const body: Omit<GwsgTransition, 'transitionSha256'> = {
        schemaVersion: GWSG_SCHEMA_VERSION,
        transitionId: `gwsg-transition-${governanceDigest({ materialSha256, sequence: events.length, idempotencyKey: request.idempotencyKey }).replace('sha256:', '').slice(0, 32)}`,
        workflowInstanceId: request.workflowInstanceId,
        sequence: events.length,
        priorState,
        nextState,
        occurredAt: now.toISOString(),
        actor: request.actor,
        policyVersion: resolved.policyVersion,
        policySha256: resolved.policySha256,
        inputSha256,
        evidenceRefs: request.evidence
          .map((entry) => ({ evidenceId: entry.evidenceId, contentSha256: entry.contentSha256 }))
          .sort((a, b) => (a.evidenceId < b.evidenceId ? -1 : 1)),
        evidenceSetSha256,
        uncertaintyStatus: fields.uncertaintyStatus,
        authorizationResult: fields.authorizationResult,
        approvalState: fields.approvalState,
        idempotencyKey: request.idempotencyKey,
        recoveryClassification: fields.recoveryClassification,
        reasonCodes: fields.reasonCodes,
        sideEffect: { intent: fields.intent ?? null, receipt: fields.receipt ?? null },
        previousTransitionSha256: head?.transitionSha256 ?? null,
      }
      const transition: GwsgTransition = { ...body, transitionSha256: computeTransitionDigest(body) }
      this.#log.append(transition)
      this.#idempotency.set(idempotencyScope, {
        idempotencyKey: request.idempotencyKey,
        materialSha256,
        transitionId: transition.transitionId,
        recordedAt: now.toISOString(),
      })
      const accepted = !fields.reasonCodes.some((code) => code !== 'allowed' && code !== 'approval_required')
      return { accepted, idempotent: false, transition, reasonCodes: fields.reasonCodes }
    }

    // Rejected without appending. Recording a `denied -> denied` edge would put
    // a transition in the log that the state graph declares illegal, and would
    // let any caller grow a finished workflow's history indefinitely.
    //
    // Terminal is absolute: `closed`, `denied` and `failed_final` admit no
    // further transition from anyone, which is why they declare no edges.
    if (isTerminal(priorState)) {
      if (!head) throw new Error('Terminal workflow has no head transition.')
      return { accepted: false, idempotent: false, transition: head, reasonCodes: ['terminal_state'] }
    }

    // `expired`, `needs_human_review` and `replay_blocked` are halted, not
    // finished. They exist precisely to hand control to a person, so a human
    // reviewer may move them along a legal edge while an agent may not — a
    // state that routed to human review but no human could leave would make
    // the review a dead end rather than an escalation.
    if (isHalted(priorState) && request.actor.actorKind !== 'human_reviewer') {
      if (!head) throw new Error('Halted workflow has no head transition.')
      return { accepted: false, idempotent: false, transition: head, reasonCodes: ['approval_bypass_attempted'] }
    }

    // Replay, before anything else that could cause a second effect.
    const priorIdempotency = this.#idempotency.get(idempotencyScope)
    if (priorIdempotency) {
      const original = events.find((event) => event.transitionId === priorIdempotency.transitionId)
      if (priorIdempotency.materialSha256 !== materialSha256) {
        return record('replay_blocked', {
          reasonCodes: ['replay_material_change_rejected'],
          authorizationResult: 'denied',
          approvalState: 'not_required',
          recoveryClassification: 'blocked_duplicate',
          uncertaintyStatus: 'none',
        })
      }
      if (original) {
        // Same key, same inputs: hand back the original decision unchanged.
        // No new event is appended and no intent is produced, so a replayed
        // action cannot become a second side effect.
        return { accepted: true, idempotent: true, transition: original, reasonCodes: ['replay_duplicate_returned'] }
      }
    }

    for (const reference of request.evidence) {
      const validation = validateEvidenceReference(reference)
      if (!validation.valid) {
        return record('needs_human_review', {
          reasonCodes: ['evidence_missing'],
          authorizationResult: 'denied',
          approvalState: 'not_required',
          recoveryClassification: 'requires_human_review',
          uncertaintyStatus: 'unresolved',
        })
      }
    }

    if (!canTransition(priorState, request.intendedState)) {
      return record('needs_human_review', {
        reasonCodes: ['invalid_transition'],
        authorizationResult: 'denied',
        approvalState: 'not_required',
        recoveryClassification: 'requires_human_review',
        uncertaintyStatus: 'none',
      })
    }

    // An action cannot complete unless a prior event authorized it.
    if (requiresPriorAuthorization(request.intendedState)) {
      const authorized = events.some((event) => event.nextState === 'action_authorized' && event.authorizationResult === 'allowed')
      if (!authorized) {
        return record('needs_human_review', {
          reasonCodes: ['action_not_authorized'],
          authorizationResult: 'denied',
          approvalState: 'not_required',
          recoveryClassification: 'requires_human_review',
          uncertaintyStatus: 'none',
        })
      }
    }

    const evaluation = evaluateTransitionPolicy({
      resolved,
      operation,
      uncertainties: request.uncertainties,
      // Completeness is a precondition for a decision, not for collection.
      // The whole purpose of `evidence_collected` is that evidence is still
      // being gathered, so requiring the full set to enter that state would
      // make the state unreachable.
      evidenceComplete:
        request.intendedState === 'evidence_collected' ||
        evidenceSetIsComplete(request.evidence, this.#requiredEvidenceKinds).complete,
    })

    // Non-action transitions carry the policy evaluation but do not authorize.
    if (request.intendedState !== 'action_authorized') {
      if (evaluation.decision === 'denied' && evaluation.uncertaintyStatus !== 'none' &&
        (evaluation.reasonCodes.includes('uncertainty_blocks_decision') || evaluation.reasonCodes.includes('uncertainty_unresolved'))) {
        return record('needs_human_review', {
          reasonCodes: evaluation.reasonCodes,
          authorizationResult: 'denied',
          approvalState: 'not_required',
          recoveryClassification: 'requires_human_review',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      if (evaluation.decision === 'denied') {
        return record('denied', {
          reasonCodes: evaluation.reasonCodes,
          authorizationResult: 'denied',
          approvalState: 'not_required',
          recoveryClassification: 'not_applicable',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      return record(request.intendedState, {
        reasonCodes: evaluation.reasonCodes,
        authorizationResult: 'not_evaluated',
        approvalState: evaluation.requiresApproval && request.intendedState === 'approval_pending' ? 'pending' : 'not_required',
        recoveryClassification: 'not_applicable',
        uncertaintyStatus: evaluation.uncertaintyStatus,
      })
    }

    // From here the caller is asking to authorize an action.
    const binding: ApprovalBinding = {
      workflowInstanceId: request.workflowInstanceId,
      transitionId: request.action ? `gwsg-action-${operation}` : `gwsg-action-${request.intendedState}`,
      policyVersion: resolved.policyVersion,
      policySha256: resolved.policySha256,
      inputSha256,
      evidenceSetSha256,
    }

    let decision = evaluation.decision
    let reasonCodes = [...evaluation.reasonCodes]

    if (decision === 'denied' && request.exception) {
      const verified = verifyPolicyException({
        exception: request.exception,
        secret: this.#exceptionSecret,
        workflowInstanceId: request.workflowInstanceId,
        transitionId: binding.transitionId,
        operation,
        now,
      })
      if (verified.valid && !reasonCodes.includes('uncertainty_blocks_decision') && !reasonCodes.includes('uncertainty_unresolved')) {
        decision = 'allowed'
        reasonCodes = ['allowed']
      } else {
        reasonCodes = [...reasonCodes.filter((code) => code !== 'allowed'), verified.reasonCode === 'allowed' ? 'policy_denied' : verified.reasonCode]
      }
    }

    if (decision === 'denied') {
      const needsHuman = reasonCodes.includes('uncertainty_blocks_decision') || reasonCodes.includes('uncertainty_unresolved')
      return record(needsHuman ? 'needs_human_review' : 'denied', {
        reasonCodes,
        authorizationResult: 'denied',
        approvalState: 'not_required',
        recoveryClassification: needsHuman ? 'requires_human_review' : 'not_applicable',
        uncertaintyStatus: evaluation.uncertaintyStatus,
      })
    }

    if (evaluation.requiresApproval) {
      const approvalId = GwsgEngine.approvalIdFor(binding)
      const approval = this.#approvals.get(approvalId)
      if (!approval) {
        // No approval exists for *this* binding. If one exists for a different
        // binding the id differs, so a changed input silently loses its
        // approval rather than inheriting it.
        const stale = [...this.#approvals.values()].some(
          (entry) => entry.binding.workflowInstanceId === request.workflowInstanceId && entry.state === 'granted',
        )
        return record(stale ? 'needs_human_review' : 'approval_pending', {
          reasonCodes: stale ? ['approval_binding_stale'] : ['approval_required'],
          authorizationResult: 'denied',
          approvalState: 'pending',
          recoveryClassification: stale ? 'requires_human_review' : 'not_applicable',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      const expired = Date.parse(approval.expiresAt) <= now.getTime()
      if (approval.state === 'pending' && expired) {
        this.#approvals.set(approvalId, { ...approval, state: 'expired', reasonCode: 'approval_expired' })
        return record('expired', {
          reasonCodes: ['approval_expired'],
          authorizationResult: 'denied',
          approvalState: 'expired',
          recoveryClassification: 'requires_human_review',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      if (approval.state === 'expired' || (approval.state === 'granted' && expired)) {
        return record('expired', {
          reasonCodes: ['approval_expired'],
          authorizationResult: 'denied',
          approvalState: 'expired',
          recoveryClassification: 'requires_human_review',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      if (approval.state === 'denied') {
        return record('denied', {
          reasonCodes: ['approval_denied'],
          authorizationResult: 'denied',
          approvalState: 'denied',
          recoveryClassification: 'not_applicable',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
      if (approval.state !== 'granted') {
        return record('approval_pending', {
          reasonCodes: ['approval_pending'],
          authorizationResult: 'denied',
          approvalState: 'pending',
          recoveryClassification: 'not_applicable',
          uncertaintyStatus: evaluation.uncertaintyStatus,
        })
      }
    }

    const intent: SideEffectIntent | null = request.action
      ? { intentId: `gwsg-intent-${governanceDigest(binding).replace('sha256:', '').slice(0, 32)}`, operation, requestSha256: request.action.requestSha256, simulated: true }
      : null

    return record('action_authorized', {
      reasonCodes,
      authorizationResult: 'allowed',
      approvalState: evaluation.requiresApproval ? 'granted' : 'not_required',
      recoveryClassification: input.receipt ? 'not_applicable' : 'indeterminate_side_effect',
      uncertaintyStatus: evaluation.uncertaintyStatus,
      intent,
      receipt: input.receipt ?? null,
    })
  }
}
