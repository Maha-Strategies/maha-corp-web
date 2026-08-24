import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import secp256k1 from 'secp256k1'

import {
  CABEZON_SELLER_ROLE_URL,
  BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER,
  BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
  CARP_SELLER_ROLE_URL,
  SAMLEY_CINNAMON_TEA_RFQ_REF,
  MAHA_CARP_SELLER_URL,
  SAMLEY_CINNAMON_TEA_RFQ_OFFER,
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
  assert.equal(mahaCarpSellerProfile.membership.status, 'identity_published_pending_cabezon_directory_confirmation')
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
    jsonrpc: '2.0', method: 'enquiry', id: 'enquiry-2', params: { query: 'monthly accounting software', tags: [], imgtxt: null },
  })
  assert.ok('result' in unrelated)
  assert.deepEqual((unrelated as { result: unknown[] }).result, [])
})

test('tea enquiries expose the Samley pallet RFQ under Maha without inventing stock or exporter authority', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'cinnamon-enquiry-1',
    params: { query: 'Pure Ceylon cinnamon exported from Sri Lanka', tags: ['physical', 'spice'], imgtxt: null },
  })
  assert.ok('result' in matched)
  const offers = (matched as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.equal(offers.length, 1)
  const offer = offers[0]
  assert.equal(offer.offeringRef, SAMLEY_CINNAMON_TEA_RFQ_REF)
  assert.equal(offer.kind, 'physical')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.offerType, 'request_for_quote')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.status, 'request_for_quote')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.commercialAvailability, 'enquiry_only')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.price, null)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.directSettlement, null)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.productSpecification.itemCode, 'SG-S8')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.productSpecification.retailPacksPerPallet, 2_376)
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.indicativeCommercialTerms.indicativePalletProductValue, '1425.60')
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.supplier.carpMembershipAsserted, false)
  assert.match(JSON.stringify(SAMLEY_CINNAMON_TEA_RFQ_OFFER.capabilityBoundaries), /Maha is the CABEZON Seller/)
})

test('black tea enquiries expose one bounded retail unit without inventing manufacturer authority', () => {
  const matched = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'enquiry', id: 'black-tea-enquiry-1',
    params: { query: 'one box of Bogawantalawa high grown BOPF black tea', tags: ['physical'], imgtxt: null },
  })
  assert.ok('result' in matched)
  const offers = (matched as { result: typeof mahaCarpSellerProfile.offers }).result
  assert.equal(offers.length, 1)
  assert.equal(offers[0].offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.commercialAvailability, 'enquiry_only')
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.purchasable, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.price, null)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.directSettlement, null)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.inventory.availableUnits, 1)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.inventory.replenishmentPromised, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.productSpecification.barcode, '4791037556078')
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.seller.manufacturerAuthorizationAsserted, false)
  assert.equal(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.seller.distributorRelationshipAsserted, false)
  assert.match(BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER.productSpecification.visibleCondition, /compression\/creasing/)
})

test('the one-box tea test fails closed at purchase pending a destination-specific quote', () => {
  const reply = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-purchase-1',
    params: {
      offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
      quantity: 1,
      agreedPrice: null,
    },
  })
  assert.ok('error' in reply)
  assert.equal(reply.error.code, -32011)
  assert.match(reply.error.message, /QUOTE_REQUIRED/)
  assert.equal((reply.error.data as { offeringRef: string }).offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(JSON.stringify(reply).includes('paymentInstructions'), false)
  assert.equal(JSON.stringify(reply).includes('escrowInstructions'), false)
  assert.equal(JSON.stringify(reply).includes('deliveryInstructions'), false)
})

test('the one-box tea test rejects legacy and expanded purchase shapes', () => {
  const legacy = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-legacy-1',
    params: [1, BOGAWANTALAWA_LEGEND_TEA_TEST_REF, null],
  })
  assert.ok('error' in legacy)
  assert.equal(legacy.error.code, -32602)

  const expanded = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'black-tea-expanded-1',
    params: {
      offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
      quantity: 1,
      agreedPrice: null,
      delivery: { destination: 'undisclosed' },
    },
  })
  assert.ok('error' in expanded)
  assert.equal(expanded.error.code, -32602)
  assert.match(expanded.error.message, /additional fields are refused/)
})

test('the one-box tea evidence is metadata-only and served from the declared public path', async () => {
  const canonicalBytes = await readFile(new URL('../artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json', import.meta.url))
  const publicBytes = await readFile(new URL('../public/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json', import.meta.url))
  assert.deepEqual(publicBytes, canonicalBytes)
  const artifact = JSON.parse(canonicalBytes.toString('utf8'))
  assert.equal(artifact.subject.offeringRef, BOGAWANTALAWA_LEGEND_TEA_TEST_REF)
  assert.equal(artifact.inventory.availableUnits, 1)
  assert.equal(artifact.commercialBoundary.purchasable, false)
  assert.equal(artifact.commercialBoundary.paymentInstructionsPresent, false)
  assert.equal(artifact.claimBoundary.healthClaimsAdopted, false)
  assert.equal(artifact.evidence.imageBytesPublished, false)
  assert.equal(artifact.evidence.sha256.length, 4)
  assert.equal(JSON.stringify(artifact).includes('/Users/'), false)
})

test('the Samley RFQ fails closed at purchase until an order-specific quote exists', () => {
  const reply = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-purchase-1',
    params: {
      offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
      quantity: 1,
      agreedPrice: null,
    },
  })
  assert.ok('error' in reply)
  assert.equal(reply.error.code, -32011)
  assert.match(reply.error.message, /QUOTE_REQUIRED/)
  assert.equal((reply.error.data as { commercialAvailability: string }).commercialAvailability, 'enquiry_only')
  assert.equal(JSON.stringify(reply).includes('paymentInstructions'), false)
})

test('the physical RFQ accepts only its exact v0.2 object boundary', () => {
  const legacy = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-legacy-1',
    params: [1, SAMLEY_CINNAMON_TEA_RFQ_REF, null],
  })
  assert.ok('error' in legacy)
  assert.equal(legacy.error.code, -32602)
  assert.match(legacy.error.message, /Legacy positional arguments/)

  const extraFields = handleCarpSellerRequest({
    jsonrpc: '2.0', method: 'purchase', id: 'cinnamon-extra-fields-1',
    params: {
      offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
      quantity: 1,
      agreedPrice: null,
      delivery: { mode: 'physical', destination: { country: 'US' } },
    },
  })
  assert.ok('error' in extraFields)
  assert.equal(extraFields.error.code, -32602)
  assert.match(extraFields.error.message, /additional fields are refused/)
})

test('the sanitized RFQ verification artifact records only the pre-money response boundary', async () => {
  const artifact = JSON.parse(await readFile(new URL('../artifacts/carp/rfq-purchase-verification-v0.2.json', import.meta.url), 'utf8'))
  assert.equal(artifact.subject.offeringRef, SAMLEY_CINNAMON_TEA_RFQ_REF)
  assert.deepEqual(artifact.acceptedRequestShape.params, {
    offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
    quantity: 1,
    agreedPrice: null,
  })
  assert.equal(artifact.acceptedRequestShape.legacyPositionalArgumentsAccepted, false)
  assert.equal(artifact.acceptedRequestShape.additionalFieldsAccepted, false)
  assert.equal(artifact.observedOutcome.reasonCode, 'QUOTE_REQUIRED')
  assert.equal(artifact.observedOutcome.paymentInstructionsPresent, false)
  assert.equal(artifact.retention.credentialsRetained, false)
  const forbiddenKeys = new Set(['CARP_AGENT_PRIVATE_KEY', 'privateKey', 'accessToken', 'authorization', 'sessionKey'])
  const collectKeys = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(collectKeys)
    if (!value || typeof value !== 'object') return []
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...collectKeys(nested)])
  }
  assert.equal(collectKeys(artifact).some((key) => forbiddenKeys.has(key)), false)
})

test('the physical RFQ discloses non-binding economics without presenting freight as a fixed price', () => {
  const offer = SAMLEY_CINNAMON_TEA_RFQ_OFFER
  assert.equal(offer.productSpecification.masterCartonsPerPallet * offer.productSpecification.retailPacksPerMasterCarton, 2_376)
  assert.equal((Number(offer.indicativeCommercialTerms.retailPackUnitPrice) * offer.productSpecification.retailPacksPerPallet).toFixed(2), '1425.60')
  assert.equal(offer.indicativeCommercialTerms.nonBinding, true)
  assert.equal(offer.indicativeCommercialTerms.namedPort, null)
  assert.ok(offer.indicativeCommercialTerms.excludes.includes('freight'))
  assert.doesNotMatch(JSON.stringify(offer), /1500/)
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
  const offer = mahaCarpSellerProfile.offers.find((candidate) => candidate.offeringRef === 'maha:deep-context-evaluation:v1')
  assert.ok(offer && offer.directSettlement && offer.price)
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
