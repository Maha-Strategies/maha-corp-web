import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  FRONTIER_SOURCE_VERIFICATION_BOUNDARY,
  parseFrontierSourceVerificationReport,
} from '@/lib/frontier-source-verification'
import {
  createEpistemicPersistenceClient,
  insertFrontierSourceVerificationReport,
  listFrontierSourceVerificationReports,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json({ ...body, boundary: FRONTIER_SOURCE_VERIFICATION_BOUNDARY }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function gate(request: Request) {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint ? authorization.actorFingerprint : null
}

function unavailable(error?: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('[22023]')) return json({ error: { code: 'invalid_request', message: 'The source-verification report failed persistence validation.' } }, 400)
  if (message.includes('[P0001]')) return json({ error: { code: 'conflict', message: 'The idempotency key conflicts with a different verification report.' } }, 409)
  return json({ error: { code: 'source_verifications_unavailable', message: 'Source-verification persistence is temporarily unavailable.' } }, 503)
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const reports = await listFrontierSourceVerificationReports(client)
    return json({ latest: reports[0] ?? null, history: reports.map(({ results, ...report }) => ({ ...report, resultCount: results.length })) }, 200)
  } catch (error) { return unavailable(error) }
}

export async function POST(request: Request) {
  const actorFingerprint = gate(request)
  if (!actorFingerprint) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, 400) }
  let report
  let idempotencyKey
  try {
    const candidate = body as { report?: unknown; idempotencyKey?: unknown }
    report = parseFrontierSourceVerificationReport(candidate.report)
    if (typeof candidate.idempotencyKey !== 'string' || candidate.idempotencyKey.trim().length < 8 || candidate.idempotencyKey.length > 160) throw new Error('idempotencyKey must contain 8-160 characters.')
    idempotencyKey = candidate.idempotencyKey.trim()
  } catch (error) {
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid source-verification report.' } }, 400)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return unavailable()
  try {
    const persistence = await insertFrontierSourceVerificationReport(client, report, idempotencyKey, actorFingerprint)
    return json({ report, persistence, reviewCreated: false, releaseCreated: false }, persistence.idempotentReplay ? 200 : 201)
  } catch (error) { return unavailable(error) }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
