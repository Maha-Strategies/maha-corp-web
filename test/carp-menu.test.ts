import test from 'node:test'
import assert from 'node:assert/strict'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { mahaServiceMenu } from '../lib/carp/menu.ts'
import { MAHA_CARP_DIGITAL_OFFERS, mahaCarpSellerProfile, usdcDisplayAmount } from '../lib/carp/seller.ts'
import { GET as menuGET } from '../app/index.json/route.ts'
import { GET as catalogGET } from '../app/api/discovery/carp/catalog/route.ts'
import { GET as landingGET } from '../app/index.html/route.ts'

test('exact display pricing retains micro amounts and large integers', () => {
  for (const [base, display] of [['7000', '0.007'], ['10500', '0.0105'], ['12000', '0.012'], ['250000', '0.25'], ['3000000', '3.00'], ['1', '0.000001'], ['9007199254740993', '9007199254.740993']]) assert.equal(usdcDisplayAmount(base), display)
  assert.throws(() => usdcDisplayAmount('1.1'))
})
test('menu and profile cover every available product exactly once, excluding withheld', () => {
  const available = X402_OFFERS.filter(o => o.status === 'available' && o.availability.payableInProduction && !o.availability.blockedBy.length)
  assert.deepEqual(MAHA_CARP_DIGITAL_OFFERS.map(o => o.offerId), available.map(o => o.id))
  assert.equal(new Set(mahaServiceMenu.map(s => s.service)).size, mahaServiceMenu.length)
  for (const o of available) {
    const p = MAHA_CARP_DIGITAL_OFFERS.find(p => p.offerId === o.id)!
    const s = mahaServiceMenu.find(s => s.service === o.id)!
    assert.ok('directSettlement' in s)
    assert.equal(p.price.amount, usdcDisplayAmount(o.amount))
    assert.equal(s.directSettlement.amountBaseUnits, o.amount)
    assert.deepEqual(s['http-request'], { method: o.method, url: o.path, body: o.discovery.input })
    assert.deepEqual(s.inputSchema, o.discovery.inputSchema)
    assert.equal(s.descrip, o.description)
    assert.equal(s.paymentRequired, true)
    assert.equal(s.directSettlement.payee, p.directSettlement.payee)
  }
  for (const id of ['celestial-result-compatibility', 'evidence-frame-compatibility']) assert.ok(available.some(o => o.id === id))
})
test('crawler can discover free catalogue from root array menu without a wallet', async () => {
  const response = menuGET()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  const menu = await response.json()
  assert.ok(Array.isArray(menu))
  assert.equal(menu.find(s => s.service === 'catalog')['http-request'], 'GET /api/discovery/carp/catalog')
  const offers = await catalogGET().json()
  assert.equal(offers.length, mahaCarpSellerProfile.offers.length)
  const physical = offers.filter((o: { kind: string }) => o.kind === 'physical')
  assert.equal(physical.length, 2)
  for (const p of physical) { assert.equal(p.purchasable, false); assert.equal(p.price, null); assert.equal(p.directSettlement, null) }
  assert.match(await landingGET().text(), /href="\/index.json"/)
})
