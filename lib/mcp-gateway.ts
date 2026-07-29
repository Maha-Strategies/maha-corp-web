import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const MCP_GATEWAY_CAPABILITY = 'mcp_gateway' as const
export const MAX_MCP_GATEWAY_BODY_BYTES = 65_536
export const MAX_UPSTREAM_RESPONSE_BYTES = 1_000_000

const SAFE_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'resources/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
  'tools/call',
])

export type GatewayPolicyDecision =
  | { outcome: 'allowed'; method: string; toolName: string | null }
  | { outcome: 'blocked'; code: 'method_not_allowed' | 'tool_not_allowed' | 'invalid_request'; message: string; method: string | null; toolName: string | null }

export type GatewayServerRecord = {
  public_id: string
  client_id: string
  display_name: string
  endpoint_url: string
  status: 'active' | 'disabled'
  allowed_methods: string[]
  allowed_tool_names: string[]
  context_pack_required_tools: string[]
  context_pack_id_argument: string
  context_pack_hash_argument: string
  context_pack_content_argument: string
}

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createMcpGatewayServerId(): string {
  return `mcp_srv_${randomUUID().replaceAll('-', '')}`
}

export function mcpGatewayHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

export function mcpGatewayTextHash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function validMcpGatewayServerId(value: string): boolean {
  return /^mcp_srv_[a-f0-9]{32}$/.test(value)
}

export function parsePublicUpstreamUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2_000) throw new Error('endpointUrl must be an HTTPS URL.')
  let url: URL
  try { url = new URL(value) } catch { throw new Error('endpointUrl must be an HTTPS URL.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('endpointUrl must be an HTTPS URL without embedded credentials.')
  const hostname = url.hostname.toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || isIP(hostname)) {
    throw new Error('endpointUrl must use a public DNS hostname, not localhost or an IP address.')
  }
  return url.toString()
}

function privateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [first, second] = parts
  return first === 0 || first === 10 || first === 127 || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
}

function privateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd')
    || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')
    || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.')
}

// Registration validation rejects literal IP addresses; resolve again before a
// call to catch obvious private-DNS targets. Deployment networking should still
// provide egress controls, because DNS rebinding cannot be solved in a generic
// application-level fetch alone.
export async function assertPublicUpstreamHost(endpointUrl: string): Promise<void> {
  const hostname = new URL(endpointUrl).hostname
  const records = await lookup(hostname, { all: true, verbatim: true })
  if (!records.length || records.some(({ address, family }) => family === 4 ? privateIpv4(address) : privateIpv6(address))) {
    throw new Error('Registered upstream resolves to a non-public network address.')
  }
}

export function parseGatewayMethods(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > SAFE_METHODS.size) throw new Error('allowedMethods must contain one or more supported MCP methods.')
  const methods = value.map((item) => {
    if (typeof item !== 'string' || !SAFE_METHODS.has(item)) throw new Error('allowedMethods contains an unsupported MCP method.')
    return item
  })
  if (new Set(methods).size !== methods.length) throw new Error('allowedMethods must not contain duplicates.')
  return methods
}

export function parseGatewayToolNames(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) throw new Error('allowedToolNames must contain at most 100 tool names.')
  const names = value.map((item) => {
    if (typeof item !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(item)) throw new Error('allowedToolNames contains an invalid tool name.')
    return item
  })
  if (new Set(names).size !== names.length) throw new Error('allowedToolNames must not contain duplicates.')
  return names
}

export function parseGatewayArgumentName(value: unknown, field: string, fallback: string): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)) throw new Error(`${field} must be an argument name containing letters, numbers, and underscores.`)
  return value
}

export function parseMcpGatewayRequest(value: unknown): JsonRpcRequest {
  if (!isObject(value) || value.jsonrpc !== '2.0' || typeof value.method !== 'string' || !value.method) {
    throw new Error('Request must be a JSON-RPC 2.0 message with a method.')
  }
  if (value.id !== undefined && typeof value.id !== 'string' && typeof value.id !== 'number' && value.id !== null) {
    throw new Error('JSON-RPC id must be a string, number, null, or omitted.')
  }
  if (value.params !== undefined && !isObject(value.params)) throw new Error('JSON-RPC params must be an object when provided.')
  return value as JsonRpcRequest
}

export function evaluateGatewayPolicy(request: JsonRpcRequest, server: GatewayServerRecord): GatewayPolicyDecision {
  if (!SAFE_METHODS.has(request.method) || !server.allowed_methods.includes(request.method)) {
    return { outcome: 'blocked', code: 'method_not_allowed', message: 'This MCP method is not permitted by the registered gateway policy.', method: request.method, toolName: null }
  }
  const toolName = request.method === 'tools/call' && typeof request.params?.name === 'string' ? request.params.name : null
  if (request.method === 'tools/call' && (!toolName || !server.allowed_tool_names.includes(toolName))) {
    return { outcome: 'blocked', code: 'tool_not_allowed', message: 'This tool is not on the tenant allowlist.', method: request.method, toolName }
  }
  return { outcome: 'allowed', method: request.method, toolName }
}

export type ContextPackAdmission =
  | { required: false; packId: null }
  | { required: true; valid: false; code: 'context_pack_required' | 'context_pack_invalid'; message: string; packId: string | null }
  | { required: true; valid: true; packId: string; outputHash: string; context: string }

export function evaluateContextPackAdmission(request: JsonRpcRequest, server: GatewayServerRecord): ContextPackAdmission {
  const toolName = request.method === 'tools/call' && typeof request.params?.name === 'string' ? request.params.name : null
  if (!toolName || !server.context_pack_required_tools.includes(toolName)) return { required: false, packId: null }
  const argumentsValue = request.params?.arguments
  if (!isObject(argumentsValue)) return { required: true, valid: false, code: 'context_pack_required', message: 'This approved workflow requires Context Pack arguments.', packId: null }
  const packId = argumentsValue[server.context_pack_id_argument]
  const outputHash = argumentsValue[server.context_pack_hash_argument]
  const context = argumentsValue[server.context_pack_content_argument]
  if (typeof packId !== 'string' || !/^ctxpack_[a-f0-9]{32}$/.test(packId)) return { required: true, valid: false, code: 'context_pack_required', message: `This workflow requires a valid ${server.context_pack_id_argument}.`, packId: null }
  if (typeof outputHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(outputHash) || typeof context !== 'string') {
    return { required: true, valid: false, code: 'context_pack_required', message: `This workflow requires ${server.context_pack_hash_argument} and ${server.context_pack_content_argument}.`, packId }
  }
  if (mcpGatewayTextHash(context) !== outputHash) return { required: true, valid: false, code: 'context_pack_invalid', message: 'The supplied context does not match its declared Context Pack hash.', packId }
  return { required: true, valid: true, packId, outputHash, context }
}

export function validateMcpHeaders(request: Request, message: JsonRpcRequest): string | null {
  const methodHeader = request.headers.get('mcp-method')
  const expectedName = message.method === 'tools/call' || message.method === 'resources/read' || message.method === 'prompts/get'
    ? typeof message.params?.name === 'string' ? message.params.name : typeof message.params?.uri === 'string' ? message.params.uri : null
    : null
  const nameHeader = request.headers.get('mcp-name')
  if (methodHeader !== message.method) return 'Mcp-Method must exactly match the JSON-RPC method.'
  if (expectedName && nameHeader !== expectedName) return 'Mcp-Name must exactly match the requested tool, resource, or prompt.'
  if (!expectedName && nameHeader) return 'Mcp-Name is not valid for this MCP method.'
  return null
}

export function gatewayOperationsAuthorized(request: Request): boolean {
  const expected = process.env.MCP_GATEWAY_OPERATIONS_TOKEN
  const header = request.headers.get('authorization')
  if (!expected || !header?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(header.slice('Bearer '.length))
  const configured = Buffer.from(expected)
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
}

export function isAllowedGatewayOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  // Non-browser MCP clients normally omit Origin. Browser-originated clients
  // need an explicit integration later; rejecting them avoids DNS-rebinding.
  return origin === null
}
