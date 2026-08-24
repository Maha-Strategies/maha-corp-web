import {
  buildEpistemicExpertReview,
  EPISTEMIC_EXPERT_REVIEW_BOUNDARY,
  EXPERT_REVIEW_CRITERIA,
  authorizeEpistemicOperations,
  buildExpertReviewProgress,
  parseEpistemicExpertReview,
} from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  insertEpistemicExpertReview,
  listEpistemicExpertReviews,
  listEpistemicReviewerProfiles,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'
import { EPISTEMIC_PHASE4_PILOT_RECORD_IDS } from '@/lib/epistemic-pilot-corpus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_EXPERT_REVIEW_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The review failed persistence validation.' } }, 400)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'The reviewer identity version, domain, or superseded decision conflicts with the frozen target.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The frozen ingestion target or superseded review was not found.' } }, 404)
  return json({ error: { code: 'epistemic_reviews_unavailable', message: 'Epistemic expert-review persistence is unavailable.' } }, 503)
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const [targets, profiles, reviews] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicReviewerProfiles(client),
      listEpistemicExpertReviews(client),
    ])
    return json({
      criteria: EXPERT_REVIEW_CRITERIA,
      targets: targets.map(({ candidateSnapshot, ...target }) => ({
        ...target,
        invitationRequired: EPISTEMIC_PHASE4_PILOT_RECORD_IDS.has(target.recordId),
        reviewProgress: candidateSnapshot ? buildExpertReviewProgress(candidateSnapshot, reviews) : null,
      })),
      profiles,
      reviews,
      productApprovalSupported: false,
      autoPublicationSupported: false,
    }, 200)
  } catch (error) {
    return unavailable(error)
  }
}

export async function POST(request: Request) {
  const authorization = gate(request)
  if (!authorization) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed: ReturnType<typeof parseEpistemicExpertReview>
  try { parsed = parseEpistemicExpertReview(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid expert review.' } }, 400)
  }
  if (EPISTEMIC_PHASE4_PILOT_RECORD_IDS.has(parsed.recordId)) {
    return json({ error: { code: 'invitation_required', message: 'Phase 4 pilot decisions must use a one-time, exact-scope reviewer invitation.' } }, 409)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  const review = buildEpistemicExpertReview(parsed)
  try {
    const persistence = await insertEpistemicExpertReview(client, review, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ review, persistence, productApprovalSupported: false, autoPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) {
    return unavailable(error)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
