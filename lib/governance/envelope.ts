import { createHash } from 'node:crypto'
import canonicalize from 'canonicalize'

export const GOVERNANCE_SCHEMA_VERSION = '0.1.0' as const

export type GovernanceTransport = 'a2a' | 'mcp' | 'http-x402'
export type GovernanceOutcome = 'proceed' | 'require_review' | 'deny'

export type GovernanceEnvelope = {
  schemaVersion: typeof GOVERNANCE_SCHEMA_VERSION
  requestId: string
  taskId: string
  issuedAt: string
  expiresAt: string
  subject: {
    tenantId: string
    agentId: string
  }
  action: {
    transport: GovernanceTransport
    targetId: string
    resource: string
    operation: string
    capability?: string
  }
  context: {
    inputSha256: string
    inputBytes: number
    contentRetained: false
  }
  execution: {
    hopCount: number
    timeoutMs: number
  }
  payment: {
    status: 'not_required' | 'authorized' | 'denied' | 'not_checked'
    buyerPolicyId?: string
    buyerPolicyVersion?: string
    buyerDecisionCode?: string
    authorizationSha256?: string
  }
}

export type GovernancePolicy = {
  schemaVersion: typeof GOVERNANCE_SCHEMA_VERSION
  policyId: string
  policyVersion: string
  allowedTenantIds: string[]
  allowedAgentIds: string[]
  allowedTransports: GovernanceTransport[]
  allowedTargetIds: string[]
  allowedResources: string[]
  allowedOperations: string[]
  allowedCapabilities: string[]
  maxInputBytes: number
  maxHops: number
  maxTimeoutMs: number
  review: {
    operations: string[]
    capabilities: string[]
  }
  payment: {
    mode: 'forbid' | 'delegate'
    allowedBuyerPolicyIds: string[]
  }
}

export type GovernanceReasonCode =
  | 'policy_invalid'
  | 'envelope_invalid'
  | 'envelope_expired'
  | 'envelope_not_yet_valid'
  | 'tenant_not_allowed'
  | 'agent_not_allowed'
  | 'transport_not_allowed'
  | 'target_not_allowed'
  | 'resource_not_allowed'
  | 'operation_not_allowed'
  | 'capability_not_allowed'
  | 'input_limit_exceeded'
  | 'hop_limit_exceeded'
  | 'timeout_limit_exceeded'
  | 'payment_forbidden'
  | 'payment_not_authorized'
  | 'buyer_policy_not_allowed'
  | 'human_review_required'
  | 'allowed'

export type GovernanceDecision = {
  schemaVersion: typeof GOVERNANCE_SCHEMA_VERSION
  outcome: GovernanceOutcome
  reasonCodes: GovernanceReasonCode[]
  policy: {
    policyId: string | null
    policyVersion: string | null
    policySha256: string | null
  }
  request: {
    requestId: string | null
    taskId: string | null
    envelopeSha256: string | null
  }
  evaluatedAt: string
  evidenceSha256: string
  evidence: {
    contentRetained: false
    paymentEvaluatedBy: 'not_required' | 'maha-x402-buyer-policy' | 'not_evaluated'
  }
}

const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/
const OPERATION = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/
const MAX_SAFE_BOUND = 2_147_483_647
const TRANSPORTS = new Set<GovernanceTransport>(['a2a', 'mcp', 'http-x402'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional])
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key))
}

function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && BOUNDED_ID.test(value)
}

function isOperation(value: unknown): value is string {
  return typeof value === 'string' && OPERATION.test(value)
}

function isUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false
  return Number.isFinite(Date.parse(value))
}

function isPublicHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && url.toString() === value
  } catch {
    return false
  }
}

function isBoundedInteger(value: unknown, minimum: number): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= minimum && value <= MAX_SAFE_BOUND
}

function isUniqueStringList(value: unknown, validator: (item: unknown) => item is string, allowEmpty = false): value is string[] {
  return Array.isArray(value)
    && (allowEmpty || value.length > 0)
    && value.length <= 100
    && value.every(validator)
    && new Set(value).size === value.length
}

function digest(value: unknown): string {
  const canonical = canonicalize(value)
  if (canonical === undefined) throw new Error('Value cannot be canonicalized.')
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`
}

export function governanceDigest(value: unknown): string {
  return digest(value)
}

function validPayment(value: unknown): value is GovernanceEnvelope['payment'] {
  if (!isRecord(value) || !exactKeys(value, ['status'], ['buyerPolicyId', 'buyerPolicyVersion', 'buyerDecisionCode', 'authorizationSha256'])) return false
  if (!['not_required', 'authorized', 'denied', 'not_checked'].includes(String(value.status))) return false
  const optionalStrings = ['buyerPolicyId', 'buyerPolicyVersion', 'buyerDecisionCode'] as const
  if (optionalStrings.some((key) => value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length < 1 || value[key].length > 200))) return false
  if (value.authorizationSha256 !== undefined && (typeof value.authorizationSha256 !== 'string' || !SHA256.test(value.authorizationSha256))) return false
  if (value.status === 'authorized') {
    return isBoundedId(value.buyerPolicyId) && typeof value.buyerPolicyVersion === 'string' && value.buyerPolicyVersion.length <= 100
      && value.buyerDecisionCode === 'allowed' && typeof value.authorizationSha256 === 'string' && SHA256.test(value.authorizationSha256)
  }
  return value.buyerPolicyId === undefined && value.buyerPolicyVersion === undefined && value.authorizationSha256 === undefined
}

export function isGovernanceEnvelope(value: unknown): value is GovernanceEnvelope {
  if (!isRecord(value) || !exactKeys(value, ['schemaVersion', 'requestId', 'taskId', 'issuedAt', 'expiresAt', 'subject', 'action', 'context', 'execution', 'payment'])) return false
  if (value.schemaVersion !== GOVERNANCE_SCHEMA_VERSION || !isBoundedId(value.requestId) || !isBoundedId(value.taskId)) return false
  if (!isUtcInstant(value.issuedAt) || !isUtcInstant(value.expiresAt) || Date.parse(value.expiresAt) <= Date.parse(value.issuedAt)) return false

  const subject = value.subject
  if (!isRecord(subject) || !exactKeys(subject, ['tenantId', 'agentId']) || !isBoundedId(subject.tenantId) || !isBoundedId(subject.agentId)) return false

  const action = value.action
  if (!isRecord(action) || !exactKeys(action, ['transport', 'targetId', 'resource', 'operation'], ['capability'])) return false
  if (!TRANSPORTS.has(action.transport as GovernanceTransport) || !isBoundedId(action.targetId) || !isPublicHttpsUrl(action.resource) || !isOperation(action.operation)) return false
  if (action.capability !== undefined && !isOperation(action.capability)) return false

  const context = value.context
  if (!isRecord(context) || !exactKeys(context, ['inputSha256', 'inputBytes', 'contentRetained'])) return false
  if (typeof context.inputSha256 !== 'string' || !SHA256.test(context.inputSha256) || !isBoundedInteger(context.inputBytes, 0) || context.contentRetained !== false) return false

  const execution = value.execution
  if (!isRecord(execution) || !exactKeys(execution, ['hopCount', 'timeoutMs'])) return false
  if (!isBoundedInteger(execution.hopCount, 0) || !isBoundedInteger(execution.timeoutMs, 1)) return false

  return validPayment(value.payment)
}

export function isGovernancePolicy(value: unknown): value is GovernancePolicy {
  if (!isRecord(value) || !exactKeys(value, [
    'schemaVersion', 'policyId', 'policyVersion', 'allowedTenantIds', 'allowedAgentIds', 'allowedTransports', 'allowedTargetIds', 'allowedResources',
    'allowedOperations', 'allowedCapabilities', 'maxInputBytes', 'maxHops', 'maxTimeoutMs', 'review', 'payment',
  ])) return false
  if (value.schemaVersion !== GOVERNANCE_SCHEMA_VERSION || !isBoundedId(value.policyId)) return false
  if (typeof value.policyVersion !== 'string' || value.policyVersion.length < 1 || value.policyVersion.length > 100) return false
  if (!isUniqueStringList(value.allowedTenantIds, isBoundedId) || !isUniqueStringList(value.allowedAgentIds, isBoundedId)) return false
  if (!Array.isArray(value.allowedTransports) || value.allowedTransports.length < 1 || value.allowedTransports.length > TRANSPORTS.size || !value.allowedTransports.every((item) => TRANSPORTS.has(item)) || new Set(value.allowedTransports).size !== value.allowedTransports.length) return false
  const allowedOperations = value.allowedOperations
  const allowedCapabilities = value.allowedCapabilities
  if (!isUniqueStringList(value.allowedTargetIds, isBoundedId) || !isUniqueStringList(value.allowedResources, isPublicHttpsUrl) || !isUniqueStringList(allowedOperations, isOperation)) return false
  if (!isUniqueStringList(allowedCapabilities, isOperation, true)) return false
  if (!isBoundedInteger(value.maxInputBytes, 0) || !isBoundedInteger(value.maxHops, 0) || !isBoundedInteger(value.maxTimeoutMs, 1)) return false

  const review = value.review
  if (!isRecord(review) || !exactKeys(review, ['operations', 'capabilities'])) return false
  if (!isUniqueStringList(review.operations, isOperation, true) || !isUniqueStringList(review.capabilities, isOperation, true)) return false
  if (!review.operations.every((item) => allowedOperations.includes(item)) || !review.capabilities.every((item) => allowedCapabilities.includes(item))) return false

  const payment = value.payment
  if (!isRecord(payment) || !exactKeys(payment, ['mode', 'allowedBuyerPolicyIds'])) return false
  if (payment.mode !== 'forbid' && payment.mode !== 'delegate') return false
  if (!isUniqueStringList(payment.allowedBuyerPolicyIds, isBoundedId, payment.mode === 'forbid')) return false
  if (payment.mode === 'forbid' && payment.allowedBuyerPolicyIds.length !== 0) return false
  return true
}

function makeDecision(input: {
  outcome: GovernanceOutcome
  reasonCodes: GovernanceReasonCode[]
  policy: GovernancePolicy | null
  envelope: GovernanceEnvelope | null
  evaluatedAt: string
}): GovernanceDecision {
  const paymentEvaluatedBy: GovernanceDecision['evidence']['paymentEvaluatedBy'] = input.envelope?.payment.status === 'authorized'
    ? 'maha-x402-buyer-policy'
    : input.envelope?.payment.status === 'not_required' ? 'not_required' : 'not_evaluated'
  const evidence = {
    schemaVersion: GOVERNANCE_SCHEMA_VERSION,
    outcome: input.outcome,
    reasonCodes: input.reasonCodes,
    policy: {
      policyId: input.policy?.policyId ?? null,
      policyVersion: input.policy?.policyVersion ?? null,
      policySha256: input.policy ? digest(input.policy) : null,
    },
    request: {
      requestId: input.envelope?.requestId ?? null,
      taskId: input.envelope?.taskId ?? null,
      envelopeSha256: input.envelope ? digest(input.envelope) : null,
    },
    evaluatedAt: input.evaluatedAt,
    evidence: { contentRetained: false as const, paymentEvaluatedBy },
  }
  return { ...evidence, evidenceSha256: digest(evidence) }
}

/**
 * Deterministic, side-effect-free preflight shared by A2A, MCP and x402
 * adapters. Payment authorization remains the responsibility of the existing
 * x402 buyer-policy module; this layer only verifies its bound attestation.
 */
export function evaluateGovernedAction(policyValue: unknown, envelopeValue: unknown, now = new Date()): GovernanceDecision {
  const evaluatedAt = now.toISOString()
  const policy = isGovernancePolicy(policyValue) ? policyValue : null
  const envelope = isGovernanceEnvelope(envelopeValue) ? envelopeValue : null
  if (!policy) return makeDecision({ outcome: 'deny', reasonCodes: ['policy_invalid'], policy: null, envelope, evaluatedAt })
  if (!envelope) return makeDecision({ outcome: 'deny', reasonCodes: ['envelope_invalid'], policy, envelope: null, evaluatedAt })

  const denials: GovernanceReasonCode[] = []
  if (Date.parse(envelope.issuedAt) > now.getTime()) denials.push('envelope_not_yet_valid')
  if (Date.parse(envelope.expiresAt) <= now.getTime()) denials.push('envelope_expired')
  if (!policy.allowedTenantIds.includes(envelope.subject.tenantId)) denials.push('tenant_not_allowed')
  if (!policy.allowedAgentIds.includes(envelope.subject.agentId)) denials.push('agent_not_allowed')
  if (!policy.allowedTransports.includes(envelope.action.transport)) denials.push('transport_not_allowed')
  if (!policy.allowedTargetIds.includes(envelope.action.targetId)) denials.push('target_not_allowed')
  if (!policy.allowedResources.includes(envelope.action.resource)) denials.push('resource_not_allowed')
  if (!policy.allowedOperations.includes(envelope.action.operation)) denials.push('operation_not_allowed')
  if (envelope.action.capability && !policy.allowedCapabilities.includes(envelope.action.capability)) denials.push('capability_not_allowed')
  if (envelope.context.inputBytes > policy.maxInputBytes) denials.push('input_limit_exceeded')
  if (envelope.execution.hopCount > policy.maxHops) denials.push('hop_limit_exceeded')
  if (envelope.execution.timeoutMs > policy.maxTimeoutMs) denials.push('timeout_limit_exceeded')

  if (policy.payment.mode === 'forbid' && envelope.payment.status !== 'not_required') denials.push('payment_forbidden')
  if (policy.payment.mode === 'delegate' && envelope.payment.status !== 'not_required') {
    if (envelope.payment.status !== 'authorized') denials.push('payment_not_authorized')
    else if (!policy.payment.allowedBuyerPolicyIds.includes(envelope.payment.buyerPolicyId!)) denials.push('buyer_policy_not_allowed')
  }

  if (denials.length > 0) return makeDecision({ outcome: 'deny', reasonCodes: denials, policy, envelope, evaluatedAt })

  const reviewRequired = policy.review.operations.includes(envelope.action.operation)
    || Boolean(envelope.action.capability && policy.review.capabilities.includes(envelope.action.capability))
  return makeDecision({
    outcome: reviewRequired ? 'require_review' : 'proceed',
    reasonCodes: [reviewRequired ? 'human_review_required' : 'allowed'],
    policy,
    envelope,
    evaluatedAt,
  })
}
