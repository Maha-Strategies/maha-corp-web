import { validClientId } from '@/lib/agent-client-credentials'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import {
  createMcpGatewayServerId, gatewayOperationsAuthorized, parseGatewayMethods,
  parseGatewayArgumentName, parseGatewayToolNames, parsePublicUpstreamUrl,
} from '@/lib/mcp-gateway'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16_384

function unauthorized() {
  return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MCP Gateway operations bearer token is required.' } }, 401)
}

function singleLine(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const output = value.trim()
  if (output.length < minimum || output.length > maximum || /[\r\n]/.test(output)) throw new Error(`${field} must contain ${minimum}-${maximum} characters on one line.`)
  return output
}

export async function GET(request: Request) {
  if (!gatewayOperationsAuthorized(request)) return unauthorized()
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The gateway control plane is not configured.' } }, 503)
  const [servers, events] = await Promise.all([
    ledger.from('mcp_gateway_servers').select('public_id, client_id, display_name, endpoint_url, status, allowed_methods, allowed_tool_names, context_pack_required_tools, context_pack_id_argument, context_pack_hash_argument, context_pack_content_argument, created_at, updated_at').order('created_at', { ascending: false }).limit(200),
    ledger.from('mcp_gateway_events').select('server_id, client_id, credential_id, mcp_method, tool_name, outcome, upstream_status, context_pack_id, created_at').order('created_at', { ascending: false }).limit(200),
  ])
  if (servers.error || events.error) return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The gateway records could not be read.' } }, 503)
  return jsonResponse({ servers: servers.data ?? [], events: events.data ?? [], limits: { servers: 200, events: 200 }, secretsIncluded: false }, 200)
}

export async function POST(request: Request) {
  if (!gatewayOperationsAuthorized(request)) return unauthorized()
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const length = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Gateway registration exceeds the 16 KB limit.' } }, 413)
  let input: { clientId: string; displayName: string; endpointUrl: string; allowedMethods: string[]; allowedToolNames: string[]; contextPackRequiredTools: string[]; contextPackIdArgument: string; contextPackHashArgument: string; contextPackContentArgument: string }
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Gateway registration exceeds the 16 KB limit.' } }, 413)
    const body = JSON.parse(raw) as Record<string, unknown>
    const clientId = singleLine(body.clientId, 'clientId', 1, 80)
    if (!validClientId(clientId)) throw new Error('clientId is not valid.')
    input = {
      clientId,
      displayName: singleLine(body.displayName, 'displayName', 2, 160),
      endpointUrl: parsePublicUpstreamUrl(body.endpointUrl),
      allowedMethods: parseGatewayMethods(body.allowedMethods),
      allowedToolNames: parseGatewayToolNames(body.allowedToolNames),
      contextPackRequiredTools: parseGatewayToolNames(body.contextPackRequiredTools),
      contextPackIdArgument: parseGatewayArgumentName(body.contextPackIdArgument, 'contextPackIdArgument', 'contextPackId'),
      contextPackHashArgument: parseGatewayArgumentName(body.contextPackHashArgument, 'contextPackHashArgument', 'contextPackHash'),
      contextPackContentArgument: parseGatewayArgumentName(body.contextPackContentArgument, 'contextPackContentArgument', 'context'),
    }
    if (input.allowedMethods.includes('tools/call') && input.allowedToolNames.length === 0) throw new Error('allowedToolNames must name at least one tool when tools/call is enabled.')
    if (input.contextPackRequiredTools.some((tool) => !input.allowedToolNames.includes(tool))) throw new Error('contextPackRequiredTools must be a subset of allowedToolNames.')
    if (input.contextPackRequiredTools.length && !input.allowedMethods.includes('tools/call')) throw new Error('tools/call must be enabled when Context Pack policy names tools.')
    if (new Set([input.contextPackIdArgument, input.contextPackHashArgument, input.contextPackContentArgument]).size !== 3) throw new Error('Context Pack argument names must be different.')
  } catch (caught) {
    return jsonResponse({ error: { code: 'invalid_request', message: caught instanceof Error ? caught.message : 'Invalid gateway registration.' } }, 400)
  }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The gateway control plane is not configured.' } }, 503)
  const { data: client, error: clientError } = await ledger.from('agent_clients').select('public_id, status').eq('public_id', input.clientId).maybeSingle()
  if (clientError) return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The client registry is unavailable.' } }, 503)
  if (!client || client.status !== 'active') return jsonResponse({ error: { code: 'client_not_active', message: 'The gateway tenant must be an active registered client.' } }, 409)
  const { data, error: insertError } = await ledger.from('mcp_gateway_servers').insert({
    public_id: createMcpGatewayServerId(), client_id: input.clientId, display_name: input.displayName,
    endpoint_url: input.endpointUrl, allowed_methods: input.allowedMethods, allowed_tool_names: input.allowedToolNames,
    context_pack_required_tools: input.contextPackRequiredTools, context_pack_id_argument: input.contextPackIdArgument,
    context_pack_hash_argument: input.contextPackHashArgument, context_pack_content_argument: input.contextPackContentArgument,
  }).select('public_id, client_id, display_name, endpoint_url, status, allowed_methods, allowed_tool_names, context_pack_required_tools, context_pack_id_argument, context_pack_hash_argument, context_pack_content_argument, created_at').maybeSingle()
  if (insertError?.code === '23505') return jsonResponse({ error: { code: 'already_registered', message: 'That endpoint is already registered for this tenant.' } }, 409)
  if (insertError || !data) return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The gateway server could not be registered.' } }, 503)
  return jsonResponse({ server: data, endpoint: `/api/mcp-gateway/${data.public_id}`, security: { upstreamCredentialsStored: false, bearerForwarding: false, browserOriginRequests: false } }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
