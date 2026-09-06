import { releaseSlot } from './concurrency.ts'

// The capacity slot is acquired in proxy.ts, but proxy.ts cannot release it.
//
// Next's proxy runs *before* the route and returns as soon as it decides to
// forward; there is no `finally` that fires when the handler it forwarded to
// finishes. So the token travels downstream as a request header and whoever
// actually observes the work end releases it:
//
//   Synchronous routes  -- a `finally` block in the handler.
//   GPU solver jobs     -- the completion webhook, because the route returns at
//                          dispatch and releasing there would free the slot
//                          while Modal is still running, which is the exact
//                          saturation the cap exists to prevent.
//
// Vercel strips client-supplied `x-maha-*` headers at the proxy boundary for
// matched paths, so a caller cannot forge a token to release someone else's
// slot. Even if one leaked through, ZREM of a token you do not hold is a no-op.

export const SLOT_RESOURCE_HEADER = 'x-maha-slot-resource'
export const SLOT_TOKEN_HEADER = 'x-maha-slot-token'

export type SlotHandle = { resource: string; token: string }

/** Null for every credit-authenticated request, which holds no slot. */
export function slotFromRequest(request: { headers: Headers }): SlotHandle | null {
  const resource = request.headers.get(SLOT_RESOURCE_HEADER)
  const token = request.headers.get(SLOT_TOKEN_HEADER)
  return resource && token ? { resource, token } : null
}

/** Safe to call with null, and safe to call twice. */
export async function releaseHeldSlot(slot: SlotHandle | null): Promise<void> {
  if (!slot) return
  await releaseSlot(slot.resource, slot.token)
}

/**
 * Wraps a synchronous route so its slot is freed when the response is built.
 *
 * Without this the slot is held until its score expires. A compression that
 * finishes in milliseconds would occupy capacity for the full TTL, and a
 * paying caller would be refused for two minutes over work that is long done.
 * The release runs in a `finally` so a thrown handler frees capacity too.
 *
 * Only for routes that finish their work before responding. A route that
 * returns while work continues elsewhere -- the GPU solvers return at dispatch
 * -- must carry the token to whatever observes the real end instead.
 */
export function withSlotRelease<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const slot = slotFromRequest(request)
    try {
      return await handler(request, ...args)
    } finally {
      await releaseHeldSlot(slot)
    }
  }
}

/**
 * Routes whose handlers actually release the slot they are given.
 *
 * Pricing a route that does not release one is a silent capacity leak: the cap
 * fills with slots nobody frees and paying callers are refused until the
 * scores lapse. Nothing about the route makes that visible, so the config is
 * checked against this list at startup and a mistake becomes a loud boot
 * error instead of a slow degradation nobody can attribute.
 *
 * Add a route here only after its handler releases -- via `withSlotRelease`,
 * or by carrying the token through to whatever observes the work finish.
 */
export const SLOT_RELEASING_ROUTES = [
  'POST /api/v1/compress',
  // Wrapped in withSlotRelease, whose `finally` frees the slot on success,
  // on validation failure, and on a thrown handler alike.
  'POST /api/v1/compress/evaluate',
  // Also wrapped, and it matters more here: this route crosses the Anthropic
  // boundary, so a leaked slot is held for the length of a model call rather
  // than a few milliseconds, against a cap of 2.
  'POST /api/v1/mps/audit',
  'POST /api/v1/context/budget-ladder',
  'POST /api/v1/context/evidence-matrix',
  'POST /api/v1/context/governed-verification',
  'POST /api/v1/research/intake',
] as const

/**
 * Exact `METHOD /path` match, deliberately.
 *
 * The old rule treated a listed prefix as covering everything beneath it, so
 * the single entry for /api/v1/compress silently vouched for
 * /api/v1/compress/evaluate before that route existed: a handler nobody had
 * written yet was pre-approved as slot-releasing. Each route now earns its own
 * entry, which is the only thing that makes this allowlist worth having.
 */
export function releasesSlot(method: string, path: string): boolean {
  return (SLOT_RELEASING_ROUTES as readonly string[]).includes(`${method.toUpperCase()} ${path}`)
}
