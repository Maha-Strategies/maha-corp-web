import {
  evaluateGovernedAction, governanceDigest,
  type GovernanceDecision, type GovernanceEnvelope, type GovernancePolicy,
} from '../governance/envelope.ts'
import { resolveGovernancePolicy, type GovernancePolicyLayer } from '../governance/policy-inheritance.ts'
import { GwsgEngine } from '../governed-workflow/engine.ts'
import { evidenceSetDigest } from '../governed-workflow/evidence.ts'
import type { ApprovalBinding, Sha256 } from '../governed-workflow/types.ts'
import { GATEWAY_INTEROP_VERSION, type GatewayActionRequest, type GatewayBoundaries, type GatewayDecision } from './types.ts'

/**
 * The governance half: envelope construction, decision, and approval binding.
 *
 * There is no allow/deny logic in this file. Every authority question is
 * answered by `evaluateGovernedAction`, and every inheritance question by
 * `resolveGovernancePolicy` — both already in `lib/governance`. Writing a
 * second policy engine here would give two answers to "may this proceed" that
 * drift apart, and the one in the gateway path would be the one nobody audited.
 */

/** Two different questions, deliberately kept apart. */
export const GOVERNANCE_LAYERING_NOTE =
  'Action authority comes from the governance envelope. Workflow legality — which transition may follow which — comes from the state graph. Conflating them would let a legal transition imply an authorised action.'

export type GatewayPolicyChain = {
  root: GovernancePolicy
  layers?: GovernancePolicyLayer[]
}

const LIMITATIONS = [
  'The decision binds a digest of the arguments, not the arguments. A caller that supplies a digest for bytes it does not hold is not detectable here.',
  'Caller identity is taken from the gateway. This layer does not authenticate anyone.',
  'Dispatch execution is the gateway\'s. A receipt records what the gateway observed, not what an upstream actually did.',
  'No provider is contacted and no payment is possible, so nothing here reflects upstream behaviour.',
  'This is an evaluation-grade reference layer, not an audited control.',
] as const

export function gatewayBoundaries(): GatewayBoundaries {
  return {
    credentialsAccepted: false,
    credentialsReturned: false,
    sourceContentRetained: false,
    providerCallsMade: 0,
    paymentsInitiated: false,
    verification: {
      envelopeStructure: 'locally_verified',
      policyEvaluation: 'locally_verified',
      approvalBinding: 'locally_verified',
      idempotency: 'locally_verified',
      inputDigest: 'trusted_pass_through',
      evidenceDigests: 'trusted_pass_through',
      callerIdentity: 'trusted_pass_through',
      dispatchExecution: 'not_established',
    },
    limitations: LIMITATIONS,
  }
}

/**
 * Builds the governance envelope from a neutral request.
 *
 * The validity window is derived from the request's own timeout rather than a
 * fixed constant, so an envelope cannot outlive the call it authorises.
 */
export function buildGovernanceEnvelope(request: GatewayActionRequest, now: Date): GovernanceEnvelope {
  return {
    schemaVersion: '0.1.0',
    requestId: request.requestId,
    taskId: request.idempotencyKey,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + request.execution.timeoutMs).toISOString(),
    subject: { tenantId: request.tenantId, agentId: request.agentId },
    action: {
      transport: request.transport,
      targetId: request.targetId,
      resource: request.resource,
      operation: request.operation,
      ...(request.capability ? { capability: request.capability } : {}),
    },
    context: { inputSha256: request.inputSha256, inputBytes: request.inputBytes, contentRetained: false },
    execution: { hopCount: request.execution.hopCount, timeoutMs: request.execution.timeoutMs },
    payment: { status: request.payment?.status ?? 'not_required', ...(request.payment?.buyerPolicyId ? { buyerPolicyId: request.payment.buyerPolicyId } : {}) },
  }
}

export function resolveGatewayPolicy(chain: GatewayPolicyChain): GovernancePolicy {
  return resolveGovernancePolicy(chain.root, chain.layers ?? [])
}

/** Maps the governance vocabulary onto the three answers a gateway can act on. */
export function toGatewayDecision(outcome: GovernanceDecision['outcome']): GatewayDecision {
  if (outcome === 'proceed') return 'allow'
  if (outcome === 'require_review') return 'approval_required'
  return 'deny'
}

export function evidenceDigestFor(request: GatewayActionRequest): Sha256 {
  // Reuses the workflow evidence-set digest so an approval granted here and an
  // approval granted in a workflow bind to the same value for the same set.
  return evidenceSetDigest(
    (request.evidence ?? []).map((entry) => ({
      evidenceId: entry.evidenceId,
      kind: 'external_attestation' as const,
      contentSha256: entry.contentSha256,
      contentBytes: 0,
      provenance: {
        structureVerifiedLocally: true, digestFormatVerified: true,
        trustedPassThrough: ['contentSha256'],
        sourceAuthenticityVerified: false, factualTruthEstablished: false, providerExecutionVerified: false,
      },
      labels: {},
    })),
  )
}

/**
 * The binding an approval is addressed by.
 *
 * Content-addressed, so a changed policy, input or evidence set produces a
 * different approval id. A stale approval is therefore not overridden — it is
 * not found, which is a much harder failure to get wrong.
 */
export function approvalBindingFor(input: {
  request: GatewayActionRequest
  policySha256: string
  policyVersion: string
  evidenceSetSha256: Sha256
}): ApprovalBinding {
  return {
    workflowInstanceId: `gateway-${input.request.idempotencyKey}`,
    transitionId: `gateway-action-${input.request.operation}`,
    policyVersion: input.policyVersion,
    policySha256: input.policySha256 as Sha256,
    inputSha256: input.request.inputSha256,
    evidenceSetSha256: input.evidenceSetSha256,
  }
}

export function approvalIdFor(binding: ApprovalBinding): string {
  // Reused rather than reimplemented: the workflow engine already derives an
  // approval identity from a binding, and two derivations would eventually
  // disagree about whether an approval applies.
  return GwsgEngine.approvalIdFor(binding)
}

export type GatewayEvaluation = {
  decision: GatewayDecision
  governance: GovernanceDecision
  envelope: GovernanceEnvelope
  policy: GovernancePolicy
  evidenceSetSha256: Sha256
  binding: ApprovalBinding
  decisionSha256: string
}

/** One deterministic evaluation. No side effects, no dispatch, no clockless guessing. */
export function evaluateGatewayAction(input: {
  request: GatewayActionRequest
  chain: GatewayPolicyChain
  now: Date
}): GatewayEvaluation {
  const policy = resolveGatewayPolicy(input.chain)
  const envelope = buildGovernanceEnvelope(input.request, input.now)
  const governance = evaluateGovernedAction(policy, envelope, input.now)
  const evidenceSetSha256 = evidenceDigestFor(input.request)
  const binding = approvalBindingFor({
    request: input.request,
    policySha256: governance.policy.policySha256 ?? governanceDigest(policy),
    policyVersion: governance.policy.policyVersion ?? policy.policyVersion,
    evidenceSetSha256,
  })
  return {
    decision: toGatewayDecision(governance.outcome),
    governance, envelope, policy, evidenceSetSha256, binding,
    decisionSha256: governanceDigest({ interopVersion: GATEWAY_INTEROP_VERSION, governance, evidenceSetSha256 }),
  }
}
