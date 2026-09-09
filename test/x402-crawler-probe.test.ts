import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { celestialHandlers } from '../lib/x402/celestial-route.ts'
import { microHandlers } from '../lib/x402/micro-route.ts'
import { payableOffers, type X402Offer } from '../lib/x402/offers.ts'
import type { CelestialProductId } from '../lib/x402/celestial-products.ts'
import type { MicroProductId } from '../lib/x402/micro-contracts.ts'

/**
 * A Bazaar crawler discovers an offer by probing it and reading the 402.
 *
 * It sends a minimal body, because it does not yet know the input shape -- that
 * is what it is there to learn. An offer that validates the body first answers
 * 400 and is never listed, however correctly it is published elsewhere.
 *
 * Eight of nineteen payable offers were in exactly that state: three celestial
 * and five microproducts, all returning 400 invalid input to a probe while the
 * public manifest declared them active and payable. All eight had zero
 * settlements. Their unit tests passed throughout, because every one of them
 * drove the handler with a valid body and a payment already attached -- the two
 * things a crawler does not have.
 *
 * This exercises the arrival a crawler actually makes.
 */

const SITE = 'https://www.mahastrategies.com'

/** A resolver that only ever challenges: this asks where the price is offered, not whether payment works. */
const alwaysChallenge = (async () => ({
  kind: 'challenge' as const,
  body: { x402Version: 2, accepts: [] },
  header: 'synthetic-challenge',
})) as never

const inert = { record: async () => {}, release: async () => {}, environment: 'test' }

function handlersFor(offer: X402Offer) {
  if (offer.id.startsWith('celestial-')) {
    return celestialHandlers(offer.id as CelestialProductId, { ...inert, resolve: alwaysChallenge })
  }
  return microHandlers(offer.id as MicroProductId, { ...inert, resolve: alwaysChallenge })
}

/** How a crawler actually arrives: no payment, and no knowledge of the schema. */
function probes(path: string): Request[] {
  const url = `${SITE}${path}`
  const json = { 'Content-Type': 'application/json' }
  return [
    new Request(url, { method: 'POST', headers: json, body: '{}' }),
    new Request(url, { method: 'POST', headers: json, body: JSON.stringify({ probe: 'discovery' }) }),
    new Request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello' }),
    new Request(url, { method: 'POST', body: 'not json' }),
  ]
}

test('every payable offer answers an unpaid crawler probe with a payment challenge', async () => {
  const offers = payableOffers()
  assert.ok(offers.length > 0)
  let proxyChallenged = 0
  let handlerChallenged = 0

  for (const offer of offers) {
    const gate = apiProxyGate(offer.path, 'POST', true)
    if (gate === 'protected') {
      // The proxy issues the challenge before the handler runs, so no handler
      // ordering can hide the price.
      proxyChallenged += 1
      continue
    }
    assert.equal(gate, 'self_managed',
      `${offer.id}: a payable offer is neither proxy-challenged nor self-managed, so nothing owns its 402`)

    const handlers = handlersFor(offer)
    for (const probe of probes(offer.path)) {
      const result = await handlers.POST(probe)
      assert.equal(result.status, 402,
        `${offer.id}: an unpaid probe must be told the price, not judged on its body (got ${result.status})`)
      assert.ok(result.headers.get('PAYMENT-REQUIRED'), `${offer.id}: the challenge carries payment requirements`)
    }
    handlerChallenged += 1
  }

  // Both mechanisms are in use; if one disappears the split is worth noticing.
  assert.ok(proxyChallenged > 0 && handlerChallenged > 0)
  assert.equal(proxyChallenged + handlerChallenged, offers.length)
})

/**
 * The handler families this check knows how to drive. A payable offer served by
 * some third handler would silently be skipped above, so it fails here instead.
 */
test('every self-managed payable offer belongs to a handler family this check drives', () => {
  for (const offer of payableOffers()) {
    if (apiProxyGate(offer.path, 'POST', true) !== 'self_managed') continue
    assert.ok(offer.id.startsWith('celestial-') || offer.path.startsWith('/api/v1/micro/'),
      `${offer.id}: no handler family is mapped, so its probe behaviour is untested`)
  }
})

test('a free GET still describes the offer without payment', async () => {
  for (const offer of payableOffers()) {
    if (apiProxyGate(offer.path, 'POST', true) !== 'self_managed') continue
    const handlers = handlersFor(offer)
    const result = await handlers.GET(new Request(`${SITE}${offer.path}`))
    assert.equal(result.status, 200, `${offer.id}: GET is the free contract read`)
  }
})
