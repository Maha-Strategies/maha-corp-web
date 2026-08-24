import { authorizeEpistemicOperations, buildExpertReviewProgress } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  insertEpistemicSourceCompletionEvent,
  listEpistemicExpertReviews,
  listEpistemicReviewTargets,
  listEpistemicSourceCompletionEvents,
} from '@/lib/epistemic-store'
import {
  buildExpertReviewQueue,
  buildQueueSummary,
  buildSourceCompletionEvent,
  buildSourceCompletionQueue,
  EPISTEMIC_WORK_QUEUE_BOUNDARY,
  parseSourceCompletionEvent,
  sourceCompletionReasons,
  type EpistemicQueueTarget,
} from '@/lib/epistemic-work-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_WORK_QUEUE_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The source-completion event failed persistence validation.' } }, 400)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'The event conflicts with the current queue state or frozen target.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The frozen ingestion target was not found.' } }, 404)
  return json({ error: { code: 'epistemic_work_queue_unavailable', message: 'The epistemic work queue is temporarily unavailable.' } }, 503)
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

function queueTarget(target: Awaited<ReturnType<typeof listEpistemicReviewTargets>>[number], reviews: Awaited<ReturnType<typeof listEpistemicExpertReviews>>): EpistemicQueueTarget {
  if (!target.candidateSnapshot || !target.domainSlug || !target.title) throw new Error('The persisted ingestion target is incomplete.')
  const decision = target.gateDecision as { publicEligible?: boolean; reasons?: string[] }
  return {
    recordId: target.recordId,
    domainSlug: target.domainSlug,
    title: target.title,
    reviewTargetSha256: target.reviewTargetSha256,
    sourcePublicPath: target.sourcePublicPath,
    gateDecision: {
      publicEligible: decision.publicEligible === true,
      reasons: Array.isArray(decision.reasons) ? decision.reasons : [],
    },
    candidateSnapshot: target.candidateSnapshot,
    reviewProgress: buildExpertReviewProgress(target.candidateSnapshot, reviews),
  }
}

async function readQueue(client: NonNullable<ReturnType<typeof createEpistemicPersistenceClient>>) {
  const [targets, reviews, events] = await Promise.all([
    listEpistemicReviewTargets(client),
    listEpistemicExpertReviews(client),
    listEpistemicSourceCompletionEvents(client),
  ])
  const queueTargets = targets.map((target) => queueTarget(target, reviews))
  const sourceCompletion = buildSourceCompletionQueue(queueTargets, events)
  const expertReview = buildExpertReviewQueue(queueTargets, reviews)
  return {
    sourceCompletion,
    expertReview,
    summary: buildQueueSummary(sourceCompletion, expertReview),
    recentEvents: events.slice(0, 100),
  }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    return json({ ...(await readQueue(client)), autoPublicationSupported: false }, 200)
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
  let parsed: ReturnType<typeof parseSourceCompletionEvent>
  try { parsed = parseSourceCompletionEvent(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid source-completion event.' } }, 400)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const [targets, events] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicSourceCompletionEvents(client),
    ])
    const target = targets.find((candidate) => candidate.recordId === parsed.recordId && candidate.reviewTargetSha256 === parsed.targetSha256)
    if (!target?.candidateSnapshot || !target.domainSlug || !target.title) return json({ error: { code: 'not_found', message: 'The frozen ingestion target was not found.' } }, 404)
    const decision = target.gateDecision as { reasons?: string[] }
    const event = buildSourceCompletionEvent(parsed, events, sourceCompletionReasons({
      gateDecision: { publicEligible: false, reasons: Array.isArray(decision.reasons) ? decision.reasons : [] },
      candidateSnapshot: target.candidateSnapshot,
    }))
    const persistence = await insertEpistemicSourceCompletionEvent(client, event, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ event, persistence, queue: await readQueue(client), autoPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) {
    if (error instanceof Error && !/failed \[/.test(error.message)) {
      return json({ error: { code: 'invalid_request', message: error.message } }, 400)
    }
    return unavailable(error)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
