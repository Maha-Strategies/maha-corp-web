import {
  authorizeClientCapability,
  bearerToken,
} from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { recordCommercialApiUsage } from '@/lib/commercial-api-metering'
import {
  buildLicensedEvidenceProjection,
  createMcpEvidenceExecutionId,
  MCP_EVIDENCE_CAPABILITY,
  MCP_EVIDENCE_PROTOCOL_VERSION,
  MCP_EVIDENCE_SERVER,
  MCP_EVIDENCE_TOOL,
  MCP_EVIDENCE_TOOL_NAME,
  mcpEvidenceOutputSha256,
  mcpEvidenceRequestSha256,
  parseMcpEvidenceRpcEnvelope,
  parseMcpEvidenceToolArguments,
} from '@/lib/mcp-evidence-licensing'
import {
  completeMcpEvidenceExecution,
  failMcpEvidenceExecution,
  findActiveMcpEvidenceRelease,
  reserveMcpEvidenceExecution,
} from '@/lib/mcp-evidence-store'
import { sha256Canonical } from '@/lib/epistemic-publication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const MAX_BODY_BYTES = 16_384
const PROTOCOL_VERSIONS = new Set(['2025-03-26', '2025-06-18', MCP_EVIDENCE_PROTOCOL_VERSION])
type JsonRpcId = string | number | null

function responseHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'MCP-Protocol-Version': MCP_EVIDENCE_PROTOCOL_VERSION,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  }
}

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: responseHeaders() })
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200, data?: object) {
  return json({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } }, status)
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !origin || origin === 'https://www.mahastrategies.com'
}

async function meter(credentialId: string, statusCode: number, units = 0) {
  const ledger = createAgentInquiryLedger()
  if (ledger) await recordCommercialApiUsage(ledger, {
    credentialId,
    operation: 'mcp_evidence_retrieval',
    statusCode,
    unitQuantity: units,
  })
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return rpcError(null, -32000, 'Origin is not permitted for this MCP server.', 403)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return rpcError(null, -32600, 'Content-Type must be application/json.', 415)
  }
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return rpcError(null, -32600, 'MCP request exceeds 16 KB.', 413)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return rpcError(null, -32600, 'MCP request exceeds 16 KB.', 413)

  let envelope: ReturnType<typeof parseMcpEvidenceRpcEnvelope>
  try {
    envelope = parseMcpEvidenceRpcEnvelope(raw)
  } catch {
    return rpcError(null, -32700, 'Invalid JSON.', 400)
  }
  const { message, id } = envelope
  const requestedVersion = request.headers.get('mcp-protocol-version')
  if (requestedVersion && !PROTOCOL_VERSIONS.has(requestedVersion)) return rpcError(id ?? null, -32600, 'Unsupported MCP protocol version.', 400)

  if (envelope.initializedNotification) {
    return new Response(null, { status: 202, headers: responseHeaders() })
  }
  if (id === undefined) return rpcError(null, -32600, 'JSON-RPC requests require a valid id.', 400)

  if (message.method === 'initialize') return json({
    jsonrpc: '2.0', id, result: {
      protocolVersion: requestedVersion ?? MCP_EVIDENCE_PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: MCP_EVIDENCE_SERVER,
      instructions: 'Authentication, an active evidence-retrieval capability, an exact license grant, remaining quota, and an active canonical release are all required at call time. Licensing never upgrades evidence or release status.',
    },
  })
  if (message.method === 'ping') return json({ jsonrpc: '2.0', id, result: {} })
  if (message.method === 'tools/list') return json({ jsonrpc: '2.0', id, result: { tools: [MCP_EVIDENCE_TOOL] } })
  if (message.method !== 'tools/call') return rpcError(id, -32601, 'Method not found.')

  const params = message.params
  if (!params || typeof params !== 'object' || Array.isArray(params) || (params as { name?: unknown }).name !== MCP_EVIDENCE_TOOL_NAME) {
    return rpcError(id, -32602, 'Unknown or invalid tool request.')
  }
  let argumentsValue: ReturnType<typeof parseMcpEvidenceToolArguments>
  try {
    argumentsValue = parseMcpEvidenceToolArguments((params as { arguments?: unknown }).arguments)
  } catch (cause) {
    return rpcError(id, -32602, cause instanceof Error ? cause.message : 'Invalid tool arguments.')
  }

  const token = bearerToken(request)
  if (!token) return rpcError(id, -32001, 'A valid client credential is required.', 401)
  const authorization = await authorizeClientCapability(token, MCP_EVIDENCE_CAPABILITY)
  if (authorization.kind === 'unavailable') return rpcError(id, -32000, 'The credential registry is unavailable.', 503)
  if (authorization.kind === 'unauthorized') return rpcError(id, -32001, 'A valid client credential is required.', 401)
  if (authorization.kind === 'forbidden') return rpcError(id, -32003, 'This credential lacks the evidence-retrieval capability.', 403)
  if (authorization.kind === 'rate_limited') return rpcError(id, -32004, 'Credential request limit reached.', 429)

  const ledger = createAgentInquiryLedger()
  if (!ledger) {
    await meter(authorization.credentialId, 503)
    return rpcError(id, -32000, 'The licensed evidence ledger is unavailable.', 503)
  }

  let release
  try {
    release = await findActiveMcpEvidenceRelease(ledger, argumentsValue.selector)
  } catch {
    await meter(authorization.credentialId, 503)
    return rpcError(id, -32000, 'Canonical release lookup is unavailable.', 503)
  }
  if (!release) {
    await meter(authorization.credentialId, 404)
    return rpcError(id, -32044, 'No active canonical release matches this selector.', 200, { reason: 'release_unavailable' })
  }

  const requestSha256 = mcpEvidenceRequestSha256(argumentsValue)
  let reservation
  try {
    reservation = await reserveMcpEvidenceExecution(ledger, {
      executionId: createMcpEvidenceExecutionId(),
      clientId: authorization.clientId,
      credentialId: authorization.credentialId,
      clientRequestId: argumentsValue.clientRequestId,
      requestSha256,
      toolName: MCP_EVIDENCE_TOOL_NAME,
      releaseId: release.releaseId,
      releaseSha256: release.releaseSha256,
      observedAt: new Date().toISOString(),
    })
  } catch {
    await meter(authorization.credentialId, 503)
    return rpcError(id, -32000, 'License and quota evaluation is unavailable.', 503)
  }
  if (reservation.outcome === 'license_required') {
    await meter(authorization.credentialId, 403)
    return rpcError(id, -32003, 'An active evidence-retrieval license grant is required.', 200, { reason: 'license_required', documentation: 'https://www.mahastrategies.com/developers' })
  }
  if (reservation.outcome === 'quota_exhausted') {
    await meter(authorization.credentialId, 429)
    return rpcError(id, -32004, 'The license quota is exhausted for this UTC month.', 200, { reason: 'quota_exhausted' })
  }
  if (reservation.outcome === 'idempotency_conflict') {
    await meter(authorization.credentialId, 409)
    return rpcError(id, -32009, 'clientRequestId was already used for a different tool request or release.', 200, { reason: 'idempotency_conflict' })
  }
  if (reservation.outcome === 'execution_failed') {
    await meter(authorization.credentialId, 409)
    return rpcError(id, -32009, 'The prior execution failed. Retry with a new clientRequestId.', 200, { reason: 'execution_failed' })
  }
  if (reservation.outcome === 'release_unavailable') {
    await meter(authorization.credentialId, 404)
    return rpcError(id, -32044, 'The selected release ceased to be active before quota reservation.', 200, { reason: 'release_unavailable' })
  }

  try {
    const projection = buildLicensedEvidenceProjection(release, reservation)
    const outputSha256 = mcpEvidenceOutputSha256(projection)
    const completedAt = new Date().toISOString()
    await completeMcpEvidenceExecution(ledger, {
      executionId: reservation.executionId,
      outputSha256,
      eventSha256: sha256Canonical({ executionId: reservation.executionId, eventType: 'completed', outputSha256, completedAt }),
      completedAt,
    })
    await meter(authorization.credentialId, 200, reservation.idempotentReplay ? 0 : 1)
    return json({
      jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: JSON.stringify(projection) }],
        structuredContent: projection,
        _meta: { idempotentReplay: reservation.idempotentReplay },
      },
    })
  } catch {
    const failedAt = new Date().toISOString()
    try {
      await failMcpEvidenceExecution(ledger, {
        executionId: reservation.executionId,
        failureCode: 'projection_failed',
        eventSha256: sha256Canonical({ executionId: reservation.executionId, eventType: 'failed', failureCode: 'projection_failed', failedAt }),
        failedAt,
      })
    } catch {
      console.error('MCP evidence failure receipt could not be recorded.')
    }
    await meter(authorization.credentialId, 503)
    return rpcError(id, -32000, 'The bounded evidence projection could not be completed.', 503)
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { ...responseHeaders(), Allow: 'POST' } })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...responseHeaders(), Allow: 'POST, OPTIONS' } })
}
