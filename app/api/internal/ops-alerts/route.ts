import { jsonResponse } from '@/lib/agent-inquiries'
import { deliverPagingEvent } from '@/lib/observability/paging'
import { opsAlertDeliveryFailure, opsAlertEmail, receiveOpsAlert } from '@/lib/observability/receiver'
import { captureOperationalError } from '@/lib/observability/telemetry'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 16_384

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const body = await request.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Alert exceeds the 16 KB limit.' } }, 413)

  const secret = process.env.MAHA_OPS_WEBHOOK_SECRET
  const resendKey = process.env.RESEND_API_KEY
  // Paging is the primary channel; email alone is still a valid receiver, so
  // this only refuses when neither channel could possibly work.
  if (!secret || (!resendKey && !process.env.PAGERDUTY_ROUTING_KEY?.trim())) {
    return jsonResponse({ error: { code: 'receiver_unavailable', message: 'Operations alert receiver is not configured.' } }, 503)
  }

  let alert
  try { alert = receiveOpsAlert(body, request.headers, secret) }
  catch (error) { return jsonResponse({ error: { code: 'invalid_alert', message: error instanceof Error ? error.message : 'Alert is invalid.' } }, 401) }

  // Paging first: it is the only channel that requires a human to acknowledge
  // and that escalates when nobody does.
  const paging = await deliverPagingEvent(alert, process.env.PAGERDUTY_ROUTING_KEY)
  if (paging === 'failed') {
    captureOperationalError(new Error('Operations paging delivery failed.'), 'ops-alert-receiver', 'paging-delivery')
  }
  // Email is the fallback recipient, not a second copy: it is sent only when
  // paging did not carry the alert. One channel failing must never mean
  // silence, which is exactly what happened when email stood alone.
  if (paging === 'delivered') return jsonResponse({ received: true, channel: 'paging' }, 200)

  if (!resendKey) {
    return jsonResponse({ error: { code: 'delivery_failed', message: 'Operations notification delivery failed.' } }, 503)
  }

  const email = opsAlertEmail(alert)
  try {
    const result = await new Resend(resendKey).emails.send({
      from: process.env.MAHA_OPS_ALERT_FROM ?? 'Maha Operations <noreply@mahastrategies.com>',
      to: process.env.MAHA_OPS_ALERT_TO ?? 'mayone@mahastrategies.com',
      subject: email.subject,
      text: email.text,
    }, { idempotencyKey: alert.eventId })
    if (result.error) throw result.error
  } catch (error) {
    const failure = opsAlertDeliveryFailure(error)
    console.error('[OPS_ALERT_DELIVERY_FAILED]', { failure, paging })
    captureOperationalError(new Error(`Operations email delivery failed (${failure}).`), 'ops-alert-receiver', 'email-delivery')
    return jsonResponse({ error: { code: 'delivery_failed', message: 'Operations notification delivery failed.' } }, 503)
  }

  return jsonResponse({ received: true, channel: 'email', paging }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
