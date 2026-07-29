import { authorizeClientCapability, bearerToken } from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import {
  assertPublicUpstreamHost, evaluateContextPackAdmission, evaluateGatewayPolicy, isAllowedGatewayOrigin, MAX_MCP_GATEWAY_BODY_BYTES,
  MAX_UPSTREAM_RESPONSE_BYTES, MCP_GATEWAY_CAPABILITY, mcpGatewayHash,
  parseMcpGatewayRequest, validMcpGatewayServerId, validateMcpHeaders,
  type GatewayServerRecord,
} from '@/lib/mcp-gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

function error(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status)
}

async function recordEvent(ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>, input: {
  serverId: string; clientId: string; credentialId: string; method: string | null; toolName: string | null
  outcome: string; upstreamStatus?: number; requestHash: string; contextPackId?: string | null
}) {
  const { error: writeError } = await ledger.from('mcp_gateway_events').insert({
    server_id: input.serverId, client_id: input.clientId, credential_id: input.credentialId,
    mcp_method: input.method, tool_name: input.toolName, outcome: input.outcome,
    upstream_status: input.upstreamStatus ?? null, request_hash: input.requestHash, context_pack_id: input.contextPackId ?? null,
  })
  if (writeError) console.error('MCP gateway event write failed:', writeError.code)
}

export async function POST(request: Request, context: RouteContext<'/api/mcp-gateway/[serverId]'>) {
  const { serverId } = await context.params
  if (!validMcpGatewayServerId(serverId)) return error('not_found', 'Gateway server not found.', 404)
  if (!isAllowedGatewayOrigin(request)) return error('origin_not_allowed', 'Browser-originated MCP requests are not enabled for this gateway.', 403)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error('unsupported_media_type', 'Content-Type must be application/json.', 415)
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_MCP_GATEWAY_BODY_BYTES) return error('payload_too_large', 'MCP request exceeds the 64 KB gateway limit.', 413)

  const token = bearerToken(request)
  if (!token) return error('unauthorized', 'A tenant-owned gateway credential is required.', 401)
  const authorization = await authorizeClientCapability(token, MCP_GATEWAY_CAPABILITY)
  if (authorization.kind === 'unavailable') return error('gateway_unavailable', 'The credential registry is unavailable.', 503)
  if (authorization.kind === 'unauthorized') return error('unauthorized', 'A valid tenant-owned gateway credential is required.', 401)
  if (authorization.kind === 'forbidden') return error('capability_not_authorized', 'This credential is not authorized for the MCP gateway.', 403)
  if (authorization.kind === 'rate_limited') return error('rate_limited', 'Credential request limit reached. Retry after one hour.', 429)

  let raw: string
  let message: ReturnType<typeof parseMcpGatewayRequest>
  try {
    raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_MCP_GATEWAY_BODY_BYTES) return error('payload_too_large', 'MCP request exceeds the 64 KB gateway limit.', 413)
    message = parseMcpGatewayRequest(JSON.parse(raw))
  } catch (caught) {
    return error('invalid_request', caught instanceof Error ? caught.message : 'Invalid MCP request.', 400)
  }
  const headerError = validateMcpHeaders(request, message)
  if (headerError) return error('invalid_mcp_headers', headerError, 400)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return error('gateway_unavailable', 'The gateway control plane is not configured.', 503)
  const { data, error: serverError } = await ledger.from('mcp_gateway_servers')
    .select('public_id, client_id, display_name, endpoint_url, status, allowed_methods, allowed_tool_names, context_pack_required_tools, context_pack_id_argument, context_pack_hash_argument, context_pack_content_argument')
    .eq('public_id', serverId).eq('client_id', authorization.clientId).maybeSingle()
  if (serverError) return error('gateway_unavailable', 'The gateway server registry is unavailable.', 503)
  if (!data || data.status !== 'active') return error('not_found', 'Gateway server not found or inactive for this tenant.', 404)
  const server = data as GatewayServerRecord
  const policy = evaluateGatewayPolicy(message, server)
  const requestHash = mcpGatewayHash(message)
  if (policy.outcome === 'blocked') {
    await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: policy.code, requestHash })
    return error(policy.code, policy.message, 403)
  }
  const contextPack = evaluateContextPackAdmission(message, server)
  if (contextPack.required && !contextPack.valid) {
    await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: contextPack.code, requestHash, contextPackId: contextPack.packId })
    return error(contextPack.code, contextPack.message, 403)
  }
  if (contextPack.required && contextPack.valid) {
    const [compiled, evaluated] = await Promise.all([
      ledger.from('agent_context_packs').select('output_hash').eq('public_id', contextPack.packId).eq('client_id', authorization.clientId).maybeSingle(),
      ledger.from('agent_context_pack_evaluations').select('context_pack_output_hash').eq('context_pack_id', contextPack.packId).eq('client_id', authorization.clientId).maybeSingle(),
    ])
    if (compiled.error || evaluated.error) return error('gateway_unavailable', 'The Context Pack registry is unavailable.', 503)
    const registered = compiled.data?.output_hash === contextPack.outputHash || evaluated.data?.context_pack_output_hash === contextPack.outputHash
    if (!registered) {
      await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: 'context_pack_invalid', requestHash, contextPackId: contextPack.packId })
      return error('context_pack_invalid', 'The Context Pack is not registered to this tenant or does not match the supplied context.', 403)
    }
  }

  // Public-upstream only. No client bearer token is forwarded and no upstream
  // secret is stored. Private upstreams require a later OAuth token exchange.
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 10_000)
  try {
    await assertPublicUpstreamHost(server.endpoint_url)
    const upstream = await fetch(server.endpoint_url, {
      method: 'POST',
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/json', 'Mcp-Method': message.method,
        ...(request.headers.get('mcp-name') ? { 'Mcp-Name': request.headers.get('mcp-name')! } : {}),
        ...(request.headers.get('mcp-protocol-version') ? { 'Mcp-Protocol-Version': request.headers.get('mcp-protocol-version')! } : {}),
      }, body: raw, signal: abort.signal, redirect: 'error', cache: 'no-store',
    })
    const upstreamLength = Number(upstream.headers.get('content-length') ?? '0')
    if (Number.isFinite(upstreamLength) && upstreamLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: 'upstream_response_too_large', upstreamStatus: upstream.status, requestHash, contextPackId: contextPack.packId })
      return error('upstream_response_too_large', 'The upstream MCP response exceeds the 1 MB gateway limit.', 502)
    }
    const body = await upstream.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_UPSTREAM_RESPONSE_BYTES) {
      await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: 'upstream_response_too_large', upstreamStatus: upstream.status, requestHash, contextPackId: contextPack.packId })
      return error('upstream_response_too_large', 'The upstream MCP response exceeds the 1 MB gateway limit.', 502)
    }
    await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: upstream.ok ? 'forwarded' : 'upstream_error', upstreamStatus: upstream.status, requestHash, contextPackId: contextPack.packId })
    return new Response(body, { status: upstream.status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } })
  } catch (caught) {
    await recordEvent(ledger, { serverId, clientId: authorization.clientId, credentialId: authorization.credentialId, method: policy.method, toolName: policy.toolName, outcome: 'upstream_unavailable', requestHash, contextPackId: contextPack.packId })
    console.error('MCP gateway upstream call failed:', caught instanceof Error ? caught.name : 'unknown_error')
    return error('upstream_unavailable', 'The registered upstream MCP server did not respond.', 502)
  } finally { clearTimeout(timeout) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
