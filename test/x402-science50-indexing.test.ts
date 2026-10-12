import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertSciencePlan, assertScienceChallenge, CAP, CONFIRMATION, TARGETS, OPERATOR_HEADERS } from '../scripts/run-science50-indexing.ts'
import { USDC_NETWORKS } from '../lib/x402/networks.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import type { PaymentChallenge } from '../lib/x402/client.ts'

function challenge(target: typeof TARGETS[number]): PaymentChallenge {
  return { x402Version: 2, resource: { url: 'https://www.mahastrategies.com' + target.path }, accepts: Object.entries(USDC_NETWORKS).map(([network, n]) => ({
    scheme: 'exact', network, asset: n.asset, payTo: MAHA_PAYEE, amount: target.amount, maxTimeoutSeconds: 60, extra: n.domain,
  })) }
}
test('the immutable approved batch contains fifty unique resources within the service cap', () => {
  assert.doesNotThrow(assertSciencePlan)
  assert.equal(CAP.toString(), '3577000')
  assert.equal(TARGETS.length, 50)
  assert.match(CONFIRMATION, /ONCE_MAX_3_577_USDC$/)
  for (const t of TARGETS) {
    assert.doesNotThrow(() => assertScienceChallenge(challenge(t), t))
    const legacy = challenge(t); legacy.accepts = legacy.accepts.filter(term => term.network !== 'eip155:137')
    assert.doesNotThrow(() => assertScienceChallenge(legacy, t))
  }
})
test('indexing preflight refuses changed prices, chains, assets, payees and timeouts', () => {
  const t = TARGETS[0]
  for (const mutate of [
    (c: PaymentChallenge) => { c.resource.url += '?other=1' },
    (c: PaymentChallenge) => { c.accepts.splice(1, 1) },
    (c: PaymentChallenge) => { c.accepts[2].network = 'eip155:1' },
    (c: PaymentChallenge) => { c.accepts[2].asset = c.accepts[0].asset },
    (c: PaymentChallenge) => { c.accepts[2].amount = '1' },
    (c: PaymentChallenge) => { c.accepts[1].network = c.accepts[0].network },
    (c: PaymentChallenge) => { c.accepts[0].amount = '1' },
    (c: PaymentChallenge) => { c.accepts[1].asset = '0x' + '0'.repeat(40) },
    (c: PaymentChallenge) => { c.accepts[0].payTo = '0x' + '1'.repeat(40) },
    (c: PaymentChallenge) => { c.accepts[0].maxTimeoutSeconds = 600 },
    (c: PaymentChallenge) => { c.accepts[1].extra = { name: 'USD Coin', version: '1' } },
  ]) { const c = challenge(t); mutate(c); assert.throws(() => assertScienceChallenge(c, t)) }
})
test('publisher traffic is attributable without publishing purchase secrets', () => {
  assert.match(OPERATOR_HEADERS['user-agent'], /maha-canary/)
  assert.equal(OPERATOR_HEADERS['x-maha-discovery-source'], 'operator-canary')
  const source = readFileSync(new URL('../scripts/run-science50-indexing.ts', import.meta.url), 'utf8')
  assert.match(source, /createHmac\('sha256',key\)/)
  assert.match(source, /maha-science50-approved-20261012/)
  assert.match(source, /automatic_repayment_refused/)
  assert.match(source, /request.domain.chainId!==base.id/)
  assert.match(source, /response.status!==404/)
  assert.doesNotMatch(source, /JSON.stringify\((?:key|headers|identity)\)/)
})
