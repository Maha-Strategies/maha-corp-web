import assert from 'node:assert/strict'
import test from 'node:test'
import { categoryProfile, fetchMerchantPages, merchantSignals, rankInFrozenCohort, sellerCohort,
  snapshotAge, validateDataset, type MarketService } from '../scripts/lib/x402-market-intelligence.ts'
function service(host: string, id: number, calls: number | null, payers: number | null = 1): MarketService {
  return { u: `https://${host}/api/${id}`, n: 'Service', d: 'Bounded output', t: ['evidence'], p: 0.01, w: 'eip155:8453', c: calls, y: payers }
}
test('snapshot freshness uses source time, not a freshly wrapped response', () => {
  assert.equal(snapshotAge('2026-10-10T00:00:00Z', Date.parse('2026-10-11T03:00:00Z')).freshness, 'aging')
  assert.equal(snapshotAge('2026-10-01T00:00:00Z', Date.parse('2026-10-11T03:00:00Z')).freshness, 'stale')
  assert.throws(() => snapshotAge('2026-10-12T00:00:00Z', Date.parse('2026-10-11T03:00:00Z')))
})
test('host aggregation counts distinct sellers and exposes only payer bounds', () => {
  const rows = [service('a.test', 1, 3, 2), service('a.test', 2, 4, 2), service('b.test', 1, 5)]
  const sellers = sellerCohort(rows)
  assert.equal(sellers.length, 2); assert.equal(sellers[0].calls30dKnown, 7)
  assert.equal(sellers[0].payerLowerBound, 2); assert.equal(sellers[0].payerUpperBound, 4)
  assert.equal(rankInFrozenCohort(rows, 'a.test').rank, 1)
  assert.equal(rankInFrozenCohort(rows, 'a.test', 4).rank, 2)
  assert.equal(rankInFrozenCohort(rows, 'a.test', 4).currentRankClaimAllowed, false)
})
test('unknown calls do not produce a definitive rank or fake zero', () => {
  assert.equal(rankInFrozenCohort([service('a.test', 1, null)], 'a.test').rank, null)
  const observed = merchantSignals([{ resource: 'https://a.test/1' }], ['https://a.test/1'], Date.now())
  assert.equal(observed.resourcesWithCallMetrics, 0); assert.equal(observed.observations[0].calls30d, null)
  assert.equal(observed.qualityMetricsComplete, false); assert.equal(observed.automaticRefreshPayments, false)
})
test('category reports route inflation and host concentration without pricing claims', () => {
  const rows = [service('bulk.test', 1, 10), service('bulk.test', 2, 10), service('small.test', 1, 1)]
  const profile = categoryProfile(rows, 'evidence')
  assert.equal(profile.resources, 3); assert.equal(profile.sellerHosts, 2)
  assert.equal(profile.leadingHostCallShare, 20 / 21)
})
test('duplicate rows and absent source provenance are rejected', () => {
  const s = service('a.test', 1, 1)
  const fixture = { count: 1, generatedAt: '2026-10-11T00:00:00Z', receipt: { snapshotGeneratedAt: '2026-10-10T00:00:00Z', snapshotHash: 'abc' }, services: [s] }
  validateDataset(fixture)
  assert.throws(() => validateDataset({ ...fixture, receipt: {} }))
  assert.throws(() => validateDataset({ ...fixture, count: 2, services: [s, s] }))
})
test('pagination covers more than 100 resources without silently stopping at page one', async () => {
  const resources = Array.from({ length: 105 }, (_, i) => ({ resource: `https://a.test/${i}` }))
  const offsets: number[] = []
  const fetcher = (async (url: string | URL) => {
    const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset)
    return Response.json({ resources: resources.slice(offset, offset + 100), pagination: { total: 105, offset } })
  }) as typeof fetch
  assert.equal((await fetchMerchantPages('https://discovery.test/merchant', fetcher)).length, 105)
  assert.deepEqual(offsets, [0, 100])
})
test('changing or truncated pagination fails visibly instead of publishing partial coverage', async () => {
  const empty = (async () => Response.json({ resources: [], pagination: { total: 105, offset: 0 } })) as typeof fetch
  await assert.rejects(fetchMerchantPages('https://discovery.test/merchant', empty))
})
