export const SELF_MANAGED_KEY_ROUTES = new Set([
  '/api/v1/keys/generate',
  '/api/v1/keys/balance',
  '/api/v1/keys/checkout',
  // Called by our GPU compute workers, which hold no customer API key and must
  // not consume a customer's request unit. The route authenticates itself with
  // an HMAC signature over the raw body — see app/api/v1/jobs/webhook/route.ts.
  // Removing this entry does not fail loudly: every callback would 401 and
  // every job would silently expire at its deadline.
  '/api/v1/jobs/webhook',
])

export const API_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export type ApiProxyGate = 'preflight' | 'self_managed' | 'unavailable' | 'protected'
export type ApiAccessOutcome = 'unavailable' | 'missing_key' | 'invalid_key' | 'depleted' | 'rate_limited'

export function apiProxyGate(pathname: string, method: string, configured: boolean): ApiProxyGate {
  if (method === 'OPTIONS') return 'preflight'
  if (SELF_MANAGED_KEY_ROUTES.has(pathname)) return 'self_managed'
  return configured ? 'protected' : 'unavailable'
}

export function apiAccessStatus(outcome: ApiAccessOutcome): 401 | 402 | 429 | 503 {
  if (outcome === 'depleted') return 402
  if (outcome === 'rate_limited') return 429
  if (outcome === 'unavailable') return 503
  return 401
}
