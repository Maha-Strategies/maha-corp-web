import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProductUsage, readProductUsage, applyCompilerUsage, productUsageDisplay, type UsageRow } from '../lib/x402/product-usage.ts'
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
test('a product without invocation records is not presented as zero historical calls', () => {
  const snapshot = summarizeProductUsage([row({ event_kind: 'challenge', status_class: '4xx' })], ['one', 'new'])
  assert.equal(productUsageDisplay(snapshot, 'one').successful, 'Not recorded')
  assert.equal(productUsageDisplay(snapshot, 'new').successful, 'Not recorded')
  const failure = summarizeProductUsage([row({ status_class: '4xx' })], ['one'])
  assert.equal(productUsageDisplay(failure, 'one').successful, '0')
})
test('dedicated compiler history replaces overlapping counts and excludes API-key and anonymous traffic', () => {
  const snapshot = summarizeProductUsage([row({ offer_id: 'context-compression', event_count: 2 })], ['context-compression'])
  const legacy = (access_mode: string, status_class: string, request_count: number) => ({ access_mode, status_class, request_count,
    first_observed_at: '2026-08-10T00:00:00Z', last_observed_at: '2026-10-09T00:00:00Z' })
  const result = applyCompilerUsage(snapshot, [legacy('x402', '2xx', 7), legacy('x402', '4xx', 1), legacy('api_key', '2xx', 50), legacy('anonymous', '4xx', 100)])
  assert.ok(result.available)
  assert.equal(result.products['context-compression'].successfulCalls, 7) // not 2 + 7
  assert.equal(result.products['context-compression'].unsuccessfulCalls, 1)
  assert.equal(result.firstObservedAt, '2026-08-10T00:00:00Z')
  assert.equal(productUsageDisplay(result, 'context-compression').operator, 'Not classified')
})
test('an unavailable compiler history is unknown rather than a confident zero', async () => {
  const snapshot = await readProductUsage(['context-compression'], async () => ({ data: [], error: null }), async () => ({ data: null, error: 'offline' }))
  assert.equal(productUsageDisplay(snapshot, 'context-compression').successful, 'Unknown')
})
test('compiler history is paginated and malformed history does not hide other valid products', async () => {
  const starts: number[] = []
  const legacy = { access_mode: 'x402', status_class: '2xx', request_count: 1, first_observed_at: row().first_observed_at, last_observed_at: row().last_observed_at }
  const snapshot = await readProductUsage(['context-compression'], async () => ({ data: [], error: null }), async start => {
    starts.push(start); return { data: start ? [legacy] : Array.from({ length: 1000 }, () => legacy), error: null }
  })
  assert.deepEqual(starts, [0, 1000]); assert.ok(snapshot.available)
  assert.equal(snapshot.products['context-compression'].successfulCalls, 1001)
  const bad = await readProductUsage(['one', 'context-compression'], async () => ({ data: [row()], error: null }), async () => ({ data: [{ ...legacy, request_count: -1 }], error: null }))
  assert.equal(productUsageDisplay(bad, 'one').successful, '3')
  assert.equal(productUsageDisplay(bad, 'context-compression').successful, 'Unknown')
})
