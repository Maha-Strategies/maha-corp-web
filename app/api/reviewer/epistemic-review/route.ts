import {
  authorizeEpistemicReviewInvitation,
  buildEpistemicReviewInvitationEvent,
  EPISTEMIC_REVIEW_INVITATION_BOUNDARY,
  epistemicReviewInvitationStatus,
  parseInvitedEpistemicExpertReview,
  privateEpistemicReviewInvitationDto,
} from '@/lib/epistemic-review-invitation'
import { buildEpistemicExpertReview, EXPERT_REVIEW_CRITERIA } from '@/lib/epistemic-review'
import {
  consumeEpistemicReviewerInvitation,
  createEpistemicPersistenceClient,
  getEpistemicReviewerInvitationByTokenHash,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_REVIEW_INVITATION_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The review failed persistence validation.' } }, 400)
  if (message.includes('[P0003]')) return json({ error: { code: 'expired', message: 'This reviewer invitation has expired.' } }, 410)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'This invitation was consumed or revoked, or the assigned target no longer matches.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The reviewer invitation or frozen target was not found.' } }, 404)
  return json({ error: { code: 'epistemic_reviewer_workspace_unavailable', message: 'The invited reviewer workspace is unavailable.' } }, 503)
}

async function resolve(request: Request) {
  const authorization = authorizeEpistemicReviewInvitation(request)
  if (!authorization) return { error: json({ error: { code: 'unauthorized', message: 'A valid one-time reviewer invitation token is required.' } }, 401) }
  const client = createEpistemicPersistenceClient()
  if (!client) return { error: unavailable() }
  try {
    const grant = await getEpistemicReviewerInvitationByTokenHash(client, authorization.tokenSha256)
    if (!grant) return { error: json({ error: { code: 'unauthorized', message: 'A valid one-time reviewer invitation token is required.' } }, 401) }
    return { authorization, client, grant }
  } catch (error) {
    return { error: unavailable(error) }
  }
}

export async function GET(request: Request) {
  const resolved = await resolve(request)
  if ('error' in resolved) return resolved.error
  const { client, grant } = resolved
  const status = epistemicReviewInvitationStatus(grant.invitation, grant.event)
  if (status === 'expired') return json({ error: { code: 'expired', message: 'This reviewer invitation has expired.' } }, 410)
  if (status !== 'active') return json({ error: { code: 'conflict', message: `This reviewer invitation is already ${status}.` } }, 409)
  try {
    const target = (await listEpistemicReviewTargets(client)).find((entry) => entry.recordId === grant.invitation.recordId)
    if (!target || target.reviewTargetSha256 !== grant.invitation.targetSha256 || !target.candidateSnapshot) {
      return json({ error: { code: 'conflict', message: 'The invited hash is no longer the latest frozen target. Ask the operator for a new invitation.' } }, 409)
    }
    return json({
      invitation: privateEpistemicReviewInvitationDto(grant.invitation, grant.event),
      criteria: EXPERT_REVIEW_CRITERIA[grant.invitation.scope],
      target: {
        origin: target.origin,
        recordId: target.recordId,
        domainSlug: target.domainSlug,
        title: target.title,
        targetSha256: target.reviewTargetSha256,
        sourcePublicPath: target.sourcePublicPath,
        record: target.candidateSnapshot,
      },
      productApprovalSupported: false,
      publicationAuthorityGranted: false,
    }, 200)
  } catch (error) {
    return unavailable(error)
  }
}

export async function POST(request: Request) {
  const resolved = await resolve(request)
  if ('error' in resolved) return resolved.error
  const { authorization, client, grant } = resolved
  const status = epistemicReviewInvitationStatus(grant.invitation, grant.event)
  if (status === 'expired') return json({ error: { code: 'expired', message: 'This reviewer invitation has expired.' } }, 410)
  if (status !== 'active') return json({ error: { code: 'conflict', message: `This reviewer invitation is already ${status}.` } }, 409)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed: ReturnType<typeof parseInvitedEpistemicExpertReview>
  try { parsed = parseInvitedEpistemicExpertReview(body, grant.invitation) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid invited review.' } }, 400)
  }
  const review = buildEpistemicExpertReview(parsed)
  const event = buildEpistemicReviewInvitationEvent({
    invitationId: grant.invitation.invitationId,
    action: 'consume',
    reviewId: review.reviewId,
    reason: 'Invitation consumed by the assigned reviewer through the exact-hash reviewer workspace.',
    actorFingerprint: authorization.tokenSha256,
  }, new Date(review.reviewedAt))
  try {
    const persistence = await consumeEpistemicReviewerInvitation(client, authorization.tokenSha256, review, parsed.idempotencyKey, event)
    return json({
      review: persistence.idempotentReplay ? null : review,
      persistence,
      invitationConsumed: true,
      productApprovalSupported: false,
      publicationAuthorityGranted: false,
    }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) {
    return unavailable(error)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
