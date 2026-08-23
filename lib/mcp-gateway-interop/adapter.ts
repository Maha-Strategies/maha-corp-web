import { GwsgEngine, MemoryGwsgEventLog, type GwsgClock } from '../governed-workflow/engine.ts'
import type { ActorIdentity, ApprovalDecisionRecord, RecoveryClassification, Sha256 } from '../governed-workflow/types.ts'
import { evaluateGatewayAction, gatewayBoundaries, type GatewayPolicyChain } from './governance.ts'
import {
  GATEWAY_INTEROP_VERSION,
  type GatewayActionRequest, type GatewayActionResult, type GatewayDispatch, type GatewayDispatchOutcome,
} from './types.ts'

/**
 * The enforcement point.
 *
 * A gateway hands this its own dispatch callback. The callback is invoked only
 * when the governance decision allows it, any required approval is granted and
 * still bound, and the idempotency key has not already produced a dispatch.
 *
 * That inversion is the whole design. A decision service that returns "deny"
 * and leaves the gateway to honour it is advisory; one that holds the callback
 * makes the denial structural. A denied action cannot reach dispatch because
 * there is no code path from a denial to the callback.
 */

export type GatewayInteropOptions = {
  chain: GatewayPolicyChain
  clock: GwsgClock
  approvalTtlMs?: number
}

type DispatchRecord = {
  idempotencyKey: string
  /** Digest of the inputs whose change makes a repeat a different action. */
  materialSha256: string
  result: GatewayActionResult
  receipt: GatewayDispatchOutcome | null
}

/** Reviewers are identified by digest and role, never by name. */
export type GatewayReviewer = ActorIdentity

export class McpGatewayInterop {
  readonly #chain: GatewayPolicyChain
  readonly #clock: GwsgClock
  readonly #engine: GwsgEngine
  readonly #dispatched = new Map<string, DispatchRecord>()
  /**
   * Approvals this adapter has created, per idempotency key.
   *
   * Needed to tell "never approved" from "approved, then the inputs moved".
   * Both present as a pending approval, but only the second means someone
   * already signed off on something that no longer matches, which is the case
   * a gateway audit log should record differently.
   */
  readonly #approvalsByKey = new Map<string, string[]>()

  constructor(options: GatewayInteropOptions) {
    this.#chain = options.chain
    this.#clock = options.clock
    // The workflow engine supplies approval identity, expiry and the recovery
    // vocabulary. None of that is reimplemented here.
    this.#engine = new GwsgEngine({
      log: new MemoryGwsgEventLog(),
      clock: options.clock,
      exceptionSecret: 'gateway-interop-no-exceptions-configured',
      approvalTtlMs: options.approvalTtlMs,
    })
  }

  /** Requests approval for an action the policy sent to review. */
  requestApproval(request: GatewayActionRequest): ApprovalDecisionRecord {
    const evaluation = evaluateGatewayAction({ request, chain: this.#chain, now: this.#clock() })
    return this.#trackApproval(request.idempotencyKey, evaluation.binding)
  }

  #trackApproval(idempotencyKey: string, binding: Parameters<GwsgEngine['requestApproval']>[0]) {
    const record = this.#engine.requestApproval(binding)
    const known = this.#approvalsByKey.get(idempotencyKey) ?? []
    if (!known.includes(record.approvalId)) known.push(record.approvalId)
    this.#approvalsByKey.set(idempotencyKey, known)
    return record
  }

  /** True when a grant exists for this key but against a different binding. */
  #hasStaleGrant(idempotencyKey: string, currentApprovalId: string): boolean {
    return (this.#approvalsByKey.get(idempotencyKey) ?? []).some(
      (id) => id !== currentApprovalId && this.#engine.approval(id)?.state === 'granted',
    )
  }

  /** Records a human reviewer's decision. An agent identity is refused upstream. */
  recordApproval(input: { request: GatewayActionRequest; decision: 'grant' | 'deny'; reviewer: GatewayReviewer }): ApprovalDecisionRecord {
    const evaluation = evaluateGatewayAction({ request: input.request, chain: this.#chain, now: this.#clock() })
    const approvalId = GwsgEngine.approvalIdFor(evaluation.binding)
    if (!this.#engine.approval(approvalId)) this.#trackApproval(input.request.idempotencyKey, evaluation.binding)
    return this.#engine.recordApprovalDecision({ approvalId, decision: input.decision, decidedBy: input.reviewer })
  }

  /**
   * Evaluates one action and, only if it is authorised, dispatches it.
   *
   * Order is the security model: replay before anything that could cause a
   * second effect, then authority, then approval, then dispatch.
   */
  async handle(request: GatewayActionRequest, dispatch: GatewayDispatch): Promise<GatewayActionResult> {
    const now = this.#clock()
    let approvalSatisfied = false
    const evaluation = evaluateGatewayAction({ request, chain: this.#chain, now })
    const material = `${evaluation.governance.policy.policySha256}\n${request.inputSha256}\n${evaluation.evidenceSetSha256}\n${request.operation}`

    const base = (): Omit<GatewayActionResult, 'decision' | 'reasonCodes' | 'approval' | 'dispatch' | 'recovery'> => ({
      interopVersion: GATEWAY_INTEROP_VERSION,
      requestId: request.requestId,
      policy: evaluation.governance.policy,
      evidence: {
        envelopeSha256: evaluation.governance.request.envelopeSha256,
        decisionSha256: evaluation.decisionSha256,
        inputSha256: request.inputSha256,
        evidenceSetSha256: evaluation.evidenceSetSha256,
        contentRetained: false,
      },
      boundaries: gatewayBoundaries(),
    })

    const finish = (
      decision: GatewayActionResult['decision'],
      reasonCodes: string[],
      extra: Partial<Pick<GatewayActionResult, 'approval' | 'dispatch' | 'recovery'>> = {},
    ): GatewayActionResult => ({
      ...base(), decision, reasonCodes,
      approval: extra.approval ?? null,
      dispatch: extra.dispatch ?? { attempted: false, idempotentReplay: false, receipt: null },
      recovery: extra.recovery ?? 'not_applicable',
    })

    // 1. Replay, before anything that could dispatch.
    const prior = this.#dispatched.get(request.idempotencyKey)
    if (prior) {
      if (prior.materialSha256 !== material) {
        return finish('deny', ['replay_material_change_rejected'], { recovery: 'blocked_duplicate' })
      }
      return {
        ...prior.result,
        requestId: request.requestId,
        dispatch: { ...prior.result.dispatch, idempotentReplay: true },
      }
    }

    // 2. Authority. The governance engine decides; nothing here overrides it.
    if (evaluation.decision === 'deny') {
      return finish('deny', evaluation.governance.reasonCodes)
    }

    // 3. Approval, where the policy requires review.
    if (evaluation.decision === 'approval_required') {
      const approvalId = GwsgEngine.approvalIdFor(evaluation.binding)
      const record = this.#engine.approval(approvalId)
      const boundTo = {
        policySha256: evaluation.binding.policySha256,
        inputSha256: evaluation.binding.inputSha256,
        evidenceSetSha256: evaluation.binding.evidenceSetSha256,
      }

      // No record for *this* binding. If a grant exists for a different one,
      // the inputs moved after it was given, so say so rather than presenting a
      // fresh review as though nothing had happened.
      if (!record) {
        const stale = this.#hasStaleGrant(request.idempotencyKey, approvalId)
        const pending = this.#trackApproval(request.idempotencyKey, evaluation.binding)
        return finish('approval_required', stale ? ['approval_binding_stale', 'approval_required'] : ['approval_required'], {
          approval: { approvalId: pending.approvalId, state: 'pending', boundTo, expiresAt: pending.expiresAt },
          recovery: stale ? 'requires_human_review' : 'not_applicable',
        })
      }

      const expired = Date.parse(record.expiresAt) <= now.getTime()
      if (record.state === 'denied') {
        return finish('deny', ['approval_denied'], {
          approval: { approvalId, state: 'denied', boundTo, expiresAt: record.expiresAt },
        })
      }
      if (expired || record.state === 'expired') {
        return finish('deny', ['approval_expired'], {
          approval: { approvalId, state: 'expired', boundTo, expiresAt: record.expiresAt },
          recovery: 'requires_human_review',
        })
      }
      if (record.state !== 'granted') {
        return finish('approval_required', ['approval_pending'], {
          approval: { approvalId, state: 'pending', boundTo, expiresAt: record.expiresAt },
        })
      }
      // Granted and still bound: fall through to dispatch, recording that the
      // approval was satisfied rather than only that it was demanded.
      approvalSatisfied = true
    }

    // 4. Dispatch. The only call site for the gateway's callback.
    const outcome = await dispatch({
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      operation: request.operation,
      capability: request.capability,
      targetId: request.targetId,
      inputSha256: request.inputSha256,
    })

    const receipt = outcome
      ? { receiptId: outcome.receiptId, outcome: outcome.outcome, observedAt: this.#clock().toISOString() }
      : null

    // An authorised action with no usable receipt is indeterminate: the effect
    // may or may not have landed, and nothing in this record can tell them
    // apart. Retrying here is how one authorisation becomes two effects.
    const recovery: RecoveryClassification =
      receipt === null || receipt.outcome === 'indeterminate' ? 'indeterminate_side_effect' : 'not_applicable'

    const result = finish('allow', approvalSatisfied ? [...evaluation.governance.reasonCodes, 'approval_granted'] : evaluation.governance.reasonCodes, {
      approval: null,
      dispatch: { attempted: true, idempotentReplay: false, receipt },
      recovery,
    })

    this.#dispatched.set(request.idempotencyKey, {
      idempotencyKey: request.idempotencyKey, materialSha256: material, result, receipt: outcome ?? null,
    })
    return result
  }

  /** What a resumed run should do with a key it has seen. */
  recoveryFor(idempotencyKey: string): { known: boolean; recovery: RecoveryClassification; safeToRetry: boolean } {
    const record = this.#dispatched.get(idempotencyKey)
    if (!record) return { known: false, recovery: 'not_applicable', safeToRetry: true }
    const recovery = record.result.recovery
    // Indeterminate is never safe to retry automatically. That is the point.
    return { known: true, recovery, safeToRetry: recovery === 'not_applicable' && record.receipt?.outcome === 'succeeded' }
  }
}

export type { Sha256 }
