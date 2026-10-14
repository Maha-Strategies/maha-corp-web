import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { payloadDeadline, receiptDeadline, type PaymentStore, type PurchaseRecord } from './payment-store.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

/** Explicit local durable journal. Never an automatic Redis/production fallback. */
export function localPaymentJournal(path: string, options: { now?: () => number; environment?: NodeJS.ProcessEnv } = {}) {
  const env = options.environment ?? process.env, now = options.now ?? Date.now
  if (!['test', 'development'].includes(env.NODE_ENV ?? '') || env.VERCEL || env.VERCEL_ENV) throw Error('local_journal_refuses_hosted_environment')
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path); chmodSync(path, 0o600)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS purchases (key TEXT PRIMARY KEY, metadata TEXT NOT NULL, payload TEXT, payload_expires INTEGER NOT NULL, receipt_expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS transitions (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, state TEXT NOT NULL, at INTEGER NOT NULL, digest TEXT NOT NULL, transaction_id TEXT, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS locks (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`)
  function atomic<T>(effect: () => T) { db.exec('BEGIN IMMEDIATE'); try { const result = effect(); db.exec('COMMIT'); return result } catch (error) { db.exec('ROLLBACK'); throw error } }
  const prune = () => {
    const removed = atomic(() => {
    const payloads = db.prepare('UPDATE purchases SET payload=NULL WHERE payload IS NOT NULL AND payload_expires<=?').run(now()).changes
    const receipts = db.prepare('DELETE FROM purchases WHERE receipt_expires<=?').run(now()).changes
    db.prepare('DELETE FROM transitions WHERE expires<=?').run(now()); db.prepare('DELETE FROM locks WHERE expires<=?').run(now()); db.prepare('DELETE FROM quota WHERE expires<=?').run(now())
    return { payloads: Number(payloads), receipts: Number(receipts) }
    })
    if (removed.payloads || removed.receipts) db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    return removed
  }
  const store: PaymentStore = {
    get: async key => { prune(); const row = db.prepare('SELECT metadata,payload FROM purchases WHERE key=?').get(key); if (!row) return null
      return { ...JSON.parse(String(row.metadata)), data: row.payload === null ? undefined : JSON.parse(String(row.payload)) } as PurchaseRecord },
    put: async (key, record) => atomic(() => {
      if (payloadDeadline(record) <= now() || receiptDeadline(record) <= now() || record.dataHash !== demandDigest(record.data)) throw Error('invalid_or_expired_record')
      const old = db.prepare('SELECT metadata FROM purchases WHERE key=?').get(key)
      if (old) { const prior = JSON.parse(String(old.metadata)) as PurchaseRecord
        if (prior.createdAt !== record.createdAt || prior.endpointId !== record.endpointId || prior.inputHash !== record.inputHash || prior.dataHash !== record.dataHash
          || prior.payer !== record.payer || prior.nonce !== record.nonce || prior.recoverySeconds !== record.recoverySeconds
          || (prior.state === 'paid' && record.state !== 'paid') || (prior.state === 'settling' && record.state === 'prepared')
          || (prior.transaction && prior.transaction !== record.transaction)) throw Error('purchase_identity_or_state_conflict') }
      const metadata = JSON.stringify({ ...record, data: undefined })
      db.prepare('INSERT INTO purchases VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET metadata=excluded.metadata,payload=excluded.payload').run(key, metadata, JSON.stringify(record.data), payloadDeadline(record), receiptDeadline(record))
      db.prepare('INSERT INTO transitions (key,state,at,digest,transaction_id,expires) VALUES (?,?,?,?,?,?)').run(key, record.state, now(), demandDigest(JSON.parse(metadata)), record.transaction ?? null, receiptDeadline(record))
    }),
    lock: async (key, owner) => atomic(() => { db.prepare('DELETE FROM locks WHERE key=? AND expires<=?').run(key, now()); return db.prepare('INSERT OR IGNORE INTO locks VALUES (?,?,?)').run(key, owner, now() + 90000).changes === 1 }),
    owns: async (key, owner) => Boolean(db.prepare('SELECT 1 FROM locks WHERE key=? AND owner=? AND expires>?').get(key, owner, now())),
    unlock: async (key, owner) => { db.prepare('DELETE FROM locks WHERE key=? AND owner=?').run(key, owner) },
    admitPayer: async key => atomic(() => { db.prepare('DELETE FROM quota WHERE key=? AND expires<=?').run(key, now()); db.prepare('INSERT INTO quota VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now() + 60000); return Number(db.prepare('SELECT count FROM quota WHERE key=?').get(key)!.count) <= 30 }),
  }
  return { store, prune, close: () => db.close() }
}
