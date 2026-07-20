import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { bookCatalogConfig, createBookEntitlementId, isKnownBook, validBookCheckoutId } from '@/lib/books'
import { stripeWebhookPayloadHash, validStripeEventId, validStripeWebhookSignature } from '@/lib/mps-credits'
import { REVENUE_OFFER_FOR_BOOK, reconciliationFailure, reconcileRevenuePayment, reconcileRevenueRefund } from '@/lib/revenue-reconciliation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeCheckoutSession = {
  id?: string
  payment_intent?: string | null
  payment_status?: string
  client_reference_id?: string | null
  metadata?: { bookCheckoutId?: string }
  amount_total?: number | null
  currency?: string | null
}

type StripeRefund = {
  id?: string
  payment_intent?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
}

type StripeDispute = {
  id?: string
  payment_intent?: string | null
  charge?: string | null
  charge_id?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
}

function validPaymentAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function validCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value)
}

function validEventType(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9_.]{1,128}$/.test(value)
}

function objectId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const id = (value as { id?: unknown }).id
  return typeof id === 'string' && id.length <= 255 ? id : null
}

function validPaymentIntentId(value: unknown): value is string {
  return typeof value === 'string' && /^pi_[A-Za-z0-9]+$/.test(value)
}

function validStripeChargeId(value: unknown): value is string {
  return typeof value === 'string' && /^ch_[A-Za-z0-9]+$/.test(value)
}

type ProcessingResult = 'processed' | 'duplicate' | 'ignored' | 'retry'

function processingResponse(result: unknown, errorCode: string | undefined) {
  if (errorCode || !['processed', 'duplicate', 'ignored', 'retry'].includes(String(result))) {
    console.error('Book webhook processing failed:', errorCode ?? 'invalid_rpc_response')
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  if (result === 'retry') {
    return Response.json({ error: 'Webhook dependency is not ready.' }, { status: 503 })
  }
  return Response.json({ received: true, duplicate: result === 'duplicate' })
}

async function recordEvent(eventId: string, eventType: string, payloadHash: string, stripeObjectId: string | null) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('record_book_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_object_id: stripeObjectId,
    p_payload_hash: payloadHash,
    p_received_at: new Date().toISOString(),
  })
  return processingResponse(data as ProcessingResult | null, error?.code)
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

async function processReversal(input: {
  eventId: string; eventType: string; payloadHash: string; reversalId: string; reversalType: 'refund' | 'dispute_lost'
  paymentIntentId: string; amount: number; currency: string
}) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('process_book_payment_reversal_event', {
    p_event_id: input.eventId, p_event_type: input.eventType, p_payload_hash: input.payloadHash,
    p_reversal_id: input.reversalId, p_reversal_type: input.reversalType, p_payment_intent_id: input.paymentIntentId,
    p_amount: input.amount, p_currency: input.currency, p_received_at: new Date().toISOString(),
  })
  const productResponse = processingResponse(data as ProcessingResult | null, error?.code)
  if (error || !['processed', 'duplicate'].includes(String(data))) return productResponse
  const { data: checkout, error: checkoutError } = await ledger.from('book_checkouts').select('book_id').eq('stripe_payment_intent_id', input.paymentIntentId).maybeSingle()
  if (checkoutError || !checkout || !isKnownBook(checkout.book_id)) return Response.json({ error: 'Revenue reconciliation is temporarily unavailable.' }, { status: 503 })
  const reconciliation = await reconcileRevenueRefund(ledger, {
    eventId: input.eventId, eventType: input.eventType, payloadHash: input.payloadHash, reversalId: input.reversalId,
    paymentIntentId: input.paymentIntentId, amountCents: input.amount, currency: input.currency, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? productResponse
}

export async function POST(request: Request) {
  let config
  try { config = bookCatalogConfig() }
  catch (error) {
    console.error('Book webhook configuration invalid:', error instanceof Error ? error.message : 'unknown_error')
    return jsonResponse({ error: { code: 'webhook_unavailable', message: 'Book webhook is not configured.' } }, 503)
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
      return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
    }
    return processReversal({
      eventId, eventType, payloadHash, reversalId: refund.id!, reversalType: 'refund', paymentIntentId: refund.payment_intent,
      amount: refund.amount, currency: refund.currency,
    })
  }

  if (eventType === 'charge.dispute.closed') {
    const dispute = stripeObject as StripeDispute | undefined
    if (dispute?.status !== 'lost' || !/^du_[A-Za-z0-9]+$/.test(dispute.id ?? '') || !validPaymentAmount(dispute.amount) || !validCurrency(dispute.currency)) {
      return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
    }
    const paymentIntentId = validPaymentIntentId(dispute.payment_intent)
      ? dispute.payment_intent
      : validStripeChargeId(dispute.charge) ? await paymentIntentForCharge(dispute.charge, config.stripeSecretKey)
        : validStripeChargeId(dispute.charge_id) ? await paymentIntentForCharge(dispute.charge_id, config.stripeSecretKey)
          : null
    if (!paymentIntentId) return Response.json({ error: 'Stripe dispute dependency is not ready.' }, { status: 503 })
    return processReversal({
      eventId, eventType, payloadHash, reversalId: dispute.id!, reversalType: 'dispute_lost', paymentIntentId,
      amount: dispute.amount, currency: dispute.currency,
    })
  }

  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }

  const session = stripeObject as StripeCheckoutSession | undefined
  if (eventType === 'checkout.session.completed' && session?.payment_status !== 'paid') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }
  const checkoutId = session?.metadata?.bookCheckoutId ?? session?.client_reference_id
  if (!session?.id || !checkoutId || !validBookCheckoutId(checkoutId) || !validPaymentAmount(session.amount_total) || !validCurrency(session.currency)) {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('process_book_checkout_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: payloadHash,
    p_checkout_id: checkoutId,
    p_session_id: session.id,
    p_payment_intent_id: session.payment_intent ?? null,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_entitlement_id: createBookEntitlementId(),
    p_allowed_price_ids: Object.keys(config.bookByPrice),
    p_received_at: new Date().toISOString(),
  })
  const productResponse = processingResponse(data as ProcessingResult | null, error?.code)
  if (error || !['processed', 'duplicate'].includes(String(data))) return productResponse
  const { data: checkout, error: checkoutError } = await ledger.from('book_checkouts').select('book_id').eq('public_id', checkoutId).maybeSingle()
  if (checkoutError || !checkout || !isKnownBook(checkout.book_id)) return Response.json({ error: 'Revenue reconciliation is temporarily unavailable.' }, { status: 503 })
  const reconciliation = await reconcileRevenuePayment(ledger, {
    eventId, eventType, payloadHash, offerId: REVENUE_OFFER_FOR_BOOK[checkout.book_id], checkoutReference: checkoutId,
    sessionId: session.id, paymentIntentId: session.payment_intent ?? null, amountCents: session.amount_total,
    currency: session.currency, delivered: true, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? productResponse
}
