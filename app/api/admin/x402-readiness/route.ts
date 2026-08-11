import { jsonResponse } from '../../../../lib/agent-inquiries.ts'
import { authorizeReadiness } from '../../../../lib/readiness-authorization.ts'
import { getX402Readiness } from '../../../../lib/x402/readiness.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Operational readiness for the x402 payment surface.
//
// Behind the same bearer token as the other readiness routes, and reporting
// state rather than configuration: no secret, key, facilitator credential, or
// raw environment value is echoed. A readiness endpoint that printed the values
// it checked would be a credential leak with a dashboard attached.
//
// 503 on anything failing, so this can gate a promotion rather than merely
// describe one.

export async function GET(request: Request) {
  const authorization = authorizeReadiness(request)
  if (authorization.kind === 'unconfigured') {
    return jsonResponse({ error: { code: 'operations_unavailable', message: 'Readiness authorization is not configured.' } }, 503)
  }
  if (authorization.kind === 'unauthorized') {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid readiness bearer token is required.' } }, 401)
  }

  const report = await getX402Readiness()
  return jsonResponse(report, report.state === 'ready' ? 200 : 503)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
