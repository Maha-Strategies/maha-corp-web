import { jsonResponse } from '@/lib/agent-inquiries'
import { buildEditorialCoverageAudit } from '@/lib/editorial-coverage-audit'
import { authorizeMarketMapping } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!authorizeMarketMapping(request).authorized) {
    return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  }
  return jsonResponse({ ...buildEditorialCoverageAudit(), readOnly: true, automaticPublishingSupported: false }, 200)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } })
}
