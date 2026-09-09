import assert from 'node:assert/strict'
import test from 'node:test'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { microExecutionAllowed, RELEASED_MICRO_IDS } from '../lib/x402/micro-release.ts'
import { MICRO_OPENAPI_PATHS } from '../lib/x402/micro-openapi.ts'
import { CELESTIAL_OFFERS } from '../lib/x402/celestial-offers.ts'
import { assertCanaryRequirement, TARGETS, CONFIRMATION } from '../scripts/run-micro-five-indexing-canaries.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { readFileSync } from 'node:fs'

test('exactly five authorized microproducts, totaling 30000 base units, are released', () => {
  assert.deepEqual([...RELEASED_MICRO_IDS].sort(), ['audit-export-normalizer', 'citation-binding-check', 'divine-name-disambiguation', 'revision-lineage-check', 'unit-uncertainty-conversion'])
  const released = MICRO_OFFERS.filter(o => o.availability.payableInProduction)
  assert.deepEqual(released.map(o => o.id).sort(), [...RELEASED_MICRO_IDS].sort())
  assert.equal(released.reduce((n, o) => n + BigInt(o.amount), BigInt(0)), BigInt(30000))
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

test('three existing celestial offers retain their published prices and independent catalog entries', () => {
  assert.deepEqual(CELESTIAL_OFFERS.map(o => [o.id, o.amount]), [
    ['celestial-position-snapshot', '10000'], ['celestial-chart-evidence', '50000'], ['celestial-vimshottari-timing', '100000'],
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
