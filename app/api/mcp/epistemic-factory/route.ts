import {
  compileEpistemicDraft,
  detectEpistemicClaimConflicts,
  EPISTEMIC_FACTORY_MCP_TOOLS,
  EPISTEMIC_FACTORY_TOOL_BOUNDARY,
  parseEpistemicFactoryRecord,
  verifyEpistemicBridgeContracts,
} from '@/lib/epistemic-factory-tools'
import { EPISTEMIC_RECORDS } from '@/lib/epistemic-pilots'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import { createEpistemicPersistenceClient, listEpistemicReviewTargets } from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROTOCOL_VERSION = '2025-11-25'
const PROTOCOL_VERSIONS = new Set(['2025-03-26', '2025-06-18', PROTOCOL_VERSION])
type JsonRpcId = string | number | null

function headers() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  }
}

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: headers() })
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200) {
  return json({ jsonrpc: '2.0', id, error: { code, message } }, status)
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function requestId(value: unknown): JsonRpcId | undefined {
  return typeof value === 'string' || typeof value === 'number' || value === null ? value : undefined
}

async function existingRecords() {
  const records = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
  const client = createEpistemicPersistenceClient()
  if (client) {
    for (const target of await listEpistemicReviewTargets(client)) {
      if (target.candidateSnapshot) records.set(target.recordId, target.candidateSnapshot)
    }
  }
  return [...records.values()]
}

async function callTool(name: string, argsValue: unknown) {
  const args = object(argsValue, 'tool arguments')
  const records = await existingRecords()
  if (name === 'factory_draft_node') {
    return {
      compilation: compileEpistemicDraft(args.record, args.sourcePublicPath, records),
      queued: false,
      canonicalReleaseAttempted: false,
      boundary: EPISTEMIC_FACTORY_TOOL_BOUNDARY,
    }
  }
  const record = parseEpistemicFactoryRecord(args.record)
  if (name === 'factory_detect_conflict') {
    return {
      recordId: record.id,
      leads: detectEpistemicClaimConflicts(record, records),
      boundary: 'Lexical overlap and polarity mismatch identify review leads only; they do not prove logical inconsistency or decide which claim is correct.',
    }
  }
  if (name === 'factory_verify_bridge') {
    return {
      recordId: record.id,
      contracts: verifyEpistemicBridgeContracts(record, records),
      boundary: 'A passed bridge contract establishes structural completeness only. It is not proof of mathematical equivalence, mechanism, causality, or empirical transfer.',
    }
  }
  throw new Error('Unknown factory tool.')
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== 'https://www.mahastrategies.com') return rpcError(null, -32000, 'Origin is not permitted for this MCP server.', 403)
  const authorization = authorizeEpistemicOperations(request)
  if (!authorization.authorized) return rpcError(null, -32001, 'A valid epistemic-operations bearer token is required.', 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return rpcError(null, -32600, 'Content-Type must be application/json.', 415)

  let message: Record<string, unknown>
  try { message = object(await request.json(), 'JSON-RPC request') } catch { return rpcError(null, -32700, 'Invalid JSON.', 400) }
  const id = requestId(message.id)
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string' || id === undefined) return rpcError(null, -32600, 'Invalid JSON-RPC request.', 400)
  const requestedVersion = request.headers.get('mcp-protocol-version')
  if (requestedVersion && !PROTOCOL_VERSIONS.has(requestedVersion)) return rpcError(id, -32600, 'Unsupported MCP protocol version.', 400)

  if (message.method === 'initialize') return json({ jsonrpc: '2.0', id, result: {
    protocolVersion: requestedVersion ?? PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'maha-epistemic-publication-factory', version: '0.1.0', title: 'Maha Epistemic Publication Factory' },
    instructions: EPISTEMIC_FACTORY_TOOL_BOUNDARY,
  } })
  if (message.method === 'notifications/initialized') return new Response(null, { status: 202, headers: headers() })
  if (message.method === 'ping') return json({ jsonrpc: '2.0', id, result: {} })
  if (message.method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools: EPISTEMIC_FACTORY_MCP_TOOLS.map((tool) => ({
    name: tool.name, title: tool.title, description: tool.description, inputSchema: tool.inputSchema,
    annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: false },
  })) } })
  if (message.method !== 'tools/call') return rpcError(id, -32601, 'Method not found.')
  let params: Record<string, unknown>
  try { params = object(message.params, 'tool call parameters') } catch (cause) { return rpcError(id, -32602, cause instanceof Error ? cause.message : 'Invalid tool parameters.') }
  if (typeof params.name !== 'string' || !EPISTEMIC_FACTORY_MCP_TOOLS.some((tool) => tool.name === params.name)) return rpcError(id, -32602, 'Unknown tool.')
  try {
    const structuredContent = await callTool(params.name, params.arguments)
    return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The factory tool did not complete.'
    return json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: message }], isError: true } })
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { ...headers(), Allow: 'POST' } })
}
