import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { PHASES, assertRefreshRequirement, rankedOffers, selected, type Row } from '../scripts/run-bazaar-listing-refresh.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'

test('phases follow the ladder rather than a pinned list', () => {
  const ranked = rankedOffers()
  assert.equal(ranked.length, payableOffers().length)
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(Number(ranked[i].amount) > Number(ranked[i - 1].amount), 'ranked strictly by price')
  }
  const one = selected(1).map((o) => o.id)
  const two = selected(2).map((o) => o.id)
  assert.equal(one.length, 5)
  assert.equal(two.length, 3)
  assert.equal(new Set([...one, ...two]).size, 8, 'the two phases do not overlap')
  assert.deepEqual(selected('all').map((o) => o.id), [...one, ...two])
  // Phase 1 is the cheapest five: the most that can be spent correcting it is
  // less than the single most expensive offer in the catalogue.
  const phaseOneTotal = selected(1).reduce((n, o) => n + BigInt(o.amount), BigInt(0))
  const dearest = ranked[ranked.length - 1]
  assert.ok(phaseOneTotal < BigInt(dearest.amount))
  assert.deepEqual(PHASES[1], [0, 5])
})

test('the payment boundary refuses anything but the exact published contract', () => {
  const offer = selected(1)[1]
  const row: Row = {
    offerId: offer.id, path: offer.path, amountBaseUnits: offer.amount, amountUsdc: '0',
    listedBaseUnits: '5000', action: 'pay',
  }
  const resource = `https://www.mahastrategies.com${offer.path}`
  const requirement = {
    scheme: 'exact', network: BASE_NETWORK, amount: offer.amount, payTo: MAHA_PAYEE,
    maxTimeoutSeconds: 60, asset: BASE_USDC, extra: { name: 'USD Coin', version: '2' },
  }
  assert.doesNotThrow(() => assertRefreshRequirement(requirement, row, resource))
  // Every field is load-bearing, including paying the *listed* amount rather
  // than the real one, which is the exact mistake this script exists to undo.
  for (const [field, wrong] of [
    ['scheme', 'upto'], ['network', 'eip155:1'], ['amount', '5000'],
    ['payTo', '0x' + '0'.repeat(40)], ['asset', '0x' + '1'.repeat(40)],
  ] as const) {
    assert.throws(() => assertRefreshRequirement({ ...requirement, [field]: wrong }, row, resource),
      /refresh_payment_boundary_changed/, `${field} must be checked`)
  }
  assert.throws(() => assertRefreshRequirement(requirement, row, resource + '/other'), /refresh_payment_boundary_changed/)
})

test('the script cannot spend without a confirmation that names the exact plan', () => {
  const source = readFileSync('scripts/run-bazaar-listing-refresh.ts', 'utf8')
  // The confirmation embeds the phase, the offer count and the total, so an
  // authorization issued for one plan cannot be replayed against a larger one.
  assert.match(source, /BAZAAR_LISTING_REFRESH_PHASE_\$\{/)
  assert.match(source, /_OFFERS_MAX_\$\{/)
  assert.match(source, /confirmation_required_and_must_match_the_current_plan/)
  // Planning is the default; spending needs an explicit flag.
  assert.match(source, /if \(args\.includes\('--execute'\)\) return execute\(phase\)/)
  assert.match(source, /insufficient_balance_for_authorized_plan/)
  assert.match(source, /second_signature_refused/)
  assert.match(source, /second_challenge_refused/)
  // A settled call must be confirmed on chain at exactly the published amount.
  assert.match(source, /exact_settlement_unconfirmed/)
  assert.doesNotMatch(source, /--yes|--force|SKIP_CONFIRMATION/)
})
