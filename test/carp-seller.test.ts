import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CABEZON_SELLER_ROLE_URL,
  CARP_SELLER_ROLE_URL,
  MAHA_CARP_SELLER_URL,
  handleCarpSellerRequest,
  mahaCarpSellerProfile,
} from '../lib/carp/seller.ts'
import { pollCarpSeller } from '../scripts/run-carp-seller-worker.ts'
import { DEEP_CONTEXT_EVALUATION_OFFER } from '../lib/x402/offers.ts'

const role = JSON.parse(await readFile(new URL('../content/discovery/carp-seller-role.json', import.meta.url), 'utf8'))

test('the Seller role preserves the established services and separates digital from physical evidence', () => {
  assert.equal(role.role, 'Seller')
  assert.equal(role.version, '0.2-draft')
  assert.equal(role.proposalStatus, 'maha-extension-proposal-not-yet-adopted-by-cabezon')
  assert.deepEqual(role.services.map((service: { service: string }) => service.service), ['about', 'enquiry', 'purchase'])
  assert.deepEqual(role.compatibility.preservesTransportFields, ['http-request', 'red-request', 'red-async-result'])
  assert.deepEqual(Object.keys(role.extensions.fulfillmentKinds), ['digital_result', 'carrier_shipment'])
  assert.deepEqual(role.extensions.fulfillmentKinds.digital_result.evidenceTypes, ['service_receipt', 'result_uri', 'content_digest'])
  assert.deepEqual(role.extensions.fulfillmentKinds.carrier_shipment.evidenceTypes, ['carrier_tracking'])
  assert.equal(role.services[2].fee.separateFromOfferPrice, true)
  for (const service of role.services) {
    assert.ok(service['http-request'])
    assert.ok(service['red-request'])
    assert.ok(service['red-async-result'])
  }
})

test('the Maha seller maps its digital offer to the authoritative x402 catalog', () => {
  const offer = mahaCarpSellerProfile.offers[0]
  assert.equal(mahaCarpSellerProfile.roleContract, CABEZON_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.roleExtensionProposal, CARP_SELLER_ROLE_URL)
  assert.equal(mahaCarpSellerProfile.membership.status, 'contract_ready_pending_carp_handshake')
  assert.equal(mahaCarpSellerProfile.membership.did, null)
  assert.equal(offer.offerId, DEEP_CONTEXT_EVALUATION_OFFER.id)
  assert.equal(offer.unitPrice.amount, DEEP_CONTEXT_EVALUATION_OFFER.amount)
  assert.equal(offer.purchase.resource, `https://www.mahastrategies.com${DEEP_CONTEXT_EVALUATION_OFFER.path}`)
  assert.equal(offer.purchase.mode, 'x402_direct')
  assert.equal(offer.fulfillment.kind, 'digital_result')
  assert.equal(offer.fulfillment.failureAndRefund.automaticRefund, false)
})

test('enquiry returns Deep Context only for compatible needs, prices, and fulfillment', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-1',
    params: {
      query: 'measure evidence retention in RAG context',
      fulfillmentKinds: ['digital_result'],
      maximumUnitPrice: {
        amount: '10000',
        asset: mahaCarpSellerProfile.offers[0].unitPrice.asset,
        network: mahaCarpSellerProfile.offers[0].unitPrice.network,
      },
    },
  })
  assert.ok('result' in matched)
  assert.equal((matched as { result: { offers: unknown[] } }).result.offers.length, 1)

  const physical = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-2',
    params: { query: 'context', fulfillmentKinds: ['carrier_shipment'] },
  })
  assert.ok('result' in physical)
  assert.deepEqual((physical as { result: { offers: unknown[] } }).result.offers, [])
})

test('purchase returns exact x402 instructions and rejects a stale quote', () => {
  const unitPrice = mahaCarpSellerProfile.offers[0].unitPrice
  const accepted = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-1',
    params: {
      buyerOrderId: 'buyer-order-001',
      offerId: DEEP_CONTEXT_EVALUATION_OFFER.id,
      quantity: 1,
      quotedUnitPrice: { amount: unitPrice.amount, asset: unitPrice.asset, network: unitPrice.network },
      fulfillment: { kind: 'digital_result' },
    },
  })
  assert.ok('result' in accepted)
  const result = (accepted as { result: { payment: { mode: string; amount: string; resource: string }; fulfillment: { evidenceFields: string[] } } }).result
  assert.equal(result.payment.mode, 'x402_direct')
  assert.equal(result.payment.amount, '10000')
  assert.match(result.payment.resource, /\/api\/v1\/compress\/evaluate$/)
  assert.ok(result.fulfillment.evidenceFields.includes('outputHash'))

  const stale = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'purchase-2',
    params: {
      buyerOrderId: 'buyer-order-002', offerId: DEEP_CONTEXT_EVALUATION_OFFER.id, quantity: 1,
      quotedUnitPrice: { amount: '9999', asset: unitPrice.asset, network: unitPrice.network },
      fulfillment: { kind: 'digital_result' },
    },
  })
  assert.ok('error' in stale)
  assert.equal((stale as { error: { code: number } }).error.code, -32010)
})

test('the legacy purchase array remains usable without weakening exact payment terms', () => {
  const offer = mahaCarpSellerProfile.offers[0]
  const accepted = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: '0x' + '1'.repeat(64),
    params: [1, offer.itemref, { amount: offer.unitPrice.amount, asset: offer.unitPrice.asset, network: offer.unitPrice.network }, null, ''],
  })
  assert.ok('result' in accepted)
  const result = (accepted as { result: { buyerOrderId: string; payment: { amount: string } } }).result
  assert.match(result.buyerOrderId, /^legacy:[a-f0-9]{32}$/)
  assert.equal(result.payment.amount, DEEP_CONTEXT_EVALUATION_OFFER.amount)

  const postalDestination = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: '0x' + '2'.repeat(64),
    params: [1, offer.itemref, { amount: offer.unitPrice.amount, asset: offer.unitPrice.asset, network: offer.unitPrice.network }, 'Colombo'],
  })
  assert.ok('error' in postalDestination)
  assert.equal((postalDestination as { error: { code: number } }).error.code, -32602)
})

test('the worker polls one authenticated request and returns a JSON-RPC result', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const client = `02${'a'.repeat(64)}`
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.endsWith('/cgi-bin/nextrequest')) {
      return Response.json({ method: 'about', params: {}, client, cookie: 'request-cookie-001' })
    }
    return new Response('ACK', { status: 200 })
  }

  assert.equal(await pollCarpSeller({ baseUrl: 'http://127.0.0.1:8000/', timeoutMs: 2_000, fetchImpl }), true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, 'http://127.0.0.1:8000/cgi-bin/result')
  assert.equal(new Headers(calls[1].init?.headers).get('cookie'), `agent=${client}; cookie=request-cookie-001`)
  const reply = JSON.parse(String(calls[1].init?.body))
  assert.equal(reply.jsonrpc, '2.0')
  assert.equal(reply.id, 'request-cookie-001')
  assert.equal(reply.result.sellerId, 'maha-strategies')
})

test('the worker refuses malformed client identity before creating a result callback', async () => {
  let calls = 0
  const fetchImpl: typeof fetch = async () => {
    calls += 1
    return Response.json({ method: 'about', params: {}, client: 'not-a-key', cookie: 'request-cookie-002' })
  }
  await assert.rejects(
    pollCarpSeller({ baseUrl: 'http://127.0.0.1:8000', timeoutMs: 2_000, fetchImpl }),
    /secp256k1 public key/,
  )
  assert.equal(calls, 1)
})

test('public CARP discovery URLs are stable', () => {
  assert.equal(CARP_SELLER_ROLE_URL, 'https://www.mahastrategies.com/.well-known/carp/seller-role.json')
  assert.equal(MAHA_CARP_SELLER_URL, 'https://www.mahastrategies.com/.well-known/carp/seller.json')
})
