import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { contentCandidateHash, contentCandidateId, parseContentCandidate, parseContentCandidateAction } from '@/lib/content-publication-gate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The content candidate failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'Content candidate not found.' } }, 404)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'That action is not allowed for this content candidate.' } }, 409)
  return jsonResponse({ error: { code: 'content_candidates_unavailable', message: 'The content quality ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.from('content_page_candidates').select('public_id,topic_cluster,proposed_path,reader_question,reader_outcome,original_value,author_attribution,evidence,policy_checks,quality_score,status,reviewer_note,created_at,updated_at').order('quality_score', { ascending: false }).order('created_at', { ascending: true }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ candidates: data ?? [], publicPublishingSupported: false, automaticIndexingSupported: false }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown; try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  if (typeof body === 'object' && body !== null && !Array.isArray(body) && 'action' in body) {
    let action: ReturnType<typeof parseContentCandidateAction>; try { action = parseContentCandidateAction(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid content operation.' } }, 400) }
    const { data, error } = await ledger.rpc('operate_content_page_candidate', { p_candidate_id: action.candidateId, p_action: action.action, p_note: action.note || null, p_idempotency_hash: contentCandidateHash(action.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
    if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
    return jsonResponse({ operation: data, publicPublishingSupported: false }, 200)
  }
  let input: ReturnType<typeof parseContentCandidate>; try { input = parseContentCandidate(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid content candidate.' } }, 400) }
  const { data, error } = await ledger.rpc('create_content_page_candidate', { p_candidate_id: contentCandidateId(), p_topic_cluster: input.topicCluster, p_proposed_path: input.proposedPath, p_reader_question: input.readerQuestion, p_reader_outcome: input.readerOutcome, p_original_value: input.originalValue, p_author_attribution: input.authorAttribution, p_evidence: input.evidence, p_policy_checks: input.policyChecks, p_quality_score: input.qualityScore, p_idempotency_hash: contentCandidateHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ candidate: data, publicPublishingSupported: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
