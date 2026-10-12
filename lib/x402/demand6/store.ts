import { getRedis } from '../../redis.ts'
import { scopedRedisKey } from '../../redis-namespace.ts'
import { DEMAND6_RETAIN_SECONDS, type Demand6Id } from './contracts.ts'
import type { ClaimedDiscoverySource } from '../discovery-attribution.ts'
export type PreparedRecord = { inputHash: string; payer: string; network: string; createdAt: number; product: unknown;
  state: 'prepared' | 'paid'; receiptHeader?: string; discoverySource?: ClaimedDiscoverySource }
export type DemandStore = { get(key: string): Promise<PreparedRecord | null>; put(key: string, value: PreparedRecord): Promise<void>;
  lock(key: string, token: string): Promise<boolean>; owns(key: string, token: string): Promise<boolean>; unlock(key: string, token: string): Promise<void> }
export const demandStoreKey = (id: Demand6Id, paymentId: string) => {
  if (!/^0x[\da-f]{64}$/i.test(paymentId) && !/^[\da-f]{64}$/i.test(paymentId)) throw new Error('invalid_payment_id')
  return scopedRedisKey(`x402:demand6:${id}:${paymentId}`)
}
export function redisDemandStore(): DemandStore {
  return {
    get: key => getRedis().get<PreparedRecord>(key),
    put: async (key, value) => {
      const ttl = Math.min(DEMAND6_RETAIN_SECONDS, Math.ceil((value.createdAt + DEMAND6_RETAIN_SECONDS * 1000 - Date.now()) / 1000))
      if (ttl <= 0 || await getRedis().set(key, value, { ex: ttl }) !== 'OK') throw new Error('result_retention_unavailable')
    },
    lock: async (key, token) => await getRedis().set(key + ':lock', token, { nx: true, ex: 90 }) === 'OK',
    owns: async (key, token) => await getRedis().get(key + ':lock') === token,
    unlock: async (key, token) => { await getRedis().eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0", [key + ':lock'], [token]) },
  }
}
/** Explicit local test seam only. Production never silently substitutes memory for Redis. */
export function memoryDemandStore(): DemandStore {
  const records = new Map<string, PreparedRecord>(), locks = new Map<string, string>()
  return { get: async key => records.has(key) ? structuredClone(records.get(key)!) : null,
    put: async (key, value) => { records.set(key, structuredClone(value)) },
    lock: async (key, token) => { if (locks.has(key)) return false; locks.set(key, token); return true },
    owns: async (key, token) => locks.get(key) === token,
    unlock: async (key, token) => { if (locks.get(key) === token) locks.delete(key) },
  }
}
