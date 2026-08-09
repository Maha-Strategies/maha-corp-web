import { Resend } from 'resend'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { jsonResponse } from '@/lib/agent-inquiries'
import { buildNavigatorAssessment, createNavigatorAssessmentId, navigatorHash, parseNavigatorSubmission } from '@/lib/maha-navigator'
import { publicUtilityVisitorHash } from '@/lib/public-utility'
import { verifyContactTurnstile } from '@/lib/turnstile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 20_000

async function notifyOperator(input: ReturnType<typeof parseNavigatorSubmission>, assessmentId: string, assessment: ReturnType<typeof buildNavigatorAssessment>) {
  if (!input.consentToFollowUp || !process.env.RESEND_API_KEY) return
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.INBOUND_NOTIFICATION_FROM ?? 'Maha Strategies <onboarding@resend.dev>',
      to: process.env.INBOUND_NOTIFICATION_TO ?? 'mayone@mahastrategies.com',
      replyTo: input.requester.email,
      subject: `[Maha Navigator] ${input.requester.organization} · ${assessment.recommendedPilot.name}`,
      text: `OPT-IN NAVIGATOR ASSESSMENT\n\nASSESSMENT: ${assessmentId}\nNAME: ${input.requester.name}\nEMAIL: ${input.requester.email}\nORGANIZATION: ${input.requester.organization}\nROLE: ${input.requester.role}\nSTAGE: ${input.stage}\nPROTOCOLS: ${input.protocols.join(', ')}\nFOLLOW-UP CONSENT: yes\n\nGOAL:\n${input.primaryGoal}\n\nREADINESS: ${assessment.score}/100 (${assessment.band})\nPILOT CANDIDATE: ${assessment.pilotCandidate ? 'yes' : 'no'}\nRECOMMENDATION: ${assessment.recommendedPilot.name}\nOBJECTIVE: ${assessment.recommendedPilot.objective}`,
    })
  } catch { /* The assessment ledger is authoritative; email is best effort. */ }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return jsonResponse({ error: { code: 'payload_too_large', message: 'Assessment exceeds the 20 KB limit.' } }, 413)
  let body: Record<string, unknown>, input: ReturnType<typeof parseNavigatorSubmission>
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Request body must be a JSON object.')
    body = parsed as Record<string, unknown>
    input = parseNavigatorSubmission(body)
  } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid assessment.' } }, 400) }
  const verification = await verifyContactTurnstile(body.turnstileToken, request, 'navigator_assessment')
  if (!verification.accepted) return jsonResponse({ error: { code: 'verification_failed', message: 'Verification expired or failed. Please retry.' } }, 400)
  let visitorHash: string
  try { visitorHash = publicUtilityVisitorHash(request) }
  catch { return jsonResponse({ error: { code: 'gateway_unavailable', message: 'Navigator is not configured.' } }, 503) }
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Navigator is temporarily unavailable.' } }, 503)
  const { data: allowed, error: limitError } = await ledger.rpc('consume_inbound_submission_rate_limit', { p_visitor_hash: visitorHash, p_limit: 8 })
  if (limitError || typeof allowed !== 'boolean') return jsonResponse({ error: { code: 'gateway_unavailable', message: 'Navigator is temporarily unavailable.' } }, 503)
  if (!allowed) return jsonResponse({ error: { code: 'rate_limited', message: 'Too many assessments. Retry in one hour.' } }, 429)

  const assessment = buildNavigatorAssessment(input)
  const assessmentId = createNavigatorAssessmentId()
  const idempotencyHash = navigatorHash(input.idempotencyKey)
  const now = new Date().toISOString()
  const { data: inserted, error: insertError } = await ledger.from('navigator_assessments').insert({
    public_id: assessmentId, visitor_hash: visitorHash, idempotency_hash: idempotencyHash,
    requester_name: input.requester.name, requester_email: input.requester.email, requester_organization: input.requester.organization, requester_role: input.requester.role,
    deployment_stage: input.stage, protocols: input.protocols, priority: input.priority, primary_goal: input.primaryGoal,
    controls: input.controls, assessment, readiness_score: assessment.score, readiness_band: assessment.band, pilot_candidate: assessment.pilotCandidate,
    consent_version: 'navigator-2026-08-09', consent_to_assessment: true, consent_to_follow_up: input.consentToFollowUp, consented_at: now,
  }).select('public_id').maybeSingle()

  if (insertError?.code === '23505') {
    const { data: existing, error } = await ledger.from('navigator_assessments').select('public_id,assessment').eq('visitor_hash', visitorHash).eq('idempotency_hash', idempotencyHash).maybeSingle()
    if (error || !existing) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Assessment could not be recovered.' } }, 503)
    return jsonResponse({ assessmentId: existing.public_id, assessment: existing.assessment, idempotentReplay: true, followUpRequested: input.consentToFollowUp }, 200)
  }
  if (insertError || !inserted) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Assessment could not be recorded.' } }, 503)
  const { error: eventError } = await ledger.from('navigator_assessment_events').insert({ assessment_id: inserted.public_id, action: 'submitted', idempotency_hash: navigatorHash(`submitted:${input.idempotencyKey}`), actor_fingerprint: navigatorHash('public-navigator-v1'), note: input.consentToFollowUp ? 'Assessment submitted with follow-up consent.' : 'Assessment submitted without follow-up consent.', created_at: now })
  if (eventError) console.error('Navigator event write failed:', eventError.code)
  await notifyOperator(input, inserted.public_id, assessment)
  return jsonResponse({ assessmentId: inserted.public_id, assessment, followUpRequested: input.consentToFollowUp }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
