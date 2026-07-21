import { jsonResponse } from '@/lib/agent-inquiries'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'
import { contentPublicationHash, contentPublicationId, contentPublicationPath, parseContentPublication } from '@/lib/content-publication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(code?: string) {
  if (code === '42P01' || code === '42883') return jsonResponse({ error: { code: 'migration_required', message: 'Apply the Human Content Publication migration with supabase db push, then try again.' } }, 503)
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The publication request failed validation.' } }, 400)
  if (code === 'P0001') return jsonResponse({ error: { code: 'operation_not_allowed', message: 'A current score-qualified human publication handoff is required.' } }, 409)
  return jsonResponse({ error: { code: 'content_publications_unavailable', message: 'The public content release ledger is temporarily unavailable.' } }, 503)
}
function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.from('content_publications').select('public_id,handoff_id,draft_id,candidate_id,slug,title,published_at,publication_note').is('unpublished_at', null).order('published_at', { ascending: false }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ publications: (data ?? []).map((publication) => ({ ...publication, path: contentPublicationPath(publication.slug) })) }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown; try { body = await request.json() } catch { return jsonResponse({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400) }
  let input: ReturnType<typeof parseContentPublication>; try { input = parseContentPublication(body) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid publication request.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.rpc('publish_content_page', { p_publication_id: contentPublicationId(), p_handoff_id: input.handoffId, p_draft_id: input.draftId, p_candidate_id: input.candidateId, p_slug: input.slug, p_note: input.note || null, p_idempotency_hash: contentPublicationHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || typeof data !== 'object' || data === null || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ publication: { ...data, path: contentPublicationPath(input.slug) }, automaticPublishing: false, automaticIndexing: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
