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
  schemaVersion: '0.1.0',
  sellerId: 'maha-strategies',
  name: 'Maha Strategies LLC',
  description: 'Governed infrastructure and machine-payable utilities for production AI agents.',
  role: 'Seller',
  roleContract: CABEZON_SELLER_ROLE_URL,
  roleMirror: CARP_SELLER_ROLE_URL,
  membership: {
    network: 'CABEZON',
    status: 'identity_published_pending_cabezon_directory_confirmation',
    did: identity?.did.id ?? null,
    didUrl: MAHA_CARP_DID_URL,
    sad: identity ? MAHA_CARP_SAD_URL : null,
    carpUrl: identity ? MAHA_CARP_URL : null,
  },
  fulfillmentModes: ['digital'],
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
  ],
})

const jsonError = (id: string, code: number, message: string, data?: unknown): CarpSellerReply => ({
  jsonrpc: '2.0', error: { code, message, ...(data === undefined ? {} : { data }) }, id,
})

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
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

function enquiryMatches(params: Record<string, unknown>) {
  const terms = [
    typeof params.query === 'string' ? params.query : '',
    ...(Array.isArray(params.tags) ? params.tags.filter((tag): tag is string => typeof tag === 'string') : []),
  ].join(' ').trim().toLowerCase()
  if (!terms) return true
  return ['context', 'retention', 'evidence', 'rag', 'provenance', 'evaluation', 'digital', 'ai']
    .some((term) => terms.includes(term))
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
      result: enquiryMatches(params) ? mahaCarpSellerProfile.offers : [],
      id: request.id,
    }
  }

  if (request.method !== 'purchase') return jsonError(request.id, -32601, 'Unknown Seller service.')
  const params = normalizePurchase(request.params, request.id)
  if (!params) return jsonError(request.id, -32602, 'purchase params must use the legacy array or the v0.2 object shape.')
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
