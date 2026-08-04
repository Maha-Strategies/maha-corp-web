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
