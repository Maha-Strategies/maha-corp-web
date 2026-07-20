import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { auditInputHash, MpsAuditError, runMpsAudit } from '@/lib/mps-audit-engine'
import { mergePreflightAudits, parsePreflightText, PREFLIGHT_MODEL, reportPath, secretMatches, splitPreflightText, type StoredPreflight, validPreflightId } from '@/lib/mps-preflight'
import { reconciliationFailure, reconcileRevenueDelivery } from '@/lib/revenue-reconciliation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function loadOrder(orderId: string): Promise<{ order: StoredPreflight | null; unavailable: boolean }> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return { order: null, unavailable: true }
  const { data, error } = await ledger
    .from('mps_preflight_orders')
    .select('public_id, access_hash, customer_email, document_label, status, stripe_checkout_session_id, input_hash, report, failure_code, delivery_status, created_at, completed_at')
    .eq('public_id', orderId)
    .maybeSingle()
  return { order: data as StoredPreflight | null, unavailable: Boolean(error) }
}

async function reconcileCompletedPreflight(orderId: string): Promise<Response | null> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'The revenue ledger is unavailable.' }, 503)
  const result = await reconcileRevenueDelivery(ledger, {
    offerId: 'mps-preflight', checkoutReference: orderId, referenceId: `delivery:${orderId}`, deliveredAt: new Date().toISOString(),
  })
  return reconciliationFailure(result)
}

export async function POST(request: Request) {
  let orderId: string
  let access: string
  let text: string
  try {
    const body = await request.json() as { orderId?: unknown; access?: unknown; text?: unknown }
    if (typeof body.orderId !== 'string' || !validPreflightId(body.orderId)) throw new Error('The purchase link is invalid.')
    if (typeof body.access !== 'string' || body.access.length < 24) throw new Error('The purchase link is invalid.')
    orderId = body.orderId
    access = body.access
    text = parsePreflightText(body.text)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Invalid request.' }, 400)
  }

  const { order, unavailable } = await loadOrder(orderId)
  if (unavailable) return response({ error: 'The preflight ledger is unavailable.' }, 503)
  if (!order || !secretMatches(access, order.access_hash)) return response({ error: 'The purchase link is invalid.' }, 404)
  if (order.status === 'completed' && order.report) {
    const reconciliationError = await reconcileCompletedPreflight(orderId)
    if (reconciliationError) return reconciliationError
    return response({ status: 'completed', reportUrl: reportPath(orderId, access) }, 200)
  }
  if (order.status === 'processing') return response({ status: 'processing', retryAfterSeconds: 8 }, 202)
  if (order.status !== 'paid') return response({ error: 'Payment has not yet been confirmed. Refresh this page in a few seconds.' }, 409)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return response({ error: 'The preflight ledger is unavailable.' }, 503)
  const { data: claimed, error: claimError } = await ledger
    .from('mps_preflight_orders')
    .update({ status: 'processing', input_hash: auditInputHash(text) })
    .eq('public_id', orderId)
    .eq('status', 'paid')
    .select('public_id')
    .maybeSingle()
  if (claimError) return response({ error: 'The preflight could not be started.' }, 503)
  if (!claimed) return response({ status: 'processing', retryAfterSeconds: 8 }, 202)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const chunks = splitPreflightText(text)
    const audits = await Promise.all(chunks.map((chunk) => runMpsAudit(chunk, async (prompt) => {
      const message = await client.messages.create({
        model: PREFLIGHT_MODEL,
        max_tokens: 1_800,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    })))
    const report = mergePreflightAudits(text, audits)
    const { error: completeError } = await ledger
      .from('mps_preflight_orders')
      .update({ status: 'completed', report, completed_at: new Date().toISOString() })
      .eq('public_id', orderId)
    if (completeError) throw new Error('ledger_completion_failed')
    const reconciliationError = await reconcileCompletedPreflight(orderId)
    if (reconciliationError) return reconciliationError

    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const link = reportPath(orderId, access)
      const send = await new Resend(resendKey).emails.send({
        from: process.env.MPS_PREFLIGHT_FROM_EMAIL ?? 'Maha Strategies <onboarding@resend.dev>',
        to: order.customer_email,
        subject: 'Your MPS Preflight report is ready',
        text: `Your MPS Preflight report is ready. Open it privately: ${link}\n\nThe original document text was processed transiently and is not retained in the ledger.`,
      })
      await ledger.from('mps_preflight_orders').update({ delivery_status: send.error ? 'failed' : 'sent' }).eq('public_id', orderId)
    } else {
      await ledger.from('mps_preflight_orders').update({ delivery_status: 'not_configured' }).eq('public_id', orderId)
    }
    return response({ status: 'completed', reportUrl: reportPath(orderId, access), sourceTextStored: false }, 201)
  } catch (error) {
    const failureCode = error instanceof MpsAuditError ? 'invalid_model_response' : 'preflight_unavailable'
    await ledger.from('mps_preflight_orders').update({
      status: 'failed', failure_code: failureCode, completed_at: new Date().toISOString(),
    }).eq('public_id', orderId)
    console.error('MPS Preflight failed:', error instanceof Error ? error.name : 'unknown_error')
    return response({ error: 'The preflight did not complete. Contact us with your purchase email and we will resolve it.' }, 502)
  }
}
