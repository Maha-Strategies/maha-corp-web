import { createHash } from 'node:crypto'

import type { BookId } from '@/lib/books'

export const REVENUE_OFFER_FOR_BOOK: Record<BookId, 'book-the-imagined-life' | 'book-the-orbital-mind' | 'book-the-synthetic-self' | 'book-the-unfinished-species'> = {
  'the-imagined-life': 'book-the-imagined-life',
  'the-orbital-mind': 'book-the-orbital-mind',
  'the-synthetic-self': 'book-the-synthetic-self',
  'the-unfinished-species': 'book-the-unfinished-species',
}

export type RevenueReconciliationResult = 'processed' | 'duplicate' | 'retry' | 'ignored' | 'unavailable'

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }

function result(data: unknown, error: { code?: string } | null): RevenueReconciliationResult {
  if (error || !['processed', 'duplicate', 'retry', 'ignored'].includes(String(data))) return 'unavailable'
  return data as Exclude<RevenueReconciliationResult, 'unavailable'>
}

export function revenueWebhookFingerprint(): string {
  return `sha256:${createHash('sha256').update('maha-stripe-revenue-reconciliation-v1').digest('hex')}`
}

export async function reconcileRevenuePayment(ledger: Ledger, input: {
  eventId: string; eventType: string; payloadHash: string; offerId: string; checkoutReference: string
  sessionId: string; paymentIntentId: string | null; amountCents: number; currency: string; delivered: boolean; receivedAt: string
}): Promise<RevenueReconciliationResult> {
  const { data, error } = await ledger.rpc('reconcile_revenue_checkout_payment', {
    p_event_id: input.eventId, p_event_type: input.eventType, p_payload_hash: input.payloadHash,
    p_offer_id: input.offerId, p_checkout_reference: input.checkoutReference, p_session_id: input.sessionId,
    p_payment_intent_id: input.paymentIntentId, p_amount_cents: input.amountCents, p_currency: input.currency,
    p_delivered: input.delivered, p_actor_fingerprint: revenueWebhookFingerprint(), p_received_at: input.receivedAt,
  })
  return result(data, error)
}

export async function reconcileRevenueRefund(ledger: Ledger, input: {
  eventId: string; eventType: string; payloadHash: string; reversalId: string; paymentIntentId: string
  amountCents: number; currency: string; receivedAt: string
}): Promise<RevenueReconciliationResult> {
  const { data, error } = await ledger.rpc('reconcile_revenue_payment_reversal', {
    p_event_id: input.eventId, p_event_type: input.eventType, p_payload_hash: input.payloadHash,
    p_reversal_id: input.reversalId, p_payment_intent_id: input.paymentIntentId,
    p_amount_cents: input.amountCents, p_currency: input.currency,
    p_actor_fingerprint: revenueWebhookFingerprint(), p_received_at: input.receivedAt,
  })
  return result(data, error)
}

export async function reconcileRevenueDelivery(ledger: Ledger, input: {
  offerId: string; checkoutReference: string; referenceId: string; deliveredAt: string
}): Promise<RevenueReconciliationResult> {
  const { data, error } = await ledger.rpc('record_revenue_checkout_delivery', {
    p_offer_id: input.offerId, p_checkout_reference: input.checkoutReference, p_reference_id: input.referenceId,
    p_actor_fingerprint: revenueWebhookFingerprint(), p_delivered_at: input.deliveredAt,
  })
  return result(data, error)
}

export function reconciliationFailure(result: RevenueReconciliationResult): Response | null {
  if (result === 'processed' || result === 'duplicate' || result === 'ignored') return null
  return Response.json({ error: 'Revenue reconciliation is temporarily unavailable.' }, { status: 503 })
}
