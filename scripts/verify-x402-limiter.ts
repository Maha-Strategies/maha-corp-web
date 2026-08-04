/**
 * Exercises the concurrency limiter's Lua against the real Redis this
 * deployment uses.
 *
 * The unit tests stub fetch and assert the wiring; they cannot tell you that
 * ZREMRANGEBYSCORE, ZCARD and ZADD compose the way the cap depends on. This
 * can, and it is worth running whenever the script changes or a Redis plan is
 * migrated.
 *
 *   node --experimental-strip-types scripts/verify-x402-limiter.ts
 *
 * Runs under a throwaway namespace and cleans up after itself, so it is safe
 * against a Redis instance that is also serving traffic.
 */

import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.')
  process.exit(1)
}

process.env.MAHA_REDIS_NAMESPACE = `x402-verify-${Date.now()}`

const { acquireSlot, releaseSlot, activeSlots } = await import('../lib/x402/concurrency.ts')
const { redis } = await import('../lib/redis.ts')
const { scopedRedisKey } = await import('../lib/redis-namespace.ts')

const CAP = 'verify/cap'
const EXPIRY = 'verify/expiry'
let failures = 0

function check(description: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${description}${ok ? '' : ` -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`)
}

const first = await acquireSlot(CAP, 2, 60)
const second = await acquireSlot(CAP, 2, 60)
const third = await acquireSlot(CAP, 2, 60)

check('the cap admits exactly its limit', [first.admitted, second.admitted, third.admitted], [true, true, false])
check('each holder gets a distinct token', first.token !== second.token, true)
check('a refused caller gets no token', third.token, undefined)

// The failure the counter version had: a retried release decremented twice and
// let an extra caller past the cap.
await releaseSlot(CAP, first.token!)
await releaseSlot(CAP, first.token!)
check('a double release frees one slot, not two', await activeSlots(CAP), 1)

const fourth = await acquireSlot(CAP, 2, 60)
const fifth = await acquireSlot(CAP, 2, 60)
check('the freed slot is reusable', fourth.admitted, true)
check('and the cap still holds after it', fifth.admitted, false)

await releaseSlot(CAP, 'not-a-token-anyone-holds')
check('a token nobody holds frees nothing', await activeSlots(CAP), 2)

// Per-token expiry: the short slot lapses while its neighbour keeps running.
await acquireSlot(EXPIRY, 5, 1)
await acquireSlot(EXPIRY, 5, 60)
check('both holders are counted', await activeSlots(EXPIRY), 2)
await new Promise((resolve) => setTimeout(resolve, 1_600))
check('only the lapsed holder is dropped', await activeSlots(EXPIRY), 1)

await redis.del(scopedRedisKey(`x402:concurrency:${CAP}`), scopedRedisKey(`x402:concurrency:${EXPIRY}`))

console.log(failures === 0 ? '\nAll limiter invariants hold against live Redis.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
