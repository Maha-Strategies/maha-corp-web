import {
  activeEpistemicReleases,
  authorizeEpistemicReleaseAuthority,
  buildEpistemicCanonicalRelease,
  buildEpistemicReleaseWithdrawal,
  EPISTEMIC_RELEASE_BOUNDARY,
  epistemicReleaseStatus,
  parseEpistemicReleaseRequest,
  releaseReadiness,
} from '@/lib/epistemic-release'
import {
  createEpistemicPersistenceClient,
  insertEpistemicCanonicalRelease,
  insertEpistemicReleaseWithdrawal,
  listEpistemicCanonicalReleases,
  listEpistemicExpertReviews,
  listEpistemicReleaseWithdrawals,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json(
    { ...body, boundary: EPISTEMIC_RELEASE_BOUNDARY },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}

function gate(request: Request): { actorFingerprint: string } | null {
  const authorization = authorizeEpistemicReleaseAuthority(request)
  return authorization.authorized && authorization.actorFingerprint
    ? { actorFingerprint: authorization.actorFingerprint }
    : null
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The release failed persistence validation.' } }, 400)
  if (message.includes('[P0001]') || message.includes('duplicate key')) return json({ error: { code: 'conflict', message: 'The release conflicts with its target, approvals, active lineage, or canonical version.' } }, 409)
  if (message.includes('[P0002]')) return json({ error: { code: 'not_found', message: 'The frozen target or canonical release was not found.' } }, 404)
  return json({ error: { code: 'epistemic_release_unavailable', message: 'Canonical release control is temporarily unavailable.' } }, 503)
}

async function readWorkspace(client: NonNullable<ReturnType<typeof createEpistemicPersistenceClient>>) {
  const [targets, reviews, releases, withdrawals] = await Promise.all([
    listEpistemicReviewTargets(client),
    listEpistemicExpertReviews(client),
    listEpistemicCanonicalReleases(client),
    listEpistemicReleaseWithdrawals(client),
  ])
  const active = activeEpistemicReleases(releases, withdrawals)
  const candidates = targets.flatMap((target) => {
    if (!target.candidateSnapshot || !target.domainSlug || !target.title) return []
    const readiness = releaseReadiness({
      recordId: target.recordId,
      targetSha256: target.reviewTargetSha256,
      candidateSnapshot: target.candidateSnapshot,
    }, reviews)
    const previous = active.find((release) => release.recordId === target.recordId) ?? null
    const alreadyCanonical = previous?.targetSha256 === target.reviewTargetSha256
    return [{
      recordId: target.recordId,
      domainSlug: target.domainSlug,
      title: target.title,
      slug: target.slug,
      targetSha256: target.reviewTargetSha256,
      sourcePublicPath: target.sourcePublicPath,
      origin: target.origin,
      ready: readiness.ready && !alreadyCanonical,
      approvals: readiness.approvals,
      blockers: alreadyCanonical ? ['target-already-active-canonical'] : readiness.decision.reasons,
      activeRelease: previous ? {
        releaseId: previous.releaseId,
        canonicalVersion: previous.canonicalVersion,
        targetSha256: previous.targetSha256,
        releasedAt: previous.releasedAt,
      } : null,
    }]
  }).sort((left, right) => Number(right.ready) - Number(left.ready) || left.title.localeCompare(right.title))
  return {
    candidates,
    releases: releases.map((release) => ({ ...release, status: epistemicReleaseStatus(release, releases, withdrawals) })),
    withdrawals,
    summary: {
      candidates: candidates.length,
      ready: candidates.filter((candidate) => candidate.ready).length,
      active: active.length,
      superseded: releases.filter((release) => epistemicReleaseStatus(release, releases, withdrawals) === 'superseded').length,
      withdrawn: withdrawals.length,
    },
  }
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A distinct epistemic release-authority bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    return json({ ...(await readWorkspace(client)), autonomousPublicationSupported: false }, 200)
  } catch (error) {
    return unavailable(error)
  }
}

export async function POST(request: Request) {
  const authorization = gate(request)
  if (!authorization) return json({ error: { code: 'unauthorized', message: 'A distinct epistemic release-authority bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let parsed: ReturnType<typeof parseEpistemicReleaseRequest>
  try { parsed = parseEpistemicReleaseRequest(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid release request.' } }, 400)
  }

  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const [targets, reviews, releases, withdrawals] = await Promise.all([
      listEpistemicReviewTargets(client),
      listEpistemicExpertReviews(client),
      listEpistemicCanonicalReleases(client),
      listEpistemicReleaseWithdrawals(client),
    ])
    const active = activeEpistemicReleases(releases, withdrawals)
    if (parsed.operation === 'withdraw') {
      const activeRelease = active.find((release) => release.releaseId === parsed.releaseId)
      if (!activeRelease) return json({ error: { code: 'not_found', message: 'The active canonical release was not found.' } }, 404)
      const withdrawal = buildEpistemicReleaseWithdrawal(parsed, activeRelease)
      const persistence = await insertEpistemicReleaseWithdrawal(client, withdrawal, parsed.idempotencyKey, authorization.actorFingerprint)
      return json({ withdrawal, persistence, persisted: true, autonomousPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
    }

    const target = targets.find((candidate) => candidate.recordId === parsed.recordId && candidate.reviewTargetSha256 === parsed.targetSha256)
    if (!target?.candidateSnapshot) return json({ error: { code: 'not_found', message: 'The current frozen release target was not found.' } }, 404)
    const previous = active.find((release) => release.recordId === parsed.recordId) ?? null
    const release = buildEpistemicCanonicalRelease(parsed, {
      recordId: target.recordId,
      targetSha256: target.reviewTargetSha256,
      candidateSnapshot: target.candidateSnapshot,
    }, reviews, previous)
    if (parsed.operation === 'preview') {
      return json({ preview: release, persisted: false, autonomousPublicationSupported: false }, 200)
    }
    const persistence = await insertEpistemicCanonicalRelease(client, release, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ release, persistence, persisted: true, autonomousPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
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
