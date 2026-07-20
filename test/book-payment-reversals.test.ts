import assert from 'node:assert/strict'
import test from 'node:test'

// Mirrors the database rule in 20260720001600_book_payment_reversals.sql:
// partial reversals preserve access; full reversal removes it.
function entitlementShouldBeRevoked(originalAmount: number, reversalAmounts: number[]): boolean {
  return reversalAmounts.reduce((total, amount) => total + amount, 0) >= originalAmount
}

test('partial book refunds retain the entitlement until the original payment is fully reversed', () => {
  assert.equal(entitlementShouldBeRevoked(4900, [1200]), false)
  assert.equal(entitlementShouldBeRevoked(4900, [1200, 3700]), true)
})

test('a lost full dispute revokes the book entitlement', () => {
  assert.equal(entitlementShouldBeRevoked(4900, [4900]), true)
})
