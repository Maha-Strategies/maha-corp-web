import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { contentDraftHash, contentDraftId, parseContentDraft, parseContentDraftAction } from '@/lib/content-draft-composer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The content draft failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Content candidate or draft not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'The candidate needs human draft approval, or that draft transition is not allowed.' } }, 409)
  return jsonResponse({ error: { code: 'content_drafts_unavailable', message: 'The private draft ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const [drafts, candidates] = await Promise.all([
    ledger.from('content_page_drafts').select('public_id,candidate_id,title,summary,direct_answer,method,artifact_url,artifact_label,limitations,editorial_reviewer,status,reviewer_note,created_at,updated_at').order('updated_at', { ascending: false }).limit(100),
    ledger.from('content_page_candidates').select('public_id,proposed_path,reader_question,reader_outcome,original_value,author_attribution,evidence,quality_score,status').eq('status', 'approved_for_draft').order('quality_score', { ascending: false }).limit(100),
  ])
  if (drafts.error) return unavailable(drafts.error.code)
  if (candidates.error) return unavailable(candidates.error.code)
  return jsonResponse({ drafts: drafts.data ?? [], approvedCandidates: candidates.data ?? [], publicPublishingSupported: false, automaticIndexingSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown; try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  if (typeof body === 'object' && body !== null && !Array.isArray(body) && 'action' in body) {
    let action: ReturnType<typeof parseContentDraftAction>; try { action = parseContentDraftAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid draft operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_content_page_draft', { p_draft_id: action.draftId, p_action: action.action, p_note: action.note || null, p_idempotency_hash: contentDraftHash(action.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, publicPublishingSupported: false }, 200)
  }
  let input: ReturnType<typeof parseContentDraft>; try { input = parseContentDraft(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid content draft.' } }, 400) }
  const { data, error } = await ledger.rpc('compose_content_page_draft', { p_draft_id: contentDraftId(), p_candidate_id: input.candidateId, p_title: input.title, p_summary: input.summary, p_direct_answer: input.directAnswer, p_method: input.method, p_artifact_url: input.artifactUrl || null, p_artifact_label: input.artifactLabel || null, p_limitations: input.limitations || null, p_editorial_reviewer: input.editorialReviewer, p_idempotency_hash: contentDraftHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ draft: data, publicPublishingSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
