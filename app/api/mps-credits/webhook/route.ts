import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import {
  MPS_AUDIT_CREDIT_UNIT,
  createCreditLedgerEntryId,
  ledgerEventHash,
  validCreditCheckoutId,
  validStripeWebhookSignature,
  type CreditCheckout,
} from '@/lib/mps-credits'

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

function checkoutSelect() {
  return 'public_id, client_id, credential_id, request_hash, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_amount, stripe_payment_currency, stripe_price_id, credit_quantity, status, failure_code, created_at, paid_at'
}

function validPaymentAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function validCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value)
}

async function recordRefund(refund: StripeRefund) {
  if (refund.status !== 'succeeded' || !refund.id || !refund.payment_intent || !validPaymentAmount(refund.amount) || !validCurrency(refund.currency)) {
    return Response.json({ received: true })
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error: lookupError } = await ledger
    .from('mps_credit_checkouts')
    .select(checkoutSelect())
    .eq('stripe_payment_intent_id', refund.payment_intent)
    .maybeSingle()
  if (lookupError) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const checkout = data as CreditCheckout | null
  if (
    !checkout ||
    checkout.status !== 'paid' ||
    !checkout.stripe_payment_amount ||
    !checkout.stripe_payment_currency ||
    checkout.stripe_payment_currency.toLowerCase() !== refund.currency.toLowerCase() ||
    refund.amount > checkout.stripe_payment_amount
  ) return Response.json({ received: true })

  const { data: priorReversals, error: reversalsError } = await ledger
    .from('mps_credit_ledger_entries')
    .select('quantity')
    .eq('checkout_id', checkout.public_id)
    .eq('entry_type', 'reversal')
    .eq('source_type', 'stripe_refund')
  if (reversalsError) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })

  const alreadyReversed = (priorReversals ?? []).reduce((total, entry) => total + Math.abs(Number(entry.quantity)), 0)
  const requestedReversal = Number((checkout.credit_quantity * refund.amount / checkout.stripe_payment_amount).toFixed(6))
  const quantity = -Math.min(Math.max(0, checkout.credit_quantity - alreadyReversed), requestedReversal)
  if (quantity === 0) return Response.json({ received: true })

  const entryId = createCreditLedgerEntryId()
  const createdAt = new Date().toISOString()
  const { error: reversalError } = await ledger.from('mps_credit_ledger_entries').insert({
    public_id: entryId,
    client_id: checkout.client_id,
    checkout_id: checkout.public_id,
    entry_type: 'reversal',
    unit: MPS_AUDIT_CREDIT_UNIT,
    quantity,
    source_type: 'stripe_refund',
    source_id: refund.id,
    event_hash: ledgerEventHash({ entryId, clientId: checkout.client_id, checkoutId: checkout.public_id, quantity, sourceId: refund.id, createdAt }),
    metadata: { stripePaymentIntentId: refund.payment_intent, stripeRefundId: refund.id, stripeRefundAmount: refund.amount, stripeRefundCurrency: refund.currency.toLowerCase() },
    created_at: createdAt,
  })
  if (reversalError && reversalError.code !== '23505') {
    console.error('MPS credit reversal failed:', reversalError.code)
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  return Response.json({ received: true })
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_MPS_CREDITS_WEBHOOK_SECRET
  const raw = await request.text()
  if (!secret || !validStripeWebhookSignature(raw, request.headers.get('stripe-signature'), secret)) {
    return Response.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
  }

  let event: { type?: string; data?: { object?: StripeCheckoutSession | StripeRefund } }
  try { event = JSON.parse(raw) } catch { return Response.json({ error: 'Invalid Stripe event.' }, { status: 400 }) }
  if (event.type === 'refund.created' || event.type === 'refund.updated') return recordRefund(event.data?.object as StripeRefund)
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return Response.json({ received: true })

  const session = event.data?.object as StripeCheckoutSession | undefined
  if (event.type === 'checkout.session.completed' && session?.payment_status !== 'paid') return Response.json({ received: true })
  const checkoutId = session?.metadata?.mpsCreditCheckoutId ?? session?.client_reference_id
  if (!session?.id || !checkoutId || !validCreditCheckoutId(checkoutId) || !validPaymentAmount(session.amount_total) || !validCurrency(session.currency)) {
    return Response.json({ received: true })
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const { data, error: lookupError } = await ledger
    .from('mps_credit_checkouts')
    .select(checkoutSelect())
    .eq('public_id', checkoutId)
    .maybeSingle()
  if (lookupError) return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  const checkout = data as CreditCheckout | null
  if (!checkout || checkout.status === 'failed') return Response.json({ received: true })
  if (checkout.stripe_checkout_session_id && checkout.stripe_checkout_session_id !== session.id) return Response.json({ received: true })

  const entryId = createCreditLedgerEntryId()
  const createdAt = new Date().toISOString()
  const eventHash = ledgerEventHash({ entryId, clientId: checkout.client_id, checkoutId: checkout.public_id, quantity: checkout.credit_quantity, sourceId: session.id, createdAt })
  const { data: finalized, error: updateError } = await ledger.rpc('finalize_mps_credit_purchase', {
    p_checkout_id: checkout.public_id, p_session_id: session.id, p_payment_intent_id: session.payment_intent ?? null,
    p_amount: session.amount_total, p_currency: session.currency, p_entry_id: entryId, p_event_hash: eventHash, p_created_at: createdAt,
  })
  if (updateError || finalized !== true) {
    console.error('MPS credit checkout finalization failed:', updateError?.code ?? 'rejected')
    return Response.json({ error: 'Ledger unavailable.' }, { status: 503 })
  }
  return Response.json({ received: true })
}
