import assert from 'node:assert/strict'
import test from 'node:test'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { microExecutionAllowed, RELEASED_MICRO_IDS } from '../lib/x402/micro-release.ts'
import { MICRO_OPENAPI_PATHS } from '../lib/x402/micro-openapi.ts'
import { CELESTIAL_OFFERS } from '../lib/x402/celestial-offers.ts'
import { assertCanaryRequirement, TARGETS, CONFIRMATION } from '../scripts/run-micro-five-indexing-canaries.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { readFileSync } from 'node:fs'
import { x402Config } from '../lib/x402/config.ts'

test('exactly five authorized microproducts are released, at widely separated amounts', () => {
  assert.deepEqual([...RELEASED_MICRO_IDS].sort(), ['audit-export-normalizer', 'citation-binding-check', 'divine-name-disambiguation', 'revision-lineage-check', 'unit-uncertainty-conversion'])
  const released = MICRO_OFFERS.filter(o => o.availability.payableInProduction)
  assert.deepEqual(released.map(o => o.id).sort(), [...RELEASED_MICRO_IDS].sort())
  // The cohort was first published at the $0.005/$0.01 tiers separated by
  // one-to-eleven base-unit offsets, which attributes on-chain but is
  // unreadable and a thousand times finer than the facilitator fee. Each
  // product now holds its own rung. The invariant that matters is the
  // separation, not the total: the ledger attributes a payment by its amount,
  // so any two amounts closer than a fee apart are one perturbation away from
  // being indistinguishable.
  const total = released.reduce((n, o) => n + BigInt(o.amount), BigInt(0))
  assert.equal(total, BigInt(62000))
  const amounts = [...payableOffers()].map(o => BigInt(o.amount)).sort((a, b) => (a < b ? -1 : 1))
  const gaps = amounts.slice(1).map((a, i) => a - amounts[i])
  assert.ok(gaps.every(g => g >= BigInt(2000)), 'every payable pair stays at least twice the facilitator fee apart')
  assert.equal(MICRO_OFFERS.filter(o => o.status === 'withheld').length, 17)
  for (const offer of MICRO_OFFERS) {
    const allowed = released.includes(offer)
    assert.equal(microExecutionAllowed(offer.id, 'production'), allowed)
    assert.equal(microExecutionAllowed(offer.id, 'preview'), allowed)
    assert.equal(microExecutionAllowed(offer.id, undefined), false)
    assert.equal(microExecutionAllowed(offer.id, 'unknown'), false)
    assert.equal(MICRO_OPENAPI_PATHS[offer.path].post['x-maha-payable-in-production'], allowed)
  }
  assert.equal(microExecutionAllowed('citation-binding-check/extra', 'production'), false)
})

test('three existing celestial offers keep their price tier at distinct settled amounts', () => {
  // Own rungs rather than one base unit above a neighbour's tier. The
  // settlement ledger attributes a payment by its amount, and
  // deep-context-evaluation has four external settlements that a shared or
  // near-shared price would have made unattributable.
  assert.deepEqual(CELESTIAL_OFFERS.map(o => [o.id, o.amount]), [
    ['celestial-position-snapshot', '20000'], ['celestial-chart-evidence', '60000'], ['celestial-vimshottari-timing', '120000'],
  ])
  assert.ok(CELESTIAL_OFFERS.every(o => o.availability.payableInProduction))
})

test('indexing purchases bind all payment terms to exactly the five new offers', () => {
  assert.deepEqual(TARGETS.map(t => t.id).sort(), [...RELEASED_MICRO_IDS].sort())
  assert.equal(TARGETS.reduce((n, t) => n + Number(t.amount), 0), 30000)
  assert.equal(CONFIRMATION, 'PUBLISHER_FUNDED_MICRO_FIVE_ONCE_MAX_0_03_USDC')
  for (const target of TARGETS) {
    const resource = 'https://www.mahastrategies.com' + target.path
    const requirement = { scheme: 'exact', amount: target.amount, network: BASE_NETWORK, asset: BASE_USDC, payTo: MAHA_PAYEE, maxTimeoutSeconds: 60 }
    assert.doesNotThrow(() => assertCanaryRequirement(requirement, target, resource))
    for (const field of ['scheme', 'amount', 'network', 'asset', 'payTo']) assert.throws(() => assertCanaryRequirement({ ...requirement, [field]: 'wrong' }, target, resource))
    assert.throws(() => assertCanaryRequirement(requirement, target, resource + '/other'))
  }
  const script = readFileSync(new URL('../scripts/run-micro-five-indexing-canaries.ts', import.meta.url), 'utf8')
  assert.match(script, /await verifyMicroProduct/)
  assert.match(script, /\+\+signatures !== 1/)
  assert.match(script, /GITHUB_RUN_ATTEMPT !== '1'/)
  assert.match(script, /customerDemand: false, organicDemand: false/)
  assert.doesNotMatch(script, /CELESTIAL_OFFERS|160000|verifyCelestialProduct/)
})

test('five-product opt-in preserves existing configuration and refuses implicit enablement', () => {
  const env = { X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402', X402_PAY_TO: MAHA_PAYEE,
    X402_ASSET: BASE_USDC, X402_NETWORK: BASE_NETWORK, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }]) }
  const before = x402Config(env)!, after = x402Config({ ...env, X402_MICRO_FIVE_ENABLED: 'true' })!
  assert.deepEqual(after.resources.slice(0, 1), before.resources)
  assert.equal(after.resources.length, 6)
  assert.deepEqual(after.resources.slice(1).map(r => r.offerId).sort(), [...RELEASED_MICRO_IDS].sort())
  for (const value of ['false', '1', 'TRUE', ' true ']) assert.deepEqual(x402Config({ ...env, X402_MICRO_FIVE_ENABLED: value })!.resources, before.resources)
  const existing = { ...env, X402_RESOURCES: JSON.stringify([{ method: 'POST', path: '/api/v1/compress' }, { method: 'POST', path: '/api/v1/micro/citation-binding-check' }]) }
  assert.equal(x402Config({ ...existing, X402_MICRO_FIVE_ENABLED: 'true' })!.resources.length, 6)
  assert.throws(() => x402Config({ ...env, X402_RESOURCES: 'not-json', X402_MICRO_FIVE_ENABLED: 'true' }))
  assert.throws(() => x402Config({ ...env, X402_RESOURCES: '[]', X402_MICRO_FIVE_ENABLED: 'true' }))
  assert.equal(x402Config({ ...env, X402_ENABLED: 'false', X402_MICRO_FIVE_ENABLED: 'true' }), null)
})
