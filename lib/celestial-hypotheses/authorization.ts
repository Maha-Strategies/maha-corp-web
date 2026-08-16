/**
 * Authorization for the hypothesis registry.
 *
 * Follows the repository's operations-token pattern (see
 * `lib/readiness-authorization.ts`): a bearer token compared in constant time,
 * with an explicit `unconfigured` state so a deployment missing the secret
 * returns 503 rather than accidentally running open.
 *
 * Every write endpoint is private. There is no unauthenticated path that can
 * create a draft, take a lock, or record an outcome.
 */

import { timingSafeEqual } from 'node:crypto'

export type RegistryAuthorization = { kind: 'authorized' } | { kind: 'unauthorized' } | { kind: 'unconfigured' }

const MIN_TOKEN_BYTES = 32
const MAX_TOKEN_BYTES = 4_096

function tokenMatches(request: Request, token: string): boolean {
  // A short secret is treated as unset rather than compared: accepting a
  // guessable operations token would be worse than having none.
  if (Buffer.byteLength(token, 'utf8') < MIN_TOKEN_BYTES || Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) return false
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice('Bearer '.length))
  const configured = Buffer.from(token)
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
}

export function authorizeRegistry(request: Request): RegistryAuthorization {
  const token = process.env.CELESTIAL_REGISTRY_TOKEN?.trim()
  if (!token) return { kind: 'unconfigured' }
  return tokenMatches(request, token) ? { kind: 'authorized' } : { kind: 'unauthorized' }
}

/**
 * A coarse per-instance limiter for the registry's write endpoints.
 *
 * The repository's atomic limiter (`consumeCredentialRateLimit`) is keyed to a
 * credential and backed by a Postgres RPC; this surface has a single operations
 * token and no per-caller identity, so that limiter does not apply. This is a
 * deliberately simple in-process ceiling to blunt a runaway client, and it is
 * documented as not being a distributed guarantee: serverless instances each
 * hold their own counter.
 */
const WINDOW_MS = 60_000
const MAX_WRITES_PER_WINDOW = 60
let windowStart = 0
let writesInWindow = 0

export function consumeRegistryWriteBudget(now: number = Date.now()): boolean {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now
    writesInWindow = 0
  }
  if (writesInWindow >= MAX_WRITES_PER_WINDOW) return false
  writesInWindow += 1
  return true
}

/** Test seam: resets the in-process window. */
export function resetRegistryWriteBudget(): void {
  windowStart = 0
  writesInWindow = 0
}
