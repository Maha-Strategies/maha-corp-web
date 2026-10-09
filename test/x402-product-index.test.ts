import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductIndex, productIndexLabel } from '../lib/x402/product-index.ts'
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
