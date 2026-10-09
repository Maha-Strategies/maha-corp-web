import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TARGETS, CONFIRMATION, assertPlanningChallenge } from '../scripts/run-planning-ten-indexing-canaries.ts'
import { PLANNING_IDS, PLANNING_PRODUCTS } from '../lib/x402/micro-planning-contracts.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'

test('one approved ten-product plan stays below 0.98 USDC and excludes CABEZON', () => {
  assert.deepEqual(TARGETS.map(t => t.id), PLANNING_IDS)
  assert.equal(TARGETS.reduce((sum, t) => sum + BigInt(t.amount), BigInt(0)), BigInt(976000))
  assert.equal(CONFIRMATION, 'PUBLISHER_FUNDED_PLANNING_TEN_ONCE_MAX_0_98_USDC')
  for (const target of TARGETS) {
    assert.equal(target.amount, PLANNING_PRODUCTS[target.id].amount)
    const term = { scheme: 'exact', network: BASE_NETWORK, amount: target.amount, asset: BASE_USDC, payTo: MAHA_PAYEE, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } }
    const challenge = { x402Version: 2 as const, resource: { url: 'https://www.mahastrategies.com' + target.path }, accepts: [term] }
    assert.doesNotThrow(() => assertPlanningChallenge(challenge, target))
    for (const field of ['scheme', 'network', 'amount', 'asset', 'payTo']) {
      assert.throws(() => assertPlanningChallenge({ ...challenge, accepts: [{ ...term, [field]: 'changed' }] }, target))
    }
    assert.throws(() => assertPlanningChallenge({ ...challenge, accepts: [term, term] }, target))
    assert.throws(() => assertPlanningChallenge({ ...challenge, resource: { url: challenge.resource.url + '/other' } }, target))
    assert.throws(() => assertPlanningChallenge({ ...challenge, accepts: [{ ...term, extra: { name: 'changed', version: '2' } }] }, target))
  }
})

test('index lag and ambiguous outcomes cannot trigger a second signed request', () => {
  const source = readFileSync(new URL('../scripts/run-planning-ten-indexing-canaries.ts', import.meta.url), 'utf8')
  assert.match(source, /GITHUB_RUN_ATTEMPT !== '1'/)
  assert.match(source, /\+\+signatures !== 1/)
  assert.match(source, /\+\+challenges !== 1/)
  assert.match(source, /customerDemand: false, organicDemand: false/)
  assert.match(source, /await verifyMicroProduct/)
  assert.match(source, /chain.amount !== target.amount/)
  assert.match(source, /stopped_do_not_repay_without_reconciliation/)
})
