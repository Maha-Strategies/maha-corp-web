import { celestialError, celestialJson, openEnterpriseGate, readCelestialBody } from '@/lib/celestial-enterprise/route-support'
import { registerWebhook } from '@/lib/celestial-enterprise/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await openEnterpriseGate(request, 'webhooks:manage')
  if (!gate.ok) return gate.response
  const { data, error } = await gate.client.from('celestial_webhook_endpoints').select('endpoint_id, target_url, event_types, status, created_at').eq('organization_id', gate.principal.tenantId).order('created_at', { ascending: false })
  return error ? celestialError('webhook_read_failed', 'Webhook endpoints could not be read.', 502) : celestialJson({ endpoints: data ?? [] })
}

export async function POST(request: Request) {
  const gate = await openEnterpriseGate(request, 'webhooks:manage')
  if (!gate.ok) return gate.response
  const body = await readCelestialBody(request)
  if (!body.ok) return body.response
  try { return celestialJson({ endpoint: await registerWebhook(gate.client, gate.principal, body.value) }, 201) }
  catch (error) { return celestialError('invalid_webhook', error instanceof Error ? error.message : 'The webhook could not be registered.', 400) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } }) }
