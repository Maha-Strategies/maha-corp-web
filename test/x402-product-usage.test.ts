import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProductUsage, readProductUsage, type UsageRow } from '../lib/x402/product-usage.ts'
const row = (extra: Partial<UsageRow> = {}): UsageRow => ({ offer_id: 'one', event_kind: 'invocation', status_class: '2xx', discovery_source: 'unknown', event_count: 3, first_observed_at: '2026-10-01T00:00:00Z', last_observed_at: '2026-10-09T00:00:00Z', ...extra })
test('calls, unpaid challenges, failures and declared tests remain separate', () => {
  const s = summarizeProductUsage([row(), row({ event_kind: 'challenge', status_class: '4xx', event_count: 9 }), row({ status_class: '5xx', event_count: 2 }), row({ discovery_source: 'maha_canary', event_count: 1 })], ['one', 'new'])
  assert.ok(s.available)
  assert.deepEqual(s.products.one, { successfulCalls: 4, challenges: 9, unsuccessfulCalls: 2, declaredOperatorCalls: 1 })
  assert.equal(s.products.new.successfulCalls, 0)
})
test('unavailable telemetry is not reported as zero', async () => {
  const s = await readProductUsage(['one'], async () => ({ data: null, error: 'offline' }))
  assert.equal(s.available, false); assert.deepEqual(s.products, {})
})
test('invalid or overflowing counts fail closed', async () => {
  assert.throws(() => summarizeProductUsage([row({ event_count: -1 })], ['one']))
  assert.throws(() => summarizeProductUsage([row({ event_count: Number.MAX_SAFE_INTEGER }), row()], ['one']))
  assert.equal((await readProductUsage(['one'], async () => ({ data: [row({ event_count: NaN })], error: null }))).available, false)
})
test('pagination reads every aggregate row instead of silently using the first page', async () => {
  const starts: number[] = []
  const s = await readProductUsage(['one'], async start => {
    starts.push(start)
    return { data: start === 0 ? Array.from({ length: 1000 }, () => row({ event_count: 1 })) : [row()], error: null }
  })
  assert.deepEqual(starts, [0, 1000]); assert.ok(s.available); assert.equal(s.products.one.successfulCalls, 1003)
})
test('query errors after the first page do not publish partial totals', async () => {
  const s = await readProductUsage(['one'], async start => ({ data: start === 0 ? Array.from({ length: 1000 }, () => row()) : null, error: start ? 'offline' : null }))
  assert.equal(s.available, false)
})
