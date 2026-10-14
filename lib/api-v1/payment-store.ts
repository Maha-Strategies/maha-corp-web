import { getRedis } from '../redis.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import { RETENTION_SECONDS, RECEIPT_RETENTION_SECONDS } from './types.ts'
export type PurchaseRecord = { endpointId: string; inputHash: string; dataHash: string; payer: string; nonce: string; createdAt: number;
  state: 'prepared' | 'settling' | 'paid'; data: unknown; transaction?: string; recoverySeconds?: number }
export const payloadDeadline = (record: PurchaseRecord) => record.createdAt + (record.recoverySeconds ?? RETENTION_SECONDS) * 1000
export const receiptDeadline = (record: PurchaseRecord) => record.createdAt + RECEIPT_RETENTION_SECONDS * 1000
export type PaymentStore = {
  get(key: string): Promise<PurchaseRecord | null>; put(key: string, record: PurchaseRecord): Promise<void>;
  lock(key: string, owner: string): Promise<boolean>; owns(key: string, owner: string): Promise<boolean>;
  unlock(key: string, owner: string): Promise<void>; admitPayer(payerHash: string): Promise<boolean>;
}
export function redisPaymentStore(): PaymentStore {
  return {
    get: async key => {
      const record = await getRedis().get<PurchaseRecord>(key)
      if (!record) return null
      const data = await getRedis().get<{ value: unknown }>(key + ':data')
      return { ...record, data: data?.value }
    },
    put: async (key, record) => {
      const ttl = Math.ceil((payloadDeadline(record) - Date.now()) / 1000)
      const evidenceTtl = Math.ceil((receiptDeadline(record) - Date.now()) / 1000)
      if (ttl <= 0 || evidenceTtl <= 0) throw new Error('retention_unavailable')
      if (await getRedis().set(key + ':data', { value: record.data }, { ex: ttl }) !== 'OK') throw new Error('retention_unavailable')
      const metadata = { ...record, data: undefined }
      if (await getRedis().set(key, metadata, { ex: evidenceTtl }) !== 'OK') throw new Error('retention_unavailable')
    },
    lock: async (key, owner) => await getRedis().set(key + ':lock', owner, { nx: true, ex: 90 }) === 'OK',
    owns: async (key, owner) => await getRedis().get(key + ':lock') === owner,
    unlock: async (key, owner) => { await getRedis().eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", [key + ':lock'], [owner]) },
    // Atomic global wallet quota across every domain: 30 new authorizations/minute.
    // Existing retained purchases bypass this quota to preserve recovery.
    admitPayer: async hash => Number(await getRedis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", [scopedRedisKey('api-v1:payer:' + hash)], [])) <= 30,
  }
}
/** Test-only store; never chosen automatically as a production fallback. */
export function memoryPaymentStore(now: () => number = Date.now, quota = 30): PaymentStore {
  const records = new Map<string, PurchaseRecord>(), locks = new Map<string, { owner: string; until: number }>(), wallets = new Map<string, { until: number; count: number }>()
  return {
    get: async key => { const r = records.get(key); if (!r || receiptDeadline(r) <= now()) { records.delete(key); return null }; return structuredClone(payloadDeadline(r) <= now() ? { ...r, data: undefined } : r) },
    put: async (key, r) => { if (payloadDeadline(r) <= now()) throw Error('expired'); records.set(key, structuredClone(r)) },
    lock: async (key, owner) => { if ((locks.get(key)?.until ?? 0) > now()) return false; locks.set(key, { owner, until: now() + 90000 }); return true },
    owns: async (key, owner) => locks.get(key)?.owner === owner && locks.get(key)!.until > now(),
    unlock: async (key, owner) => { if (locks.get(key)?.owner === owner) locks.delete(key) },
    admitPayer: async hash => { const previous = wallets.get(hash), w = previous && previous.until > now() ? previous : { until: now() + 60000, count: 0 }; w.count++; wallets.set(hash, w); return w.count <= quota },
  }
}
