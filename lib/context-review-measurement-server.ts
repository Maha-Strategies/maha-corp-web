import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'
import { reviewCounterField, type ReviewEvent, type ReviewChannel } from './context-review-measurement.ts'

export const REVIEW_MEASUREMENT_RETENTION_SECONDS = 90 * 24 * 60 * 60
type CounterStore = { eval: (script: string, keys: string[], args: (string | number)[]) => Promise<unknown> }
const increment = `local n = redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], 120)
if n > 2000 then return 0 end
redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1`

export async function recordReviewMeasurement(
  event: ReviewEvent, channel: ReviewChannel, transport: 'web' | 'mcp' | 'browser',
  dependencies: { store?: CounterStore; now?: Date } = {},
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const now = dependencies.now ?? new Date()
    const day = now.toISOString().slice(0, 10)
    const minute = now.toISOString().slice(0, 16)
    const store = dependencies.store ?? getRedis()
    return Boolean(await Promise.race([
      store.eval(increment, [scopedRedisKey(`context-review:counts:${day}`), scopedRedisKey(`context-review:cap:${transport}:${minute}`)],
        [reviewCounterField(event, channel, transport), REVIEW_MEASUREMENT_RETENTION_SECONDS]),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 5000) }),
    ]))
  } catch { return false } // Metrics must never break a review or reveal provider details.
  finally { if (timer) clearTimeout(timer) }
}
