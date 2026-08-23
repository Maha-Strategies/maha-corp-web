import type { GovernanceDecision, GovernanceTransport } from '../governance/envelope.ts'
import type { RecoveryClassification, Sha256 } from '../governed-workflow/types.ts'

/**
 * A protocol-neutral interface between an MCP gateway and Maha's governance
 * layer.
 *
 * Deliberately not shaped like any particular gateway. The gateway keeps its
 * own authentication, sandboxing and audit log; this layer answers one
 * question — may this action proceed, and on what recorded basis — and hands
 * back something the gateway can enforce with its existing machinery.
 *
 * Nothing here dispatches. The gateway supplies its own dispatch callback and
 * this layer decides whether to invoke it, which is what makes a denial
 * enforceable rather than advisory.
 */

export const GATEWAY_INTEROP_VERSION = '1.0.0'

/** The three answers a gateway can act on. */
export type GatewayDecision = 'allow' | 'deny' | 'approval_required'

/**
 * One inbound tool or action call, in gateway-neutral form.
 *
 * An MCP `tools/call` maps onto this directly; so does an A2A task and an HTTP
 * action. The adapter in `adapter.ts` does that translation for MCP without
 * this type knowing MCP exists.
 */
export type GatewayActionRequest = {
  /** Correlation id from the gateway. Echoed back, never interpreted. */
  requestId: string
  /** Stable across retries of the same intended effect. */
  idempotencyKey: string
  tenantId: string
  /** The calling agent's identity, as the gateway already knows it. */
  agentId: string
  transport: GovernanceTransport
  /** The upstream the gateway would dispatch to. */
  targetId: string
  /** Resource the action addresses. An https URL under the governance rules. */
  resource: string
  /** The operation name — for MCP, the JSON-RPC method. */
  operation: string
  /** The tool or skill, where the protocol distinguishes it from the method. */
  capability?: string
  /**
   * A digest of the arguments, supplied by the gateway.
   *
   * The arguments themselves never cross this boundary. A gateway that wants
   * the decision bound to its payload hashes the payload; this layer stores the
   * commitment and never the content.
   */
  inputSha256: Sha256
  inputBytes: number
  /** Evidence the action relies on, as references. Digests, never documents. */
  evidence?: GatewayEvidenceReference[]
  execution: { hopCount: number; timeoutMs: number }
  /** Present only where the gateway has already settled payment elsewhere. */
  payment?: { status: 'not_required' | 'authorized' | 'denied' | 'not_checked'; buyerPolicyId?: string }
}

/** An evidence reference. Bounded metadata; no document content. */
export type GatewayEvidenceReference = {
  evidenceId: string
  contentSha256: Sha256
}

/**
 * What the gateway gets back.
 *
 * Everything a gateway needs to enforce and to write its own audit row, and
 * nothing it would have to strip before writing one.
 */
export type GatewayActionResult = {
  interopVersion: typeof GATEWAY_INTEROP_VERSION
  requestId: string
  decision: GatewayDecision
  /** Machine-readable, from the governance vocabulary. Never free text. */
  reasonCodes: string[]
  policy: { policyId: string | null; policyVersion: string | null; policySha256: string | null }
  evidence: {
    /** Commitment to the decision inputs, for the gateway's audit row. */
    envelopeSha256: string | null
    decisionSha256: string
    inputSha256: Sha256
    evidenceSetSha256: Sha256
    contentRetained: false
  }
  /** Present when decision is `approval_required`. */
  approval: {
    approvalId: string
    state: 'pending' | 'granted' | 'denied' | 'expired'
    /** What the approval is bound to. Changing any of it invalidates it. */
    boundTo: { policySha256: string; inputSha256: Sha256; evidenceSetSha256: Sha256 }
    expiresAt: string
  } | null
  /** Present when the action was authorized and dispatch was attempted. */
  dispatch: {
    attempted: boolean
    /** True when a prior call with this key already produced this result. */
    idempotentReplay: boolean
    receipt: { receiptId: string; outcome: 'succeeded' | 'failed' | 'indeterminate'; observedAt: string } | null
  }
  /** How a resumed run should treat this record. */
  recovery: RecoveryClassification
  boundaries: GatewayBoundaries
}

/**
 * What this layer did and did not establish, stated on every result.
 *
 * A gateway operator integrating a decision service needs to know what it is
 * trusting. Leaving that to documentation means it is not in the audit row.
 */
export type GatewayBoundaries = {
  credentialsAccepted: false
  credentialsReturned: false
  sourceContentRetained: false
  providerCallsMade: 0
  paymentsInitiated: false
  /** Per-field: what this process checked versus what it took on trust. */
  verification: {
    envelopeStructure: 'locally_verified'
    policyEvaluation: 'locally_verified'
    approvalBinding: 'locally_verified'
    idempotency: 'locally_verified'
    inputDigest: 'trusted_pass_through'
    evidenceDigests: 'trusted_pass_through'
    callerIdentity: 'trusted_pass_through'
    dispatchExecution: 'not_established'
  }
  limitations: readonly string[]
}

/** The gateway's own executor. This layer calls it, or refuses to. */
export type GatewayDispatch = (authorized: {
  requestId: string
  idempotencyKey: string
  operation: string
  capability?: string
  targetId: string
  inputSha256: Sha256
}) => Promise<GatewayDispatchOutcome> | GatewayDispatchOutcome

export type GatewayDispatchOutcome = {
  outcome: 'succeeded' | 'failed' | 'indeterminate'
  receiptId: string
}

export type { GovernanceDecision }
