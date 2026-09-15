import { getRedis } from './redis.ts'
import { scopedRedisKey } from './redis-namespace.ts'

export type ReadingCapacity = 'accepted' | 'limited' | 'unavailable'
export const READING_CAPACITY_SCRIPT = `
local minute=tonumber(redis.call('GET',KEYS[1]) or '0')
local day=tonumber(redis.call('GET',KEYS[2]) or '0')
if minute>=30 or day>=1000 then return 0 end
local m=redis.call('INCR',KEYS[1])
if m==1 then redis.call('EXPIRE',KEYS[1],60) end
local d=redis.call('INCR',KEYS[2])
if d==1 then redis.call('EXPIRE',KEYS[2],86400) end
return 1`

/** Atomic shared service budget: no IP, birth data, user identifier or report. */
export async function consumeReadingCapacity(
  evaluate: (script: string, keys: string[]) => Promise<unknown> = (script, keys) => getRedis().eval(script, keys, []),
): Promise<ReadingCapacity> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      evaluate(READING_CAPACITY_SCRIPT, [scopedRedisKey('jyotisha:capacity:minute'), scopedRedisKey('jyotisha:capacity:day')]),
      new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), 2000) }),
    ])
    return result === 1 ? 'accepted' : result === 0 ? 'limited' : 'unavailable'
  } catch { return 'unavailable' }
  finally { if (timeout) clearTimeout(timeout) }
}
