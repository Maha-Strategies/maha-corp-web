import test from 'node:test'
import assert from 'node:assert/strict'
import { payableOffers } from '../lib/x402/offers.ts'
import { BAZAAR_LAUNCH_IDS, BAZAAR_PREVIOUS_AMOUNTS } from '../lib/x402/bazaar-launch.ts'
import { selected, COMPLETED_LAUNCH_PAYMENT } from '../scripts/run-bazaar-listing-refresh.ts'

test('reconciled continuation excludes the settled purchase and caps the remaining spend', () => {
  const remaining = selected('launch-remaining')
  assert.equal(remaining.length, 22)
  assert.ok(remaining.every(o => o.id !== COMPLETED_LAUNCH_PAYMENT.offerId))
  assert.equal(remaining.reduce((s, o) => s + BigInt(o.amount), BigInt(0)), BigInt(1_274_000))
  assert.equal(BigInt(COMPLETED_LAUNCH_PAYMENT.amount) + BigInt(1_274_000), BigInt(1_280_000))
})

test('approved launch is exactly 23 offers, all below one dollar, total 1.28 USDC', () => {
  const cohort = selected('launch')
  assert.equal(cohort.length, 23)
  assert.deepEqual(cohort.map(o => o.id).sort(), [...BAZAAR_LAUNCH_IDS].sort())
  assert.equal(cohort.reduce((s, o) => s + BigInt(o.amount), BigInt(0)), BigInt(1_280_000))
  for (const o of cohort) {
    assert.ok(BigInt(o.amount) < BigInt(1_000_000))
    assert.ok(Buffer.byteLength(o.description) <= 480)
    assert.ok(o.discovery.input && o.discovery.output && o.discovery.inputSchema && o.discovery.outputSchema)
  }
})

test('old seven prices remain attributable and cannot collide with another current or old price', () => {
  const owners = new Map<string, string>()
  for (const o of payableOffers()) for (const amount of [o.amount, ...(o.supersededAmounts ?? [])]) {
    assert.ok(!owners.has(amount) || owners.get(amount) === o.id, amount)
    owners.set(amount, o.id)
  }
  for (const [id, old] of Object.entries(BAZAAR_PREVIOUS_AMOUNTS)) {
    for (const amount of old) assert.equal(owners.get(amount), id)
  }
})
