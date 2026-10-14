import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { x402Config, requirementsFor } from '../lib/x402/config.ts'
import { discoveryExtensionsFor, resourceInfoFor, resetDiscoveryCache } from '../lib/x402/discovery.ts'
import { buildPaymentRequired, encodeChallengeHeader } from '../lib/x402/protocol.ts'
import { declarationDigest } from '../lib/x402/declaration-digest.ts'
import { compactExample, PAYMENT_HEADER_LIMIT } from '../lib/x402/declaration-compaction.ts'
import { PAYMENT_REQUIRED_HEADER_LIMIT, PAYMENT_REQUIRED_HEADER_BUDGET, assertPaymentRequiredHeader, paymentRequiredHeaderBytes } from '../lib/x402/response-header-budget.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { with402Payment } from '../lib/api-v1/with402Payment.ts'
import { memoryPaymentStore } from '../lib/api-v1/payment-store.ts'
import { MAHA_PAYEE } from '../lib/x402/merchant-identity.ts'
import { validate } from './helpers/json-schema.ts'
import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'

const origin = 'https://www.mahastrategies.com'
const savedFetch = globalThis.fetch
let networkAttempts = 0, paidAttempts = 0
before(() => { globalThis.fetch = async () => { networkAttempts++; throw Error('response_header_tests_are_offline') } })
after(() => { globalThis.fetch = savedFetch; assert.equal(networkAttempts, 0); assert.equal(paidAttempts, 0) })
const facilitator = { verify: async () => { paidAttempts++; throw Error('no_paid_calls') }, settle: async () => { paidAttempts++; throw Error('no_paid_calls') } }
const env = {
  X402_ENABLED: 'true', X402_NETWORK: 'base', X402_FACILITATOR_URL: 'https://facilitator.invalid', X402_PAY_TO: MAHA_PAYEE,
  X402_ASSET: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  X402_RESOURCES: JSON.stringify(X402_OFFERS.filter(o => o.availability.payableInProduction).map(o => ({ method: o.method, path: o.path }))),
}
const environmentFor = (count: number) => ({ ...env, ...(count >= 2 ? { X402_ARBITRUM_ENABLED: 'true', X402_ARBITRUM_FROM_BLOCK: '1' } : {}),
  ...(count >= 3 ? { X402_POLYGON_ENABLED: 'true', X402_POLYGON_FROM_BLOCK: '1', X402_POLYGON_SCHEMA_READY: 'true' } : {}) })

test('seller 8000-byte line limit is independent of the buyer signature limit', () => {
  assert.equal(PAYMENT_REQUIRED_HEADER_LIMIT, 8000); assert.equal(PAYMENT_HEADER_LIMIT, 16384)
  assert.equal(paymentRequiredHeaderBytes(''), 20)
  assert.doesNotThrow(() => assertPaymentRequiredHeader('A'.repeat(7980)))
  assert.throws(() => assertPaymentRequiredHeader('A'.repeat(7981)), /response_header_too_large/)
  assert.equal(paymentRequiredHeaderBytes('é'), 22)
  // This is the reported live value size, not a funded request or live probe.
  assert.throws(() => assertPaymentRequiredHeader('A'.repeat(11252)), /response_header_too_large/)
})
test('the encoder refuses an oversized challenge instead of emitting an unreadable 402', () => {
  const config = x402Config(env)!, p = config.resources[0], url = origin + p.path
  const b = buildPaymentRequired(requirementsFor(p, url, config), { url, description: 'synthetic' }, 'Payment required.', { synthetic: 'x'.repeat(10000) })
  assert.throws(() => encodeChallengeHeader(b), /response_header_too_large/)
})
test('strict example compaction preserves consts without correcting an invalid author example', () => {
  const d = 'sha256:' + 'a'.repeat(64)
  assert.equal(compactExample(d, 0, { const: d }, 1), d)
  assert.equal(compactExample('wrong', 0, { const: d }, 1), 'wrong')
  const v = { nested: { detail: 'long'.repeat(80) }, rows: [{ id: 'r1' }] }
  assert.deepEqual(compactExample(v, 0, undefined, 1), { nested: {}, rows: [{}] })
  assert.equal(v.nested.detail.length, 320)
})

for (const count of [1, 2, 3]) test('all offers expose bounded seller challenges and correct post-compaction digests: networks=' + count, async () => {
  resetDiscoveryCache()
  const config = x402Config(environmentFor(count))!
  for (const p of config.resources) {
    const offer = X402_OFFERS.find(o => o.id === p.offerId)!, before = JSON.stringify(offer.discovery)
    const url = origin + p.path, requirements = requirementsFor(p, url, config), extensions = await discoveryExtensionsFor(p, url, requirements)
    const body = buildPaymentRequired(requirements, resourceInfoFor(p, url), 'Payment required.', extensions)
    const header = encodeChallengeHeader(body)
    assert.ok(paymentRequiredHeaderBytes(header) <= PAYMENT_REQUIRED_HEADER_BUDGET, p.offerId)
    assert.equal(body.accepts.length, count)
    assert.equal((extensions!['declaration-integrity'] as { declarationDigest: string }).declarationDigest, await declarationDigest(body), p.offerId)
    assert.deepEqual(validateDiscoveryExtensionSpec(extensions!.bazaar as never), { valid: true })
    assert.deepEqual(validateDiscoveryExtension(extensions!.bazaar as never), { valid: true })
    const bazaar = extensions!.bazaar as { info: { input: { body: unknown } } }
    assert.deepEqual(bazaar.info.input.body, offer.discovery.input, 'request examples must not be truncated')
    assert.deepEqual(validate(bazaar.info.input.body, offer.discovery.inputSchema), [], p.offerId)
    assert.equal(JSON.stringify(offer.discovery), before, 'full examples and schemas must remain unchanged')
    const changed = { ...body, extensions: { ...extensions, bazaar: { different: true } } }
    assert.notEqual(await declarationDigest(changed), await declarationDigest(body))
  }
})
test('Matrix keeps all five budgets and exact evidence spans with a readable three-network quote', async () => {
  const config = x402Config(environmentFor(3))!, p = config.resources.find(r => r.offerId === 'evidence-retention-matrix')!
  const outcome = await resolveX402(new Request(origin + p.path, { method: 'POST' }), { config, facilitator })
  assert.equal(outcome.kind, 'challenge')
  if (outcome.kind !== 'challenge') throw Error('matrix_quote_missing')
  assert.ok(paymentRequiredHeaderBytes(outcome.header) < 8000)
  const challenge = JSON.parse(Buffer.from(outcome.header, 'base64').toString('utf8'))
  const b = challenge.extensions.bazaar as { info: { input: { body: { tokenBudgets: number[]; documents: { id: string; text: string }[]; requiredEvidence: { sourceId: string; text: string }[] } } } }
  const i = b.info.input.body; assert.equal(i.tokenBudgets.length, 5)
  for (const e of i.requiredEvidence) assert.ok(i.documents.find(d => d.id === e.sourceId)!.text.includes(e.text))
})
test('every legacy gateway unsigned path stops before verification or settlement', async () => {
  const config = x402Config(environmentFor(3))!
  for (const p of config.resources) {
    const outcome = await resolveX402(new Request(origin + p.path, { method: p.method }), { config, facilitator })
    assert.equal(outcome.kind, 'challenge', p.offerId)
    if (outcome.kind === 'challenge') assert.ok(paymentRequiredHeaderBytes(outcome.header) <= PAYMENT_REQUIRED_HEADER_LIMIT, p.offerId)
  }
})
test('all 296 released modular products use the guarded encoder without changing prices', async () => {
  assert.equal(PRODUCTION_ENDPOINTS.length, 296)
  for (const e of PRODUCTION_ENDPOINTS) {
    const route = with402Payment(e, undefined, { environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MAHA_PAYEE }, facilitator, store: memoryPaymentStore() })
    const response = await route(new Request(origin + e.path, { method: e.method }))
    assert.equal(response.status, 402, e.id)
    assert.ok(paymentRequiredHeaderBytes(response.headers.get('PAYMENT-REQUIRED')!) <= PAYMENT_REQUIRED_HEADER_LIMIT, e.id)
    assert.equal((await response.json()).price, e.price_usdc)
  }
})
test('an oversized future modular declaration refuses before any payment operation', async () => {
  const e = { ...PRODUCTION_ENDPOINTS[0], name: 'N'.repeat(10000) }
  const route = with402Payment(e, undefined, { environment: { NODE_ENV: 'test', BASE_PAYEE_ADDRESS: MAHA_PAYEE }, facilitator, store: memoryPaymentStore() })
  const response = await route(new Request(origin + e.path, { method: e.method }))
  assert.equal(response.status, 503); assert.equal(response.headers.get('PAYMENT-REQUIRED'), null)
  assert.equal((await response.json()).error.code, 'payment_challenge_unavailable_no_payment')
})
