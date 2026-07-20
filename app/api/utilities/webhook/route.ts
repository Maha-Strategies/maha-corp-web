import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { stripeWebhookPayloadHash, validStripeEventId, validStripeWebhookSignature } from '@/lib/mps-credits'
import { reconciliationFailure, reconcileRevenuePayment, reconcileRevenueRefund } from '@/lib/revenue-reconciliation'
import { REVENUE_OFFER_FOR_UTILITY, isKnownUtility, utilityCatalogConfig, validUtilityCheckoutId } from '@/lib/utility-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeCheckoutSession = {
  id?: string
  payment_intent?: string | null
  payment_status?: string
  client_reference_id?: string | null
  metadata?: { utilityCheckoutId?: string }
  amount_total?: number | null
  currency?: string | null
}

type StripeRefund = { id?: string; payment_intent?: string | null; amount?: number | null; currency?: string | null; status?: string | null }
type StripeDispute = { id?: string; payment_intent?: string | null; charge?: string | null; charge_id?: string | null; amount?: number | null; currency?: string | null; status?: string | null }

function validPaymentAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
function validCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value)
}
function validEventType(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9_.]{1,128}$/.test(value)
}
function validPaymentIntentId(value: unknown): value is string {
  return typeof value === 'string' && /^pi_[A-Za-z0-9]+$/.test(value)
}
function validStripeChargeId(value: unknown): value is string {
  return typeof value === 'string' && /^ch_[A-Za-z0-9]+$/.test(value)
}

async function paymentIntentForCharge(chargeId: string, stripeSecretKey: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(chargeId)}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}` }, cache: 'no-store',
    })
    if (!response.ok) return null
    const charge = await response.json() as { payment_intent?: unknown }
    return validPaymentIntentId(charge.payment_intent) ? charge.payment_intent : null
  } catch { return null }
}

// A full reversal always reconciles revenue and locks a consumed run. A partial
// refund does not consume the buyer's paid run token.
async function processReversal(input: {
  eventId: string; eventType: string; payloadHash: string; reversalId: string; paymentIntentId: string; amount: number; currency: string
}) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data: checkout } = await ledger.from('utility_checkouts').select('public_id,stripe_payment_amount,stripe_payment_currency').eq('stripe_payment_intent_id', input.paymentIntentId).maybeSingle()
  if (checkout?.public_id && validUtilityCheckoutId(checkout.public_id) && checkout.stripe_payment_amount === input.amount && checkout.stripe_payment_currency === input.currency.toLowerCase()) {
    await ledger.rpc('mark_utility_run_refunded', { p_checkout_id: checkout.public_id })
  }
  const reconciliation = await reconcileRevenueRefund(ledger, {
    eventId: input.eventId, eventType: input.eventType, payloadHash: input.payloadHash, reversalId: input.reversalId,
    paymentIntentId: input.paymentIntentId, amountCents: input.amount, currency: input.currency, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? Response.json({ received: true })
}

export async function POST(request: Request) {
  let config
  try { config = utilityCatalogConfig() }
  catch (error) {
    console.error('Utility webhook configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'webhook_unavailable', message: 'Utility webhook is not configured.' } }, 503)
  }
  const raw = await request.text()
  if (!config || !validStripeWebhookSignature(raw, request.headers.get('stripe-signature'), config.webhookSecret)) {
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } }
  try { event = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 }) }
  if (typeof event.id !== 'string' || !validStripeEventId(event.id) || !validEventType(event.type)) {
    return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 })
  }
  const eventId = event.id
  const eventType = event.type
  const stripeObject = event.data?.object
  const payloadHash = stripeWebhookPayloadHash(raw)

  if (eventType === 'refund.created' || eventType === 'refund.updated') {
    const refund = stripeObject as StripeRefund | undefined
    if (refund?.status !== 'succeeded' || !/^re_[A-Za-z0-9]+$/.test(refund.id ?? '') || !validPaymentIntentId(refund.payment_intent) || !validPaymentAmount(refund.amount) || !validCurrency(refund.currency)) {
      return Response.json({ received: true, ignored: true })
    }
    return processReversal({ eventId, eventType, payloadHash, reversalId: refund.id!, paymentIntentId: refund.payment_intent, amount: refund.amount, currency: refund.currency })
  }

  if (eventType === 'charge.dispute.closed') {
    const dispute = stripeObject as StripeDispute | undefined
    if (dispute?.status !== 'lost' || !/^du_[A-Za-z0-9]+$/.test(dispute.id ?? '') || !validPaymentAmount(dispute.amount) || !validCurrency(dispute.currency)) {
      return Response.json({ received: true, ignored: true })
    }
    const paymentIntentId = validPaymentIntentId(dispute.payment_intent)
      ? dispute.payment_intent
      : validStripeChargeId(dispute.charge) ? await paymentIntentForCharge(dispute.charge, config.stripeSecretKey)
        : validStripeChargeId(dispute.charge_id) ? await paymentIntentForCharge(dispute.charge_id, config.stripeSecretKey)
          : null
    if (!paymentIntentId) return Response.json({ error: 'Stripe dispute dependency is not ready.' }, { status: 503 })
    return processReversal({ eventId, eventType, payloadHash, reversalId: dispute.id!, paymentIntentId, amount: dispute.amount, currency: dispute.currency })
  }

  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return Response.json({ received: true, ignored: true })
  }

  const session = stripeObject as StripeCheckoutSession | undefined
  if (eventType === 'checkout.session.completed' && session?.payment_status !== 'paid') {
    return Response.json({ received: true, ignored: true })
  }
  const checkoutId = session?.metadata?.utilityCheckoutId ?? session?.client_reference_id
  if (!session?.id || !checkoutId || !validUtilityCheckoutId(checkoutId) || !validPaymentAmount(session.amount_total) || !validCurrency(session.currency)) {
    return Response.json({ received: true, ignored: true })
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data: markResult, error: markError } = await ledger.rpc('process_utility_checkout_event', {
    p_checkout_id: checkoutId,
    p_session_id: session.id,
    p_payment_intent_id: session.payment_intent ?? null,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_received_at: new Date().toISOString(),
  })
  if (markError || !['processed', 'duplicate', 'ignored', 'retry'].includes(String(markResult))) {
    console.error('Utility checkout event failed:', markError?.code ?? 'invalid_rpc_response')
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  if (markResult === 'retry') return Response.json({ error: 'Webhook dependency is not ready.' }, { status: 503 })
  if (markResult === 'ignored') return Response.json({ received: true, ignored: true })

  // Payment is reconciled now; delivery is deferred until the buyer runs the token.
  const { data: checkout } = await ledger.from('utility_checkouts').select('utility').eq('public_id', checkoutId).maybeSingle()
  if (!checkout || !isKnownUtility(checkout.utility)) {
    return Response.json({ error: 'Revenue reconciliation is temporarily unavailable.' }, { status: 503 })
  }
  const reconciliation = await reconcileRevenuePayment(ledger, {
    eventId, eventType, payloadHash, offerId: REVENUE_OFFER_FOR_UTILITY[checkout.utility], checkoutReference: checkoutId,
    sessionId: session.id, paymentIntentId: session.payment_intent ?? null, amountCents: session.amount_total,
    currency: session.currency, delivered: false, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? Response.json({ received: true, duplicate: markResult === 'duplicate' })
}
