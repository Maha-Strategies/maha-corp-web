import assert from 'node:assert/strict'
import test from 'node:test'
import { privateKeyToAccount } from 'viem/accounts'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'
import { prepareDemandPurchase, submitDemandPurchase, type DemandPurchaseCapsule } from '../lib/x402/demand6/buyer.ts'
import { demand6Handlers } from '../lib/x402/demand6/route.ts'
import { demandPurchaseHeaders } from '../lib/x402/demand6/purchase.ts'
import { DEMAND6_IDS, DEMAND6_SAMPLES, DEMAND6_PRODUCTS, demand6Path, type Demand6Id } from '../lib/x402/demand6/contracts.ts'
import { memoryDemandStore } from '../lib/x402/demand6/store.ts'
import { fixtureDependencies, FIXTURE_NOW } from '../lib/x402/demand6/fixtures.ts'
import { buildDemandProduct } from '../lib/x402/demand6/products.ts'
import { DECLARED_PAYMENT_NETWORKS, usdcNetwork, type UsdcNetwork } from '../lib/x402/networks.ts'
import { MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
import { buildPaymentRequired, encodePaymentResponse } from '../lib/x402/protocol.ts'
const account = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`) // unfunded fixture only
const origin = 'https://www.mahastrategies.com'
function harness(id: Demand6Id, network: UsdcNetwork) {
  const definition = usdcNetwork(network), requirement = { scheme: 'exact' as const, network, amount: DEMAND6_PRODUCTS[id].amount,
    asset: definition.asset, payTo: MAHA_PAYEE, maxTimeoutSeconds: 60, extra: definition.domain }
  const body = buildPaymentRequired([requirement], { url: origin + demand6Path(id) })
  const header = Buffer.from(JSON.stringify(body)).toString('base64')
  let builds = 0, settlements = 0, calls = 0
  const handler = demand6Handlers(id, { environment: 'test', now: () => FIXTURE_NOW, store: memoryDemandStore(),
    verify: async () => true, record: async () => {}, recordPurchase: async () => {}, release: async () => {},
    acquirePreparation: async () => ({ admitted: true, token: 'fixture', active: 1 }), releasePreparation: async () => {},
    build: async (id, input) => { builds++; return buildDemandProduct(id, input, fixtureDependencies) },
    resolve: async request => {
      if (!request.headers.has('PAYMENT-SIGNATURE')) return { kind: 'challenge', status: 402, header, body }
      settlements++
      return { kind: 'paid', amountPaid: requirement.amount, network, payer: account.address, transaction: '0x' + 'ab'.repeat(32),
        header: encodePaymentResponse({ network, payer: account.address, transaction: '0x' + 'ab'.repeat(32) }), slot: { resource: id, token: 'fixture' } }
    } })
  const fetchImpl: typeof fetch = async (url, init) => { calls++; return handler.POST(new Request(url, init)) }
  return { fetchImpl, counts: () => ({ builds, settlements, calls }), header }
}
export async function runDemandBuyerExample(id: Demand6Id = 'csv-import-preflight', network: UsdcNetwork = 'eip155:8453') {
  const h = harness(id, network), input = { ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' }
  let saved: DemandPurchaseCapsule | undefined, signatures = 0
  const capsule = await prepareDemandPurchase({ productId: id, input, network, payer: account.address, now: FIXTURE_NOW,
    maximumAmount: BigInt(DEMAND6_PRODUCTS[id].amount), fetchImpl: h.fetchImpl,
    signTypedData: async data => { signatures++; return account.signTypedData(data as Parameters<typeof account.signTypedData>[0]) },
    persist: async value => { saved = value } })
  assert.ok(saved); assert.deepEqual(saved, capsule); assert.equal(h.counts().settlements, 0)
  const first = await submitDemandPurchase(capsule, h.fetchImpl), recovery = await submitDemandPurchase(saved, h.fetchImpl)
  assert.equal(first.delivery, 'validated_response'); assert.equal(first.settlement, 'provider_reported')
  assert.equal(recovery.delivery, 'validated_response'); assert.equal(recovery.replayed, true)
  assert.deepEqual(recovery.product, first.product); assert.equal(signatures, 1)
  assert.deepEqual(h.counts(), { builds: 1, settlements: 1, calls: 3 })
  return { productId: id, network, offlineMocksOnly: true, walletSignatures: signatures,
    mockedSettlements: h.counts().settlements, paidLiveCalls: 0, recovery: recovery.delivery }
}
for (const id of DEMAND6_IDS) for (const network of DECLARED_PAYMENT_NETWORKS) {
  test(`${id} ${network}: unmodified independent SDK is refused before work/payment`, async () => {
    const h = harness(id, network), input = { ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' }
    const paidFetch = wrapFetchWithPaymentFromConfig(h.fetchImpl, { schemes: [{ network, client: new ExactEvmScheme(account) }] })
    const response = await paidFetch(origin + demand6Path(id), { method: 'POST', body: JSON.stringify(input),
      headers: { ...demandPurchaseHeaders(input), 'Content-Type': 'application/json' } })
    assert.equal(response.status, 400)
    assert.deepEqual(h.counts(), { builds: 0, settlements: 0, calls: 2 })
  })
  test(`${id} ${network}: persisted adapter and recovery work without second signature/settlement`, async () => { await runDemandBuyerExample(id, network) })
}
test('persistence failure never submits a paid request', async () => {
  const h = harness('csv-import-preflight', 'eip155:8453')
  await assert.rejects(prepareDemandPurchase({ productId: 'csv-import-preflight', input: { ...DEMAND6_SAMPLES['csv-import-preflight'], dataClass: 'synthetic' },
    network: 'eip155:8453', payer: account.address, now: FIXTURE_NOW, maximumAmount: BigInt(13500), fetchImpl: h.fetchImpl,
    signTypedData: data => account.signTypedData(data as Parameters<typeof account.signTypedData>[0]), persist: async () => { throw Error('outbox_failed') } }), /outbox_failed/)
  assert.deepEqual(h.counts(), { builds: 0, settlements: 0, calls: 1 })
})
test('price cap and tampered quotes refuse before prompting signer', async () => {
  const h = harness('csv-import-preflight', 'eip155:8453'); let signed = 0
  const options = { productId: 'csv-import-preflight' as const, input: { ...DEMAND6_SAMPLES['csv-import-preflight'], dataClass: 'synthetic' },
    network: 'eip155:8453' as const, payer: account.address, now: FIXTURE_NOW, maximumAmount: BigInt(13500),
    signTypedData: async () => { signed++; return 'bad' }, persist: async () => {} }
  await assert.rejects(prepareDemandPurchase({ ...options, maximumAmount: BigInt(13499), fetchImpl: h.fetchImpl }), /cap_exceeded/)
  const quote = JSON.parse(Buffer.from(h.header, 'base64').toString()); quote.accepts[0].payTo = account.address
  await assert.rejects(prepareDemandPurchase({ ...options, fetchImpl: async () => new Response('{}', { status: 402,
    headers: { 'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(quote)).toString('base64') } }) }), /terms_mismatch/)
  assert.equal(signed, 0)
})
test('lost response remains unknown and explicit recovery reuses the original capsule', async () => {
  const h = harness('csv-import-preflight', 'eip155:8453')
  const capsule = await prepareDemandPurchase({ productId: 'csv-import-preflight', input: { ...DEMAND6_SAMPLES['csv-import-preflight'], dataClass: 'synthetic' },
    network: 'eip155:8453', payer: account.address, now: FIXTURE_NOW, maximumAmount: BigInt(13500), fetchImpl: h.fetchImpl,
    signTypedData: data => account.signTypedData(data as Parameters<typeof account.signTypedData>[0]), persist: async () => {} })
  const lost = await submitDemandPurchase(capsule, async (url, init) => { await h.fetchImpl(url, init); throw Error('response_lost') })
  assert.equal(lost.settlement, 'unknown'); assert.equal(lost.delivery, 'unresolved'); assert.equal(lost.automaticRepayment, false)
  const recovered = await submitDemandPurchase(capsule, h.fetchImpl)
  assert.equal(recovered.delivery, 'validated_response'); assert.equal(h.counts().settlements, 1)
  const receipt = encodePaymentResponse({ transaction: '0x' + 'ab'.repeat(32), network: capsule.network, payer: capsule.payer })
  for (const body of [null, {}, { result: 'fabricated' }]) {
    const result = await submitDemandPurchase(capsule, async () => new Response(JSON.stringify(body), { headers: { 'PAYMENT-RESPONSE': receipt } }))
    assert.equal(result.settlement, 'provider_reported'); assert.equal(result.delivery, 'unresolved')
  }
  const tampered = { ...capsule, url: 'https://attacker.example' }
  let called = false
  await assert.rejects(submitDemandPurchase(tampered, async () => { called = true; return new Response() }), /invalid_purchase_capsule/)
  assert.equal(called, false)
})
