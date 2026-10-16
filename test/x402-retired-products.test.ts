import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RETIRED_X402_PRODUCTS, retiredProductForPath, retiredProductResponse } from '../lib/x402/retired-offers.ts'
import { X402_OFFERS, payableOffers, settlementOffers, offerFor, offerById } from '../lib/x402/offers.ts'
import { x402Config, priceFor } from '../lib/x402/config.ts'
import { resolveX402 } from '../lib/x402/gateway.ts'
import { ledgerFromRows } from '../lib/x402/settlement-refresh.ts'
import { PRODUCTION_ENDPOINTS } from '../lib/api-v1/production-release.ts'
import { openApiDocument } from '../lib/openapi.ts'

test('only two approved experiments are removed; all 1000 modular products and paid bundles remain', () => {
  assert.equal(PRODUCTION_ENDPOINTS.length, 1000)
  assert.equal(X402_OFFERS.length, 161); assert.equal(payableOffers().length, 159)
  for (const product of RETIRED_X402_PRODUCTS) {
    assert.equal(offerById(product.id), undefined)
    assert.equal(offerFor('POST', product.path), undefined)
    assert.ok(offerFor('POST', product.replacement))
    assert.equal(retiredProductForPath(product.path + '/other'), undefined)
  }
  for (const id of ['book-epub-the-maha-principle', 'book-epub-the-orbital-mind', 'synthetic-artifact-test-pack', 'evidence-retention-matrix']) assert.ok(payableOffers().some(e => e.id === id))
})
test('retired routes return a no-payment 410 before configuration, signing, credit or settlement handling', async () => {
  for (const product of RETIRED_X402_PRODUCTS) {
    const response = retiredProductResponse(product.path)
    assert.equal(response.status, 410); assert.equal(response.headers.get('PAYMENT-REQUIRED'), null)
    assert.equal((await response.json()).paymentAccepted, false)
    for (const method of ['GET', 'POST']) {
      const result = await resolveX402(new Request('https://www.mahastrategies.com' + product.path, { method, headers: { 'PAYMENT-SIGNATURE': 'must-not-be-processed', Authorization: 'Bearer must-not-be-consumed' } }),
        { get config(): never { throw Error('configuration must not be read') } })
      assert.equal(result.kind, 'refused'); assert.equal(result.status, 410)
    }
    const docs = openApiDocument.paths[product.path as keyof typeof openApiDocument.paths] as { post: { deprecated: boolean; responses: object } }
    assert.equal(docs.post.deprecated, true); assert.deepEqual(Object.keys(docs.post.responses), ['410'])
  }
  const proxy = readFileSync('proxy.ts', 'utf8')
  assert.ok(proxy.indexOf('retiredProductForPath(pathname)') < proxy.indexOf('const gate = apiProxyGate'))
})
test('old deployment enablement cannot resurrect retired prices or break other routes', () => {
  const config = x402Config({ X402_ENABLED: 'true', X402_FACILITATOR_URL: 'https://facilitator.example', X402_PAY_TO: '0xPayee', X402_ASSET: '0xUSDC',
    X402_RESOURCES: JSON.stringify([...RETIRED_X402_PRODUCTS.map(p => ({ method: 'POST', path: p.path })), { method: 'POST', path: '/api/v1/compress' }]) })!
  assert.equal(config.catalogContradictions.length, 0)
  for (const p of RETIRED_X402_PRODUCTS) assert.equal(priceFor('POST', p.path, config), null)
  assert.ok(priceFor('POST', '/api/v1/compress', config))
})
test('retirement preserves historical price attribution instead of deleting transfer evidence', () => {
  const rows = RETIRED_X402_PRODUCTS.map((p, i) => ({ payer: '0x' + 'a'.repeat(40), amountBaseUnits: BigInt(p.previousAmount), blockNumber: BigInt(i + 1),
    transactionHash: '0x' + String(i + 1).repeat(64), logIndex: 0, timestampUtc: '2026-10-01T00:00:00Z' }))
  const ledger = ledgerFromRows(rows, 1n, 10n, '2026-10-16T00:00:00Z')
  assert.equal(ledger.summary.totalSettlements, 2)
  assert.deepEqual(ledger.entries.map(e => e.product?.id).sort(), RETIRED_X402_PRODUCTS.map(p => p.id).sort())
  assert.ok(RETIRED_X402_PRODUCTS.every(p => settlementOffers().some(e => e.id === p.id)))
})
test('current discovery advertisements no longer invite retired purchases', () => {
  for (const name of ['agent-card.json', 'agent-offers.json', 'agentic-commerce.md']) {
    const text = readFileSync('content/discovery/' + name, 'utf8')
    for (const p of RETIRED_X402_PRODUCTS) { assert.ok(!text.includes(p.id)); assert.ok(!text.includes(p.path)) }
  }
})
