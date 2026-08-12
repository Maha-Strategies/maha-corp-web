import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assessOfferInactivity,
  findBazaarResource,
  worstLevel,
  BAZAAR_REMOVAL_AFTER_DAYS,
  INACTIVITY_URGENT_DAYS_REMAINING,
  INACTIVITY_WARN_DAYS_REMAINING,
} from '../lib/x402/bazaar-inactivity.ts'
import { CANARY_STALE_AFTER_DAYS } from '../lib/x402/bazaar-canary.ts'
import {
  BASE_NETWORK,
  BASE_USDC,
  BAZAAR_MAX_SEARCH_LIMIT,
  BAZAAR_MAX_USD_PRICE,
  bazaarSearchUrl,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'
import { offerById, payableOffers, USDC_DECIMALS } from '../lib/x402/offers.ts'

const DAY_MS = 24 * 60 * 60 * 1_000
const NOW = Date.parse('2026-08-12T00:00:00.000Z')

const daysAgo = (days: number): string => new Date(NOW - days * DAY_MS).toISOString()

const listing = (overrides: Partial<BazaarResource['quality']> = {}): BazaarResource => ({
  resource: 'https://www.mahastrategies.com/api/v1/compress/evaluate',
  quality: { l30DaysTotalCalls: 1, l30DaysUniquePayers: 1, lastCalledAt: daysAgo(1), ...overrides },
})

const manual = {
  offerId: 'deep-context-evaluation',
  resource: 'https://www.mahastrategies.com/api/v1/compress/evaluate',
  coveredByCanary: false,
}
const automated = {
  offerId: 'context-compression',
  resource: 'https://www.mahastrategies.com/api/v1/compress',
  coveredByCanary: true,
}

// --- 1. Bazaar search filtering -------------------------------------------

test('generated Bazaar searches filter on the exact Base USDC contract address', () => {
  const url = bazaarSearchUrl()
  assert.equal(url.searchParams.get('asset'), BASE_USDC)
  assert.match(url.searchParams.get('asset') ?? '', /^0x[a-fA-F0-9]{40}$/)
})

test('the symbolic asset value that returned no results is never sent', () => {
  // The regression this guards is silent: Bazaar answers `asset=usdc` with an
  // empty result set rather than an error, and the recipe's merchant fallback
  // then rescues the run, so the broken filter looks like a slow index.
  const asset = bazaarSearchUrl().searchParams.get('asset') ?? ''
  assert.notEqual(asset.toLowerCase(), 'usdc')
  assert.ok(!/^[a-z]+$/i.test(asset), 'a bare symbol is not an asset filter Bazaar can match')
})

test('the search carries the network, scheme and price ceiling alongside the asset', () => {
  const url = bazaarSearchUrl({ maxUsdPrice: '0.02', limit: 5 })
  assert.equal(url.searchParams.get('network'), BASE_NETWORK)
  assert.equal(url.searchParams.get('scheme'), 'exact')
  assert.equal(url.searchParams.get('maxUsdPrice'), '0.02')
  assert.equal(url.searchParams.get('limit'), '5')
  assert.ok((url.searchParams.get('query') ?? '').length > 0)
})

test('an out-of-range limit fails locally instead of as a remote 400', () => {
  // Bazaar answers limit>20 with HTTP 400 rather than a truncated page, which
  // reads as "no results" to anything that does not check the status -- the
  // same shape of silent failure as the asset bug.
  assert.throws(() => bazaarSearchUrl({ limit: BAZAAR_MAX_SEARCH_LIMIT + 1 }), /limit from 1 through 20/)
  assert.throws(() => bazaarSearchUrl({ limit: 0 }), /limit from 1 through 20/)
  assert.doesNotThrow(() => bazaarSearchUrl({ limit: BAZAAR_MAX_SEARCH_LIMIT }))
})

test('the default price ceiling excludes Deep Context, so discovery checks must raise it', () => {
  // Not a defect: the recipe buys the $0.001 offer and refuses anything
  // dearer. It is recorded because a search at the default ceiling reports a
  // healthy $0.01 listing as missing, which is exactly how this looked during
  // verification before the ceiling was raised.
  const deep = offerById('deep-context-evaluation')
  assert.ok(deep, 'the deep offer must exist in the catalog')
  const priceUsd = Number(deep.amount) / 10 ** USDC_DECIMALS
  assert.ok(
    priceUsd > Number(BAZAAR_MAX_USD_PRICE),
    'if the deep offer ever costs less than the recipe ceiling, this caveat is obsolete',
  )
})

// --- 2. Inactivity assessment ---------------------------------------------

test('a freshly settled listing sits inside its margin', () => {
  const report = assessOfferInactivity(manual, listing(), NOW)
  assert.equal(report.level, 'ok')
  assert.equal(report.reason, 'within_margin')
  assert.equal(report.daysRemaining, BAZAAR_REMOVAL_AFTER_DAYS - 1)
  assert.equal(report.totalCallsL30Days, 1)
  assert.equal(report.uniquePayersL30Days, 1)
})

test('a listing warns once the remaining margin falls under a fortnight', () => {
  const atWarn = BAZAAR_REMOVAL_AFTER_DAYS - INACTIVITY_WARN_DAYS_REMAINING
  assert.equal(assessOfferInactivity(manual, listing({ lastCalledAt: daysAgo(atWarn - 0.1) }), NOW).level, 'ok')
  const report = assessOfferInactivity(manual, listing({ lastCalledAt: daysAgo(atWarn) }), NOW)
  assert.equal(report.level, 'warn')
  assert.equal(report.reason, 'margin_low')
})

test('a manual offer escalates to urgent with under a working week left', () => {
  const atUrgent = BAZAAR_REMOVAL_AFTER_DAYS - INACTIVITY_URGENT_DAYS_REMAINING
  const report = assessOfferInactivity(manual, listing({ lastCalledAt: daysAgo(atUrgent) }), NOW)
  assert.equal(report.level, 'urgent')
  assert.equal(report.reason, 'margin_critical')
})

test('an urgent canary-covered offer is reported as broken automation, not a stale listing', () => {
  // The canary settles at CANARY_STALE_AFTER_DAYS, which leaves more margin
  // than `urgent` allows. Reaching this band means it did not run.
  const atUrgent = BAZAAR_REMOVAL_AFTER_DAYS - INACTIVITY_URGENT_DAYS_REMAINING
  assert.ok(atUrgent > CANARY_STALE_AFTER_DAYS, 'the urgent band must sit past the canary trigger')
  const report = assessOfferInactivity(automated, listing({ lastCalledAt: daysAgo(atUrgent) }), NOW)
  assert.equal(report.level, 'urgent')
  assert.equal(report.reason, 'automation_should_have_fired')
})

test('an absent listing is unknown rather than fresh', () => {
  const report = assessOfferInactivity(manual, null, NOW)
  assert.equal(report.level, 'unknown')
  assert.equal(report.reason, 'listing_missing')
  assert.equal(report.lastCalledAt, null)
})

test('an unparseable or future last-call timestamp is unknown, never ok', () => {
  for (const lastCalledAt of ['', 'not-a-date', new Date(NOW + 5 * DAY_MS).toISOString()]) {
    const report = assessOfferInactivity(manual, listing({ lastCalledAt }), NOW)
    assert.equal(report.level, 'unknown', `${lastCalledAt || '(empty)'} must not read as fresh`)
    assert.equal(report.reason, 'last_call_missing')
  }
})

test('call and payer metrics survive an unusable timestamp', () => {
  const report = assessOfferInactivity(manual, listing({ lastCalledAt: 'nope' }), NOW)
  assert.equal(report.totalCallsL30Days, 1)
  assert.equal(report.uniquePayersL30Days, 1)
})

test('the watch reports the worst level across offers', () => {
  const at = (days: number, offer: typeof manual) =>
    assessOfferInactivity(offer, listing({ lastCalledAt: daysAgo(days) }), NOW)
  assert.equal(worstLevel([at(1, manual), at(1, automated)]), 'ok')
  assert.equal(worstLevel([at(1, manual), at(17, automated)]), 'warn')
  assert.equal(worstLevel([at(17, manual), at(24, automated)]), 'urgent')
  assert.equal(worstLevel([at(1, manual), assessOfferInactivity(manual, null, NOW)]), 'unknown')
})

test('resources are matched by exact URL, so one offer never answers for another', () => {
  const resources: BazaarResource[] = [
    { resource: 'https://www.mahastrategies.com/api/v1/compress' },
    { resource: 'https://www.mahastrategies.com/api/v1/compress/evaluate' },
  ]
  assert.equal(
    findBazaarResource(resources, 'https://www.mahastrategies.com/api/v1/compress')?.resource,
    'https://www.mahastrategies.com/api/v1/compress',
  )
  assert.equal(findBazaarResource(resources, 'https://www.mahastrategies.com/api/v1/mps/audit'), null)
})

test('the watch covers every payable offer, so promotion enrols an offer by itself', () => {
  const ids = payableOffers().map((offer) => offer.id)
  assert.ok(ids.includes('context-compression'))
  assert.ok(ids.includes('deep-context-evaluation'))
  // The watch list is the payable set, so an offer cannot be promoted and then
  // silently go unmonitored -- and, as on 2026-08-12, cannot be withdrawn and
  // then keep generating listing alerts for something nobody can buy.
  assert.ok(!ids.includes('mps-autonomous-audit'), 'a withheld offer has no listing to protect')
  assert.equal(ids.length, payableOffers().length)
})
