import {
  buildControlledReingestionCompilation,
  CONTROLLED_REINGESTION_BOUNDARY,
  controlledCorrectionDescriptor,
  parseControlledReingestionRequest,
} from '@/lib/epistemic-reingestion'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  insertEpistemicReingestionCompilation,
  listEpistemicReingestionCompilations,
  listEpistemicReviewTargets,
  listEpistemicSourceCompletionEvents,
} from '@/lib/epistemic-store'
import { queueLaneForReason } from '@/lib/epistemic-work-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json(
    { ...body, boundary: CONTROLLED_REINGESTION_BOUNDARY },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The compilation failed persistence validation.' } }, 400)
  if (message.includes('[P0001]') || message.includes('duplicate key')) return json({ error: { code: 'conflict', message: 'The compilation conflicts with its frozen target, evidence ledger, or an existing revision.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The frozen base target was not found.' } }, 404)
  return json({ error: { code: 'epistemic_reingestion_unavailable', message: 'Controlled re-ingestion is temporarily unavailable.' } }, 503)
}

async function readWorkspace(client: NonNullable<ReturnType<typeof createEpistemicPersistenceClient>>) {
  const [targets, events, compilations] = await Promise.all([
    listEpistemicReviewTargets(client),
    listEpistemicSourceCompletionEvents(client),
    listEpistemicReingestionCompilations(client),
  ])
  const readyTargets = targets.flatMap((target) => {
    if (!target.candidateSnapshot || !target.domainSlug || !target.title) return []
    const decision = target.gateDecision as { publicEligible?: boolean; reasons?: string[] }
    const reasons = Array.isArray(decision.reasons) ? decision.reasons : []
    const relevantEvents = events
      .filter((event) => event.recordId === target.recordId && event.targetSha256 === target.reviewTargetSha256)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    if (relevantEvents.at(-1)?.nextState !== 'ready-for-reingestion') return []
    const sourceBlockers = reasons.filter((reason) => queueLaneForReason(reason) === 'source-completion')
    const corrections = sourceBlockers.flatMap((blockerCode) => {
      const descriptor = controlledCorrectionDescriptor(target.candidateSnapshot!, blockerCode)
      if (!descriptor) return []
      const evidenceOptions = relevantEvents.flatMap((event) => event.action === 'submit-evidence'
        ? event.evidence.filter((evidence) => evidence.blockerCode === blockerCode).map((evidence) => ({
          eventId: event.eventId,
          eventSha256: event.eventSha256,
          occurredAt: event.occurredAt,
          sourceUrl: evidence.sourceUrl,
          exactLocator: evidence.exactLocator,
          proposedValue: evidence.proposedValue ?? null,
          note: evidence.note,
          rightsBasis: evidence.rightsBasis,
        }))
        : [])
      return evidenceOptions.length ? [{ ...descriptor, evidenceOptions }] : []
    })
    return [{
      recordId: target.recordId,
      domainSlug: target.domainSlug,
      title: target.title,
      sourcePublicPath: target.sourcePublicPath,
      candidateSha256: target.candidateSha256,
      targetSha256: target.reviewTargetSha256,
      origin: target.origin,
      gateReasons: reasons,
      corrections,
      unsupportedSourceBlockers: sourceBlockers.filter((blocker) => !controlledCorrectionDescriptor(target.candidateSnapshot!, blocker)),
      candidateSnapshot: target.candidateSnapshot,
    }]
  })
  return {
    readyTargets,
    recentCompilations: compilations.slice(0, 100),
    summary: {
      readyTargets: readyTargets.length,
      supportedCorrections: readyTargets.reduce((total, target) => total + target.corrections.length, 0),
      immutableRevisions: compilations.length,
    },
  }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    return json({ ...(await readWorkspace(client)), autoPublicationSupported: false }, 200)
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
  let parsed: ReturnType<typeof parseControlledReingestionRequest>
  try { parsed = parseControlledReingestionRequest(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid controlled re-ingestion request.' } }, 400)
  }

  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const [targets, events] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicSourceCompletionEvents(client),
    ])
    const target = targets.find((candidate) => candidate.recordId === parsed.recordId && candidate.reviewTargetSha256 === parsed.baseTargetSha256)
    if (!target?.candidateSnapshot) return json({ error: { code: 'not_found', message: 'The current frozen base target was not found.' } }, 404)
    const decision = target.gateDecision as { publicEligible?: boolean; reasons?: string[] }
    const compilation = buildControlledReingestionCompilation(parsed, {
      recordId: target.recordId,
      sourcePublicPath: target.sourcePublicPath,
      candidateSha256: target.candidateSha256,
      reviewTargetSha256: target.reviewTargetSha256,
      gateDecision: { publicEligible: decision.publicEligible === true, reasons: Array.isArray(decision.reasons) ? decision.reasons : [] },
      candidateSnapshot: target.candidateSnapshot,
    }, events)
    if (parsed.operation === 'preview') {
      return json({ preview: compilation, persisted: false, autoPublicationSupported: false }, 200)
    }
    const persistence = await insertEpistemicReingestionCompilation(client, compilation, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ compilation, persistence, persisted: true, autoPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
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
