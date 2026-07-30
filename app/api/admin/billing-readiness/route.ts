import { jsonResponse } from '../../../../lib/agent-inquiries.ts'
import { getBillingReadiness } from '../../../../lib/billing-readiness.ts'
import { authorizeRevenueOperations } from '../../../../lib/revenue-control-plane.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') {
    return jsonResponse({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)
  }
  const report = await getBillingReadiness()
  return jsonResponse(report, report.state === 'ready' ? 200 : 503)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
