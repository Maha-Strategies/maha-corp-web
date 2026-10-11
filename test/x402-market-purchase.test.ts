import assert from 'node:assert/strict'
import test from 'node:test'
import { MARKET_ASSET, MARKET_BATCH_CAP, MARKET_BUYER, MARKET_PAYEE, MARKET_PURCHASES,
  USER_SPEND_CAP, marketTypedData, validateMarketChallenge, validateMarketDelivery } from '../scripts/lib/market-intelligence-purchase.ts'

function quote() {
  return { x402Version: 1, accepts: [{ scheme: 'exact', network: 'base', asset: MARKET_ASSET,
    payTo: MARKET_PAYEE, resource: MARKET_PURCHASES[0].url, maxAmountRequired: '31250',
    maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' } }] }
}
test('fixed two-product batch is smaller than the user cap', () => {
  assert.equal(MARKET_PURCHASES.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0)), MARKET_BATCH_CAP)
  assert.ok(MARKET_BATCH_CAP < USER_SPEND_CAP)
})
test('only the approved exact v1 contract is accepted', () => {
  assert.equal(validateMarketChallenge(quote(), MARKET_PURCHASES[0]).maxAmountRequired, '31250')
  for (const field of ['scheme', 'network', 'asset', 'payTo', 'resource', 'maxAmountRequired', 'maxTimeoutSeconds']) {
    const altered = quote()
    Object.assign(altered.accepts[0], { [field]: 'changed' })
    assert.throws(() => validateMarketChallenge(altered, MARKET_PURCHASES[0]))
  }
  assert.throws(() => validateMarketChallenge({ ...quote(), x402Version: 2 }, MARKET_PURCHASES[0]))
  assert.throws(() => validateMarketChallenge({ ...quote(), accepts: [...quote().accepts, ...quote().accepts] }, MARKET_PURCHASES[0]))
  const altered = quote(); altered.accepts[0].extra.version = '1'
  assert.throws(() => validateMarketChallenge(altered, MARKET_PURCHASES[0]))
})
test('typed authorization pins token, chain, buyer, payee, amount and lifetime', () => {
  const typed = marketTypedData(MARKET_PURCHASES[1], `0x${'11'.repeat(32)}`, 1800000000)
  assert.equal(typed.domain.chainId, 8453)
  assert.equal(typed.domain.verifyingContract, MARKET_ASSET)
  assert.equal(typed.message.from, MARKET_BUYER)
  assert.equal(typed.message.to, MARKET_PAYEE)
  assert.equal(typed.message.value, BigInt(20000))
  assert.equal(typed.message.validBefore, BigInt(1800000300))
  assert.throws(() => marketTypedData(MARKET_PURCHASES[1], '0x11', 1800000000))
})
test('partial or malformed results never count as useful delivery', () => {
  validateMarketDelivery('dataset', { generatedAt: '2026-10-10T00:00:00Z', count: 1, fields: { u: 'url' }, services: [{}] })
  validateMarketDelivery('report', { generatedAt: '2026-10-10T00:00:00Z', catalogSize: 1, categories: [], topServices: [] })
  assert.throws(() => validateMarketDelivery('dataset', { generatedAt: 'invalid', count: 1, fields: {}, services: [{}] }))
  assert.throws(() => validateMarketDelivery('dataset', { generatedAt: '2026-10-10T00:00:00Z', count: 2, fields: {}, services: [{}] }))
})
