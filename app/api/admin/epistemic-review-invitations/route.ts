import {
  buildEpistemicReviewInvitation,
  buildEpistemicReviewInvitationEvent,
  EPISTEMIC_REVIEW_INVITATION_BOUNDARY,
  parseEpistemicReviewInvitationRequest,
  privateEpistemicReviewInvitationDto,
} from '@/lib/epistemic-review-invitation'
import {
  EPISTEMIC_PHASE4_PILOT_ENTRIES,
  EPISTEMIC_PHASE4_PILOT_MANIFEST,
  EPISTEMIC_PHASE4_PILOT_RECORD_IDS,
} from '@/lib/epistemic-pilot-corpus'
import { authorizeEpistemicOperations, buildExpertReviewProgress } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  insertEpistemicReviewerInvitation,
  listEpistemicExpertReviews,
  listEpistemicReviewerInvitationEvents,
  listEpistemicReviewerInvitations,
  listEpistemicReviewTargets,
  revokeEpistemicReviewerInvitation,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_REVIEW_INVITATION_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The invitation failed persistence validation.' } }, 400)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'The exact target, required scope, identity version, or invitation state conflicts with the durable ledger.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The pilot entry, target, or invitation was not found.' } }, 404)
  return json({ error: { code: 'epistemic_review_invitations_unavailable', message: 'Epistemic reviewer-invitation persistence is unavailable.' } }, 503)
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

async function parseBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Content-Type must be application/json.')
  try { return await request.json() as Record<string, unknown> } catch { throw new Error('Request body must be valid JSON.') }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const [targets, reviews, invitations, events] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicExpertReviews(client),
      listEpistemicReviewerInvitations(client),
      listEpistemicReviewerInvitationEvents(client),
    ])
    const eventsByInvitation = new Map(events.map((event) => [event.invitationId, event]))
    const targetsByRecord = new Map(targets.map((target) => [target.recordId, target]))
    const pilot = EPISTEMIC_PHASE4_PILOT_ENTRIES.map((entry) => {
      const target = targetsByRecord.get(entry.recordId)
      return {
        ...entry,
        target: target ? {
          origin: target.origin,
          candidateSha256: target.candidateSha256,
          reviewTargetSha256: target.reviewTargetSha256,
          ingestedAt: target.ingestedAt,
          requiredReviewScopes: target.candidateSnapshot?.publication.requiredReviewScopes ?? [],
          reviewProgress: target.candidateSnapshot ? buildExpertReviewProgress(target.candidateSnapshot, reviews) : null,
        } : null,
      }
    })
    const invitationDtos = invitations.map((invitation) => privateEpistemicReviewInvitationDto(
      invitation,
      eventsByInvitation.get(invitation.invitationId),
      targetsByRecord.get(invitation.recordId)?.reviewTargetSha256,
    ))
    return json({
      manifest: EPISTEMIC_PHASE4_PILOT_MANIFEST,
      pilot,
      invitations: invitationDtos,
      summary: {
        records: pilot.length,
        durableTargets: pilot.filter((entry) => entry.target).length,
        activeInvitations: invitationDtos.filter((invitation) => invitation.status === 'active').length,
        completedInvitationReviews: invitationDtos.filter((invitation) => invitation.status === 'consumed').length,
      },
      plaintextCredentialsPersisted: false,
      publicationAuthorityGranted: false,
    }, 200)
  } catch (error) {
    return unavailable(error)
  }
}

export async function POST(request: Request) {
  const authorization = gate(request)
  if (!authorization) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  let body: Record<string, unknown>
  try { body = await parseBody(request) } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.'
    return json({ error: { code: message.startsWith('Content-Type') ? 'unsupported_media_type' : 'invalid_json', message } }, message.startsWith('Content-Type') ? 415 : 400)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()

  if (body.operation === 'create') {
    let parsed: ReturnType<typeof parseEpistemicReviewInvitationRequest>
    try {
      const expiryDays = Number(body.expiryDays)
      if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 30) throw new Error('expiryDays must be an integer from 1 through 30.')
      parsed = parseEpistemicReviewInvitationRequest({
        ...body,
        expiresAt: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
      })
    } catch (error) {
      return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid reviewer invitation.' } }, 400)
    }
    const credential = buildEpistemicReviewInvitation(parsed, authorization.actorFingerprint)
    try {
      const persistence = await insertEpistemicReviewerInvitation(client, credential.invitation, parsed.idempotencyKey, authorization.actorFingerprint)
      return json({
        invitation: persistence.idempotentReplay ? null : privateEpistemicReviewInvitationDto(credential.invitation, null),
        token: persistence.idempotentReplay ? null : credential.token,
        credentialReturnedOnce: !persistence.idempotentReplay,
        persistence,
      }, persistence.idempotentReplay ? 200 : 201)
    } catch (error) {
      return unavailable(error)
    }
  }

  if (body.operation === 'revoke') {
    const invitationId = typeof body.invitationId === 'string' ? body.invitationId.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
    let known
    try {
      known = (await listEpistemicReviewerInvitations(client)).find((invitation) => invitation.invitationId === invitationId)
    } catch (error) {
      return unavailable(error)
    }
    if (!known || !EPISTEMIC_PHASE4_PILOT_RECORD_IDS.has(known.recordId)) return json({ error: { code: 'not_found', message: 'The bounded pilot invitation was not found.' } }, 404)
    let event
    try {
      if (idempotencyKey.length < 8 || idempotencyKey.length > 160) throw new Error('idempotencyKey must contain 8-160 characters.')
      event = buildEpistemicReviewInvitationEvent({ invitationId, action: 'revoke', reason, actorFingerprint: authorization.actorFingerprint })
    } catch (error) {
      return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid revocation.' } }, 400)
    }
    try {
      const persistence = await revokeEpistemicReviewerInvitation(client, invitationId, event, idempotencyKey, authorization.actorFingerprint)
      return json({ event, persistence }, persistence.idempotentReplay ? 200 : 201)
    } catch (error) {
      return unavailable(error)
    }
  }

  return json({ error: { code: 'invalid_request', message: 'operation must be create or revoke.' } }, 400)
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
