import Anthropic from '@anthropic-ai/sdk'

import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { publicationHandoff } from '@/lib/content-publication-handoff'
import {
  contentFactCheckHash, contentFactCheckId, factCheckExtractionGuard, publicationEligibility, reviewFactCheck,
  parseEditorSources,
} from '@/lib/content-fact-check'
import { runMpsAudit } from '@/lib/mps-audit-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

function unavailable(code?: string) {
  if (code === '42P01' || code === '42883') return jsonResponse({ error: { code: 'migration_required', message: 'Apply the Content Fact-Check Reviews migration with supabase db push, then try again.' } }, 503)
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The fact-check request failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The fact-check claim was not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'An active fact-check review and matching draft are required.' } }, 409)
  return jsonResponse({ error: { code: 'fact_check_unavailable', message: 'The fact-check ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }
function id(value: unknown, prefix: string) { return typeof value === 'string' && new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(value) ? value : null }
function idempotencyKey(value: unknown) { const key = typeof value === 'string' ? value.trim() : ''; return key.length >= 8 && key.length <= 120 && !/[\r\n]/.test(key) ? key : null }

type Ledger = NonNullable<ReturnType<typeof createAgentInquiryLedger>>

// Combined publication-eligibility view: the EXISTING structural score plus the
// fact-check gate. Never mutates anything; safe to compute on read.
async function eligibilityFor(ledger: Ledger, draftId: string) {
  const [draftResult, reviewResult] = await Promise.all([
    ledger.from('content_page_drafts').select('public_id,candidate_id,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status').eq('public_id', draftId).maybeSingle(),
    ledger.from('content_fact_check_reviews').select('public_id,readiness_score,claim_count,high_risk_count,status,acknowledged_at').eq('draft_id', draftId).is('superseded_at', null).maybeSingle(),
  ])
  if (draftResult.error || !draftResult.data) return { error: draftResult.error?.code, body: null }
  const candidateResult = await ledger.from('content_page_candidates').select('public_id,proposed_path,quality_score,evidence,policy_checks,status').eq('public_id', draftResult.data.candidate_id).maybeSingle()
  if (candidateResult.error || !candidateResult.data) return { error: candidateResult.error?.code, body: null }

  const structural = publicationHandoff({ draft: draftResult.data, candidate: candidateResult.data })
  const review = reviewResult.data
  const eligibility = publicationEligibility({
    structuralScore: structural.score,
    structuralHardBlockersClear: structural.decision === 'ready_for_human_publish',
    factCheckReviewed: Boolean(review),
    highRiskOpen: review?.high_risk_count ?? 1,
    acknowledged: Boolean(review?.acknowledged_at),
  })
  return {
    error: undefined,
    body: {
      draftId,
      structuralPublicationReadiness: { score: structural.score, decision: structural.decision, checklist: structural.checklist },
      claimVerificationReadiness: review ? { reviewId: review.public_id, score: review.readiness_score, claimCount: review.claim_count, highRiskOpen: review.high_risk_count, acknowledged: Boolean(review.acknowledged_at) } : null,
      publicationEligibility: eligibility,
    },
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const draftId = id(new URL(request.url).searchParams.get('draftId'), 'contentdraft')

  if (draftId) {
    const summary = await eligibilityFor(ledger, draftId)
    if (!summary.body) return unavailable(summary.error)
    const claims = await ledger.from('content_fact_check_claims')
      .select('claim_index,claim_text,classification,required_action,rationale,cited_urls,risk,weak_evidence,resolution,resolution_reason,resolved_at')
      .eq('review_id', summary.body.claimVerificationReadiness?.reviewId ?? '__none__').order('claim_index', { ascending: true })
    return jsonResponse({ ...summary.body, claims: claims.data ?? [] }, 200)
  }

  const { data, error } = await ledger.from('content_fact_check_reviews')
    .select('public_id,draft_id,candidate_id,readiness_score,claim_count,high_risk_count,status,acknowledged_at,created_at')
    .is('superseded_at', null).order('created_at', { ascending: false }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ reviews: data ?? [], autonomousPublishingSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const action = typeof body.action === 'string' ? body.action : 'submit'

  if (action === 'resolve') {
    const reviewId = id(body.reviewId, 'contentfc'); const key = idempotencyKey(body.idempotencyKey)
    const claimIndex = typeof body.claimIndex === 'number' && Number.isInteger(body.claimIndex) ? body.claimIndex : null
    const resolution = body.resolution === 'resolved' || body.resolution === 'accepted' ? body.resolution : null
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reviewId || !key || claimIndex === null || !resolution || reason.length < 3 || reason.length > 2_000) return jsonResponse({ error: { code: 'invalid_request', message: 'reviewId, claimIndex, resolution (resolved|accepted), a reason, and idempotencyKey are required.' } }, 400)
    const { data, error } = await ledger.rpc('resolve_content_fact_check_claim', { p_review_id: reviewId, p_claim_index: claimIndex, p_resolution: resolution, p_reason: reason, p_idempotency_hash: contentFactCheckHash(key), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ resolution: data }, 200)
  }

  if (action === 'acknowledge') {
    const reviewId = id(body.reviewId, 'contentfc'); const key = idempotencyKey(body.idempotencyKey)
    const note = body.note === undefined || body.note === '' ? '' : (typeof body.note === 'string' && body.note.trim().length <= 2_000 ? body.note.trim() : null)
    if (!reviewId || !key || note === null) return jsonResponse({ error: { code: 'invalid_request', message: 'reviewId and idempotencyKey are required; note must be ≤2000 chars.' } }, 400)
    const { data, error } = await ledger.rpc('acknowledge_content_fact_check', { p_review_id: reviewId, p_note: note || null, p_idempotency_hash: contentFactCheckHash(key), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ acknowledgement: data }, 200)
  }

  // Common draft/candidate resolution for submit + extract.
  const draftId = id(body.draftId, 'contentdraft'); const candidateId = id(body.candidateId, 'contentcand')
  if (!draftId || !candidateId) return jsonResponse({ error: { code: 'invalid_request', message: 'Valid draftId and candidateId are required.' } }, 400)
  const [draftResult, candidateResult] = await Promise.all([
    ledger.from('content_page_drafts').select('public_id,candidate_id,direct_answer,method').eq('public_id', draftId).maybeSingle(),
    ledger.from('content_page_candidates').select('public_id,evidence').eq('public_id', candidateId).maybeSingle(),
  ])
  if (draftResult.error || candidateResult.error) return unavailable(draftResult.error?.code ?? candidateResult.error?.code)
  if (!draftResult.data || !candidateResult.data) return jsonResponse({ error: { code: 'not_found', message: 'Draft or candidate not found.' } }, 404)
  if (draftResult.data.candidate_id !== candidateId) return jsonResponse({ error: { code: 'invalid_request', message: 'The draft does not belong to the selected evidence candidate.' } }, 400)

  if (action === 'extract') {
    // Optional MPS-audit claim SUGGESTIONS. Gated + fail-closed. Never consumes
    // customer MPS credits (internal editorial call) and asserts no truth.
    const guard = factCheckExtractionGuard(process.env)
    if (!guard.enabled) return jsonResponse({ error: { code: 'extraction_unavailable', message: 'Claim extraction is disabled or the model provider is unavailable.' } }, 503)
    const passage = `${draftResult.data.direct_answer}\n\n${draftResult.data.method}`.slice(0, 6_000)
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const audit = await runMpsAudit(passage, async (prompt) => {
        const message = await client.messages.create({ model: MODEL, max_tokens: 2_000, messages: [{ role: 'user', content: prompt }] })
        return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n')
      })
      // Suggestions only — excerpts a human turns into claims. No classification, no storage.
      return jsonResponse({ suggestions: audit.claims.map((claim) => ({ claimText: claim.excerpt, mpsTag: claim.tag })), note: 'Suggestions only. Truth, source quality, and appropriateness remain human judgments.' }, 200)
    } catch {
      return jsonResponse({ error: { code: 'extraction_failed', message: 'The extraction model was unavailable. No claims were changed.' } }, 502)
    }
  }

  // Default: submit a review.
  const key = idempotencyKey(body.idempotencyKey)
  if (!key) return jsonResponse({ error: { code: 'invalid_request', message: 'A valid idempotencyKey is required.' } }, 400)
  let review
  try {
    const editorSources = parseEditorSources(body.editorSources)
    const candidateEvidence = Array.isArray(candidateResult.data.evidence) ? (candidateResult.data.evidence as { url: string; sourceType: string }[]) : []
    review = reviewFactCheck({ candidateEvidence, editorSources, claims: Array.isArray(body.claims) ? body.claims : [] })
  } catch (error) {
    return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid claims.' } }, 400)
  }
  const claimsPayload = review.claims.map((claim) => ({ index: claim.index, claimText: claim.claimText, classification: claim.classification, citedUrls: claim.citedUrls, rationale: claim.rationale, requiredAction: claim.requiredAction, risk: claim.risk, weakEvidence: claim.weakEvidence }))
  const { data, error } = await ledger.rpc('record_content_fact_check', { p_review_id: contentFactCheckId(), p_draft_id: draftId, p_candidate_id: candidateId, p_readiness_score: review.readinessScore, p_claims: claimsPayload, p_idempotency_hash: contentFactCheckHash(key), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ review: data, readinessScore: review.readinessScore, counts: review.counts, claims: review.claims }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
