import assert from 'node:assert/strict'
import test from 'node:test'

import { applyManualMetadataRefresh, decideBazaarCanary, findContextCompiler } from '../lib/x402/bazaar-canary.ts'
import { MAHA_CONTEXT_RESOURCE, type BazaarResource } from '../lib/x402/discovery-payment-recipe.ts'

const now = Date.parse('2026-08-29T12:00:00.000Z')

function resource(lastCalledAt?: string): BazaarResource {
  return {
    resource: MAHA_CONTEXT_RESOURCE,
    quality: lastCalledAt ? { lastCalledAt, l30DaysTotalCalls: 2, l30DaysUniquePayers: 1 } : {},
  }
}

test('organic activity inside 21 days suppresses the paid canary', () => {
  const decision = decideBazaarCanary(resource('2026-08-09T12:00:00.000Z'), now)
  assert.equal(decision.shouldPay, false)
  assert.equal(decision.reason, 'settlement_recent')
  assert.equal(decision.ageDays, 20)
})

test('a settlement at the 21-day threshold permits exactly one caller-controlled canary', () => {
  const decision = decideBazaarCanary(resource('2026-08-08T12:00:00.000Z'), now)
  assert.equal(decision.shouldPay, true)
  assert.equal(decision.reason, 'settlement_stale')
  assert.equal(decision.ageDays, 21)
})

test('a missing listing or last-call timestamp requests recovery settlement', () => {
  assert.equal(decideBazaarCanary(null, now).reason, 'listing_missing')
  assert.equal(decideBazaarCanary(resource(), now).reason, 'last_call_missing')
})

test('a future timestamp fails closed instead of paying', () => {
  assert.throws(
    () => decideBazaarCanary(resource('2026-08-30T12:00:00.000Z'), now),
    /timestamp in the future/,
  )
})

test('a reviewed manual metadata refresh overrides only the inactivity decision', () => {
  const recent = decideBazaarCanary(resource('2026-08-29T11:00:00.000Z'), now)
  assert.equal(recent.shouldPay, false)

  const forced = applyManualMetadataRefresh(recent, true)
  assert.equal(forced.shouldPay, true)
  assert.equal(forced.reason, 'metadata_refresh_requested')
  assert.equal(forced.lastCalledAt, recent.lastCalledAt)
  assert.equal(forced.ageDays, recent.ageDays)
})

test('an ordinary scheduled run cannot force a recent settlement', () => {
  const recent = decideBazaarCanary(resource('2026-08-29T11:00:00.000Z'), now)
  assert.deepEqual(applyManualMetadataRefresh(recent, false), recent)
})

test('the gate selects only the canonical Context Compiler resource', () => {
  const selected = findContextCompiler([
    { resource: 'https://example.com/not-maha' },
    resource('2026-08-08T12:00:00.000Z'),
  ])
  assert.equal(selected?.resource, MAHA_CONTEXT_RESOURCE)
})
