import { timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const token = process.env.INBOUND_DIGEST_TOKEN ?? process.env.CRON_SECRET
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !supplied) return false
  const expected = Buffer.from(token), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  const ledger = createAgentInquiryLedger()
  if (!ledger) return Response.json({ error: 'Inbound ledger unavailable.' }, { status: 503 })
  const { data: submissions, error } = await ledger.from('inbound_submissions')
    .select('public_id,offer_id,requester_name,requester_email,requester_organization,decision,question,deadline,qualification_reasons,revenue_opportunity_id,created_at')
    .eq('qualification_status', 'qualified').is('digest_sent_at', null).order('created_at', { ascending: true }).limit(25)
  if (error) return Response.json({ error: 'Inbound ledger unavailable.' }, { status: 503 })
  if (!submissions?.length) return new Response(null, { status: 204 })
  const resendKey = process.env.RESEND_API_KEY
  const to = process.env.INBOUND_DIGEST_TO ?? process.env.AGENT_INQUIRY_TO
  if (!resendKey || !to) return Response.json({ error: 'Digest delivery is not configured.' }, { status: 503 })
  const lines = submissions.map((item, index) => `${index + 1}. ${item.offer_id} · ${item.requester_organization ?? item.requester_name}\nDecision: ${item.decision}\nQuestion: ${item.question}\nDeadline: ${item.deadline ?? 'Not specified'}\nRevenue opportunity: ${item.revenue_opportunity_id ?? 'pending'}\nSubmission: ${item.public_id}`).join('\n\n')
  const { error: sendError } = await new Resend(resendKey).emails.send({
    from: process.env.INBOUND_DIGEST_FROM ?? process.env.AGENT_INQUIRY_FROM ?? 'Maha Strategies <onboarding@resend.dev>', to,
    subject: `[Inbound digest] ${submissions.length} qualified opportunity${submissions.length === 1 ? '' : 'ies'}`,
    text: `QUALIFIED INBOUND OPPORTUNITIES\n\n${lines}\n\nAll submissions remain non-binding and require human scope, price, and timing confirmation.`,
  })
  if (sendError) return Response.json({ error: 'Digest delivery failed.' }, { status: 503 })
  const ids = submissions.map((item) => item.public_id)
  const { error: markError } = await ledger.from('inbound_submissions').update({ digest_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('public_id', ids)
  if (markError) return Response.json({ error: 'Digest delivery status could not be recorded.' }, { status: 503 })
  return Response.json({ delivered: ids.length })
}
