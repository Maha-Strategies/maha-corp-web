import { scopedRedisKey } from '../redis-namespace.ts'

// Payment authorizes a request. It says nothing about capacity.
//
// An agent willing to spend a few dollars in sub-cent increments could
// otherwise queue thousands of GPU solver jobs, and Modal would bill every one
// of them. Credit-based callers are bounded by their balance and a per-minute
// key limit; a paying caller has neither, so the cap has to be per resource.
//
// A slot is taken on admission and released either explicitly, by whoever
// observes the work finish, or by its own expiry. The TTL is the safety net:
// a request that dies mid-flight must not hold a slot forever. It should be
// set at or above the slowest expected duration for the resource, because a
// slot that expires while work is still running admits more concurrency than
// the cap allows.

const ACQUIRE = `
local key = KEYS[1]
local cap = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local active = redis.call('INCR', key)
if active == 1 then redis.call('EXPIRE', key, ttl) end
if active > cap then
  redis.call('DECR', key)
  return {0, active - 1}
end
-- Re-arm the expiry so a busy resource cannot have its counter outlive the
-- work it represents.
redis.call('EXPIRE', key, ttl)
return {1, active}
`

const RELEASE = `
local key = KEYS[1]
local active = tonumber(redis.call('GET', key) or '0')
if active <= 0 then return 0 end
return redis.call('DECR', key)
`

export type SlotResult = { admitted: boolean; active: number }

function slotKey(pathPrefix: string): string {
  return scopedRedisKey(`x402:inflight:${pathPrefix}`)
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
 * Fails closed. If the counter cannot be read the request is refused, because
 * admitting unbounded paid work to protect against a Redis outage is the wrong
 * trade for GPU compute someone else is billing us for.
 */
export async function acquireSlot(pathPrefix: string, cap: number, ttlSeconds: number): Promise<SlotResult> {
  try {
    const result = await (await client()).eval(ACQUIRE, [slotKey(pathPrefix)], [String(cap), String(ttlSeconds)]) as [number, number]
    const [admitted, active] = result
    return { admitted: admitted === 1, active }
  } catch (error) {
    console.error('x402 concurrency acquire failed:', error instanceof Error ? error.name : 'unknown_error')
    return { admitted: false, active: cap }
  }
}

/**
 * Called by whoever observes the work finish. Releasing is best-effort: a
 * missed release costs one slot until the TTL expires, which is a throughput
 * cost rather than a correctness one.
 */
export async function releaseSlot(pathPrefix: string): Promise<void> {
  try {
    await (await client()).eval(RELEASE, [slotKey(pathPrefix)], [])
  } catch (error) {
    console.error('x402 concurrency release failed:', error instanceof Error ? error.name : 'unknown_error')
  }
}
