import type { BuyerPolicy } from '../x402/buyer-policy.ts'

export type A2AAuthType = 'bearer' | 'hmac' | 'none'

export type A2AAgentSkill = {
  id: string
  name: string
  description?: string
}

export type A2AAgentCardSummary = {
  name: string
  description: string
  protocolVersion: string
  rpcUrl: string
  skills: A2AAgentSkill[]
  digest: string
}

export type A2ATaskPolicy = {
  allowedMethods: string[]
  allowedTaskClasses: string[]
  maxTextBytes: number
}

export type A2AAgentConfig = {
  id: string
  tenantId: string
  name: string
  agentCardUrl: string
  rpcUrl: string
  authType: A2AAuthType
  authSecretEncrypted?: string
  status: 'active' | 'suspended'
  taskPolicy: A2ATaskPolicy
  paymentPolicy?: BuyerPolicy
  agentCard: A2AAgentCardSummary
  createdAt: number
}

export type A2AAgentSummary = Omit<A2AAgentConfig, 'tenantId' | 'authSecretEncrypted' | 'paymentPolicy'> & {
  paymentPolicy: {
    configured: boolean
    policyId?: string
    policyVersion?: string
  }
}

export type A2AJsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export type A2AJsonRpcResponse = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

