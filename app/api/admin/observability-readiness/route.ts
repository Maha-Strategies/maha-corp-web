import { jsonResponse } from '@/lib/agent-inquiries'
import { observabilityReadiness } from '@/lib/observability/readiness'
import { authorizeRevenueOperations } from '@/lib/revenue-control-plane'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') return jsonResponse({ error: { code: 'operations_unavailable', message: 'The operations control plane is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid operations bearer token is required.' } }, 401)
  const report = observabilityReadiness()
  return jsonResponse(report, report.state === 'ready' ? 200 : 503)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } }) }
