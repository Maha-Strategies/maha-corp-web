import {
  buildEpistemicFactoryRun,
  EPISTEMIC_FACTORY_BOUNDARY,
  epistemicFactoryPersistenceKey,
  parseEpistemicFactoryRequest,
  type EpistemicFactoryTarget,
} from '@/lib/epistemic-factory'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  insertEpistemicFactoryRun,
  listEpistemicFactoryRuns,
  listEpistemicReviewPackets,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_FACTORY_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The factory run failed persistence validation.' } }, 400)
  if (message.includes('[P0001]') || message.includes('duplicate key')) return json({ error: { code: 'conflict', message: 'A packet is stale, duplicated, promoted, or no longer bound to the latest immutable draft target.' } }, 409)
  return json({ error: { code: 'epistemic_factory_unavailable', message: 'The noncanonical publishing factory is temporarily unavailable.' } }, 503)
}

function factoryTargets(targets: Awaited<ReturnType<typeof listEpistemicReviewTargets>>): EpistemicFactoryTarget[] {
  return targets.flatMap((target) => target.candidateSnapshot ? [{
    recordId: target.recordId,
    sourcePublicPath: target.sourcePublicPath,
    candidateSha256: target.candidateSha256,
    reviewTargetSha256: target.reviewTargetSha256,
    candidateSnapshot: target.candidateSnapshot,
    lineage: {
      origin: target.origin,
      baseTargetSha256: target.baseTargetSha256,
      snapshot: target.lineageSnapshot,
    },
  }] : [])
}

function packetSummary(packet: Awaited<ReturnType<typeof listEpistemicReviewPackets>>[number]) {
  return {
    packetId: packet.packetId,
    recordId: packet.recordId,
    domainSlug: packet.domainSlug,
    title: packet.title,
    candidateSha256: packet.candidateSha256,
    reviewTargetSha256: packet.reviewTargetSha256,
    status: packet.automatedAudit.status,
    findingCounts: packet.automatedAudit.counts,
    canonicalStatus: packet.canonicalStatus,
    preparedAt: packet.preparedAt,
    packetSha256: packet.packetSha256,
  }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  const recordId = new URL(request.url).searchParams.get('recordId')?.trim() || undefined
  try {
    const [targets, runs, packets] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicFactoryRuns(client),
      listEpistemicReviewPackets(client, recordId),
    ])
    if (recordId) {
      return json({ recordId, packets, canonicalReleaseSupported: false, publicCandidateRoutesSupported: false }, 200)
    }
    return json({
      summary: {
        currentImmutableTargets: targets.filter((target) => target.candidateSnapshot).length,
        immutableFactoryRuns: runs.length,
        reviewerPackets: packets.length,
        latestRun: runs[0] ?? null,
      },
      recentRuns: runs.slice(0, 20),
      recentPackets: packets.slice(0, 100).map(packetSummary),
      canonicalReleaseSupported: false,
      publicCandidateRoutesSupported: false,
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
  let parsed: ReturnType<typeof parseEpistemicFactoryRequest>
  try { parsed = parseEpistemicFactoryRequest(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid factory request.' } }, 400)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const currentTargets = factoryTargets(await listEpistemicReviewTargets(client))
    const selected = parsed.recordIds.length
      ? parsed.recordIds.map((recordId) => currentTargets.find((target) => target.recordId === recordId)).filter((target): target is EpistemicFactoryTarget => Boolean(target))
      : currentTargets
    if (parsed.recordIds.length && selected.length !== parsed.recordIds.length) {
      const found = new Set(selected.map((target) => target.recordId))
      return json({ error: { code: 'not_found', message: `Current immutable targets were not found for: ${parsed.recordIds.filter((recordId) => !found.has(recordId)).join(', ')}` } }, 404)
    }
    const result = buildEpistemicFactoryRun(selected)
    const response = {
      run: result.run,
      packets: result.packets.map(packetSummary),
      persisted: parsed.operation === 'compile',
      canonicalReleaseSupported: false,
      publicCandidateRoutesSupported: false,
    }
    if (parsed.operation === 'preview') return json(response, 200)
    const persistence = await insertEpistemicFactoryRun(
      client,
      result.run,
      result.packets,
      epistemicFactoryPersistenceKey(parsed.idempotencyKey, result.run.targetSha256s),
      authorization.actorFingerprint,
    )
    return json({ ...response, persistence }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) {
    if (error instanceof Error && !/failed \[/.test(error.message)) return json({ error: { code: 'invalid_request', message: error.message } }, 400)
    return unavailable(error)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}
