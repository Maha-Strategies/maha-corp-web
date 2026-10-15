import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductIndex, productIndexLabel, readProductIndex, MAX_MERCHANT_INDEX_RESOURCES } from '../lib/x402/product-index.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
const at = '2026-10-09T00:00:00Z'
const url = 'https://www.mahastrategies.com/api/v1/example'
test('only observed exact URLs are marked listed', () => {
  const s = parseProductIndex({ payTo: MAHA_PAYEE, resources: [{ resource: url }], pagination: { total: 1, offset: 0 } }, at)
  assert.equal(productIndexLabel(s, '/api/v1/example'), 'Listed in Bazaar merchant record')
  assert.equal(productIndexLabel(s, '/api/v1/missing'), 'Not observed in Bazaar merchant record')
})
test('incomplete or unavailable lookups cannot assert absence', () => {
  const s = parseProductIndex({ payTo: MAHA_PAYEE, resources: [], pagination: { total: 101, offset: 0 } }, at)
  assert.match(productIndexLabel(s, '/missing'), /unknown/)
  assert.match(productIndexLabel({ ...s, available: false }, '/missing'), /unavailable/)
})
test('wrong merchant or malformed payload is rejected, not shown as empty', () => {
  assert.throws(() => parseProductIndex({ resources: [] }, at))
  assert.throws(() => parseProductIndex({ payTo: '0xwrong', resources: [], pagination: { total: 0, offset: 0 } }, at))
})
test('catalogues over 100 are paginated without asserting absence after a changed or failed page', async () => {
  const original = globalThis.fetch
  const rows = Array.from({ length: 101 }, (_, i) => ({ resource: `https://www.mahastrategies.com/api/v1/example-${i}` }))
  try {
    const offsets: number[] = []
    globalThis.fetch = async input => {
      const offset = Number(new URL(String(input)).searchParams.get('offset'))
      offsets.push(offset)
      return Response.json({ payTo: MAHA_PAYEE, resources: rows.slice(offset, offset + 100), pagination: { total: 101, offset } })
    }
    const snapshot = await readProductIndex()
    assert.equal(snapshot.complete, true); assert.equal(snapshot.resources.length, 101)
    assert.deepEqual(offsets, [0, 100])
    globalThis.fetch = async input => {
      const offset = Number(new URL(String(input)).searchParams.get('offset'))
      if (offset) throw new Error('second-page-unavailable')
      return Response.json({ payTo: MAHA_PAYEE, resources: rows.slice(0, 100), pagination: { total: 101, offset: 0 } })
    }
    const partial = await readProductIndex()
    assert.equal(partial.complete, false); assert.equal(partial.resources.length, 100)
    assert.match(productIndexLabel(partial, '/not-observed'), /unknown/)
  } finally { globalThis.fetch = original }
})
test('Bazaar paid-call counts and missing quality metrics remain distinct', () => {
  const snapshot = parseProductIndex({ payTo: MAHA_PAYEE,
    resources: [{ resource: url, serviceName: 'Compiler', quality: { l30DaysTotalCalls: 4, l30DaysUniquePayers: 4, lastCalledAt: at } },
      { resource: url + '-pending' }], pagination: { total: 2, offset: 0 } }, at)
  assert.equal(snapshot.listings?.[url].calls30d, 4)
  assert.equal(snapshot.listings?.[url + '-pending'].calls30d, null)
  assert.equal(snapshot.listings?.[url + '-pending'].serviceName, null)
})
test('one thousand modular products plus legacy listings are fully read, with a bounded shared snapshot', async () => {
  const original = globalThis.fetch, rows = Array.from({ length: 1156 }, (_, i) => ({ resource: url + '-' + i }))
  const offsets: number[] = [], snapshots = new Set<string>()
  try {
    globalThis.fetch = async input => {
      const u = new URL(String(input)), offset = Number(u.searchParams.get('offset'))
      offsets.push(offset); snapshots.add(u.searchParams.get('_maha_snapshot')!)
      return Response.json({ payTo: MAHA_PAYEE, resources: rows.slice(offset, offset + 100), pagination: { total: rows.length, offset } })
    }
    const result = await readProductIndex()
    assert.equal(result.complete, true); assert.equal(result.resources.length, 1156)
    assert.equal(offsets.length, 12); assert.equal(offsets.at(-1), 1100); assert.equal(snapshots.size, 1)
    assert.ok(snapshots.has(result.checkedAt))
    globalThis.fetch = async input => {
      const offset = Number(new URL(String(input)).searchParams.get('offset'))
      const page = Array.from({ length: 100 }, (_, i) => ({ resource: url + '-' + (offset + i) }))
      return Response.json({ payTo: MAHA_PAYEE, resources: page, pagination: { total: 100000, offset } })
    }
    const capped = await readProductIndex()
    assert.equal(capped.complete, false); assert.equal(capped.resources.length, MAX_MERCHANT_INDEX_RESOURCES)
    assert.match(productIndexLabel(capped, '/missing'), /unknown/)
  } finally { globalThis.fetch = original }
})
test('invalid quality metrics and future timestamps never become valid activity', () => {
  const snapshot = parseProductIndex({ payTo: MAHA_PAYEE, resources: [{ resource: url,
    quality: { l30DaysTotalCalls: -1, l30DaysUniquePayers: 1.5, lastCalledAt: '2027-01-01T00:00:00Z' } }], pagination: { total: 1, offset: 0 } }, at)
  assert.deepEqual(snapshot.listings?.[url], { serviceName: null, calls30d: null, payers30d: null, lastCalledAt: null })
  assert.throws(() => parseProductIndex({ payTo: MAHA_PAYEE, resources: [{ resource: url }, { resource: url }], pagination: { total: 2, offset: 0 } }, at))
})
