import { governanceDigest, type GovernancePolicy, type GovernanceTransport } from './envelope.ts'

const MAX_POLICY_DEPTH = 8

export type GovernancePolicyLayer = {
  policyId: string
  policyVersion: string
  parentPolicyId: string
  scope: 'tenant' | 'workflow' | 'action'
  constraints: {
    allowedTenantIds?: string[]
    allowedAgentIds?: string[]
    allowedTransports?: GovernanceTransport[]
    allowedTargetIds?: string[]
    allowedResources?: string[]
    allowedOperations?: string[]
    allowedCapabilities?: string[]
    maxInputBytes?: number
    maxHops?: number
    maxTimeoutMs?: number
    reviewOperations?: string[]
    reviewCapabilities?: string[]
    payment?: { mode: 'forbid' | 'delegate'; allowedBuyerPolicyIds?: string[] }
  }
}

function intersect<T>(parent: T[], child: T[] | undefined): T[] {
  if (child === undefined) return [...parent]
  const allowed = new Set(child)
  return parent.filter((value) => allowed.has(value))
}

function minimum(parent: number, child: number | undefined): number {
  return child === undefined ? parent : Math.min(parent, child)
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/**
 * Resolves a root-to-leaf policy chain. Child layers can only remove allowed
 * values, lower ceilings, add review requirements or forbid payment. A child
 * can never restore authority removed by an ancestor.
 */
export function resolveGovernancePolicy(root: GovernancePolicy, layers: GovernancePolicyLayer[] = []): GovernancePolicy {
  if (layers.length > MAX_POLICY_DEPTH) throw new Error(`Governance policy inheritance exceeds ${MAX_POLICY_DEPTH} layers.`)
  let policy: GovernancePolicy = structuredClone(root)
  let parentPolicyId = root.policyId
  const seen = new Set([root.policyId])

  for (const layer of layers) {
    if (seen.has(layer.policyId)) throw new Error('Governance policy inheritance contains a cycle or duplicate policy ID.')
    if (layer.parentPolicyId !== parentPolicyId) throw new Error('Governance policy inheritance is not a contiguous root-to-leaf chain.')
    if (!layer.policyId || !layer.policyVersion) throw new Error('Governance policy layer identity is required.')
    seen.add(layer.policyId)

    const constraints = layer.constraints
    const paymentMode = policy.payment.mode === 'forbid' || constraints.payment?.mode === 'forbid' ? 'forbid' : 'delegate'
    const allowedBuyerPolicyIds = paymentMode === 'forbid'
      ? []
      : intersect(policy.payment.allowedBuyerPolicyIds, constraints.payment?.allowedBuyerPolicyIds)
    const allowedOperations = intersect(policy.allowedOperations, constraints.allowedOperations)
    const allowedCapabilities = intersect(policy.allowedCapabilities, constraints.allowedCapabilities)
    policy = {
      ...policy,
      policyId: layer.policyId,
      policyVersion: governanceDigest({
        parentPolicyId, parentPolicyVersion: policy.policyVersion, layerPolicyId: layer.policyId,
        layerPolicyVersion: layer.policyVersion, scope: layer.scope, constraints,
      }),
      allowedTenantIds: intersect(policy.allowedTenantIds, constraints.allowedTenantIds),
      allowedAgentIds: intersect(policy.allowedAgentIds, constraints.allowedAgentIds),
      allowedTransports: intersect(policy.allowedTransports, constraints.allowedTransports),
      allowedTargetIds: intersect(policy.allowedTargetIds, constraints.allowedTargetIds),
      allowedResources: intersect(policy.allowedResources, constraints.allowedResources),
      allowedOperations,
      allowedCapabilities,
      maxInputBytes: minimum(policy.maxInputBytes, constraints.maxInputBytes),
      maxHops: minimum(policy.maxHops, constraints.maxHops),
      maxTimeoutMs: minimum(policy.maxTimeoutMs, constraints.maxTimeoutMs),
      review: {
        operations: unique([...policy.review.operations, ...(constraints.reviewOperations ?? [])]).filter((value) => allowedOperations.includes(value)),
        capabilities: unique([...policy.review.capabilities, ...(constraints.reviewCapabilities ?? [])]).filter((value) => allowedCapabilities.includes(value)),
      },
      payment: { mode: paymentMode, allowedBuyerPolicyIds },
    }
    parentPolicyId = layer.policyId
  }
  return policy
}
