import crypto from 'node:crypto'
import { MCPDiscoveryService } from '@/lib/mcp/discovery'
import { MCPRegistry } from '@/lib/mcp/registry'
import type { MCPServerConfig, MCPToolDiscovery } from '@/lib/mcp/types'

export const runtime = 'nodejs'

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

async function persistDiscovery(tenantId: string, server: MCPServerConfig, discovery: MCPToolDiscovery) {
  try { return await MCPRegistry.updateDiscovery(tenantId, server.id, discovery) }
  catch (error) {
    console.error('[MCP_DISCOVERY_PERSISTENCE_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return null
  }
}

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const tenantId = request.headers.get('x-maha-tenant-id')
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  const { serverId } = await context.params
  if (!/^mcp_srv_[a-f0-9]{16}$/.test(serverId)) return json({ error: { code: 'invalid_server_id', message: 'Provide a valid MCP server ID.' } }, 400)
  const server = await MCPRegistry.getServer(tenantId, serverId)
  if (!server) return json({ error: { code: 'mcp_server_not_found', message: 'This MCP server is not registered to the authenticated tenant.' } }, 404)

  try {
    const discovery = await MCPDiscoveryService.discover(server)
    const updated = await persistDiscovery(tenantId, server, discovery)
    if (!updated) return json({ error: { code: 'mcp_registry_unavailable', message: 'Discovered tool metadata could not be persisted.' } }, 503)
    return json({ server: MCPRegistry.summarize(updated) }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool discovery failed.'
    const discovery = { status: 'error' as const, tools: [], discoveredAt: Date.now(), error: message }
    const updated = await persistDiscovery(tenantId, server, discovery)
    console.error('[MCP_DISCOVERY_ERROR]', crypto.createHash('sha256').update(`${tenantId}:${serverId}`).digest('hex').slice(0, 12), error instanceof Error ? error.name : 'unknown_error')
    const rateLimited = message.startsWith('MCP rate limit reached')
    const circuitOpen = message.startsWith('Circuit breaker is open')
    if (!updated) return json({ error: { code: 'mcp_registry_unavailable', message: 'Tool discovery status could not be persisted.' } }, 503)
    return json(
      { error: { code: rateLimited ? 'mcp_rate_limited' : circuitOpen ? 'mcp_circuit_open' : 'mcp_discovery_failed', message } },
      rateLimited ? 429 : circuitOpen ? 503 : 502,
    )
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
