import { A2ARegistry } from '@/lib/a2a/registry'
import type { A2AAuthType } from '@/lib/a2a/types'
import type { BuyerPolicy } from '@/lib/x402/buyer-policy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const tenantId = request.headers.get('x-maha-tenant-id')
  if (!tenantId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const agentCardUrl = typeof body.agentCardUrl === 'string' ? body.agentCardUrl : ''
  const authType = body.authType
  const secret = body.secret
  if (name.length < 2 || name.length > 160 || !agentCardUrl || !['none', 'bearer', 'hmac'].includes(String(authType))) return json({ error: { code: 'invalid_registration', message: 'name, agentCardUrl, authType and taskPolicy are required.' } }, 400)
  if (authType === 'none' && secret !== undefined) return json({ error: { code: 'invalid_registration', message: 'authType none must not include a secret.' } }, 400)
  if (authType !== 'none' && (typeof secret !== 'string' || secret.length < 1 || secret.length > 4_096)) return json({ error: { code: 'invalid_registration', message: 'A bounded secret is required for bearer or hmac authentication.' } }, 400)
  try {
    const agent = await A2ARegistry.registerAgent(tenantId, {
      name,
      agentCardUrl,
      authType: authType as A2AAuthType,
      ...(typeof secret === 'string' ? { rawSecret: secret } : {}),
      taskPolicy: body.taskPolicy,
      ...(body.paymentPolicy ? { paymentPolicy: body.paymentPolicy as BuyerPolicy } : {}),
    })
    return json({ agent: A2ARegistry.summarize(agent) }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'A2A registration failed.'
    if (/Agent Card|agent|taskPolicy|allowed|HTTPS|public DNS|non-public|HTTP/.test(message)) return json({ error: { code: 'invalid_a2a_registration', message } }, 400)
    console.error('[A2A_REGISTER_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'a2a_registry_unavailable', message: 'The A2A agent could not be registered.' } }, 503)
  }
}

