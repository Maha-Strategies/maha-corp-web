import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import {
  createCreditLedgerEntryId,
  stripeWebhookPayloadHash,
  validCreditCheckoutId,
  validStripeEventId,
  validStripeWebhookSignature,
} from '@/lib/mps-credits'
import { reconciliationFailure, reconcileRevenuePayment, reconcileRevenueRefund } from '@/lib/revenue-reconciliation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeCheckoutSession = {
  id?: string
  payment_intent?: string | null
  payment_status?: string
  client_reference_id?: string | null
  metadata?: { mpsCreditCheckoutId?: string }
  amount_total?: number | null
  currency?: string | null
}

type StripeRefund = {
  id?: string
  status?: string
  payment_intent?: string | null
  amount?: number | null
  currency?: string | null
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

type ProcessingResult = 'processed' | 'duplicate' | 'ignored' | 'retry'

function processingResponse(result: unknown, errorCode: string | undefined) {
  if (errorCode || !['processed', 'duplicate', 'ignored', 'retry'].includes(String(result))) {
    console.error('MPS credit webhook processing failed:', errorCode ?? 'invalid_rpc_response')
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
  const { data, error } = await ledger.rpc('record_mps_credit_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_object_id: stripeObjectId,
    p_payload_hash: payloadHash,
    p_received_at: new Date().toISOString(),
  })
  return processingResponse(data as ProcessingResult | null, error?.code)
}

async function processRefund(eventId: string, eventType: string, payloadHash: string, refund: StripeRefund) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('process_mps_credit_refund_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: payloadHash,
    p_refund_id: refund.id,
    p_payment_intent_id: refund.payment_intent,
    p_amount: refund.amount,
    p_currency: refund.currency,
    p_entry_id: createCreditLedgerEntryId(),
    p_received_at: new Date().toISOString(),
  })
  const productResponse = processingResponse(data as ProcessingResult | null, error?.code)
  if (error || !['processed', 'duplicate'].includes(String(data))) return productResponse
  const reconciliation = await reconcileRevenueRefund(ledger, {
    eventId, eventType, payloadHash, reversalId: refund.id!, paymentIntentId: refund.payment_intent!,
    amountCents: refund.amount!, currency: refund.currency!, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? productResponse
}

async function processCheckout(eventId: string, eventType: string, payloadHash: string, checkoutId: string, session: StripeCheckoutSession) {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error } = await ledger.rpc('process_mps_credit_checkout_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: payloadHash,
    p_checkout_id: checkoutId,
    p_session_id: session.id,
    p_payment_intent_id: session.payment_intent ?? null,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_entry_id: createCreditLedgerEntryId(),
    p_received_at: new Date().toISOString(),
  })
  const productResponse = processingResponse(data as ProcessingResult | null, error?.code)
  if (error || !['processed', 'duplicate'].includes(String(data))) return productResponse
  const reconciliation = await reconcileRevenuePayment(ledger, {
    eventId, eventType, payloadHash, offerId: 'mps-prepaid-audit-access', checkoutReference: checkoutId,
    sessionId: session.id!, paymentIntentId: session.payment_intent ?? null, amountCents: session.amount_total!,
    currency: session.currency!, delivered: true, receivedAt: new Date().toISOString(),
  })
  return reconciliationFailure(reconciliation) ?? productResponse
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_MPS_CREDITS_WEBHOOK_SECRET
  const raw = await request.text()
  if (!secret || !validStripeWebhookSignature(raw, request.headers.get('stripe-signature'), secret)) {
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
    if (refund?.status !== 'succeeded' || !refund.id || !refund.payment_intent || !validPaymentAmount(refund.amount) || !validCurrency(refund.currency)) {
      return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
    }
    return processRefund(eventId, eventType, payloadHash, refund)
  }
  if (eventType !== 'checkout.session.completed' && eventType !== 'checkout.session.async_payment_succeeded') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }

  const session = stripeObject as StripeCheckoutSession | undefined
  if (eventType === 'checkout.session.completed' && session?.payment_status !== 'paid') {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }
  const checkoutId = session?.metadata?.mpsCreditCheckoutId ?? session?.client_reference_id
  if (!session?.id || !checkoutId || !validCreditCheckoutId(checkoutId) || !validPaymentAmount(session.amount_total) || !validCurrency(session.currency)) {
    return recordEvent(eventId, eventType, payloadHash, objectId(stripeObject))
  }
  return processCheckout(eventId, eventType, payloadHash, checkoutId, session)
}
