import { NextResponse, type NextRequest } from 'next/server'
import { apiKeyServiceConfigured, authorizeAndConsumeApiUnit, bearerApiKey } from '@/lib/api-key'
import { API_CORS_HEADERS, apiAccessStatus, apiProxyGate } from '@/lib/api-proxy-policy'

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return NextResponse.json(body, { status, headers: { ...API_CORS_HEADERS, ...headers } })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const gate = apiProxyGate(pathname, request.method, apiKeyServiceConfigured())
  if (gate === 'preflight') return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS })
  if (gate === 'self_managed') return NextResponse.next({ headers: API_CORS_HEADERS })
  if (gate === 'unavailable') return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, apiAccessStatus('unavailable'))
  const key = bearerApiKey(request); if (!key) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>. Generate a free starter key at /tools/token-calc.', href: '/tools/token-calc' } }, apiAccessStatus('missing_key'))
  const access = await authorizeAndConsumeApiUnit(key)
  if (access.kind === 'unauthorized') return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.', href: '/tools/token-calc' } }, apiAccessStatus('invalid_key'))
  if (access.kind === 'depleted') return json({ error: { code: 'credit_balance_depleted', message: 'This API key has no remaining credits. Purchase a prepaid pack to continue.' } }, apiAccessStatus('depleted'))
  if (access.kind === 'rate_limited') return json({ error: { code: 'rate_limited', message: 'Per-minute API key limit reached. Retry shortly.' } }, apiAccessStatus('rate_limited'), { 'Retry-After': '60' })
  if (access.kind !== 'authorized') return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, apiAccessStatus('unavailable'))
  const headers = new Headers(request.headers); headers.set('x-maha-api-key-id', access.keyId); headers.set('x-maha-tenant-id', access.tenantId); headers.set('x-maha-api-key-tier', access.tier); headers.set('x-maha-zero-data-retention', String(access.zeroDataRetention)); headers.set('x-maha-credits-remaining', String(access.remainingCredits)); return NextResponse.next({ request: { headers }, headers: API_CORS_HEADERS })
}
export const config = { matcher: ['/api/v1/:path*'] }
