import { jsonResponse } from '../../../../lib/agent-inquiries.ts'
import { authorizeReadiness } from '../../../../lib/readiness-authorization.ts'
import { getRevenueReadiness } from '../../../../lib/revenue-readiness.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Reports which paid paths can actually transact. It returns variable names
// only — never a value, prefix, or length.
//
// Deliberately not one of the four release-health checks: those gate the
// last-known-good manifest rollback depends on, and a configuration fault must
// never be able to withhold the recovery path. Poll this separately.
export async function GET(request: Request) {
  const authorization = authorizeReadiness(request)
  if (authorization.kind === 'unconfigured') {
    return jsonResponse({ error: { code: 'operations_unavailable', message: 'Readiness authorization is not configured.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid readiness bearer token is required.' } }, 401)
  }
  const report = getRevenueReadiness()
  return jsonResponse(report, report.state === 'ready' ? 200 : 503)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
