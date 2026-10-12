import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { redisDemandStore, demandStoreKey } from '../lib/x402/demand6/store.ts'
import { getRedis } from '../lib/redis.ts'
import { buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { DEMAND6_SAMPLES } from '../lib/x402/demand6/contracts.ts'
import { fixtureDependencies } from '../lib/x402/demand6/fixtures.ts'
// Only synthetic records under an unpredictable, exact task-owned key. Never scans keys.
export async function checkDemandStore() {
  const store = redisDemandStore(), key = demandStoreKey('csv-import-preflight', randomBytes(32).toString('hex')), token = randomUUID()
  try {
    assert.equal(await store.lock(key, token), true)
    assert.equal(await store.lock(key, 'not-owner'), false)
    await store.unlock(key, 'not-owner'); assert.equal(await store.owns(key, token), true)
    const product = await buildDemandProduct('csv-import-preflight', DEMAND6_SAMPLES['csv-import-preflight'], fixtureDependencies)
    const row = { inputHash: product.inputHash, product, payer: 'synthetic-store-check', network: 'eip155:8453', createdAt: Date.now(), state: 'prepared' as const }
    await store.put(key, row); assert.deepEqual(await store.get(key), row)
    const ttl = await getRedis().ttl(key); assert.ok(ttl > 86300 && ttl <= 86400)
    await store.unlock(key, token); assert.equal(await store.owns(key, token), false)
    console.log(JSON.stringify({ state: 'passed', syntheticRoundTrip: true, ownerCheckedLock: true, retentionTtlSeconds: ttl, payments: 0 }))
  } finally {
    await store.unlock(key, token)
    await getRedis().del(key) // Exactly the unpredictable task-owned synthetic key.
  }
}
