export const SELF_MANAGED_KEY_ROUTES = new Set([
  '/api/v1/keys/generate',
  '/api/v1/keys/balance',
  '/api/v1/keys/checkout',
  '/api/v1/keys/rotate',
  '/api/v1/keys/revoke',
  '/api/v1/billing/subscription',
  '/api/v1/billing/settings',
  // Called by our GPU compute workers, which hold no customer API key and must
  // not consume a customer's request unit. The route authenticates itself with
  // an HMAC signature over the raw body — see app/api/v1/jobs/webhook/route.ts.
  // Removing this entry does not fail loudly: every callback would 401 and
  // every job would silently expire at its deadline.
  '/api/v1/jobs/webhook',
])

/**
 * Self-managed routes whose final segment is a resource id.
 *
 * Kept separate from the exact-match set above because these cannot be
 * enumerated: the id is minted per job. Each entry must name a route that
 * authenticates itself, and each one is listed with what that credential is.
 *
 * /api/v1/mps/audit/{auditId} -- retrieval and resumption of an audit that has
 * already been paid for, authenticated by the high-entropy retrieval token
 * issued once at creation. It is deliberately not priced: demanding a second
 * $0.10 to look at a job the caller already bought is how a settled payment
 * turns into a support ticket. Note this is a *different path* from the priced
 * POST /api/v1/mps/audit, and only stays that way because offer matching is
 * exact rather than prefix-based.
 */
export const SELF_MANAGED_KEY_ROUTE_PREFIXES = [
  // The orchestration control plane authenticates tenant-bound operator
  // credentials at the route. Customer API credits must never consume or
  // reinterpret that bearer before the control-plane gate sees it.
  '/api/v1/orchestration/',
  '/api/v1/workflows/',
  '/api/v1/mps/audit/',
  // Private hypothesis-registry routes use their own dedicated, constant-time
  // operations token. Sending them through the customer credit gate consumes
  // the Authorization header before the registry can authenticate it.
  '/api/v1/celestial-hypotheses/',
  // The event corpus shares the private registry bearer and service-role
  // database boundary. It must reach its route-level gate with that bearer
  // intact rather than being interpreted as a customer API key.
  '/api/v1/celestial-corpus/',
] as const

export const API_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // Browser-based x402 clients must be able to read the unpaid challenge and
  // settlement receipt, then submit the signed authorization on the retry.
  // Server-side agents do not exercise CORS, so omitting these can pass every
  // settlement test while making the same public endpoint unusable in a web
  // agent or zero-install playground.
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, PAYMENT-SIGNATURE',
  'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, Retry-After, Server-Timing',
  'Access-Control-Max-Age': '86400',
}

export type ApiProxyGate = 'preflight' | 'self_managed' | 'unavailable' | 'protected'
export type ApiAccessOutcome = 'unavailable' | 'missing_key' | 'invalid_key' | 'depleted' | 'rate_limited'

export function apiProxyGate(pathname: string, method: string, configured: boolean): ApiProxyGate {
  if (method === 'OPTIONS') return 'preflight'
  if (SELF_MANAGED_KEY_ROUTES.has(pathname)) return 'self_managed'
  // A trailing-slash prefix, so /api/v1/mps/audit itself (the priced POST) is
  // never matched here and keeps its 402.
  if (SELF_MANAGED_KEY_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length)) {
    return 'self_managed'
  }
  return configured ? 'protected' : 'unavailable'
}

export function apiAccessStatus(outcome: ApiAccessOutcome): 401 | 402 | 429 | 503 {
  if (outcome === 'depleted') return 402
  if (outcome === 'rate_limited') return 429
  if (outcome === 'unavailable') return 503
  return 401
}

export function x402ChallengeHeaders(paymentRequired: string, durationMs: number): Record<string, string> {
  const duration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0
  return {
    'PAYMENT-REQUIRED': paymentRequired,
    'Cache-Control': 'no-store',
    'Server-Timing': `x402-challenge;dur=${duration.toFixed(1)}`,
  }
}
