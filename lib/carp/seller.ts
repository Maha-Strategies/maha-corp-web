import { createHash } from 'node:crypto'

import { BASE_USDC, MAHA_PAYEE } from '../x402/discovery-payment-recipe.ts'
import { BASE_MAINNET_CAIP2, DEEP_CONTEXT_EVALUATION_OFFER, USDC_DECIMALS } from '../x402/offers.ts'
import { configuredIdentity, MAHA_CARP_DID_URL, MAHA_CARP_SAD_URL, MAHA_CARP_URL } from './identity.ts'

export const CARP_SELLER_ROLE_URL = 'https://www.mahastrategies.com/.well-known/carp/seller-role.json'
export const MAHA_CARP_SELLER_URL = 'https://www.mahastrategies.com/.well-known/carp/seller.json'
export const CABEZON_SELLER_ROLE_URL = 'https://raw.githubusercontent.com/bitsanity/cabezon/master/roles/seller.json'

const SITE_URL = 'https://www.mahastrategies.com'
const OFFER = DEEP_CONTEXT_EVALUATION_OFFER
const identity = configuredIdentity()

export const SAMLEY_CINNAMON_TEA_RFQ_REF = 'maha:samley-cinnamon-tea:rfq-v1'
export const BOGAWANTALAWA_LEGEND_TEA_TEST_REF = 'maha:bogawantalawa-legend-black-tea:retail-test-v1'

export const SAMLEY_CINNAMON_TEA_RFQ_OFFER = Object.freeze({
  offeringRef: SAMLEY_CINNAMON_TEA_RFQ_REF,
  kind: 'physical',
  offerType: 'request_for_quote',
  title: 'Samley Signature Collection Cinnamon Tea — Pallet RFQ',
  descrip: 'A non-binding request-for-quote offering for one export pallet of Samley Signature Collection Cinnamon Tea. Maha coordinates the agent-commerce enquiry; Samley must confirm stock, final export terms, logistics, and acceptance before any order or payment can exist.',
  tags: ['cinnamon-tea', 'ceylon-tea', 'samley', 'sri-lanka', 'b2b', 'wholesale', 'physical-fulfillment', 'export-rfq'],
  status: 'request_for_quote',
  commercialAvailability: 'enquiry_only',
  purchasable: false,
  price: null,
  directSettlement: null,
  supplier: {
    name: 'Samley Teas',
    role: 'prospective_fulfilling_exporter',
    carpMembershipAsserted: false,
    confirmationRequiredForEveryOrder: true,
  },
  productSpecification: {
    productName: 'Samley Signature Collection Cinnamon Tea',
    itemCode: 'SG-S8',
    teaType: 'Cinnamon tea',
    originCountry: 'LK',
    retailPackNetWeightGrams: 40,
    teaBagsPerRetailPack: 20,
    teaBagWrapping: 'individually_wrapped',
    retailPacksPerMasterCarton: 24,
    masterCartonsPerPallet: 99,
    retailPacksPerPallet: 2_376,
    approximatePalletWeightKilograms: 230,
    shelfLifeMonths: 36,
    packaging: 'existing Samley-branded packaging',
    packagingReportedReadyForUsSale: true,
  },
  indicativeCommercialTerms: {
    nonBinding: true,
    currency: 'USD',
    basis: 'FOB',
    namedPort: null,
    retailPackUnitPrice: '0.60',
    indicativePalletProductValue: '1425.60',
    calculation: '2376 retail packs × USD 0.60',
    minimumOrder: 'one pallet',
    paymentTerms: '100% in advance after final quote and order acceptance',
    leadTime: 'subject to material availability; supplier indicated a couple of days if material is available',
    excludes: ['freight', 'insurance', 'customs duties', 'taxes', 'destination clearance', 'warehousing', 'last-mile delivery'],
  },
  quoteRequirements: [
    'buyer legal name and business contact',
    'requested pallet quantity',
    'destination country, postal code, and delivery address or port',
    'named consignee and importer-of-record status',
    'requested delivery window and freight preference',
    'supplier confirmation of availability, final FOB port and price, quote expiry, and production lead time',
    'order-specific freight, customs, duties, labelling, inspection, rejection, refund, and delivery responsibilities',
  ],
  fulfillment: {
    modes: ['physical'],
    estimatedSeconds: null,
    deliveryDeadlineSeconds: null,
    shipsFrom: 'Sri Lanka',
    proofTypes: ['supplier-order-confirmation', 'commercial-invoice', 'export-document-reference', 'carrier-tracking', 'signed-receipt'],
  },
  capabilityBoundaries: [
    'Maha is the CABEZON Seller and RFQ coordinator; it does not claim to own inventory or act as the exporter of record.',
    'Samley Teas is identified only as the prospective fulfilling exporter; no CABEZON membership or standing partnership is asserted.',
    'The indicative FOB product value is not a delivered price or binding offer and excludes freight, duties, taxes, clearance, and destination services.',
    'The listing cannot be purchased and returns no payment or escrow instructions until Samley and the buyer confirm an order-specific quote and responsibilities.',
  ],
  retention: { orderPersisted: false, personalDataAccepted: false, evidenceReturnedToCaller: true },
  termsUrl: `${SITE_URL}/terms/physical-goods`,
  termsManifest: `${SITE_URL}/terms/carp-physical-goods-v1.json`,
})

export const BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER = Object.freeze({
  offeringRef: BOGAWANTALAWA_LEGEND_TEA_TEST_REF,
  kind: 'physical',
  offerType: 'request_for_quote',
  title: 'Bogawantalawa Legend Black Tea — one-box retail test',
  descrip: 'A bounded one-unit resale test for one sealed retail box of Bogawantalawa Legend Black Tea purchased by Maha in Sri Lanka. A buyer may request a destination-specific quote; no order, payment, escrow, or shipment exists until Maha confirms import eligibility, shipping, total price, and acceptance of the photographed package condition.',
  tags: ['black-tea', 'ceylon-tea', 'bogawantalawa', 'sri-lanka', 'retail', 'single-unit', 'physical-fulfillment', 'test-listing'],
  status: 'request_for_quote',
  commercialAvailability: 'enquiry_only',
  purchasable: false,
  price: null,
  directSettlement: null,
  seller: {
    name: 'Maha Strategies LLC',
    role: 'seller_of_record_for_one_retail_unit',
    manufacturerAuthorizationAsserted: false,
    distributorRelationshipAsserted: false,
  },
  manufacturer: {
    name: 'Bogawantalawa Tea Ceylon (Pvt) Ltd',
    relationshipToMaha: 'none_asserted',
  },
  inventory: {
    availableUnits: 1,
    countedAsOf: '2026-08-24',
    replenishmentPromised: false,
    acquisition: 'retail purchase at Cargills in Sri Lanka; seller-declared',
  },
  productSpecification: {
    productName: 'Bogawantalawa Legend Black Tea',
    teaType: 'Pure Ceylon high grown BOPF black tea',
    originCountry: 'LK',
    teaBagsPerRetailPack: 50,
    teaBagWeightGrams: 2,
    retailPackNetWeightGrams: 100,
    barcode: '4791037556078',
    dateOfManufacture: '2026-01-25',
    bestBefore: '2028-01-25',
    packaging: 'manufacturer-branded sealed retail box',
    visibleCondition: 'sealed; photographed outer box shows minor corner and edge compression/creasing',
  },
  evidence: {
    artifact: `${SITE_URL}/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json`,
    source: 'four seller-supplied photographs of the physical retail box',
    imageBytesPublished: true,
    inspectionIndex: `${SITE_URL}/artifacts/carp/bogawantalawa-legend-tea-retail-test-v1.json`,
  },
  quoteRequirements: [
    'buyer legal name and contact',
    'destination country, postal code, and complete delivery address',
    'recipient and importer-of-record confirmation where required',
    'destination-specific food import, labelling, customs, and carrier eligibility check',
    'shipping service, tracking, insurance, duties, taxes, and delivery responsibility',
    'buyer acceptance of the photographed package condition and remaining shelf life',
    'one-unit stock reconfirmation and a final total price with quote expiry',
  ],
  fulfillment: {
    modes: ['physical'],
    estimatedSeconds: null,
    deliveryDeadlineSeconds: null,
    shipsFrom: 'Sri Lanka',
    proofTypes: ['inventory-reconfirmation', 'package-condition-record', 'carrier-tracking', 'signed-receipt'],
  },
  capabilityBoundaries: [
    'Maha owns and may resell one retail unit; it does not claim manufacturer authorization, distributor status, or a partnership with Bogawantalawa or Cargills.',
    'Manufacturer packaging statements are transcribed as label evidence and are not independently verified by Maha; no health or environmental claim is adopted as Maha fact.',
    'The photographed package condition must be disclosed to and accepted by the buyer before an order is activated.',
    'The listing cannot be purchased and returns no payment, escrow, or delivery instructions until a destination-specific quote and lawful shipment path are confirmed.',
    'Inventory is limited to one unit and no replenishment or long-term product availability is promised.',
  ],
  retention: { orderPersisted: false, personalDataAccepted: false, evidenceReturnedToCaller: true },
  termsUrl: `${SITE_URL}/terms/physical-goods`,
  termsManifest: `${SITE_URL}/terms/carp-physical-goods-v1.json`,
})

export type CarpSellerRequest = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: string
}

export type CarpSellerReply =
  | { jsonrpc: '2.0'; result: unknown; id: string }
  | { jsonrpc: '2.0'; error: { code: number; message: string; data?: unknown }; id: string }

type NormalizedPurchase = {
  clientOrderRef: string
  offerId: string
  quantity: number
  agreedPrice: unknown
  delivery: unknown
  input: unknown
}

export const mahaCarpSellerProfile = Object.freeze({
  schemaVersion: '0.1.2',
  sellerId: 'maha-strategies',
  name: 'Maha Strategies LLC',
  description: 'Governed infrastructure, machine-payable utilities, and bounded agent-commerce pilots.',
  role: 'Seller',
  roleContract: CABEZON_SELLER_ROLE_URL,
  roleMirror: CARP_SELLER_ROLE_URL,
  membership: {
    network: 'CABEZON',
    status: 'confirmed_cabezon_seller_directory',
    confirmedAt: '2026-08-21',
    confirmationEvidence: `${SITE_URL}/artifacts/carp/thrivbe-buyer-review-2026-08-27.json`,
    directPeerBindings: [{
      handle: 'thrivbe',
      status: 'thrivbe_to_maha_verified_reciprocal_retry_pending',
      did: 'did:key:zQ3shs5FSFqMhhCw7MazfRtyWZwBXGMVLs2jLxu8xiihjEbnJ',
      sadUrl: 'https://carp.thrivbe.com/cgi-bin/thrivbe',
      descriptorSequence: 2,
      publicKey: '03b8bd2886d40b5a4b6d12d396ff60c8df6b3b1deecc777411335d60afc5283673',
      carpUrl: 'https://carp.thrivbe.com',
      reciprocalEvidence: `${SITE_URL}/artifacts/carp/thrivbe-reciprocal-attempt-2026-08-28.json`,
    }],
    did: identity?.did.id ?? null,
    didUrl: MAHA_CARP_DID_URL,
    sad: identity ? MAHA_CARP_SAD_URL : null,
    carpUrl: identity ? MAHA_CARP_URL : null,
  },
  fulfillmentModes: ['digital', 'physical'],
  termsUrl: `${SITE_URL}/terms`,
  offers: [
    {
      offeringRef: 'maha:deep-context-evaluation:v1',
      kind: 'digital',
      title: 'Deep Context Evaluation',
      descrip: OFFER.description,
      tags: [...OFFER.tags, 'digital-fulfillment', 'x402'],
      status: OFFER.status,
      price: {
        amount: (Number(OFFER.amount) / 10 ** USDC_DECIMALS).toFixed(2),
        asset: 'USDC',
        network: BASE_MAINNET_CAIP2,
      },
      directSettlement: {
        mode: 'x402_direct',
        amountBaseUnits: OFFER.amount,
        assetContract: BASE_USDC,
        assetDecimals: USDC_DECIMALS,
        method: OFFER.method,
        resource: `${SITE_URL}${OFFER.path}`,
        payee: MAHA_PAYEE,
        idempotencyRequired: OFFER.requiresIdempotency,
      },
      fulfillment: {
        modes: ['digital'],
        estimatedSeconds: 60,
        deliveryDeadlineSeconds: 120,
        shipsFrom: null,
        resultMediaType: 'application/json',
      },
      failurePolicy: { onMissedDeadline: 'seller-defined-remedy', refundAuthority: 'seller', termsUrl: `${SITE_URL}/terms` },
      inputSchema: `${SITE_URL}/api/discovery/x402-offers/${OFFER.id}`,
      outputSchema: `${SITE_URL}/api/discovery/x402-offers/${OFFER.id}`,
      capabilityBoundaries: [...OFFER.capabilityBoundaries],
      retention: OFFER.retention,
      termsUrl: `${SITE_URL}/deep-context-evaluation`,
    },
    SAMLEY_CINNAMON_TEA_RFQ_OFFER,
    BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER,
  ],
})

const jsonError = (id: string, code: number, message: string, data?: unknown): CarpSellerReply => ({
  jsonrpc: '2.0', error: { code, message, ...(data === undefined ? {} : { data }) }, id,
})

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

const RFQ_PURCHASE_FIELDS = new Set(['offeringRef', 'quantity', 'agreedPrice'])
const RFQ_OFFER_REFS = new Set([SAMLEY_CINNAMON_TEA_RFQ_REF, BOGAWANTALAWA_LEGEND_TEA_TEST_REF])

function rfqOfferForRef(offeringRef: unknown) {
  if (offeringRef === SAMLEY_CINNAMON_TEA_RFQ_REF) return SAMLEY_CINNAMON_TEA_RFQ_OFFER
  if (offeringRef === BOGAWANTALAWA_LEGEND_TEA_TEST_REF) return BOGAWANTALAWA_LEGEND_TEA_TEST_OFFER
  return null
}

function rfqPurchaseParamsAreCanonical(params: unknown): boolean {
  const record = asRecord(params)
  if (!record || !RFQ_OFFER_REFS.has(String(record.offeringRef))) return false

  const keys = Object.keys(record)
  return keys.length === RFQ_PURCHASE_FIELDS.size
    && keys.every((key) => RFQ_PURCHASE_FIELDS.has(key))
    && record.quantity === 1
    && record.agreedPrice === null
}

function isRfqPurchaseAttempt(params: unknown): boolean {
  const record = asRecord(params)
  return RFQ_OFFER_REFS.has(String(record?.offeringRef))
    || (Array.isArray(params) && params.some((value) => RFQ_OFFER_REFS.has(String(value))))
}

function legacyOrderId(requestId: string, itemref: unknown): string {
  const digest = createHash('sha256').update(`${requestId}\n${String(itemref)}`).digest('hex').slice(0, 32)
  return `legacy:${digest}`
}

function normalizePurchase(params: unknown, requestId: string): NormalizedPurchase | null {
  if (Array.isArray(params)) {
    if (params.length < 3 || params.length > 5) return null
    const [quantity, itemref, quotedUnitPrice, destination] = params
    const legacyPrice = asRecord(quotedUnitPrice)
    const agreedPrice = legacyPrice && legacyPrice.amount === OFFER.amount
      ? { amount: '0.01', asset: 'USDC', network: legacyPrice.network }
      : quotedUnitPrice
    return {
      clientOrderRef: legacyOrderId(requestId, itemref),
      offerId: itemref === 'maha:deep-context-evaluation:v1' ? OFFER.id : String(itemref),
      quantity: Number(quantity),
      agreedPrice,
      input: null,
      delivery: {
        mode: 'digital',
        ...(destination === null || destination === undefined || destination === '' ? {} : { destination }),
      },
    }
  }

  const record = asRecord(params)
  if (!record) return null
  return {
    clientOrderRef: typeof record.clientOrderRef === 'string' ? record.clientOrderRef : '',
    offerId: record.offeringRef === 'maha:deep-context-evaluation:v1' ? OFFER.id : String(record.offeringRef ?? ''),
    quantity: Number(record.quantity),
    agreedPrice: record.agreedPrice,
    input: record.input,
    delivery: record.delivery,
  }
}

function enquiryTerms(params: Record<string, unknown>) {
  return [
    typeof params.query === 'string' ? params.query : '',
    ...(Array.isArray(params.tags) ? params.tags.filter((tag): tag is string => typeof tag === 'string') : []),
  ].join(' ').trim().toLowerCase()
}

function enquiryMatchesDigital(terms: string) {
  if (!terms) return true
  return ['context', 'retention', 'evidence', 'rag', 'provenance', 'evaluation', 'digital', 'ai']
    .some((term) => terms.includes(term))
}

function enquiryMatchesSamleyTea(terms: string) {
  if (!terms) return true
  if (['bogawantalawa', 'legend', 'bopf', 'black tea', 'single unit'].some((term) => terms.includes(term))) return false
  return ['cinnamon', 'tea', 'ceylon', 'samley', 'sri lanka', 'physical', 'export', 'wholesale', 'pallet']
    .some((term) => terms.includes(term))
}

function enquiryMatchesBogawantalawaTea(terms: string) {
  if (!terms) return true
  if (['samley', 'cinnamon', 'pallet', 'wholesale'].some((term) => terms.includes(term))) return false
  return ['black tea', 'tea', 'ceylon', 'bogawantalawa', 'legend', 'bopf', 'sri lanka', 'physical', 'retail', 'single unit']
    .some((term) => terms.includes(term))
}

function enquiryMatches(params: Record<string, unknown>) {
  const terms = enquiryTerms(params)
  return mahaCarpSellerProfile.offers.filter((offer) => {
    if (offer.offeringRef === SAMLEY_CINNAMON_TEA_RFQ_REF) return enquiryMatchesSamleyTea(terms)
    if (offer.offeringRef === BOGAWANTALAWA_LEGEND_TEA_TEST_REF) return enquiryMatchesBogawantalawaTea(terms)
    return enquiryMatchesDigital(terms)
  })
}

export function handleCarpSellerRequest(request: CarpSellerRequest): CarpSellerReply {
  if (request.jsonrpc !== '2.0' || typeof request.id !== 'string' || !request.id || request.id.length > 256) {
    return jsonError(typeof request.id === 'string' ? request.id : '', -32600, 'Invalid JSON-RPC request.')
  }

  if (request.method === 'about') {
    return { jsonrpc: '2.0', result: mahaCarpSellerProfile, id: request.id }
  }

  if (request.method === 'enquiry') {
    const params = asRecord(request.params)
    if (!params) return jsonError(request.id, -32602, 'enquiry params must be an object.')
    if (typeof params.query === 'string' && params.query.length > 2_000) {
      return jsonError(request.id, -32602, 'query must not exceed 2,000 characters.')
    }
    if (Array.isArray(params.tags) && (params.tags.length > 20 || params.tags.some((tag) => typeof tag !== 'string' || tag.length > 80))) {
      return jsonError(request.id, -32602, 'tags must contain at most 20 strings of at most 80 characters.')
    }
    return {
      jsonrpc: '2.0',
      result: enquiryMatches(params),
      id: request.id,
    }
  }

  if (request.method !== 'purchase') return jsonError(request.id, -32601, 'Unknown Seller service.')
  if (isRfqPurchaseAttempt(request.params) && !rfqPurchaseParamsAreCanonical(request.params)) {
    return jsonError(
      request.id,
      -32602,
      'RFQ purchase params must use exactly the v0.2 object shape { offeringRef, quantity, agreedPrice }; agreedPrice must be null. Legacy positional arguments and additional fields are refused.',
    )
  }
  const params = normalizePurchase(request.params, request.id)
  if (!params) return jsonError(request.id, -32602, 'purchase params must use the legacy array or the v0.2 object shape.')
  const rfqOffer = rfqOfferForRef(params.offerId)
  if (rfqOffer) {
    return jsonError(
      request.id,
      -32011,
      'QUOTE_REQUIRED: this physical-goods offering is enquiry-only until the seller and buyer confirm an order-specific quote and lawful fulfillment path.',
      {
        offeringRef: rfqOffer.offeringRef,
        status: rfqOffer.status,
        commercialAvailability: rfqOffer.commercialAvailability,
        quoteRequirements: rfqOffer.quoteRequirements,
      },
    )
  }
  if (params.offerId !== OFFER.id) return jsonError(request.id, -32602, 'Unknown offerId or itemref.')
  if (params.quantity !== 1) return jsonError(request.id, -32602, 'Deep Context Evaluation must be purchased with quantity 1.')
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(params.clientOrderRef)) {
    return jsonError(request.id, -32602, 'clientOrderRef must be an 8-120 character idempotency key.')
  }
  const price = asRecord(params.agreedPrice)
  if (price?.amount !== '0.01' || price.asset !== 'USDC' || price.network !== BASE_MAINNET_CAIP2) {
    return jsonError(request.id, -32010, 'The agreed price does not match the current offer.', mahaCarpSellerProfile.offers[0].price)
  }
  const delivery = asRecord(params.delivery)
  if (delivery?.mode !== 'digital') {
    return jsonError(request.id, -32602, 'Deep Context Evaluation supports digital fulfillment only.')
  }
  if (delivery.destination !== null && delivery.destination !== undefined) {
    return jsonError(request.id, -32602, 'A digital order must not include a postal destination.')
  }

  return {
    jsonrpc: '2.0',
    result: {
      orderId: `maha:${params.clientOrderRef}`,
      clientOrderRef: params.clientOrderRef,
      status: 'PAYMENT_REQUIRED',
      paymentInstructions: {
        mode: 'x402_direct',
        service: 'x402',
        amount: '0.01',
        amountBaseUnits: OFFER.amount,
        asset: 'USDC',
        assetContract: BASE_USDC,
        assetDecimals: USDC_DECIMALS,
        network: BASE_MAINNET_CAIP2,
        payee: MAHA_PAYEE,
        method: OFFER.method,
        resource: `${SITE_URL}${OFFER.path}`,
        escrower: null,
        escrowOrderId: null,
        expiresAt: null,
      },
      fulfillmentExpectation: mahaCarpSellerProfile.offers[0].fulfillment,
      nextSteps: [
        'Send the Deep Context Evaluation request to paymentInstructions.resource.',
        'Answer its x402 v2 challenge for exactly paymentInstructions.amountBaseUnits on paymentInstructions.network.',
        'Treat evaluationId, outputHash, and the PAYMENT-RESPONSE transaction as digital delivery evidence.',
      ],
    },
    id: request.id,
  }
}
