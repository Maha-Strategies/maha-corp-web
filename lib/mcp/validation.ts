import type { JSONRPCRequest, MCPSlaPolicy, MCPServerConfig, MCPToolDefinition } from './types.ts'

export const DEFAULT_MCP_SLA_POLICY: MCPSlaPolicy = Object.freeze({
  requestsPerMinute: 60,
  timeoutMs: 10_000,
  failureThreshold: 3,
  cooldownMs: 30_000,
})

const MAX_DISCOVERED_TOOLS = 256

export const MCP_SUPPORTED_METHODS = Object.freeze([
  'initialize', 'notifications/initialized', 'ping', 'tools/list',
  'resources/list', 'resources/read', 'prompts/list', 'prompts/get', 'tools/call',
] as const)

export const DEFAULT_MCP_ALLOWED_METHODS: string[] = [
  'initialize', 'notifications/initialized', 'ping', 'tools/list',
  'resources/list', 'resources/read', 'prompts/list', 'prompts/get',
]

const SUPPORTED_METHODS = new Set<string>(MCP_SUPPORTED_METHODS)
const TOOL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}.`)
  }
  return value as number
}

export function parseMcpSlaPolicy(value: unknown): MCPSlaPolicy {
  if (!object(value)) throw new Error('SLA settings must be an object.')
  return {
    requestsPerMinute: boundedInteger(value.requestsPerMinute, 'requestsPerMinute', 1, 600),
    timeoutMs: boundedInteger(value.timeoutMs, 'timeoutMs', 1_000, 30_000),
    failureThreshold: boundedInteger(value.failureThreshold, 'failureThreshold', 1, 10),
    cooldownMs: boundedInteger(value.cooldownMs, 'cooldownMs', 5_000, 300_000),
  }
}

export function parseMcpServerPolicy(value: unknown): { allowedMethods: string[]; allowedToolNames: string[] } {
  if (!object(value)) throw new Error('MCP server policy must be an object.')
  if (!Array.isArray(value.allowedMethods) || value.allowedMethods.length < 1 || value.allowedMethods.length > MCP_SUPPORTED_METHODS.length) throw new Error('allowedMethods must contain one or more supported MCP methods.')
  const allowedMethods = value.allowedMethods.map((method) => {
    if (typeof method !== 'string' || !SUPPORTED_METHODS.has(method)) throw new Error('allowedMethods contains an unsupported MCP method.')
    return method
  })
  if (new Set(allowedMethods).size !== allowedMethods.length) throw new Error('allowedMethods must not contain duplicates.')
  if (!Array.isArray(value.allowedToolNames) || value.allowedToolNames.length > MAX_DISCOVERED_TOOLS) throw new Error(`allowedToolNames must contain at most ${MAX_DISCOVERED_TOOLS} tool names.`)
  const allowedToolNames = value.allowedToolNames.map((name) => {
    if (typeof name !== 'string' || !TOOL_NAME.test(name)) throw new Error('allowedToolNames contains an invalid tool name.')
    return name
  })
  if (new Set(allowedToolNames).size !== allowedToolNames.length) throw new Error('allowedToolNames must not contain duplicates.')
  if (allowedMethods.includes('tools/call') !== (allowedToolNames.length > 0)) throw new Error('tools/call requires one or more allowedToolNames, and tool names require tools/call.')
  return { allowedMethods, allowedToolNames }
}

export function evaluateMcpServerPolicy(request: JSONRPCRequest, server: Pick<MCPServerConfig, 'allowedMethods' | 'allowedToolNames'>): { allowed: true } | { allowed: false; code: number; message: string } {
  if (!server.allowedMethods.includes(request.method)) return { allowed: false, code: -32010, message: 'This MCP method is not permitted by the server policy.' }
  if (request.method !== 'tools/call') return { allowed: true }
  const toolName = typeof request.params?.name === 'string' ? request.params.name : null
  if (!toolName || !server.allowedToolNames.includes(toolName)) return { allowed: false, code: -32011, message: 'This MCP tool is not on the server allowlist.' }
  return { allowed: true }
}

export function parseToolsListResponse(value: unknown, expectedId: string): { tools: MCPToolDefinition[]; nextCursor?: string } {
  if (!object(value) || value.jsonrpc !== '2.0' || value.id !== expectedId) throw new Error('Upstream returned an invalid tools/list JSON-RPC envelope.')
  if (object(value.error)) throw new Error('Upstream rejected tools/list.')
  if (!object(value.result) || !Array.isArray(value.result.tools)) throw new Error('Upstream tools/list result must contain a tools array.')
  if (value.result.tools.length > MAX_DISCOVERED_TOOLS) throw new Error(`Upstream exposes more than ${MAX_DISCOVERED_TOOLS} tools.`)
  const names = new Set<string>()
  const tools = value.result.tools.map((raw): MCPToolDefinition => {
    if (!object(raw) || typeof raw.name !== 'string' || !TOOL_NAME.test(raw.name)) throw new Error('Upstream tools/list contains an invalid tool name.')
    if (names.has(raw.name)) throw new Error('Upstream tools/list contains duplicate tool names.')
    names.add(raw.name)
    if (raw.description !== undefined && (typeof raw.description !== 'string' || raw.description.length > 4_000)) throw new Error(`Tool ${raw.name} has an invalid description.`)
    if (!object(raw.inputSchema) || JSON.stringify(raw.inputSchema).length > 100_000) throw new Error(`Tool ${raw.name} has an invalid inputSchema.`)
    return { name: raw.name, ...(raw.description ? { description: raw.description } : {}), inputSchema: raw.inputSchema }
  })
  const nextCursor = value.result.nextCursor
  if (nextCursor !== undefined && (typeof nextCursor !== 'string' || nextCursor.length > 1_000)) throw new Error('Upstream tools/list returned an invalid cursor.')
  return { tools, ...(nextCursor ? { nextCursor } : {}) }
}
