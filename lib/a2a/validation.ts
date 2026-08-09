import { createHash } from 'node:crypto'
import { parsePublicUpstreamUrl } from '../mcp-gateway.ts'
import type { A2AAgentCardSummary, A2AJsonRpcRequest, A2ATaskPolicy } from './types.ts'
import type { BuyerPolicy } from '../x402/buyer-policy.ts'
import { evaluatePaymentIntent } from '../x402/buyer-policy.ts'

export const A2A_SUPPORTED_METHODS = Object.freeze([
  // A2A v0.3 JSON-RPC binding.
  'message/send', 'tasks/get', 'tasks/cancel',
  // A2A v1 JSON-RPC binding.
  'SendMessage', 'GetTask', 'CancelTask',
] as const)

export const DEFAULT_A2A_METHODS = ['message/send', 'tasks/get', 'tasks/cancel']
const SUPPORTED = new Set<string>(A2A_SUPPORTED_METHODS)
const TASK_CLASS = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const MAX_SKILLS = 256

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > maximum) throw new Error(`${field} is invalid.`)
  return value.trim()
}

export function parseA2AAgentCard(value: unknown): A2AAgentCardSummary {
  if (!object(value)) throw new Error('Agent Card must be a JSON object.')
  const name = boundedString(value.name, 'Agent Card name', 200)
  const description = boundedString(value.description, 'Agent Card description', 4_000)
  const interfaces = Array.isArray(value.supportedInterfaces) ? value.supportedInterfaces : []
  const jsonRpcInterface = interfaces.find((candidate) => object(candidate) && String(candidate.protocolBinding).toUpperCase() === 'JSONRPC')
  const rpcUrl = parsePublicUpstreamUrl(
    object(jsonRpcInterface) ? jsonRpcInterface.url : value.url,
  )
  const protocolVersion = typeof (object(jsonRpcInterface) ? jsonRpcInterface.protocolVersion : value.protocolVersion) === 'string'
    ? String(object(jsonRpcInterface) ? jsonRpcInterface.protocolVersion : value.protocolVersion)
    : '0.3.0'
  if (protocolVersion.length > 32) throw new Error('Agent Card protocol version is invalid.')
  if (!Array.isArray(value.skills) || value.skills.length < 1 || value.skills.length > MAX_SKILLS) throw new Error('Agent Card must declare one to 256 skills.')
  const seen = new Set<string>()
  const skills = value.skills.map((candidate) => {
    if (!object(candidate)) throw new Error('Agent Card contains an invalid skill.')
    const id = boundedString(candidate.id, 'Agent skill ID', 128)
    if (!TASK_CLASS.test(id) || seen.has(id)) throw new Error('Agent Card contains an invalid or duplicate skill ID.')
    seen.add(id)
    const skillName = boundedString(candidate.name, 'Agent skill name', 200)
    const skillDescription = candidate.description === undefined ? undefined : boundedString(candidate.description, 'Agent skill description', 4_000)
    return { id, name: skillName, ...(skillDescription ? { description: skillDescription } : {}) }
  })
  const digest = `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
  return { name, description, protocolVersion, rpcUrl, skills, digest }
}

export function parseA2ATaskPolicy(value: unknown, discoveredSkills: string[]): A2ATaskPolicy {
  if (!object(value)) throw new Error('taskPolicy must be an object.')
  if (!Array.isArray(value.allowedMethods) || value.allowedMethods.length < 1 || value.allowedMethods.length > A2A_SUPPORTED_METHODS.length) throw new Error('allowedMethods must contain one or more supported A2A methods.')
  const allowedMethods = value.allowedMethods.map((method) => {
    if (typeof method !== 'string' || !SUPPORTED.has(method)) throw new Error('allowedMethods contains an unsupported A2A method.')
    return method
  })
  if (new Set(allowedMethods).size !== allowedMethods.length) throw new Error('allowedMethods must not contain duplicates.')
  if (!Array.isArray(value.allowedTaskClasses) || value.allowedTaskClasses.length < 1 || value.allowedTaskClasses.length > MAX_SKILLS) throw new Error('allowedTaskClasses must contain one or more Agent Card skill IDs.')
  const discovered = new Set(discoveredSkills)
  const allowedTaskClasses = value.allowedTaskClasses.map((taskClass) => {
    if (typeof taskClass !== 'string' || !TASK_CLASS.test(taskClass) || !discovered.has(taskClass)) throw new Error('Every allowed task class must be a skill ID from the validated Agent Card.')
    return taskClass
  })
  if (new Set(allowedTaskClasses).size !== allowedTaskClasses.length) throw new Error('allowedTaskClasses must not contain duplicates.')
  if (!Number.isInteger(value.maxTextBytes) || (value.maxTextBytes as number) < 1 || (value.maxTextBytes as number) > 65_536) throw new Error('maxTextBytes must be an integer between 1 and 65536.')
  return { allowedMethods, allowedTaskClasses, maxTextBytes: value.maxTextBytes as number }
}

export function parseA2APaymentPolicy(value: unknown, rpcUrl: string): BuyerPolicy {
  if (!object(value) || value.schemaVersion !== '1.0.0') throw new Error('paymentPolicy must use buyer-policy schemaVersion 1.0.0.')
  const policyId = boundedString(value.policyId, 'paymentPolicy.policyId', 200)
  const policyVersion = boundedString(value.policyVersion, 'paymentPolicy.policyVersion', 100)
  const stringList = (candidate: unknown, field: string, maximum: number) => {
    if (!Array.isArray(candidate) || candidate.length < 1 || candidate.length > maximum || candidate.some((item) => typeof item !== 'string' || !item)) throw new Error(`paymentPolicy.${field} is invalid.`)
    return candidate as string[]
  }
  const approvedSchemes = stringList(value.approvedSchemes, 'approvedSchemes', 8)
  const approvedResources = stringList(value.approvedResources, 'approvedResources', 100).map(parsePublicUpstreamUrl)
  if (!approvedResources.includes(new URL(rpcUrl).toString())) throw new Error('paymentPolicy must allowlist the exact Agent Card RPC URL.')
  const approvedPayees = stringList(value.approvedPayees, 'approvedPayees', 100)
  if (!Array.isArray(value.assetRules) || value.assetRules.length < 1 || value.assetRules.length > 32) throw new Error('paymentPolicy.assetRules is invalid.')
  const assetRules = value.assetRules.map((candidate) => {
    if (!object(candidate)) throw new Error('paymentPolicy.assetRules is invalid.')
    const network = boundedString(candidate.network, 'paymentPolicy.assetRules.network', 200)
    const asset = boundedString(candidate.asset, 'paymentPolicy.assetRules.asset', 200)
    const maxAmountPerCall = boundedString(candidate.maxAmountPerCall, 'paymentPolicy.assetRules.maxAmountPerCall', 64)
    const maxAmountPerTask = boundedString(candidate.maxAmountPerTask, 'paymentPolicy.assetRules.maxAmountPerTask', 64)
    const humanApprovalAbove = candidate.humanApprovalAbove === undefined ? undefined : boundedString(candidate.humanApprovalAbove, 'paymentPolicy.assetRules.humanApprovalAbove', 64)
    return { network, asset, maxAmountPerCall, maxAmountPerTask, ...(humanApprovalAbove ? { humanApprovalAbove } : {}) }
  })
  if (!object(value.settlement) || typeof value.settlement.requirePaymentResponse !== 'boolean' || typeof value.settlement.requireOnchainConfirmation !== 'boolean') throw new Error('paymentPolicy.settlement is invalid.')
  if (value.settlement.requireOnchainConfirmation) throw new Error('paymentPolicy.requireOnchainConfirmation is not supported by the compatibility prototype.')
  if (typeof value.requireValidatedSchema !== 'boolean') throw new Error('paymentPolicy.requireValidatedSchema must be boolean.')
  const policy: BuyerPolicy = {
    schemaVersion: '1.0.0', policyId, policyVersion, approvedSchemes, approvedResources, approvedPayees, assetRules,
    requireValidatedSchema: value.requireValidatedSchema,
    settlement: { requirePaymentResponse: value.settlement.requirePaymentResponse, requireOnchainConfirmation: value.settlement.requireOnchainConfirmation },
  }
  const validation = evaluatePaymentIntent(policy, {
    taskId: 'a2a-policy-validation', requestedResource: rpcUrl, declaredResource: rpcUrl,
    requirement: { scheme: approvedSchemes[0], network: assetRules[0].network, asset: assetRules[0].asset, payTo: approvedPayees[0], amount: '1' },
    schema: { status: 'valid' }, authorizationId: 'a2a-policy-validation-auth',
  })
  if (!validation.allowed && validation.code === 'invalid_policy') throw new Error(`paymentPolicy is invalid: ${validation.message}`)
  return policy
}

export function parseA2ARequest(value: unknown): A2AJsonRpcRequest {
  if (!object(value) || value.jsonrpc !== '2.0' || typeof value.method !== 'string' || !value.method || (typeof value.id !== 'string' && typeof value.id !== 'number')) throw new Error('Request must be a JSON-RPC 2.0 A2A message with an id.')
  if (value.params !== undefined && !object(value.params)) throw new Error('A2A params must be an object when present.')
  return value as A2AJsonRpcRequest
}

function sendMethod(method: string): boolean {
  return method === 'message/send' || method === 'SendMessage'
}

export type A2ATaskDecision =
  | { allowed: true; taskClass: string | null; textBytes: number }
  | { allowed: false; code: number; message: string }

export function evaluateA2ATaskPolicy(request: A2AJsonRpcRequest, taskClass: string | null, policy: A2ATaskPolicy): A2ATaskDecision {
  if (!policy.allowedMethods.includes(request.method)) return { allowed: false, code: -32010, message: 'This A2A method is not permitted by the tenant policy.' }
  if (!sendMethod(request.method)) return { allowed: true, taskClass: null, textBytes: 0 }
  if (!taskClass || !policy.allowedTaskClasses.includes(taskClass)) return { allowed: false, code: -32011, message: 'This A2A task class is not on the tenant allowlist.' }
  const message = object(request.params?.message) ? request.params.message : null
  if (!message || message.role !== 'user' || !Array.isArray(message.parts) || message.parts.length < 1 || message.parts.length > 64) return { allowed: false, code: -32602, message: 'A2A message/send requires one to 64 user message parts.' }
  let textBytes = 0
  for (const part of message.parts) {
    if (!object(part) || (part.kind !== 'text' && part.type !== 'text') || typeof part.text !== 'string') return { allowed: false, code: -32012, message: 'This compatibility profile permits text parts only.' }
    textBytes += new TextEncoder().encode(part.text).byteLength
  }
  if (textBytes > policy.maxTextBytes) return { allowed: false, code: -32013, message: 'The A2A task exceeds the tenant text-size limit.' }
  const configuration = object(request.params?.configuration) ? request.params.configuration : null
  if (configuration && ('pushNotificationConfig' in configuration || 'push_notification_config' in configuration)) return { allowed: false, code: -32014, message: 'Push notification callbacks are disabled in this compatibility profile.' }
  return { allowed: true, taskClass, textBytes }
}
