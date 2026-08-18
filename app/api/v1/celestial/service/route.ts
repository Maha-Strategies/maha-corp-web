import { celestialJson, openEnterpriseGate } from '@/lib/celestial-enterprise/route-support'
import { CELESTIAL_SERVICE_POLICY } from '@/lib/celestial-enterprise/service'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const gate = await openEnterpriseGate(request, 'incidents:read')
  if (!gate.ok) return gate.response
  const { data } = await gate.client.from('celestial_service_incidents').select('incident_id, severity, status, affected_components, customer_summary, started_at, resolved_at, postmortem_url').order('started_at', { ascending: false }).limit(50)
  return celestialJson({ policy: CELESTIAL_SERVICE_POLICY, incidents: data ?? [] })
}
