import { MAX_MCP_GATEWAY_BODY_BYTES } from '../mcp-gateway.ts'
import type { A2AAgentConfig, A2AJsonRpcRequest } from '../a2a/types.ts'
import type { JSONRPCRequest, MCPProxyContext, MCPServerConfig } from '../mcp/types.ts'
import type { PaymentAuthorization } from '../x402/buyer-policy.ts'
import { evaluateGovernedAction, governanceDigest, type GovernanceDecision, type GovernanceEnvelope, type GovernancePolicy } from './envelope.ts'

export const GOVERNANCE_OUTCOME_HEADER = 'X-Maha-Governance-Outcome'
export const GOVERNANCE_EVIDENCE_HEADER = 'X-Maha-Governance-Evidence'
export const GOVERNANCE_POLICY_HEADER = 'X-Maha-Governance-Policy'

const A2A_GATEWAY_PRINCIPAL = 'maha.gateway.a2a'
const MCP_GATEWAY_PRINCIPAL = 'maha.gateway.mcp'

function validityWindow(now: Date, timeoutMs: number) {
  return { issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + timeoutMs).toISOString() }
}

function paymentAttestation(authorization: PaymentAuthorization | null): GovernanceEnvelope['payment'] {
  if (!authorization) return { status: 'not_required' }
  return {
    status: 'authorized',
    buyerPolicyId: authorization.policyId,
    buyerPolicyVersion: authorization.policyVersion,
    buyerDecisionCode: authorization.code,
    authorizationSha256: governanceDigest(authorization),
  }
}

export function governanceResponseHeaders(decision: GovernanceDecision): Record<string, string> {
  return {
    [GOVERNANCE_OUTCOME_HEADER]: decision.outcome,
    [GOVERNANCE_EVIDENCE_HEADER]: decision.evidenceSha256,
    ...(decision.policy.policySha256 ? { [GOVERNANCE_POLICY_HEADER]: decision.policy.policySha256 } : {}),
  }
}

export function evaluateA2AGovernance(input: {
  config: A2AAgentConfig
  request: A2AJsonRpcRequest
  tenantId: string
  traceId: string
  taskId: string
  taskClass: string | null
  inputBytes: number
  timeoutMs: number
  paymentAuthorization: PaymentAuthorization | null
  now?: Date
}): GovernanceDecision {
  const now = input.now ?? new Date()
  const policyVersion = governanceDigest({
    agentCardDigest: input.config.agentCard.digest,
    taskPolicy: input.config.taskPolicy,
    buyerPolicy: input.config.paymentPolicy
      ? { policyId: input.config.paymentPolicy.policyId, policyVersion: input.config.paymentPolicy.policyVersion }
      : null,
  })
  const policy: GovernancePolicy = {
    schemaVersion: '0.1.0',
    policyId: `governance.a2a.${input.config.id}`,
    policyVersion,
    allowedTenantIds: [input.config.tenantId],
    allowedAgentIds: [A2A_GATEWAY_PRINCIPAL],
    allowedTransports: ['a2a'],
    allowedTargetIds: [input.config.id],
    allowedResources: [input.config.rpcUrl],
    allowedOperations: input.config.taskPolicy.allowedMethods,
    allowedCapabilities: input.config.taskPolicy.allowedTaskClasses,
    maxInputBytes: input.config.taskPolicy.maxTextBytes,
    maxHops: 1,
    maxTimeoutMs: input.timeoutMs,
    review: { operations: [], capabilities: [] },
    payment: input.config.paymentPolicy
      ? { mode: 'delegate', allowedBuyerPolicyIds: [input.config.paymentPolicy.policyId] }
      : { mode: 'forbid', allowedBuyerPolicyIds: [] },
  }
  const envelope: GovernanceEnvelope = {
    schemaVersion: '0.1.0',
    requestId: input.traceId,
    taskId: input.taskId,
    ...validityWindow(now, input.timeoutMs),
    subject: { tenantId: input.tenantId, agentId: A2A_GATEWAY_PRINCIPAL },
    action: {
      transport: 'a2a',
      targetId: input.config.id,
      resource: input.config.rpcUrl,
      operation: input.request.method,
      ...(input.taskClass ? { capability: input.taskClass } : {}),
    },
    context: { inputSha256: governanceDigest(input.request.params ?? {}), inputBytes: input.inputBytes, contentRetained: false },
    execution: { hopCount: 1, timeoutMs: input.timeoutMs },
    payment: paymentAttestation(input.paymentAuthorization),
  }
  return evaluateGovernedAction(policy, envelope, now)
}

export function evaluateMcpGovernance(input: {
  server: MCPServerConfig
  request: JSONRPCRequest
  context: MCPProxyContext
  timeoutMs: number
  now?: Date
}): GovernanceDecision {
  const now = input.now ?? new Date()
  const capability = input.request.method === 'tools/call' && typeof input.request.params?.name === 'string'
    ? input.request.params.name
    : null
  const policy: GovernancePolicy = {
    schemaVersion: '0.1.0',
    policyId: `governance.mcp.${input.server.id}`,
    policyVersion: governanceDigest({
      allowedMethods: input.server.allowedMethods,
      allowedToolNames: input.server.allowedToolNames,
      policyMode: input.server.policyMode,
      status: input.server.status,
    }),
    allowedTenantIds: [input.server.tenantId],
    allowedAgentIds: [MCP_GATEWAY_PRINCIPAL],
    allowedTransports: ['mcp'],
    allowedTargetIds: [input.server.id],
    allowedResources: [input.server.baseUrl],
    allowedOperations: input.server.allowedMethods,
    allowedCapabilities: input.server.allowedToolNames,
    maxInputBytes: MAX_MCP_GATEWAY_BODY_BYTES,
    maxHops: 1,
    maxTimeoutMs: input.timeoutMs,
    review: { operations: [], capabilities: [] },
    payment: { mode: 'forbid', allowedBuyerPolicyIds: [] },
  }
  const envelope: GovernanceEnvelope = {
    schemaVersion: '0.1.0',
    requestId: input.context.traceId,
    taskId: input.context.taskId ?? input.context.traceId,
    ...validityWindow(now, input.timeoutMs),
    subject: { tenantId: input.context.tenantId, agentId: MCP_GATEWAY_PRINCIPAL },
    action: {
      transport: 'mcp',
      targetId: input.server.id,
      resource: input.server.baseUrl,
      operation: input.request.method,
      ...(capability ? { capability } : {}),
    },
    context: {
      inputSha256: input.context.inputSha256 ?? governanceDigest(input.request),
      inputBytes: input.context.inputBytes ?? new TextEncoder().encode(JSON.stringify(input.request)).byteLength,
      contentRetained: false,
    },
    execution: { hopCount: 1, timeoutMs: input.timeoutMs },
    payment: { status: 'not_required' },
  }
  return evaluateGovernedAction(policy, envelope, now)
}
