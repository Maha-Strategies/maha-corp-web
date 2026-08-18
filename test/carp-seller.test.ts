import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import secp256k1 from 'secp256k1'

import {
  CABEZON_SELLER_ROLE_URL,
  CARP_SELLER_ROLE_URL,
  MAHA_CARP_SELLER_URL,
  handleCarpSellerRequest,
  mahaCarpSellerProfile,
} from '../lib/carp/seller.ts'
import {
  didDocumentForPublicKey,
  multibaseForPublicKey,
  signedAgentDescriptor,
  verifySignedAgentDescriptor,
} from '../lib/carp/identity.ts'
import { pollCarpSeller } from '../scripts/run-carp-seller-worker.ts'
import { DEEP_CONTEXT_EVALUATION_OFFER } from '../lib/x402/offers.ts'

const role = JSON.parse(await readFile(new URL('../content/discovery/carp-seller-role.json', import.meta.url), 'utf8'))

test('the public Seller role mirrors the adopted upstream v0.2 contract', () => {
  assert.equal(role.sourceVersion, '0.2')
  assert.equal(role.upstreamStatus, 'adopted-in-bitsanity-cabezon-after-maha-pr-1')
  assert.equal(role.mahaContribution, 'https://github.com/bitsanity/cabezon/pull/1')
  assert.deepEqual(role.services.map((service: { service: string }) => service.service), ['about', 'enquiry', 'purchase'])
  assert.deepEqual(role.fulfillmentDescriptor.modes, ['physical', 'digital', 'hybrid'])
})

test('the Maha seller maps Deep Context to the adopted digital offering shape', () => {
  const offer = mahaCarpSellerProfile.offers[0]
  assert.equal(mahaCarpSellerProfile.roleContract, CABEZON_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.roleMirror, CARP_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.membership.status, 'directory_confirmed_by_cabezon_operator')
  assert.equal(mahaCarpSellerProfile.membership.confirmedAt, '2026-08-13')
  assert.equal(mahaCarpSellerProfile.membership.confirmationUrl, 'https://github.com/bitsanity/cabezon/pull/1#issuecomment-5281334301')
  assert.equal(offer.offeringRef, 'maha:deep-context-evaluation:v1')
  assert.equal(offer.kind, 'digital')
  assert.equal(offer.price.amount, '0.01')
  assert.equal(offer.directSettlement.amountBaseUnits, DEEP_CONTEXT_EVALUATION_OFFER.amount)
  assert.equal(offer.directSettlement.resource, `https://www.mahastrategies.com${DEEP_CONTEXT_EVALUATION_OFFER.path}`)
  assert.deepEqual(offer.fulfillment.modes, ['digital'])
})

test('enquiry returns the canonical offering array for compatible needs', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-1',
    params: { query: 'measure evidence retention in RAG context', tags: ['provenance'], imgtxt: null },
  })
  assert.ok('result' in matched)
  assert.equal((matched as { result: unknown[] }).result.length, 1)

  const unrelated = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-2', params: { query: 'bulk tea shipment', tags: [], imgtxt: null },
  })
  assert.ok('result' in unrelated)
  assert.deepEqual((unrelated as { result: unknown[] }).result, [])
})

test('purchase binds the canonical order to exact x402 instructions', () => {
  const accepted = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-1',
    params: {
      clientOrderRef: 'buyer-order-001',
      offeringRef: 'maha:deep-context-evaluation:v1',
      quantity: 1,
      agreedPrice: { amount: '0.01', asset: 'USDC', network: 'eip155:8453' },
      input: { clientRequestId: 'carp-test' },
      delivery: { mode: 'digital', destination: null, replyTo: 'carp://buyer/results/buyer-order-001' },
      specialInstructions: null,
    },
  })
  assert.ok('result' in accepted)
  const result = (accepted as { result: { status: string; paymentInstructions: { mode: string; amountBaseUnits: string; resource: string } } }).result
  assert.equal(result.status, 'PAYMENT_REQUIRED')
  assert.equal(result.paymentInstructions.mode, 'x402_direct')
  assert.equal(result.paymentInstructions.amountBaseUnits, '10000')
  assert.match(result.paymentInstructions.resource, /\/api\/v1\/compress\/evaluate$/)

  const stale = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-2',
    params: {
      clientOrderRef: 'buyer-order-002', offeringRef: 'maha:deep-context-evaluation:v1', quantity: 1,
      agreedPrice: { amount: '0.009', asset: 'USDC', network: 'eip155:8453' },
      delivery: { mode: 'digital', destination: null },
    },
  })
  assert.ok('error' in stale)
  assert.equal(stale.error.code, -32010)
})

test('legacy purchase arrays remain compatible with base-unit quotes', () => {
  const offer = mahaCarpSellerProfile.offers[0]
  const accepted = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: `0x${'1'.repeat(64)}`,
    params: [1, offer.offeringRef, { amount: offer.directSettlement.amountBaseUnits, asset: offer.directSettlement.assetContract, network: offer.price.network }, null, ''],
  })
  assert.ok('result' in accepted)
  assert.equal((accepted as { result: { paymentInstructions: { amountBaseUnits: string } } }).result.paymentInstructions.amountBaseUnits, '10000')
})

test('Maha DID and SAD are derived from and signed by the same secp256k1 identity', () => {
  const privateKey = '1'.padStart(64, '0')
  const publicKey = Buffer.from(secp256k1.publicKeyCreate(Buffer.from(privateKey, 'hex'), true)).toString('hex')
  assert.match(multibaseForPublicKey(publicKey), /^zQ3s/)
  const did = didDocumentForPublicKey(publicKey)
  const sad = signedAgentDescriptor({ privateKey, issuedAt: '2026-08-13T00:00:00.000Z', expiresAt: '2027-08-13T00:00:00.000Z' })
  assert.equal(sad.id, did.id)
  assert.equal(sad.publicKey.value, publicKey)
  assert.equal(verifySignedAgentDescriptor(sad), true)
  assert.equal(sad.proof.canonicalization, 'RFC8785')
})

test('the worker polls one authenticated request and returns a JSON-RPC result', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const client = `02${'a'.repeat(64)}`
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.endsWith('/cgi-bin/nextrequest')) return Response.json({ method: 'about', params: {}, client, cookie: 'request-cookie-001' })
    return new Response('ACK', { status: 200 })
  }
  assert.equal(await pollCarpSeller({ baseUrl: 'http://127.0.0.1:8000/', timeoutMs: 2_000, fetchImpl }), true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/cgi-bin/result')
})

test('public CARP discovery URLs are stable', () => {
  assert.equal(CARP_SELLER_ROLE_URL, 'https://www.mahastrategies.com/.well-known/carp/seller-role.json')
  assert.equal(MAHA_CARP_SELLER_URL, 'https://www.mahastrategies.com/.well-known/carp/seller.json')
})
