import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { MpsAuditError, runMpsAudit } from '@/lib/mps-audit-engine'
import { PUBLIC_MPS_AUDIT_DAILY_LIMIT, PublicMpsAuditConfigurationError, publicAuditVisitorHash } from '@/lib/public-mps-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MODEL = 'claude-sonnet-4-6'
const PROTOCOL_VERSIONS = new Set(['2025-03-26', '2025-06-18', '2025-11-25'])

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }

function headers() {
  return { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'MCP-Protocol-Version': '2025-11-25', 'X-Content-Type-Options': 'nosniff' }
}

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: headers() })
}

function error(id: JsonRpcId, code: number, message: string, status = 200) {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status)
}

function id(value: unknown): JsonRpcId | undefined {
  return typeof value === 'string' || typeof value === 'number' || value === null ? value : undefined
}

function validOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !origin || origin === 'https://www.mahastrategies.com'
}

async function recordEvent(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  visitorHash: string,
  eventType: 'submitted' | 'completed' | 'failed',
  inputCharCount: number,
  acquisitionChannel: 'mcp',
  claimCount?: number,
) {
  const { error: insertError } = await ledger.from('mps_public_audit_events').insert({
    visitor_hash: visitorHash,
    event_type: eventType,
    input_char_count: inputCharCount,
    claim_count: claimCount ?? null,
    acquisition_channel: acquisitionChannel,
  })
  if (insertError) console.error('Public MPS audit event failed:', insertError.code)
}

const tool = {
  name: 'mps_claim_preflight',
  title: 'MPS Claim Preflight',
  description: 'Classify substantive claims in a sanitized nonfiction passage using Maha Provenance Standard v0.1. Returns claim excerpts, provenance tags, and suggested actions. Do not submit sensitive, personal, regulated, or confidential material. This is automated triage, not factual verification, certification, or advice.',
  inputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 6000, description: 'A sanitized nonfiction passage, maximum 6,000 characters.' },
    },
  },
  outputSchema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['mps_version', 'input_hash', 'claims'],
    properties: {
      mps_version: { type: 'string' },
      input_hash: { type: 'string' },
      claims: { type: 'array' },
    },
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}

async function callPreflight(request: Request, value: unknown) {
  const text = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as { text?: unknown }).text : undefined
  if (typeof text !== 'string' || !text.trim()) throw new MpsAuditError('text must be a non-empty sanitized passage.', 400)

  let visitorHash: string
  try {
    visitorHash = publicAuditVisitorHash(request)
  } catch (cause) {
    if (cause instanceof PublicMpsAuditConfigurationError) console.error('Public MPS audit rate limit is not configured.')
    throw new MpsAuditError('The public preflight is temporarily unavailable.', 503)
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) throw new MpsAuditError('The public preflight is temporarily unavailable.', 503)
  const { data: allowed, error: quotaError } = await ledger.rpc('consume_public_mps_audit_quota', { p_visitor_hash: visitorHash, p_daily_limit: PUBLIC_MPS_AUDIT_DAILY_LIMIT })
  if (quotaError) {
    console.error('Public MPS audit quota failed:', quotaError.code)
    throw new MpsAuditError('The public preflight is temporarily unavailable.', 503)
  }
  if (allowed !== true) throw new MpsAuditError('Free preflight limit reached. Please return tomorrow, or use the private MPS Preflight for a longer document.', 429)

  const clean = text.trim()
  await recordEvent(ledger, visitorHash, 'submitted', clean.length, 'mcp')
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const audit = await runMpsAudit(clean, async (prompt) => {
      const message = await client.messages.create({ model: MODEL, max_tokens: 1_500, messages: [{ role: 'user', content: prompt }] })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    })
    await recordEvent(ledger, visitorHash, 'completed', clean.length, 'mcp', audit.claims.length)
    return audit
  } catch (cause) {
    await recordEvent(ledger, visitorHash, 'failed', clean.length, 'mcp')
    if (cause instanceof MpsAuditError) throw cause
    console.error('Public MPS audit error:', cause instanceof Error ? cause.name : 'unknown_error')
    throw new MpsAuditError("The audit didn't complete. Please try again tomorrow or use the private preflight.", 502)
  }
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return error(null, -32000, 'Origin is not permitted for this MCP server.', 403)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error(null, -32600, 'Content-Type must be application/json.', 415)

  let message: JsonRpcRequest
  try { message = await request.json() as JsonRpcRequest } catch { return error(null, -32700, 'Invalid JSON.', 400) }
  const requestId = id(message.id)
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string' || requestId === undefined) return error(null, -32600, 'Invalid JSON-RPC request.', 400)
  const requestedVersion = request.headers.get('mcp-protocol-version')
  if (requestedVersion && !PROTOCOL_VERSIONS.has(requestedVersion)) return error(requestId, -32600, 'Unsupported MCP protocol version.', 400)

  if (message.method === 'initialize') {
    return json({ jsonrpc: '2.0', id: requestId, result: { protocolVersion: requestedVersion ?? '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'maha-mps-preflight', version: '0.1.0', title: 'Maha MPS Preflight', description: 'Public, rate-limited claim-level provenance preflight for sanitized nonfiction passages.' }, instructions: 'Use only with sanitized, non-sensitive passages. The result is automated claim triage, not factual verification or certification.' } })
  }
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202, headers: headers() })
  if (message.method === 'ping') return json({ jsonrpc: '2.0', id: requestId, result: {} })
  if (message.method === 'tools/list') return json({ jsonrpc: '2.0', id: requestId, result: { tools: [tool] } })
  if (message.method !== 'tools/call') return error(requestId, -32601, 'Method not found.')

  const params = message.params
  if (typeof params !== 'object' || params === null || Array.isArray(params) || (params as { name?: unknown }).name !== tool.name) return error(requestId, -32602, 'Unknown or invalid tool request.')
  try {
    const audit = await callPreflight(request, (params as { arguments?: unknown }).arguments)
    return json({ jsonrpc: '2.0', id: requestId, result: { content: [{ type: 'text', text: JSON.stringify(audit) }], structuredContent: audit } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The preflight did not complete.'
    return json({ jsonrpc: '2.0', id: requestId, result: { content: [{ type: 'text', text: message }], isError: true } })
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { ...headers(), Allow: 'POST' } })
}
