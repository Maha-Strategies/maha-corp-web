import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { assertUniqueCohortPrices } from '../lib/x402/micro-price-policy.ts'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { PLANNING_IDS } from '../lib/x402/micro-planning-contracts.ts'
import { OPERATOR_SETTLEMENT_RECEIPTS } from '../lib/x402/operator-settlement-receipts.ts'

test('ten prices avoid the full catalog, reserved history and observed settlement amounts', () => {
  const ledger = JSON.parse(readFileSync(new URL('../content/x402/settlement-ledger.json', import.meta.url), 'utf8'))
  const history = [
    ...OPERATOR_SETTLEMENT_RECEIPTS.map(r => ({ id: r.offerId, amount: r.amountBaseUnits })),
    ...ledger.entries.map((e: { product: { id: string } | null; amountBaseUnits: string }) => ({ id: e.product?.id ?? 'unattributed-historical-transfer', amount: e.amountBaseUnits })),
  ]
  assert.doesNotThrow(() => assertUniqueCohortPrices(X402_OFFERS, PLANNING_IDS, history))
  const amounts = PLANNING_IDS.map(id => X402_OFFERS.find(o => o.id === id)!.amount)
  assert.equal(new Set(amounts).size, 10)
  assert.equal(amounts.reduce((sum, amount) => sum + BigInt(amount), BigInt(0)), BigInt(976000), 'fixed published prices stay within the 0.98 USDC indexing authorization')
})

test('price guard refuses collisions with current, withheld, superseded and historical offers', () => {
  const candidate = { id: 'candidate', amount: '30000' }
  for (const offers of [
    [candidate, { id: 'other', amount: '30000' }],
    [candidate, { id: 'other-withheld', amount: '30000' }],
    [candidate, { id: 'old', amount: '60000', supersededAmounts: ['30000'] }],
    [candidate, { id: 'padded-reservation', amount: '030000' }],
  ]) assert.throws(() => assertUniqueCohortPrices(offers, ['candidate']), /reserved-price-collision/)
  assert.throws(() => assertUniqueCohortPrices([candidate], ['candidate'], [{ id: 'old', amount: '30000' }]), /reserved-price-collision/)
  assert.doesNotThrow(() => assertUniqueCohortPrices([candidate], ['candidate'], [{ id: 'candidate', amount: '30000' }]))
  assert.doesNotThrow(() => assertUniqueCohortPrices([candidate, { id: 'legacy-a', amount: '5000' }, { id: 'legacy-b', amount: '5000' }], ['candidate']))
})

test('price guard refuses missing, duplicate and noncanonical cohort declarations', () => {
  assert.throws(() => assertUniqueCohortPrices([], ['missing']), /missing-or-duplicate/)
  assert.throws(() => assertUniqueCohortPrices([{ id: 'a', amount: '30000' }], ['a', 'a']), /duplicate-price-cohort-id/)
  assert.throws(() => assertUniqueCohortPrices([{ id: 'a', amount: '30000' }, { id: 'a', amount: '40000' }], ['a']), /missing-or-duplicate/)
  for (const amount of ['0', '-1', '0.03', '030000', 'NaN']) assert.throws(() => assertUniqueCohortPrices([{ id: 'a', amount }], ['a']), /invalid-price-amount/)
})
