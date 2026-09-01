import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'
import {
  buildEpistemicIngestionBatch,
  EPISTEMIC_INGESTION_BOUNDARY,
  parseEpistemicIngestionRequest,
} from '@/lib/epistemic-ingestion'
import { previewDiagnostic } from '@/lib/epistemic-ingestion-diagnostics'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  listEpistemicIngestionBatches,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'
import { insertEpistemicIngestionBatch } from '@/lib/epistemic-ingestion-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: EPISTEMIC_INGESTION_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function unavailable(error?: unknown, operation = 'persistence-call-failed') {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The ingestion batch failed persistence validation.' } }, 400)
  if (message.includes('[23505]')) return json({ error: { code: 'conflict', message: 'This immutable batch conflicts with an existing record.' } }, 409)
  return json({
    error: { code: 'epistemic_persistence_unavailable', message: 'Epistemic ingestion persistence is unavailable.' },
    ...previewDiagnostic(operation, error),
  }, 503)
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
  if (!client) return unavailable(undefined, 'persistence-client-absent')
  try {
    const [batches, reviewTargets] = await Promise.all([
      listEpistemicIngestionBatches(client),
      listEpistemicReviewTargets(client),
    ])
    return json({
      inventory: EPISTEMIC_MIGRATION_INVENTORY,
      batches,
      reviewTargets: reviewTargets.map((target) => ({
        recordId: target.recordId,
        domainSlug: target.domainSlug,
        title: target.title,
        slug: target.slug,
        candidateSha256: target.candidateSha256,
        reviewTargetSha256: target.reviewTargetSha256,
        sourcePublicPath: target.sourcePublicPath,
        gateDecision: target.gateDecision,
        ingestedAt: target.ingestedAt,
      })),
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
  let parsed: ReturnType<typeof parseEpistemicIngestionRequest>
  try { parsed = parseEpistemicIngestionRequest(body) } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid ingestion request.' } }, 400)
  }
  if (parsed.adapterId === 'mcp-private-canary' && (process.env.VERCEL_ENV !== 'preview' || process.env.MCP_PRIVATE_CANARY_ENABLED !== 'true')) {
    return json({ error: { code: 'not_found', message: 'The synthetic private canary adapter is unavailable.' } }, 404)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable(undefined, 'persistence-client-absent')
  const batch = buildEpistemicIngestionBatch(parsed)
  try {
    const persistence = await insertEpistemicIngestionBatch(client, batch, parsed.idempotencyKey, authorization.actorFingerprint)
    return json({ batch: { ...batch, records: undefined }, persistence, autoPublicationSupported: false }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) {
    return unavailable(error)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
