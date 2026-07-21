import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { contentHandoffHash, contentHandoffId, publicationHandoff } from '@/lib/content-publication-handoff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '42P01' || code === '42883') return jsonResponse({ error: { code: 'migration_required', message: 'Apply the Content Publication Handoffs migration with supabase db push, then try again.' } }, 503)
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The publication handoff failed validation.' } }, 400)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'An editorial-ready draft and approved evidence package are required.' } }, 409)
  return jsonResponse({ error: { code: 'content_handoffs_unavailable', message: 'The publication handoff ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }
function id(value: unknown, prefix: string) { return typeof value === 'string' && new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(value) ? value : null }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.from('content_publication_handoffs').select('public_id,draft_id,candidate_id,release_score,decision,checklist,reviewer_note,created_at,updated_at').is('superseded_at', null).order('created_at', { ascending: false }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ handoffs: data ?? [], publicPublishingSupported: false, automaticIndexingSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>; try { body = await request.json() as Record<string, unknown> } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const draftId = id(body.draftId, 'contentdraft'); const candidateId = id(body.candidateId, 'contentcand'); const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
  if (!draftId || !candidateId || idempotencyKey.length < 8 || idempotencyKey.length > 120 || /[\r\n]/.test(idempotencyKey)) return jsonResponse({ error: { code: 'invalid_request', message: 'Valid draftId, candidateId, and idempotencyKey are required.' } }, 400)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const [draftResult, candidateResult] = await Promise.all([
    ledger.from('content_page_drafts').select('public_id,candidate_id,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status').eq('public_id', draftId).maybeSingle(),
    ledger.from('content_page_candidates').select('public_id,proposed_path,quality_score,evidence,policy_checks,status').eq('public_id', candidateId).maybeSingle(),
  ])
  if (draftResult.error || candidateResult.error || !draftResult.data || !candidateResult.data) return unavailable(draftResult.error?.code ?? candidateResult.error?.code)
  if (draftResult.data.candidate_id !== candidateId) return jsonResponse({ error: { code: 'invalid_request', message: 'The draft does not belong to the selected evidence candidate.' } }, 400)
  const handoff = publicationHandoff({ draft: draftResult.data, candidate: candidateResult.data })

  const { data, error } = await ledger.rpc('prepare_content_publication_handoff', { p_handoff_id: contentHandoffId(), p_draft_id: draftId, p_candidate_id: candidateId, p_release_score: handoff.score, p_decision: handoff.decision, p_checklist: handoff.checklist, p_idempotency_hash: contentHandoffHash(idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ handoff: { ...data, score: handoff.score, decision: handoff.decision, checklist: handoff.checklist }, publicPublishingSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
