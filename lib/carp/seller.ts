import { createHash } from 'node:crypto'

import { BASE_USDC, MAHA_PAYEE } from '../x402/discovery-payment-recipe.ts'
import { BASE_MAINNET_CAIP2, DEEP_CONTEXT_EVALUATION_OFFER, USDC_DECIMALS } from '../x402/offers.ts'

export const CARP_SELLER_ROLE_URL = 'https://www.mahastrategies.com/.well-known/carp/seller-role.json'
export const MAHA_CARP_SELLER_URL = 'https://www.mahastrategies.com/.well-known/carp/seller.json'
export const CABEZON_SELLER_ROLE_URL = 'https://raw.githubusercontent.com/bitsanity/cabezon/master/roles/seller.json'

const SITE_URL = 'https://www.mahastrategies.com'
const OFFER = DEEP_CONTEXT_EVALUATION_OFFER

export type CarpSellerRequest = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
  id: string
}

export type CarpSellerReply =
  | { jsonrpc: '2.0'; result: unknown; id: string }
  | { jsonrpc: '2.0'; error: { code: number; message: string; data?: unknown }; id: string }

type Price = { amount: string; asset: string; network: string }
type NormalizedPurchase = {
  buyerOrderId: string
  offerId: string
  quantity: number
  quotedUnitPrice: unknown
  fulfillment: unknown
}

export const mahaCarpSellerProfile = Object.freeze({
  schemaVersion: '0.1.0',
  sellerId: 'maha-strategies',
  name: 'Maha Strategies LLC',
  description: 'Governed infrastructure and machine-payable utilities for production AI agents.',
  role: 'Seller',
  roleContract: CABEZON_SELLER_ROLE_URL,
  roleExtensionProposal: CARP_SELLER_ROLE_URL,
  membership: {
    network: 'CABEZON',
    status: 'contract_ready_pending_carp_handshake',
    did: null,
    sad: null,
    carpUrl: null,
  },
  fulfillmentKinds: ['digital_result'],
  termsUrl: `${SITE_URL}/terms`,
  offers: [
    {
      offerId: OFFER.id,
      itemref: `urn:maha:offer:${OFFER.id}`,
      kind: 'digital_service',
      title: 'Deep Context Evaluation',
      description: OFFER.description,
      tags: [...OFFER.tags, 'digital-delivery', 'x402'],
      status: OFFER.status,
      unitPrice: {
        amount: OFFER.amount,
        asset: BASE_USDC,
        assetSymbol: 'USDC',
        assetDecimals: USDC_DECIMALS,
        network: BASE_MAINNET_CAIP2,
      },
      quantity: { minimum: 1, maximum: 1, increment: 1 },
      purchase: {
        mode: 'x402_direct',
        method: OFFER.method,
        resource: `${SITE_URL}${OFFER.path}`,
        payee: MAHA_PAYEE,
        idempotencyRequired: OFFER.requiresIdempotency,
      },
      fulfillment: {
        kind: 'digital_result',
        estimatedDeliverySeconds: 60,
        evidenceTypes: ['service_receipt', 'content_digest'],
        evidenceFields: ['evaluationId', 'outputHash', 'PAYMENT-RESPONSE transaction'],
        completionCondition: 'The endpoint returns a successful Deep Context Evaluation response bound to the x402 payment receipt.',
        failureAndRefund: {
          automaticRefund: false,
          invalidBuyerInputAfterSettlement: 'not_automatically_refunded',
          deliveryFailureAfterSettlement: 'contact_support_with_order_and_payment_evidence',
          supportUrl: `${SITE_URL}/contact`,
        },
      },
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

function samePrice(value: unknown): value is Price {
  const price = asRecord(value)
  return price?.amount === OFFER.amount
    && typeof price.asset === 'string' && price.asset.toLowerCase() === BASE_USDC.toLowerCase()
    && price.network === BASE_MAINNET_CAIP2
}

function legacyOrderId(requestId: string, itemref: unknown): string {
  const digest = createHash('sha256').update(`${requestId}\n${String(itemref)}`).digest('hex').slice(0, 32)
  return `legacy:${digest}`
}

function normalizePurchase(params: unknown, requestId: string): NormalizedPurchase | null {
  if (Array.isArray(params)) {
    if (params.length < 3 || params.length > 5) return null
    const [quantity, itemref, quotedUnitPrice, destination] = params
    return {
      buyerOrderId: legacyOrderId(requestId, itemref),
      offerId: itemref === `urn:maha:offer:${OFFER.id}` ? OFFER.id : String(itemref),
      quantity: Number(quantity),
      quotedUnitPrice,
      fulfillment: {
        kind: 'digital_result',
        ...(destination === null || destination === undefined || destination === '' ? {} : { destination }),
      },
    }
  }

  const record = asRecord(params)
  if (!record) return null
  return {
    buyerOrderId: typeof record.buyerOrderId === 'string' ? record.buyerOrderId : '',
    offerId: typeof record.offerId === 'string' ? record.offerId : '',
    quantity: Number(record.quantity),
    quotedUnitPrice: record.quotedUnitPrice,
    fulfillment: record.fulfillment,
  }
}

function enquiryMatches(params: Record<string, unknown>) {
  const requestedKinds = Array.isArray(params.fulfillmentKinds) ? params.fulfillmentKinds : []
  if (requestedKinds.length > 0 && !requestedKinds.includes('digital_result')) return false

  const ceiling = asRecord(params.maximumUnitPrice)
  if (ceiling) {
    if (typeof ceiling.amount !== 'string' || !/^\d+$/.test(ceiling.amount)) return false
    if (typeof ceiling.asset !== 'string' || ceiling.asset.toLowerCase() !== BASE_USDC.toLowerCase()) return false
    if (ceiling.network !== BASE_MAINNET_CAIP2 || BigInt(ceiling.amount) < BigInt(OFFER.amount)) return false
  }

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
      result: { offers: enquiryMatches(params) ? mahaCarpSellerProfile.offers : [] },
      id: request.id,
    }
  }

  if (request.method !== 'purchase') return jsonError(request.id, -32601, 'Unknown Seller service.')
  const params = normalizePurchase(request.params, request.id)
  if (!params) return jsonError(request.id, -32602, 'purchase params must use the legacy array or the v0.2 object shape.')
  if (params.offerId !== OFFER.id) return jsonError(request.id, -32602, 'Unknown offerId or itemref.')
  if (params.quantity !== 1) return jsonError(request.id, -32602, 'Deep Context Evaluation must be purchased with quantity 1.')
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(params.buyerOrderId)) {
    return jsonError(request.id, -32602, 'buyerOrderId must be an 8-120 character idempotency key.')
  }
  if (!samePrice(params.quotedUnitPrice)) {
    return jsonError(request.id, -32010, 'The quoted price does not match the current offer.', mahaCarpSellerProfile.offers[0].unitPrice)
  }
  const fulfillment = asRecord(params.fulfillment)
  if (fulfillment?.kind !== 'digital_result') {
    return jsonError(request.id, -32602, 'Deep Context Evaluation supports digital_result fulfillment only.')
  }
  if ('destination' in fulfillment) {
    return jsonError(request.id, -32602, 'A digital_result order must not include a shipping destination.')
  }

  return {
    jsonrpc: '2.0',
    result: {
      orderId: `maha:${params.buyerOrderId}`,
      buyerOrderId: params.buyerOrderId,
      status: 'payment_instructions_issued',
      payment: {
        mode: 'x402_direct',
        amount: OFFER.amount,
        asset: BASE_USDC,
        assetDecimals: USDC_DECIMALS,
        network: BASE_MAINNET_CAIP2,
        payee: MAHA_PAYEE,
        method: OFFER.method,
        resource: `${SITE_URL}${OFFER.path}`,
        escrower: null,
        escrowOrderId: null,
        expiresAt: null,
      },
      fulfillment: mahaCarpSellerProfile.offers[0].fulfillment,
      nextSteps: [
        'Send the Deep Context Evaluation request to payment.resource.',
        'Answer its x402 v2 challenge for exactly payment.amount on payment.network.',
        'Treat evaluationId, outputHash, and the PAYMENT-RESPONSE transaction as digital delivery evidence.',
      ],
    },
    id: request.id,
  }
}
