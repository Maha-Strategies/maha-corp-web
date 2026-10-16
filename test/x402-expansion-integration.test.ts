import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { EXPANSION_IDS, EXPANSION_INDEXING_IDS, EXPANSION_UTILITY_IDS, EXPANSION_MAX_SERVICE_BASE_UNITS, expansionPaidContent } from '../lib/x402/expansion-registry.ts'
import { X402_OFFERS, payableOffers } from '../lib/x402/offers.ts'
import { buildMicroProduct, verifyMicroProduct } from '../lib/x402/micro-products.ts'
import { schemaAccepts, MICRO_INPUT_SCHEMAS, MICRO_MAX_RESPONSE_BYTES } from '../lib/x402/micro-contracts.ts'
import { x402Config } from '../lib/x402/config.ts'
import { licensedSectionMetadata } from '../lib/x402/licensed-book-sections.ts'
import { TARGETS, CONFIRMATION, assertExpansionPlan, assertExpansionChallenge } from '../scripts/run-expansion-indexing.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'

test('56 bounded products substitute for expensive indexing and preserve existing commerce', () => {
  assert.equal(EXPANSION_IDS.length, 51); assert.equal(EXPANSION_UTILITY_IDS.length, 5)
  assert.equal(TARGETS.length, 56); assertExpansionPlan()
  assert.equal(EXPANSION_MAX_SERVICE_BASE_UNITS, '2735500')
  assert.equal(CONFIRMATION, 'PUBLISHER_FUNDED_EXPANSION_56_ONCE_MAX_2_7355_USDC')
  assert.equal(payableOffers().length, 159)
  const prices = TARGETS.map(t => BigInt(t.amount))
  assert.equal(new Set(prices).size, 56)
  assert.ok(prices.every(p => p >= BigInt(2000) && p <= BigInt(390000)))
  for (const id of ['research-intake-evidence-pack', 'book-epub-the-maha-principle', 'book-epub-the-orbital-mind']) {
    assert.ok(!(EXPANSION_INDEXING_IDS as readonly string[]).includes(id))
    assert.ok(X402_OFFERS.find(o => o.id === id)?.availability.payableInProduction)
  }
})

test('new opt-in cannot widen previous flags or mutate prior configured resources', () => {
  const env = { X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example/x402', X402_PAY_TO: MAHA_PAYEE,
    X402_ASSET: BASE_USDC, X402_NETWORK: BASE_NETWORK, X402_RESOURCES: '[{"method":"POST","path":"/api/v1/compress"}]' }
  const old = x402Config({ ...env, X402_MICRO_FIVE_ENABLED: 'true', X402_PLANNING_TEN_ENABLED: 'true' })!
  const current = x402Config({ ...env, X402_MICRO_FIVE_ENABLED: 'true', X402_PLANNING_TEN_ENABLED: 'true', X402_EXPANSION_56_ENABLED: 'true' })!
  assert.deepEqual(current.resources.slice(0, old.resources.length), old.resources)
  assert.deepEqual(current.resources.slice(old.resources.length).map(r => r.offerId).sort(), [...EXPANSION_INDEXING_IDS].sort())
  for (const value of ['false', '1', 'TRUE', ' true ']) assert.deepEqual(x402Config({ ...env, X402_EXPANSION_56_ENABLED: value })!.resources, x402Config(env)!.resources)
})

test('every new paid sample recomputes within limits and tampering fails', async () => {
  for (const id of EXPANSION_INDEXING_IDS) {
    const offer = X402_OFFERS.find(o => o.id === id)!
    assert.ok(schemaAccepts(MICRO_INPUT_SCHEMAS[id], offer.discovery.input), id)
    const result = await buildMicroProduct(id, offer.discovery.input)
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= MICRO_MAX_RESPONSE_BYTES, id)
    assert.ok(await verifyMicroProduct(id, offer.discovery.input, result), id)
    assert.equal(await verifyMicroProduct(id, offer.discovery.input, { ...result, amountBaseUnits: '1' }), false, id)
    assert.ok(schemaAccepts(offer.discovery.outputSchema, offer.discovery.output), id)
    const route = readFileSync(new URL(`../app${offer.path}/route.ts`, import.meta.url), 'utf8')
    assert.match(route, new RegExp(`microHandlers\\('${id}'\\)`))
    assert.match(route, /runtime = 'nodejs'/)
    const challenge = { x402Version: 2, resource: { url: 'https://www.mahastrategies.com' + offer.path }, accepts: [{ scheme: 'exact', network: BASE_NETWORK, amount: offer.amount, asset: BASE_USDC, payTo: MAHA_PAYEE, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } }] }
    assert.doesNotThrow(() => assertExpansionChallenge(challenge, TARGETS.find(t => t.id === id)!))
    assert.throws(() => assertExpansionChallenge({ ...challenge, accepts: [{ ...challenge.accepts[0], amount: '1' }] }, TARGETS.find(t => t.id === id)!))
  }
})

test('free discovery contains contracts, not licensed chapter content', async () => {
  const free = readFileSync(new URL('../content/discovery/microproduct-examples.json', import.meta.url), 'utf8')
  for (const id of EXPANSION_IDS.filter(expansionPaidContent)) {
    const offer = X402_OFFERS.find(o => o.id === id)!
    assert.equal((offer.discovery.output as { exampleOnly: boolean }).exampleOnly, true, id)
    const payload = JSON.stringify(await buildMicroProduct(id, offer.discovery.input))
    assert.notEqual(JSON.stringify(offer.discovery.output), payload)
  }
  const pack = X402_OFFERS.find(o => o.id === 'book-reading-pack-the-maha-principle')!
  const paid = await buildMicroProduct('book-reading-pack-the-maha-principle', pack.discovery.input)
  const sections = paid.result.sections as { id: string; content: string; contentSha256: string; utf8Bytes: number }[]
  assert.equal(sections.length, 2)
  assert.deepEqual(paid.result.readingOrder, ['map-of-the-terrain', 'founders-pledge'])
  for (const section of sections) {
    assert.equal(section.contentSha256, 'sha256:' + createHash('sha256').update(section.content).digest('hex'))
    assert.equal(section.utf8Bytes, Buffer.byteLength(section.content))
    assert.ok(!free.includes(section.content.slice(0, 150)))
  }
  assert.equal(paid.result.editionDigest, licensedSectionMetadata('the-maha-principle').editionDigest)
  for (const bad of [ { ...pack.discovery.input, sectionIds: ['founders-pledge', 'founders-pledge'] },
    { ...pack.discovery.input, editionDigest: 'sha256:' + '0'.repeat(64) },
    { ...pack.discovery.input, sectionIds: ['not-a-section'] },
    { ...pack.discovery.input, dataClass: 'private' } ]) await assert.rejects(buildMicroProduct('book-reading-pack-the-maha-principle', bad))
})

test('indexing workflow is manual, first-attempt only and refuses automatic repayments', () => {
  const workflow = readFileSync(new URL('../.github/workflows/expansion-56-indexing.yml', import.meta.url), 'utf8')
  assert.match(workflow, /workflow_dispatch:/); assert.doesNotMatch(workflow, /schedule:|push:/)
  assert.match(workflow, /github.run_attempt == 1/)
  assert.match(workflow, /production-x402-canary/)
  const script = readFileSync(new URL('../scripts/run-expansion-indexing.ts', import.meta.url), 'utf8')
  assert.match(script, /customerDemand: false, organicDemand: false/)
  assert.match(script, /\+\+signatures !== 1/)
  assert.match(script, /stopped-do-not-repay-before-reconciliation/)
  assert.match(script, /await verifyMicroProduct/)
  assert.match(script, /confirmSettlement/)
})
