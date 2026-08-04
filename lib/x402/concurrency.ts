import { scopedRedisKey } from '../redis-namespace.ts'

// Payment authorizes a request. It says nothing about capacity.
//
// An agent willing to spend a few dollars in sub-cent increments could
// otherwise queue thousands of GPU solver jobs, and Modal would bill every one
// of them. Credit-based callers are bounded by their balance and a per-minute
// key limit; a paying caller has neither, so the cap has to be per resource.
//
// A sorted set, not a counter. Each holder gets a token scored by its own
// expiry, which buys two properties a counter cannot:
//
//   Stale slots expire individually. A counter with a TTL on the key releases
//   every slot at once when it fires, including ones still doing work.
//
//   Release is idempotent and targeted. ZREM of a token you hold is a no-op
//   the second time, whereas a blind DECR under-counts on a retried release
//   and admits more concurrency than the cap allows.
//
// Upstash speaks HTTP, so a ZCARD followed by a ZADD would race between two
// requests. Both live in one EVAL, which Redis runs atomically.

const ACQUIRE = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
local expires_at = tonumber(ARGV[3])
local token = ARGV[4]
local ttl_ms = tonumber(ARGV[5])

-- Drop tokens whose holders died before releasing.
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)

local active = redis.call('ZCARD', key)
if active >= cap then
  return {0, active}
end

redis.call('ZADD', key, expires_at, token)
-- Janitor only: an idle resource's key should not live forever. Individual
-- expiry is still the score above.
redis.call('PEXPIRE', key, ttl_ms)
return {1, active + 1}
`

const RELEASE = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now)
local removed = redis.call('ZREM', key, ARGV[2])
return {removed, redis.call('ZCARD', key)}
`

export type SlotResult = { admitted: boolean; active: number; token?: string }

function slotKey(resourceId: string): string {
  return scopedRedisKey(`x402:concurrency:${resourceId}`)
}

/**
 * Imported on use rather than at module load. lib/redis throws when its
 * credentials are absent, and importing this module must not require Redis
 * configuration on a deployment where x402 is switched off.
 */
async function client() {
  const { redis } = await import('../redis.ts')
  return redis
}

/**
 * Fails closed. If the set cannot be read the request is refused, because
 * admitting unbounded paid work to survive a Redis outage is the wrong trade
 * for GPU compute someone else bills us for.
 *
 * The returned token must be handed to `releaseSlot` when the work finishes.
 * Losing it costs one slot until its score expires -- a throughput cost, not a
 * correctness one.
 */
export async function acquireSlot(resourceId: string, cap: number, ttlSeconds: number): Promise<SlotResult> {
  const token = crypto.randomUUID()
  const now = Date.now()
  const ttlMs = ttlSeconds * 1_000
  try {
    const [admitted, active] = await (await client()).eval(
      ACQUIRE,
      [slotKey(resourceId)],
      [String(now), String(cap), String(now + ttlMs), token, String(ttlMs)],
    ) as [number, number]
    return admitted === 1 ? { admitted: true, active, token } : { admitted: false, active }
  } catch (error) {
    console.error('x402 concurrency acquire failed:', error instanceof Error ? error.name : 'unknown_error')
    return { admitted: false, active: cap }
  }
}

/**
 * Called by whoever observes the work finish.
 *
 * For a synchronous route that is a `finally` block. For the GPU solvers it is
 * the job-completion webhook, because the route returns as soon as the job is
 * dispatched and releasing there would free the slot while Modal is still
 * running -- which is the exact saturation this exists to prevent.
 */
export async function releaseSlot(resourceId: string, token: string): Promise<void> {
  if (!token) return
  try {
    await (await client()).eval(RELEASE, [slotKey(resourceId)], [String(Date.now()), token])
  } catch (error) {
    console.error('x402 concurrency release failed:', error instanceof Error ? error.name : 'unknown_error')
  }
}

/** Current holders, after pruning expired ones. For diagnostics only. */
export async function activeSlots(resourceId: string): Promise<number> {
  try {
    const redis = await client()
    await redis.zremrangebyscore(slotKey(resourceId), '-inf', Date.now())
    return await redis.zcard(slotKey(resourceId))
  } catch {
    return -1
  }
}
