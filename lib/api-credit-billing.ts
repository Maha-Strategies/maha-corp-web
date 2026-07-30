import { createHash, randomUUID } from 'node:crypto'
import Stripe from 'stripe'

import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'

export const API_CREDIT_PACKS = {
  starter: { environment: 'STRIPE_API_CREDITS_STARTER_PRICE_ID', credits: 100_000 },
  pro: { environment: 'STRIPE_API_CREDITS_PRO_PRICE_ID', credits: 600_000 },
  enterprise: { environment: 'STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID', credits: 3_000_000 },
} as const

export type ApiCreditPack = keyof typeof API_CREDIT_PACKS
export type ApiCreditCheckout = { public_id: string; api_key_id: string; pack: ApiCreditPack; stripe_price_id: string; stripe_checkout_session_id: string | null; stripe_checkout_url: string | null; status: 'awaiting_payment' | 'paid' | 'failed' | 'reversed' }

export function isApiCreditPack(value: unknown): value is ApiCreditPack { return typeof value === 'string' && value in API_CREDIT_PACKS }
export function createApiCreditCheckoutId() { return `api_credit_checkout_${randomUUID().replaceAll('-', '')}` }
export function createApiCreditLedgerEntryId() { return `api_credit_${randomUUID().replaceAll('-', '')}` }
export function billingRequestHash(apiKeyId: string, clientRequestId: string) { return `sha256:${createHash('sha256').update(`api-credit-v1|${apiKeyId}|${clientRequestId}`).digest('hex')}` }
export function validClientRequestId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,120}$/.test(value) }

export function apiCreditBillingConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_API_KEY_WEBHOOK_SECRET?.trim()
  const prices = Object.fromEntries(Object.entries(API_CREDIT_PACKS).map(([pack, item]) => [pack, process.env[item.environment]?.trim()])) as Record<ApiCreditPack, string | undefined>
  if (!stripeSecretKey || !webhookSecret || !Object.values(prices).every((price) => /^price_[A-Za-z0-9]+$/.test(price ?? ''))) return null
  return { stripeSecretKey, webhookSecret, prices: prices as Record<ApiCreditPack, string> }
}

export function apiCreditWebhookConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = process.env.STRIPE_API_KEY_WEBHOOK_SECRET?.trim()
  return stripeSecretKey && webhookSecret ? { stripeSecretKey, webhookSecret } : null
}

function siteOrigin(request: Request) { return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') || new URL(request.url).origin }

export async function createOrRecoverApiCreditCheckout(input: { request: Request; apiKeyId: string; pack: ApiCreditPack; clientRequestId: string }) {
  const config = apiCreditBillingConfig(); const ledger = createAgentInquiryLedger()
  if (!config || !ledger) return { kind: 'unavailable' as const }
  const requestHash = billingRequestHash(input.apiKeyId, input.clientRequestId)
  const priceId = config.prices[input.pack]; const credits = API_CREDIT_PACKS[input.pack].credits
  let checkout: ApiCreditCheckout | null = null; let created = false
  const { error: insertError } = await ledger.from('api_credit_checkouts').insert({ public_id: createApiCreditCheckoutId(), api_key_id: input.apiKeyId, request_hash: requestHash, pack: input.pack, stripe_price_id: priceId, credit_quantity: credits, status: 'awaiting_payment' })
  if (insertError?.code === '23505') {
    const { data, error } = await ledger.from('api_credit_checkouts').select('public_id,api_key_id,pack,stripe_price_id,stripe_checkout_session_id,stripe_checkout_url,status').eq('api_key_id', input.apiKeyId).eq('request_hash', requestHash).maybeSingle()
    if (error || !data) return { kind: 'unavailable' as const }
    checkout = data as ApiCreditCheckout
    if (checkout.pack !== input.pack) return { kind: 'conflict' as const }
    if (checkout.status === 'paid') return { kind: 'paid' as const }
    if (checkout.status === 'failed') return { kind: 'failed' as const }
    if (checkout.stripe_checkout_url) return { kind: 'ready' as const, url: checkout.stripe_checkout_url, idempotentReplay: true }
  } else if (insertError) return { kind: 'unavailable' as const }
  if (!checkout) {
    const { data, error } = await ledger.from('api_credit_checkouts').select('public_id,api_key_id,pack,stripe_price_id,stripe_checkout_session_id,stripe_checkout_url,status').eq('api_key_id', input.apiKeyId).eq('request_hash', requestHash).maybeSingle()
    if (error || !data) return { kind: 'unavailable' as const }
    checkout = data as ApiCreditCheckout; created = true
  }
  const origin = siteOrigin(input.request); const successUrl = new URL('/dashboard', origin); successUrl.searchParams.set('status', 'success'); const cancelUrl = new URL('/dashboard', origin); cancelUrl.searchParams.set('status', 'cancelled')
  try {
    const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2026-06-24.dahlia' })
    const session = await stripe.checkout.sessions.create({ mode: 'payment', payment_method_types: ['card'], client_reference_id: checkout.public_id, line_items: [{ price: priceId, quantity: 1 }], metadata: { api_credit_checkout_id: checkout.public_id, api_key_id: input.apiKeyId, pack: input.pack, credits: String(credits) }, success_url: successUrl.toString(), cancel_url: cancelUrl.toString() }, { idempotencyKey: checkout.public_id })
    if (!session.url) throw new Error('Stripe did not return a Checkout URL.')
    const { error } = await ledger.from('api_credit_checkouts').update({ stripe_checkout_session_id: session.id, stripe_checkout_url: session.url }).eq('public_id', checkout.public_id).eq('status', 'awaiting_payment')
    if (error) return { kind: 'unavailable' as const }
    return { kind: 'ready' as const, url: session.url, idempotentReplay: !created }
  } catch (error) {
    if (created) await ledger.from('api_credit_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkout.public_id).eq('status', 'awaiting_payment')
    console.error('[API_CREDIT_CHECKOUT_ERROR]', error)
    return { kind: 'failed' as const }
  }
}
