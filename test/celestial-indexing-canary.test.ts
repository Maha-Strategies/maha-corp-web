import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCanaryRequirement, TARGETS } from '../scripts/run-celestial-indexing-canaries.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
test('celestial canary pins three exact routes and caps total authorization at 0.16 USDC', () => {
  assert.equal(TARGETS.reduce((sum, t) => sum + BigInt(t.amount), BigInt(0)), BigInt(160000))
  for (const target of TARGETS) {
    const resource = 'https://www.mahastrategies.com' + target.path
    const requirement = { scheme: 'exact' as const, network: BASE_NETWORK, asset: BASE_USDC, amount: target.amount, payTo: MAHA_PAYEE, maxTimeoutSeconds: 60 }
    assert.doesNotThrow(() => assertCanaryRequirement(requirement, target, resource))
    for (const delta of [{ amount: '160001' }, { payTo: '0x' + '0'.repeat(40) }, { network: 'eip155:1' }, { asset: '0x' + '1'.repeat(40) }]) {
      assert.throws(() => assertCanaryRequirement({ ...requirement, ...delta }, target, resource))
    }
    assert.throws(() => assertCanaryRequirement(requirement, target, resource + '?birth=synthetic'))
  }
})
