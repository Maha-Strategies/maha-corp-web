import { jsonResponse } from '@/lib/agent-inquiries'
import { contentAmendmentHash, contentAmendmentId, parseContentSourceAmendment } from '@/lib/content-publication-amendment'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { authorizeMarketMapping } from '@/lib/market-mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(request: Request) { const result = authorizeMarketMapping(request); return result.authorized && result.actorFingerprint ? result : null }
function unavailable(code?: string) {
  if (code === '42P01' || code === '42883') return jsonResponse({ error: { code: 'migration_required', message: 'Apply the publication source amendments migration with supabase db push, then try again.' } }, 503)
  if (code === '22023') return jsonResponse({ error: { code: 'invalid_request', message: 'The source amendment failed validation.' } }, 400)
  if (code === 'P0002') return jsonResponse({ error: { code: 'not_found', message: 'The live publication was not found.' } }, 404)
  return jsonResponse({ error: { code: 'content_amendments_unavailable', message: 'The publication amendment ledger is temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.from('content_publications').select('public_id,slug,title,evidence,published_at,updated_at').is('unpublished_at', null).order('published_at', { ascending: false }).limit(100)
  if (error) return unavailable(error.code)
  return jsonResponse({ publications: data ?? [] }, 200)
}

export async function POST(request: Request) {
  const auth = authorized(request)
  if (!auth) return jsonResponse({ error: { code: 'unauthorized', message: 'A valid market-mapping bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let input: ReturnType<typeof parseContentSourceAmendment>
  try { input = parseContentSourceAmendment(await request.json()) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid source amendment.' } }, 400) }
  const ledger = createAgentInquiryLedger(); if (!ledger) return unavailable()
  const { data, error } = await ledger.rpc('amend_content_publication_sources', { p_amendment_id: contentAmendmentId(), p_publication_id: input.publicationId, p_slug: input.slug, p_confirmation: input.confirmation, p_evidence: input.evidence, p_note: input.note, p_idempotency_hash: contentAmendmentHash(input.idempotencyKey), p_actor_fingerprint: auth.actorFingerprint, p_at: new Date().toISOString() })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return unavailable(error?.code)
  return jsonResponse({ amendment: data, automaticPublishing: false }, 201)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
