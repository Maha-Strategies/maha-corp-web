import { MCPRegistry } from '@/lib/mcp/registry'
import { parseMcpServerPolicy } from '@/lib/mcp/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request, context: RouteContext<'/api/v1/mcp/servers/[serverId]'>) {
  const tenantId = request.headers.get('x-maha-tenant-id')
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  const { serverId } = await context.params
  if (!/^mcp_srv_[a-f0-9]{16}$/.test(serverId)) return json({ error: { code: 'invalid_server_id', message: 'MCP server ID is malformed.' } }, 400)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let policy: ReturnType<typeof parseMcpServerPolicy>
  try {
    policy = parseMcpServerPolicy(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid MCP server policy.'
    return json({ error: { code: 'invalid_mcp_policy', message } }, 400)
  }
  const status = body.status === undefined ? undefined : body.status === 'active' || body.status === 'suspended' ? body.status : null
  if (status === null) return json({ error: { code: 'invalid_status', message: 'status must be active or suspended.' } }, 400)
  try {
    const existing = await MCPRegistry.getServer(tenantId, serverId)
    if (!existing) return json({ error: { code: 'not_found', message: 'MCP server was not found for this tenant.' } }, 404)
    const discoveredNames = new Set(existing.discovery.tools.map((tool) => tool.name))
    if (policy.allowedToolNames.some((name) => !discoveredNames.has(name))) return json({ error: { code: 'unknown_tool', message: 'Every allowed tool must appear in the latest validated tools/list inventory.' } }, 400)
    const updated = await MCPRegistry.updatePolicy(tenantId, serverId, policy, status ?? undefined)
    if (!updated) return json({ error: { code: 'not_found', message: 'MCP server was not found for this tenant.' } }, 404)
    return json({ server: MCPRegistry.summarize(updated) }, 200)
  } catch (error) {
    console.error('[MCP_POLICY_UPDATE_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'mcp_registry_unavailable', message: 'The MCP server policy could not be saved.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'PATCH, OPTIONS', 'Cache-Control': 'no-store' } })
}
