import { A2ARegistry } from '@/lib/a2a/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const tenantId = request.headers.get('x-maha-tenant-id')
  if (!tenantId) return Response.json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, { status: 401 })
  try {
    const agents = (await A2ARegistry.listAgents(tenantId)).map(A2ARegistry.summarize)
    return Response.json({ agents }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[A2A_LIST_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return Response.json({ error: { code: 'a2a_registry_unavailable', message: 'A2A agents could not be listed.' } }, { status: 503 })
  }
}

