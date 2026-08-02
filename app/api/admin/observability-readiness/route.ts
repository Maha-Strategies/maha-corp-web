import { jsonResponse } from '@/lib/agent-inquiries'
import { observabilityReadiness } from '@/lib/observability/readiness'
import { authorizeReadiness } from '@/lib/readiness-authorization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = authorizeReadiness(request)
  if (authorization.kind === 'unconfigured') return jsonResponse({ error: { code: 'operations_unavailable', message: 'Readiness authorization is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid readiness bearer token is required.' } }, 401)
  const report = observabilityReadiness()
  return jsonResponse(report, report.state === 'ready' ? 200 : 503)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } }) }
