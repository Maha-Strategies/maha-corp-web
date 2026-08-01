import { MCPControls } from '@/lib/mcp/controls'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function tenant(request: Request) {
  return request.headers.get('x-maha-tenant-id')
}

export async function GET(request: Request) {
  const tenantId = tenant(request)
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  try {
    return json({ settings: await MCPControls.getPolicy(tenantId) }, 200)
  } catch (error) {
    console.error('[MCP_SETTINGS_READ_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'mcp_controls_unavailable', message: 'MCP SLA settings could not be loaded.' } }, 503)
  }
}

export async function POST(request: Request) {
  const tenantId = tenant(request)
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  try {
    const settings = await MCPControls.setPolicy(tenantId, body)
    return json({ settings }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid MCP SLA settings.'
    if (message.includes('must be')) return json({ error: { code: 'invalid_mcp_sla_settings', message } }, 400)
    console.error('[MCP_SETTINGS_WRITE_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'mcp_controls_unavailable', message: 'MCP SLA settings could not be saved.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
