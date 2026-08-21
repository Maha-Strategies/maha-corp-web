import { createHmac, timingSafeEqual } from 'node:crypto'
import { governanceDigest, type GovernancePolicy } from '../governance/envelope.ts'
import { resolveGovernancePolicy, type GovernancePolicyLayer } from '../governance/policy-inheritance.ts'
import {
  GWSG_POLICY_MODEL_VERSION,
  type ActorIdentity,
  type GwsgReasonCode,
  type PermittedAction,
  type Sha256,
  type SignedPolicyException,
  type UncertaintyDeclaration,
  type UncertaintyStatus,
} from './types.ts'

/**
 * Policy for the governed workflow state graph.
 *
 * This is deliberately a thin layer over `resolveGovernancePolicy`. The
 * authorization framework already exists in `lib/governance`; duplicating it
 * here would create two answers to "is this allowed" that drift apart. What
 * this module adds is the four workflow scopes and the rule that unresolved
 * uncertainty cannot be silently ignored.
 */

/** Root → leaf. Order is the precedence: later layers may only restrict. */
export const GWSG_POLICY_SCOPES = ['tenant', 'workflow', 'instance', 'action'] as const
export type GwsgPolicyScope = (typeof GWSG_POLICY_SCOPES)[number]

export type GwsgPolicyChain = {
  /** Organization/tenant policy. The widest authority that can ever apply. */
  root: GovernancePolicy
  /** Workflow template, workflow instance, transition/action layers. */
  layers: GovernancePolicyLayer[]
}

export type ResolvedGwsgPolicy = {
  policy: GovernancePolicy
  policyVersion: string
  policySha256: Sha256
  policyModelVersion: typeof GWSG_POLICY_MODEL_VERSION
  /** Scopes that contributed, in precedence order, for audit. */
  scopeChain: GwsgPolicyScope[]
}

/**
 * Resolves the chain most-restrictive-wins.
 *
 * There is no override parameter. The only way to widen a resolved policy is a
 * signed exception object, checked separately at the transition — see
 * `verifyPolicyException`. A boolean flag here would be reachable from any
 * caller that can construct a request, which is the bypass this graph exists
 * to prevent.
 */
export function resolveGwsgPolicy(chain: GwsgPolicyChain): ResolvedGwsgPolicy {
  const ordered = [...chain.layers].sort(
    (a, b) => GWSG_POLICY_SCOPES.indexOf(a.scope as GwsgPolicyScope) - GWSG_POLICY_SCOPES.indexOf(b.scope as GwsgPolicyScope),
  )
  const policy = resolveGovernancePolicy(chain.root, ordered)
  return {
    policy,
    policyVersion: policy.policyVersion,
    policySha256: governanceDigest(policy) as Sha256,
    policyModelVersion: GWSG_POLICY_MODEL_VERSION,
    scopeChain: ['tenant', ...ordered.map((layer) => layer.scope as GwsgPolicyScope)],
  }
}

/**
 * Classifies declared uncertainty.
 *
 * `unresolved` is the state a caller reaches by declaring nothing while the
 * evidence set is incomplete. It is distinct from `none`, because "we checked
 * and there is nothing outstanding" and "nobody looked" must not both read as
 * a clear path to an automated decision.
 */
export function classifyUncertainty(
  uncertainties: UncertaintyDeclaration[],
  options: { evidenceComplete: boolean },
): UncertaintyStatus {
  if (uncertainties.some((entry) => entry.blocksAutomatedDecision)) return 'declared_blocking'
  if (!options.evidenceComplete) return 'unresolved'
  if (uncertainties.length > 0) return 'declared_non_blocking'
  return 'none'
}

export type PolicyEvaluation = {
  decision: 'allowed' | 'denied'
  reasonCodes: GwsgReasonCode[]
  uncertaintyStatus: UncertaintyStatus
  permittedActions: PermittedAction[]
  requiresApproval: boolean
}

/**
 * Evaluates one operation against the resolved policy and declared uncertainty.
 *
 * Order matters. Uncertainty is checked before the allow-list, so a blocking
 * declaration cannot be papered over by an operation that happens to be
 * permitted. A policy decision that ignores an unresolved question is the
 * failure mode this whole model is built against.
 */
export function evaluateTransitionPolicy(input: {
  resolved: ResolvedGwsgPolicy
  operation: string
  uncertainties: UncertaintyDeclaration[]
  evidenceComplete: boolean
}): PolicyEvaluation {
  const { resolved, operation } = input
  const uncertaintyStatus = classifyUncertainty(input.uncertainties, { evidenceComplete: input.evidenceComplete })
  const reasonCodes: GwsgReasonCode[] = []

  if (uncertaintyStatus === 'declared_blocking') reasonCodes.push('uncertainty_blocks_decision')
  if (uncertaintyStatus === 'unresolved') reasonCodes.push('uncertainty_unresolved')

  const operationAllowed = resolved.policy.allowedOperations.includes(operation)
  if (!operationAllowed) reasonCodes.push('policy_denied')

  // Review requirements are additive across the chain and can only be added by
  // a child layer, so this reflects the most restrictive answer in the chain.
  const requiresApproval = resolved.policy.review.operations.includes(operation)

  const decision = reasonCodes.length === 0 ? 'allowed' : 'denied'
  if (decision === 'allowed') reasonCodes.push('allowed')
  if (requiresApproval && decision === 'allowed') reasonCodes.push('approval_required')

  return {
    decision,
    reasonCodes,
    uncertaintyStatus,
    requiresApproval,
    permittedActions: [
      {
        actionId: `action-${operation}`,
        operation,
        requiresApproval,
        // Authorized only when policy allows *and* nothing is outstanding.
        // Approval, if required, is granted later; it cannot be assumed here.
        authorized: decision === 'allowed' && !requiresApproval,
      },
    ],
  }
}

/** Canonical body an exception signature covers. Excludes the signature itself. */
export function policyExceptionBody(exception: SignedPolicyException) {
  return {
    exceptionId: exception.exceptionId,
    issuedBy: exception.issuedBy,
    workflowInstanceId: exception.workflowInstanceId,
    transitionId: exception.transitionId,
    relaxes: exception.relaxes,
    expiresAt: exception.expiresAt,
  }
}

export function signPolicyException(exception: Omit<SignedPolicyException, 'signature'>, secret: string): SignedPolicyException {
  const body = policyExceptionBody({ ...exception, signature: '' })
  const signature = createHmac('sha256', secret).update(governanceDigest(body)).digest('hex')
  return { ...exception, signature }
}

/**
 * Verifies a signed exception against one specific transition.
 *
 * Every check is a hard failure rather than a warning: an exception that is
 * expired, misaddressed, or unsigned must not widen anything, because the only
 * reason to reach this code path is that the resolved policy already said no.
 */
export function verifyPolicyException(input: {
  exception: SignedPolicyException
  secret: string
  workflowInstanceId: string
  transitionId: string
  operation: string
  now: Date
}): { valid: boolean; reasonCode: GwsgReasonCode; issuedBy: ActorIdentity | null } {
  const { exception } = input
  const expected = createHmac('sha256', input.secret)
    .update(governanceDigest(policyExceptionBody(exception)))
    .digest('hex')
  const provided = exception.signature
  const signatureValid =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'))

  if (!signatureValid) return { valid: false, reasonCode: 'exception_invalid', issuedBy: null }
  if (exception.workflowInstanceId !== input.workflowInstanceId) return { valid: false, reasonCode: 'exception_invalid', issuedBy: null }
  if (exception.transitionId !== input.transitionId) return { valid: false, reasonCode: 'exception_invalid', issuedBy: null }
  if (exception.relaxes.operation !== input.operation) return { valid: false, reasonCode: 'exception_invalid', issuedBy: null }
  if (Date.parse(exception.expiresAt) <= input.now.getTime()) return { valid: false, reasonCode: 'exception_invalid', issuedBy: null }

  return { valid: true, reasonCode: 'allowed', issuedBy: exception.issuedBy }
}
