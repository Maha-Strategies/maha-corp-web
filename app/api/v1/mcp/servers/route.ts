import { MCPRegistry } from '@/lib/mcp/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(request: Request) {
  // proxy.ts authenticates /api/v1 routes and overwrites this with the
  // verified key id. The caller cannot select a different tenant namespace.
  const tenantId = request.headers.get('x-maha-api-key-id')
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)

  try {
    const servers = await MCPRegistry.listServers(tenantId)
    return json({ servers: servers.map((server) => ({
      serverId: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      createdAt: server.createdAt,
      status: server.status,
    })) }, 200)
  } catch (error) {
    console.error('[MCP_SERVERS_LIST_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'mcp_registry_unavailable', message: 'Registered MCP servers could not be loaded.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
