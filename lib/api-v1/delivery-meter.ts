import { getRedis } from '../redis.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import { RECEIPT_RETENTION_SECONDS } from './types.ts'
const meter = () => scopedRedisKey('api-v1:delivery-aggregate')
const OPERATOR = '0x7b7ff44288fade4a1829aba2584dfceb952146f2'
/** Counts validated server responses, not browser receipt or useful buyer outcomes.
 * Receipt-key deduplication expires at the original receipt deadline. Aggregates
 * have no payer/input/signature fields and expire after 90 days of inactivity. */
export async function recordModularDelivery(key: string, id: string, payer: string, createdAt: number, replayed: boolean) {
  const ttl = Math.ceil((createdAt + RECEIPT_RETENTION_SECONDS * 1000 - Date.now()) / 1000)
  if (ttl <= 0) return
  try { await getRedis().eval(`
    if ARGV[3] == '1' then redis.call('HINCRBY', KEYS[2], ARGV[1] .. ':recovery', 1)
    elseif redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[4]) then
      redis.call('HINCRBY', KEYS[2], ARGV[1] .. ':new', 1)
      if ARGV[2] == '1' then redis.call('HINCRBY', KEYS[2], ARGV[1] .. ':operator', 1) end
    end
    redis.call('EXPIRE', KEYS[2], ARGV[5]); return 1`,
    [key + ':delivery-meter', meter()], [id, payer.toLowerCase() === OPERATOR ? '1' : '0', replayed ? '1' : '0', ttl, RECEIPT_RETENTION_SECONDS])
  } catch { /* Never withhold a paid result because an aggregate meter failed. */ }
}
export async function readModularDeliveryMeter() {
  try {
    const rows = await getRedis().hgetall<Record<string, number>>(meter())
    if (!rows || Object.values(rows).some(n => !Number.isSafeInteger(Number(n)) || Number(n) < 0)) return null
    return rows
  } catch { return null }
}
