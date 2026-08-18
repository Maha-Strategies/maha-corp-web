import { buildPractitionerReviewRecord, buildPractitionerReviewTargets, parsePractitionerReview, PRACTITIONER_REVIEW_BOUNDARY, authorizePractitionerReview } from '../../../../lib/practitioner-review.ts'
import { createPractitionerReviewClient, insertPractitionerReview, listPractitionerReviews } from '../../../../lib/practitioner-review-store.ts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: PRACTITIONER_REVIEW_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The review failed persistence validation.' } }, 400)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'The reviewer profile version or superseded review conflicts with the existing record.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The superseded review was not found.' } }, 404)
  return json({ error: { code: 'practitioner_reviews_unavailable', message: 'Practitioner review persistence is unavailable.' } }, 503)
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizePractitionerReview(request)
  if (!authorization.authorized || !authorization.actorFingerprint) return null
  return { actorFingerprint: authorization.actorFingerprint }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid practitioner-review bearer token is required.' } }, 401)
  const client = createPractitionerReviewClient()
  if (!client) return unavailable()
  try {
    return json({ targets: buildPractitionerReviewTargets(), reviews: await listPractitionerReviews(client), productApprovalSupported: false, empiricalValidationClaimed: false }, 200)
  } catch (error) { return unavailable(error) }
}

export async function POST(request: Request) {
  const authorization = gate(request)
  if (!authorization) return json({ error: { code: 'unauthorized', message: 'A valid practitioner-review bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed: ReturnType<typeof parsePractitionerReview>
  try { parsed = parsePractitionerReview(body) } catch (error) { return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid practitioner review.' } }, 400) }
  const client = createPractitionerReviewClient()
  if (!client) return unavailable()
  const record = buildPractitionerReviewRecord(parsed)
  try {
    const result = await insertPractitionerReview(client, record, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ review: record, persistence: result, productApprovalSupported: false, empiricalValidationClaimed: false }, result.idempotentReplay ? 200 : 201)
  } catch (error) { return unavailable(error) }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
