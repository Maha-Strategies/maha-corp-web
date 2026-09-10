import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { CELESTIAL_OFFERS } from '../lib/x402/celestial-offers.ts'
import { buildCelestialProduct, calculationDigest, CELESTIAL_PRODUCTS, parseCalculationInput, SYNTHETIC_CALCULATION_INPUTS, verifyCelestialProduct, type CelestialProductId } from '../lib/x402/celestial-products.ts'
import { apiProxyGate } from '../lib/api-proxy-policy.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { validate } from './helpers/json-schema.ts'
import { bytesDigest, createBuyerCapture, checkBuyerDelivery } from '../lib/x402/buyer-delivery-check.ts'
import { summarizeCalculationDemand } from '../lib/x402/celestial-demand.ts'

test('discovery: synthetic examples and outputs conform; three explicitly promoted prices', () => {
  // Own rungs rather than one base unit above a neighbour's tier. Every pair of
  // payable amounts is now at least 2000 base units apart, twice the
  // facilitator fee, so no fee-scale perturbation can alias one onto another.
  assert.deepEqual(CELESTIAL_OFFERS.map(o => o.amount), ['20000', '60000', '120000'])
  for (const offer of CELESTIAL_OFFERS) {
    assert.deepEqual(validate(offer.discovery.input, offer.discovery.inputSchema), [])
    assert.deepEqual(validate(offer.discovery.output, offer.discovery.outputSchema), [])
    assert.equal(offer.status, 'available')
    assert.ok(payableOffers().some(o => o.id === offer.id))
    assert.equal(apiProxyGate(offer.path, 'POST', true), 'self_managed')
    assert.equal(apiProxyGate(offer.path, 'GET', false), 'self_managed')
  }
  assert.equal(apiProxyGate('/api/v1/celestial/reports', 'POST', true), 'protected')
  assert.equal(apiProxyGate('/api/v1/calculations/chart/other', 'POST', true), 'protected')
})

test('calculation integrity: deterministic core replay, input/offer binding and tamper failures', () => {
  for (const offer of CELESTIAL_OFFERS) {
    const id = offer.id as CelestialProductId
    const input = SYNTHETIC_CALCULATION_INPUTS[id]
    const result = buildCelestialProduct(id, input)
    assert.deepEqual(result, buildCelestialProduct(id, input))
    assert.ok(verifyCelestialProduct(id, input, result))
    assert.equal(verifyCelestialProduct(id, { ...input, instantUtc: '2000-01-02T12:00:00.000Z' }, result), false)
    for (const mutation of [
      { ...result, receiptDigest: 'sha256:' + '0'.repeat(64) },
      { ...result, conventions: { ...result.conventions, ephemeris: 'fake' } },
      { ...result, result: { altered: true } },
      { ...result, offerId: 'different-product' },
    ]) {
      assert.equal(verifyCelestialProduct(id, input, mutation), false)
      const { receiptDigest: _, ...body } = mutation
      void _
      // Replacing only a broken digest with the correct one restores the
      // original payload. Re-hashing changed content must still fail replay.
      if (calculationDigest(body) !== result.receiptDigest) assert.equal(verifyCelestialProduct(id, input, { ...body, receiptDigest: calculationDigest(body) }), false)
    }
  }
})

test('input boundary: reject identifiers, personal attestation, impossible dates, coordinates, and unbounded timing', () => {
  const input = SYNTHETIC_CALCULATION_INPUTS['celestial-chart-evidence']
  for (const changed of [{ ...input, name: 'synthetic-person' }, { ...input, dataClass: 'personal' },
    { ...input, instantUtc: '2000-02-30T12:00:00.000Z' }, { ...input, latitudeDegrees: NaN },
    { ...input, latitudeDegrees: 90 }, { ...input, instantUtc: '2100-01-01T00:00:00.000Z' },
    { ...input, instantUtc: '2000-01-01T12:00:00+05:30' }]) assert.throws(() => parseCalculationInput('celestial-chart-evidence', changed))
  assert.throws(() => parseCalculationInput('celestial-vimshottari-timing', { ...input, referenceInstantUtc: '1999-01-01T00:00:00.000Z' }))
  assert.throws(() => parseCalculationInput('celestial-vimshottari-timing', { ...input, instantUtc: '1800-01-01T00:00:00.000Z', referenceInstantUtc: '2000-01-01T00:00:00.000Z' }))
})

test('buyer delivery: pinned byte capture and embedded calculation receipt are checked separately from settlement', () => {
  for (const offer of CELESTIAL_OFFERS) {
    const id = offer.id as CelestialProductId
    const requestBytes = Buffer.from(JSON.stringify(SYNTHETIC_CALCULATION_INPUTS[id]))
    const responseBytes = Buffer.from(JSON.stringify(buildCelestialProduct(id, SYNTHETIC_CALCULATION_INPUTS[id])))
    const capture = createBuyerCapture({ provenance: 'synthetic', offerId: id, method: 'POST', resourcePath: offer.path, httpStatus: 200 }, requestBytes, responseBytes)
    const captureBytes = Buffer.from(JSON.stringify(capture))
    const report = checkBuyerDelivery({ captureBytes, expectedCaptureSha256: bytesDigest(captureBytes), requestBytes, responseBytes })
    assert.equal(report.state, 'payload_verified', JSON.stringify(report.problems))
    assert.equal(report.settlement, 'not_checked')
    assert.equal(checkBuyerDelivery({ captureBytes, expectedCaptureSha256: bytesDigest(captureBytes), requestBytes, responseBytes: Buffer.from('{}') }).state, 'rejected')
  }
})

test('demand: exclude operator and publisher-funded canaries, pending records, conflicts and price-only attribution', () => {
  const wallet = '0x' + '1'.repeat(40), operator = '0x' + '2'.repeat(40)
  // Amounts come from the catalog so a reprice cannot silently make this
  // fixture stop matching the offer it is meant to exercise.
  const positions = CELESTIAL_PRODUCTS['celestial-position-snapshot'].amount
  const chart = CELESTIAL_PRODUCTS['celestial-chart-evidence'].amount
  const base = { payer: wallet, resource: 'https://www.mahastrategies.com/api/v1/calculations/positions', amount: positions, status: 'confirmed' as const }
  const tx = (n: number) => '0x' + n.toString(16).padStart(64, '0')
  const report = summarizeCalculationDemand([
    { ...base, transaction: tx(1) }, { ...base, transaction: tx(1) }, { ...base, transaction: tx(2) },
    { ...base, transaction: tx(3), payer: operator }, { ...base, transaction: tx(4) },
    { ...base, transaction: tx(5), status: 'unconfirmed' }, { ...base, transaction: tx(6), resource: '' },
    { ...base, transaction: tx(7) }, { ...base, transaction: tx(7), amount: chart },
  ], { operatorWallets: [operator], publisherFundedTransactions: [tx(4)] })
  assert.deepEqual(report.byOffer[0], { offerId: 'celestial-position-snapshot', externalSettlements: 2,
    externalWallets: 1, repeatExternalWallets: 1, externalAmountBaseUnits: String(BigInt(positions) * BigInt(2)), publisherFundedCanaries: 2 })
  assert.equal(report.excludedRecords, 3)
})

test('new packaging imports no LLM SDK, enterprise store, or personal-content logging', () => {
  for (const file of ['celestial-products', 'celestial-offers', 'celestial-route']) {
    const source = readFileSync(new URL(`../lib/x402/${file}.ts`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"][^'"]*(anthropic|openai|celestial-enterprise)|console\.(log|error)|authorizeAndConsumeApiUnit|saveReport/)
  }
})
