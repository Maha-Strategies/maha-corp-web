import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { apiKeyServiceConfigured, authorizeAndConsumeApiUnit, bearerApiKey } from '@/lib/api-key'
import { API_CORS_HEADERS, apiAccessStatus, apiProxyGate, x402ChallengeHeaders } from '@/lib/api-proxy-policy'
import { maybeCreateTenantAutoTopup } from '@/lib/api-credit-billing'
import { maybeSendLowCreditAlert } from '@/lib/observability/alerts'
import { X402_HEADERS, paidRequestHeaders, resolveX402 } from '@/lib/x402/gateway'
import { metersAtProxy, recordContextCompilerUsage } from '@/lib/context-compiler-metering'

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return NextResponse.json(body, { status, headers: { ...API_CORS_HEADERS, ...headers } })
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl
  const gate = apiProxyGate(pathname, request.method, apiKeyServiceConfigured())
  if (gate === 'preflight') return new NextResponse(null, { status: 204, headers: API_CORS_HEADERS })
  if (gate === 'self_managed') return NextResponse.next({ headers: API_CORS_HEADERS })
  if (gate === 'unavailable') return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, apiAccessStatus('unavailable'))
  const key = bearerApiKey(request)

  // Machine payment is attempted only for a request carrying no API key, so
  // the credit path below is untouched and behaves exactly as before. When
  // X402_ENABLED is not 'true' this resolves to not_applicable without reading
  // any other configuration, and the endpoint is indistinguishable from how it
  // behaved before x402 existed.
  if (!key) {
    const x402StartedAt = performance.now()
    const outcome = await resolveX402(request)

    // A challenge is answered here and never reaches the route, so the route's
    // metering wrapper cannot see it. Recorded through waitUntil so a slow or
    // failing meter can never delay the 402 an agent is waiting on, and never
    // changes what it receives. Refusals are deliberately not recorded: they
    // follow a presented payment, and belong to reliability rather than to the
    // acquisition denominator.
    if (metersAtProxy(pathname, outcome.kind)) {
      event.waitUntil(recordContextCompilerUsage({ mode: 'anonymous', credentialId: '', status: 402 }))
    }

    if (outcome.kind === 'challenge') {
      return json(outcome.body, outcome.status, x402ChallengeHeaders(outcome.header, performance.now() - x402StartedAt))
    }
    if (outcome.kind === 'refused') {
      return json(
        { error: { code: outcome.code, message: outcome.message } },
        outcome.status,
        outcome.retryAfterSeconds ? { 'Retry-After': String(outcome.retryAfterSeconds) } : {},
      )
    }
    if (outcome.kind === 'paid') {
      // A paid caller has no key, tenant, or credit balance, so downstream is
      // told what it is dealing with rather than left to infer it.
      //
      // The capacity slot is held from here. This proxy cannot release it —
      // there is no hook that fires when the handler it forwards to finishes —
      // so the token goes downstream and whoever observes the work end releases
      // it. See lib/x402/slot.ts.
      const paidHeaders = new Headers(request.headers)
      for (const [name, value] of Object.entries(paidRequestHeaders(outcome))) paidHeaders.set(name, value)
      return NextResponse.next({
        request: { headers: paidHeaders },
        headers: { ...API_CORS_HEADERS, [X402_HEADERS.response]: outcome.header },
      })
    }
    return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>. Generate a free starter key at /tools/token-calc.', href: '/tools/token-calc' } }, apiAccessStatus('missing_key'))
  }

  const access = await authorizeAndConsumeApiUnit(key)
  if (access.kind === 'unauthorized') return json({ error: { code: 'invalid_api_key', message: 'This API key is invalid or inactive.', href: '/tools/token-calc' } }, apiAccessStatus('invalid_key'))
  if (access.kind === 'depleted') return json({ error: { code: 'credit_balance_depleted', message: 'This API key has no remaining credits. Purchase a prepaid pack to continue.' } }, apiAccessStatus('depleted'))
  if (access.kind === 'rate_limited') return json({ error: { code: 'rate_limited', message: 'Per-minute API key limit reached. Retry shortly.' } }, apiAccessStatus('rate_limited'), { 'Retry-After': '60' })
  if (access.kind !== 'authorized') return json({ error: { code: 'api_key_service_unavailable', message: 'API authorization is temporarily unavailable.' } }, apiAccessStatus('unavailable'))
  if (access.remainingCredits < 1_000) event.waitUntil(maybeCreateTenantAutoTopup({ tenantId: access.tenantId, remainingCredits: access.remainingCredits }).then(() => undefined))
  event.waitUntil(maybeSendLowCreditAlert({ tenantId: access.tenantId, remainingCredits: access.remainingCredits }).then(() => undefined))
  const headers = new Headers(request.headers); headers.set('x-maha-api-key-id', access.keyId); headers.set('x-maha-tenant-id', access.tenantId); headers.set('x-maha-api-key-tier', access.tier); headers.set('x-maha-zero-data-retention', String(access.zeroDataRetention)); headers.set('x-maha-credits-remaining', String(access.remainingCredits)); return NextResponse.next({ request: { headers }, headers: API_CORS_HEADERS })
}
export const config = { matcher: ['/api/v1/:path*'] }
