import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { ebookHandlers } from '../lib/x402/ebook-route.ts'
import { loadEbook, type PaidEbookRecord } from '../lib/x402/ebook-delivery.ts'
import { EBOOK_AMOUNT, EBOOK_VERSION, ebookArtifacts, ebookBundleHash, ebookOrderHash, ebookResource, ebookTermsHash, parseEbookOrder } from '../lib/x402/ebook-contract.ts'
const id = 'the-orbital-mind', tx = '0x' + '1'.repeat(64), payer = '0x' + '2'.repeat(40)
const order = parseEbookOrder(id, { clientRequestId: 'ebook-route-test', version: EBOOK_VERSION, artifactHash: ebookBundleHash(id), termsHash: ebookTermsHash(id), recoverySecret: '0123456789abcdef'.repeat(4) })
const request = (body: unknown = order, suffix = '', headers = {}) => new Request(ebookResource(id) + suffix, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(suffix ? {} : { 'PAYMENT-SIGNATURE': 'synthetic' }), 'x-maha-idempotency-key': order.clientRequestId, 'x-maha-input-hash': ebookOrderHash(id, order), ...headers }, body: JSON.stringify(body),
})
const present = ebookArtifacts(id).every(f => existsSync('content/paid-ebooks/' + f.filename))
test('invalid or absent private bundle fails before any payment attempt', async () => {
  let paid = 0
  const h = ebookHandlers(id, { enabled: true, load: async () => [Buffer.from('bad'), Buffer.from('bad')], resolve: async () => { paid++; throw new Error() } })
  assert.equal((await h.POST(request())).status, 503); assert.equal(paid, 0)
})
test('order and authentication mismatches cannot reach settlement', async () => {
  let paid = 0
  const h = ebookHandlers(id, { enabled: true, resolve: async () => { paid++; throw new Error() } })
  assert.equal((await h.POST(request(order, '', { authorization: 'Bearer unsupported' }))).status, 400)
  assert.equal((await h.POST(request({ ...order, termsHash: 'changed' }))).status, 400)
  assert.equal((await h.POST(request(order, '', { 'x-maha-input-hash': 'bad' }))).status, 409)
  assert.equal(paid, 0)
})
test('metadata and unpaid challenge never contain manuscript bytes', { skip: !present }, async () => {
  const events: string[] = []
  const h = ebookHandlers(id, { enabled: true, load: loadEbook, record: async e => { events.push(e.eventKind) }, resolve: async () => ({ kind: 'challenge', status: 402, body: { x402Version: 2 }, header: 'challenge' }) })
  const metadata = await (await h.GET()).json()
  assert.equal(metadata.purchaseEnabled, true); assert.equal(metadata.artifacts.length, 2)
  assert.ok(metadata.artifacts.every((f: { base64?: string }) => !f.base64))
  assert.ok(metadata.offer.discovery.output.artifacts.every((f: { base64?: string }) => !f.base64))
  const response = await h.POST(request())
  assert.equal(response.status, 402); assert.equal(response.headers.get('PAYMENT-REQUIRED'), 'challenge')
  assert.deepEqual(events, ['challenge'])
})
test('recovery requires the original secret-bound settled order and cannot charge', { skip: !present }, async () => {
  let paid = 0
  const row: PaidEbookRecord = { state: 'settled', payment_transaction: tx, input_hash: ebookOrderHash(id, order), resource: ebookResource(id), amount: EBOOK_AMOUNT }
  const h = ebookHandlers(id, { enabled: false, find: async () => row, resolve: async () => { paid++; throw new Error() } })
  const ok = await h.RETRIEVE(request({ payer, order }, '/retrieve'))
  assert.equal(ok.status, 200); assert.equal((await ok.json()).recovered, true)
  const bad = await h.RETRIEVE(request({ payer, order: { ...order, recoverySecret: 'fedcba9876543210'.repeat(4) } }, '/retrieve'))
  assert.equal(bad.status, 404)
  assert.equal((await h.RETRIEVE(request({ payer, order }, '/retrieve', { 'PAYMENT-SIGNATURE': 'forbidden' }))).status, 400)
  assert.equal(paid, 0)
})
