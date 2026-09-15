import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countObservedSettlements, decideCompilerPrice,
  type VerifiedBillingObservation, type FacilitatorObservation,
} from '../lib/x402/compiler-price-policy.ts'

const scope = 'synthetic-shared-cdp-scope'
const observation = (count: number): VerifiedBillingObservation => ({
  billingScope: scope, periodStart: '2026-09-01T00:00:00Z',
  periodEnd: '2026-10-01T00:00:00Z', observedAt: '2026-09-09T12:00:00Z',
  successfulTransactions: count, evidenceDigest: `sha256:${'a'.repeat(64)}`,
  coverage: 'shared_facilitator_billing_scope',
})
const decide = (count: number) => decideCompilerPrice({ billingScope: scope, activation: null, observation: observation(count) })

test('999 retains the entry price; 1000 and 1001 activate $0.002', () => {
  assert.equal(decide(999).amount, '1000')
  for (const count of [1000, 1001]) {
    assert.equal(decide(count).kind, 'activate')
    assert.equal(decide(count).amount, '2000')
  }
})

test('a persisted activation never resets at the next billing month or feed outage', () => {
  const result = decide(1000)
  assert.equal(result.kind, 'activate')
  if (result.kind !== 'activate') return
  const nextMonth = {
    ...observation(0), periodStart: '2026-10-01T00:00:00Z',
    periodEnd: '2026-11-01T00:00:00Z', observedAt: '2026-10-02T00:00:00Z',
  }
  for (const next of [nextMonth, null]) {
    const state = decideCompilerPrice({ billingScope: scope, activation: result.activation, observation: next })
    assert.equal(state.kind, 'already_activated')
    assert.equal(state.amount, '2000')
    assert.deepEqual('activation' in state && state.activation, result.activation)
  }
})

test('missing billing evidence does not claim the account is still on the free tier', () => {
  assert.deepEqual(decideCompilerPrice({ billingScope: scope, activation: null, observation: null }), {
    kind: 'awaiting_verified_usage', amount: null,
  })
})

test('wrong scope, endpoint-only coverage and malformed counts cannot activate pricing', () => {
  for (const patch of [
    { billingScope: 'another-account' }, { successfulTransactions: -1 },
    { successfulTransactions: 1000.5 }, { successfulTransactions: NaN },
    { successfulTransactions: Number.MAX_SAFE_INTEGER + 1 },
    { evidenceDigest: 'unverified' }, { coverage: 'observed_settlements_only' },
    { observedAt: '2026-09-09T12:00:00' }, { observedAt: '2026-11-01T00:00:00Z' },
  ]) {
    assert.throws(() => decideCompilerPrice({
      billingScope: scope, activation: null,
      observation: { ...observation(1000), ...patch } as VerifiedBillingObservation,
    }))
  }
})

test('a forged below-threshold activation is rejected', () => {
  assert.throws(() => decideCompilerPrice({
    billingScope: scope, observation: null,
    activation: { policyId: 'context-compression-facilitator-step-up-v1', amount: '2000', observation: observation(999) },
  }), /Invalid permanent/)
})

test('observed usage counts unique successful settlements across offers, including canaries', () => {
  const base: FacilitatorObservation = {
    billingScope: scope, occurredAt: '2026-09-09T12:00:00Z', operation: 'settle',
    success: true, network: 'eip155:8453', transaction: '0xABC', offerId: 'context-compression',
  }
  const rows: FacilitatorObservation[] = [
    base, { ...base, transaction: '0xabc' }, // same settlement on retry
    { ...base, transaction: '0xDEF', publisherFunded: true, offerId: 'claim-triage' },
    { ...base, transaction: 'failed', success: false },
    { ...base, transaction: 'verify', operation: 'verify' },
    { ...base, transaction: 'discovery', operation: 'discovery' },
    { ...base, transaction: 'other-scope', billingScope: 'someone-else' },
    { ...base, transaction: 'next-month', occurredAt: '2026-10-01T00:00:00Z' },
    { ...base, transaction: 'last-month', occurredAt: '2026-08-31T23:59:59Z' },
  ]
  assert.deepEqual(countObservedSettlements(rows, {
    billingScope: scope, start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z',
  }), { successfulTransactionsLowerBound: 2, coverage: 'observed_settlements_only' })
})

test('counts are monthly, never lifetime, and separate chains do not collide', () => {
  const base: FacilitatorObservation = {
    billingScope: scope, occurredAt: '2026-09-01T00:00:00Z', operation: 'settle',
    success: true, network: 'eip155:8453', transaction: 'tx',
  }
  assert.equal(countObservedSettlements([base, { ...base, network: 'eip155:42161' }], {
    billingScope: scope, start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z',
  }).successfulTransactionsLowerBound, 2)
  assert.throws(() => countObservedSettlements([{ ...base, transaction: undefined }], {
    billingScope: scope, start: '2026-09-01T00:00:00Z', end: '2026-10-01T00:00:00Z',
  }), /missing its identity/)
})
