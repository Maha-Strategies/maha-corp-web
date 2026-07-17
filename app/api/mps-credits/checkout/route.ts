import { authorizeClientCapabilityForBilling, bearerToken } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import {
  MPS_AUDIT_CREDIT_UNIT,
  creditPackConfig,
  createCreditCheckoutId,
  parseCreditCheckoutRequest,
  requestHash,
  type CreditCheckout,
} from '@/lib/mps-credits'
import { MPS_AUDIT_CAPABILITY } from '@/lib/mps-audit-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL = 'https://www.mahastrategies.com'

function checkoutResponse(checkout: CreditCheckout, checkoutUrl: string, idempotentReplay: boolean) {
  return jsonResponse({
    checkoutId: checkout.public_id,
    checkoutUrl,
    clientId: checkout.client_id,
    unit: MPS_AUDIT_CREDIT_UNIT,
    creditQuantity: checkout.credit_quantity,
    status: checkout.status,
    idempotentReplay,
    billingEnforcement: 'not_enabled',
    note: 'Payment credits this client ledger after Stripe confirms payment. Audit-call deduction is not enabled yet.',
  }, idempotentReplay ? 200 : 201)
}

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS audit client credential is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  let clientRequestId: string
  try {
    clientRequestId = parseCreditCheckoutRequest(await request.json()).clientRequestId
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, 400)
  }

  const authorization = await authorizeClientCapabilityForBilling(token, MPS_AUDIT_CAPABILITY)
  if (authorization.kind === 'unavailable') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'The credential registry is not available.' } }, 503)
  if (authorization.kind === 'unauthorized') return jsonResponse({ error: { code: 'unauthorized', message: 'A valid MPS audit client credential is required.' } }, 401)
  if (authorization.kind === 'forbidden') return jsonResponse({ error: { code: 'capability_not_authorized', message: 'This credential is not authorized for MPS audit credits.' } }, 403)
  if (authorization.kind === 'rate_limited') return jsonResponse({ error: { code: 'rate_limited', message: 'Credential request limit reached. Retry after one hour.' } }, 429)

  let config
  try {
    config = creditPackConfig()
  } catch (error) {
    console.error('MPS credit checkout configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'credit_checkout_unavailable', message: 'MPS audit credit checkout is temporarily unavailable.' } }, 503)
  }
  if (!config) return jsonResponse({ error: { code: 'credit_checkout_not_enabled', message: 'MPS audit credit checkout is not enabled.' } }, 503)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit ledger is not configured.' } }, 503)

  const hashedRequestId = requestHash(clientRequestId)
  const { data: known, error: knownError } = await ledger
    .from('mps_credit_checkouts')
    .select('public_id, client_id, credential_id, request_hash, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency, stripe_price_id, credit_quantity, status, failure_code, created_at, paid_at')
    .eq('client_id', authorization.clientId)
    .eq('request_hash', hashedRequestId)
    .maybeSingle()
  if (knownError) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit checkout ledger could not be read.' } }, 503)

  let checkout = known as CreditCheckout | null
  let idempotentReplay = Boolean(checkout)

  if (!checkout) {
    const checkoutId = createCreditCheckoutId()
    const { data: created, error: createError } = await ledger
      .from('mps_credit_checkouts')
      .insert({
        public_id: checkoutId,
        client_id: authorization.clientId,
        credential_id: authorization.credentialId,
        request_hash: hashedRequestId,
        stripe_price_id: config.stripePriceId,
        credit_quantity: config.creditQuantity,
        status: 'awaiting_payment',
      })
      .select('public_id, client_id, credential_id, request_hash, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency, stripe_price_id, credit_quantity, status, failure_code, created_at, paid_at')
      .maybeSingle()
    if (createError?.code === '23505') {
      idempotentReplay = true
      const { data: replay, error: replayError } = await ledger
        .from('mps_credit_checkouts')
        .select('public_id, client_id, credential_id, request_hash, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency, stripe_price_id, credit_quantity, status, failure_code, created_at, paid_at')
        .eq('client_id', authorization.clientId)
        .eq('request_hash', hashedRequestId)
        .maybeSingle()
      if (replayError || !replay) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit checkout could not be created.' } }, 503)
      checkout = replay as CreditCheckout
    } else if (createError || !created) {
      console.error('MPS credit checkout creation failed:', createError?.code ?? 'missing_record')
      return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit checkout could not be created.' } }, 503)
    } else {
      checkout = created as CreditCheckout
    }
  }

  if (!checkout) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The credit checkout could not be prepared.' } }, 503)
  if (checkout.status === 'paid') {
    return jsonResponse({
      checkoutId: checkout.public_id,
      clientId: checkout.client_id,
      unit: MPS_AUDIT_CREDIT_UNIT,
      creditQuantity: checkout.credit_quantity,
      status: checkout.status,
      idempotentReplay: true,
      billingEnforcement: 'not_enabled',
    }, 200)
  }
  if (checkout.status === 'failed') {
    return jsonResponse({ error: { code: 'credit_checkout_failed', message: 'This checkout request failed. Use a new clientRequestId to try again.' } }, 409)
  }

  const form = new URLSearchParams({
    mode: 'payment',
    client_reference_id: checkout.public_id,
    success_url: `${SITE_URL}/mps?credits=success`,
    cancel_url: `${SITE_URL}/mps?credits=cancelled`,
    'line_items[0][price]': checkout.stripe_price_id,
    'line_items[0][quantity]': '1',
    'metadata[mpsCreditCheckoutId]': checkout.public_id,
    'metadata[mpsCreditQuantity]': String(checkout.credit_quantity),
    'metadata[mpsCreditUnit]': MPS_AUDIT_CREDIT_UNIT,
  })
  let stripe: { id?: string; url?: string; error?: { message?: string } }
  let stripeResponse: Response
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': checkout.public_id,
      },
      body: form,
      cache: 'no-store',
    })
    stripe = await stripeResponse.json() as { id?: string; url?: string; error?: { message?: string } }
  } catch {
    return jsonResponse({ error: { code: 'stripe_unavailable', message: 'Secure checkout could not be started. Please retry with the same clientRequestId.' } }, 502)
  }
  if (!stripeResponse.ok || !stripe.id || !stripe.url) {
    console.error('MPS credit Stripe session failed:', stripeResponse.status, stripe.error?.message ?? 'unknown')
    await ledger.from('mps_credit_checkouts').update({ status: 'failed', failure_code: 'stripe_checkout_failed' }).eq('public_id', checkout.public_id)
    return jsonResponse({ error: { code: 'stripe_checkout_failed', message: 'Secure checkout could not be started. Use a new clientRequestId to try again.' } }, 502)
  }

  const { error: sessionError } = await ledger
    .from('mps_credit_checkouts')
    .update({ stripe_checkout_session_id: stripe.id })
    .eq('public_id', checkout.public_id)
  if (sessionError) {
    console.error('MPS credit checkout session storage failed:', sessionError.code)
    return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The secure checkout could not be recorded.' } }, 503)
  }
  checkout = { ...checkout, stripe_checkout_session_id: stripe.id }
  return checkoutResponse(checkout, stripe.url, idempotentReplay)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
