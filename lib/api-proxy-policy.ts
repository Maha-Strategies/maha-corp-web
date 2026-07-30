export const SELF_MANAGED_KEY_ROUTES = new Set([
  '/api/v1/keys/generate',
  '/api/v1/keys/balance',
  '/api/v1/keys/checkout',
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
