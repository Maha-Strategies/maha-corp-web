import { celestialError, celestialJson, openEnterpriseGate } from '@/lib/celestial-enterprise/route-support'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const gate = await openEnterpriseGate(request, 'usage:read')
  if (!gate.ok) return gate.response
  const url = new URL(request.url)
  const end = url.searchParams.get('end') ?? new Date().toISOString()
  const start = url.searchParams.get('start') ?? new Date(new Date(end).getTime() - 30 * 86_400_000).toISOString()
  if (!Number.isFinite(new Date(start).getTime()) || !Number.isFinite(new Date(end).getTime()) || new Date(start) >= new Date(end)) return celestialError('invalid_period', 'start and end must define a valid time period.', 400)
  const { data, error } = await gate.client.rpc('celestial_usage_summary', { p_organization_id: gate.principal.tenantId, p_period_start: start, p_period_end: end })
  return error ? celestialError('usage_read_failed', 'Usage could not be summarized.', 502) : celestialJson({ period: { start, end }, usage: data ?? [], billingBoundary: 'Billable units are auditable usage evidence; the executed order form controls currency prices and invoice terms.' })
}
