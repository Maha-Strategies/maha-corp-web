import { SLOT_RESOURCE_HEADER, SLOT_TOKEN_HEADER } from './x402/slot.ts'

/**
 * Request headers that only proxy.ts may assert.
 *
 * Routes read these as facts established by authentication: which key and
 * tenant called, the key's tier, whether a payment settled, and which capacity
 * slot to free. A client can send any header it likes, so a value that arrives
 * from outside is removed before anything is forwarded, and the proxy then sets
 * only the values it derived itself. Without this, a paid caller could send
 * `x-maha-api-key-tier: enterprise` and raise the Context Compiler's byte
 * limit, and a keyed caller could send `x-maha-access-mode: x402` and skip
 * metered billing.
 *
 * Client inputs that merely share the prefix -- idempotency key, input hash,
 * billing ceiling, task attribution, discovery source -- are declarations the
 * routes validate, not privileges, and are forwarded unchanged.
 */
export const PROXY_ASSERTED_REQUEST_HEADERS: readonly string[] = [
  // API key authorization
  'x-maha-api-key-id',
  'x-maha-tenant-id',
  'x-maha-api-key-tier',
  'x-maha-zero-data-retention',
  'x-maha-credits-remaining',
  // x402 settlement
  'x-maha-access-mode',
  'x-maha-payment-transaction',
  'x-maha-payment-payer',
  'x-maha-payment-amount',
  'x-maha-payment-replayed',
  SLOT_RESOURCE_HEADER,
  SLOT_TOKEN_HEADER,
]

const ASSERTED = new Set(PROXY_ASSERTED_REQUEST_HEADERS)

export function carriesProxyAssertedHeader(headers: Headers): boolean {
  for (const name of ASSERTED) if (headers.has(name)) return true
  return false
}

/**
 * The headers to forward upstream: the incoming set without any client-sent
 * asserted header, plus the values this proxy established. Asserting a name
 * outside the list throws, so a new trusted header cannot be added without
 * also being stripped from clients.
 */
export function forwardedRequestHeaders(incoming: Headers, asserted: Record<string, string> = {}): Headers {
  const headers = new Headers(incoming)
  for (const name of ASSERTED) headers.delete(name)
  for (const [name, value] of Object.entries(asserted)) {
    if (!ASSERTED.has(name.toLowerCase())) throw new Error(`${name} is not a proxy-asserted request header.`)
    headers.set(name, value)
  }
  return headers
}
