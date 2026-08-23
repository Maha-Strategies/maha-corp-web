import { createHash } from 'node:crypto'

import type { Sha256 } from '../governed-workflow/types.ts'
import type { GatewayActionRequest, GatewayEvidenceReference } from './types.ts'

/**
 * Translating an MCP `tools/call` into the neutral request.
 *
 * Small on purpose. The interesting content is what it refuses to carry: the
 * tool arguments are hashed and dropped, so the governance layer commits to
 * what was asked without ever holding it.
 *
 * This makes no provider call, opens no socket, and holds no credential. It is
 * a pure function from a JSON-RPC frame to a decision input.
 */

/** The subset of a JSON-RPC frame this needs. Anything else is ignored. */
export type McpToolCallFrame = {
  jsonrpc?: string
  id?: string | number | null
  method: string
  params?: {
    name?: string
    arguments?: unknown
    _meta?: Record<string, unknown>
  }
}

/** What the gateway already knows and this layer does not authenticate. */
export type McpGatewayContext = {
  requestId: string
  tenantId: string
  agentId: string
  /** The upstream MCP server the gateway would dispatch to. */
  targetId: string
  /** https URL of that upstream. */
  resource: string
  timeoutMs: number
  hopCount?: number
  /**
   * Stable across retries of the same intended effect. A gateway that already
   * has one should pass it; otherwise it is derived from the frame below, and
   * the derivation is documented rather than hidden.
   */
  idempotencyKey?: string
  evidence?: GatewayEvidenceReference[]
}

function sha256(value: string): Sha256 {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`
}

/**
 * Canonical JSON for the arguments digest.
 *
 * Keys are sorted so that two frames differing only in property order produce
 * the same commitment — otherwise an idempotency key would depend on how a
 * client happened to serialise its request.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
}

export function argumentsDigest(args: unknown): { inputSha256: Sha256; inputBytes: number } {
  const canonical = canonicalJson(args ?? {})
  return { inputSha256: sha256(canonical), inputBytes: Buffer.byteLength(canonical, 'utf8') }
}

/**
 * Derives an idempotency key when the gateway has not supplied one.
 *
 * Bound to the tenant, the tool and the exact arguments, so two genuinely
 * different calls never collide, and a retry of the same call always matches.
 * A gateway with its own request identity should pass that instead — this is a
 * fallback, not a preference.
 */
export function deriveIdempotencyKey(input: { tenantId: string; toolName: string; inputSha256: Sha256 }): string {
  return `mcp-${createHash('sha256').update(`${input.tenantId}\n${input.toolName}\n${input.inputSha256}`, 'utf8').digest('hex').slice(0, 32)}`
}

export class McpTranslationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** Argument names that would carry a credential into a decision record. */
const CREDENTIAL_ARGUMENT = /^(secret|password|passphrase|authorization|bearer|cookie|api[_-]?key|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)$/i

function assertNoCredentialArguments(args: unknown, path = 'params.arguments'): void {
  if (Array.isArray(args)) {
    args.forEach((entry, index) => assertNoCredentialArguments(entry, `${path}[${index}]`))
    return
  }
  if (args && typeof args === 'object') {
    for (const [key, entry] of Object.entries(args)) {
      if (CREDENTIAL_ARGUMENT.test(key)) {
        throw new McpTranslationError('credential_rejected', `${path}.${key} looks like a credential. This layer never accepts one, even hashed.`)
      }
      assertNoCredentialArguments(entry, `${path}.${key}`)
    }
  }
}

/**
 * Translates one MCP tool call into a neutral governance request.
 *
 * Only `tools/call` carries a tool name and arguments; other methods translate
 * with no capability, which is why `capability` is optional in the neutral
 * type rather than being faked here.
 */
export function mcpToolCallToGatewayRequest(frame: McpToolCallFrame, context: McpGatewayContext): GatewayActionRequest {
  if (typeof frame?.method !== 'string' || frame.method.length === 0) {
    throw new McpTranslationError('invalid_frame', 'An MCP frame must carry a method.')
  }
  assertNoCredentialArguments(frame.params?.arguments)

  const isToolCall = frame.method === 'tools/call'
  const toolName = isToolCall ? frame.params?.name : undefined
  if (isToolCall && (typeof toolName !== 'string' || toolName.length === 0)) {
    throw new McpTranslationError('invalid_frame', 'A tools/call frame must name a tool.')
  }

  const { inputSha256, inputBytes } = argumentsDigest(frame.params?.arguments)

  return {
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey
      ?? deriveIdempotencyKey({ tenantId: context.tenantId, toolName: toolName ?? frame.method, inputSha256 }),
    tenantId: context.tenantId,
    agentId: context.agentId,
    transport: 'mcp',
    targetId: context.targetId,
    resource: context.resource,
    operation: frame.method,
    ...(toolName ? { capability: toolName } : {}),
    inputSha256,
    inputBytes,
    evidence: context.evidence ?? [],
    execution: { hopCount: context.hopCount ?? 1, timeoutMs: context.timeoutMs },
    payment: { status: 'not_required' },
  }
}
