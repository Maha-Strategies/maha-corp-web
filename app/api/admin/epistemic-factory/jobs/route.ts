import {
  buildEpistemicFactoryQueueJob,
  compileEpistemicDraft,
} from '@/lib/epistemic-factory-tools'
import { EPISTEMIC_RECORDS } from '@/lib/epistemic-pilots'
import { authorizeEpistemicOperations } from '@/lib/epistemic-review'
import {
  createEpistemicPersistenceClient,
  enqueueEpistemicFactoryJob,
  listEpistemicFactoryJobs,
  listEpistemicReviewTargets,
} from '@/lib/epistemic-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}

function gate(request: Request) {
  const authorization = authorizeEpistemicOperations(request)
  return authorization.authorized && authorization.actorFingerprint ? authorization.actorFingerprint : null
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object.')
  return value as Record<string, unknown>
}

async function existingRecords(client: NonNullable<ReturnType<typeof createEpistemicPersistenceClient>>) {
  const records = new Map(EPISTEMIC_RECORDS.map((record) => [record.id, record]))
  for (const target of await listEpistemicReviewTargets(client)) {
    if (target.candidateSnapshot) records.set(target.recordId, target.candidateSnapshot)
  }
  return [...records.values()]
}

export async function GET(request: Request) {
  if (!gate(request)) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  const client = createEpistemicPersistenceClient()
  if (!client) return json({ error: { code: 'unavailable', message: 'Epistemic persistence is unavailable.' } }, 503)
  try {
    const jobs = await listEpistemicFactoryJobs(client)
    return json({ jobs, count: jobs.length, publicCandidateRoutesSupported: false }, 200)
  } catch (cause) {
    console.error('Epistemic factory queue read failed:', cause instanceof Error ? cause.message : 'unknown')
    return json({ error: { code: 'queue_unavailable', message: 'The epistemic factory queue is temporarily unavailable.' } }, 503)
  }
}

export async function POST(request: Request) {
  const actorFingerprint = gate(request)
  if (!actorFingerprint) return json({ error: { code: 'unauthorized', message: 'A valid epistemic-operations bearer token is required.' } }, 401)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let body: Record<string, unknown>
  try { body = object(await request.json()) } catch (cause) { return json({ error: { code: 'invalid_request', message: cause instanceof Error ? cause.message : 'Invalid JSON.' } }, 400) }
  if (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.trim().length < 8 || body.idempotencyKey.trim().length > 160) {
    return json({ error: { code: 'invalid_request', message: 'idempotencyKey must contain 8-160 characters.' } }, 400)
  }
  const client = createEpistemicPersistenceClient()
  if (!client) return json({ error: { code: 'unavailable', message: 'Epistemic persistence is unavailable.' } }, 503)
  try {
    const compilation = compileEpistemicDraft(body.record, body.sourcePublicPath, await existingRecords(client))
    const job = buildEpistemicFactoryQueueJob(compilation)
    const persistence = await enqueueEpistemicFactoryJob(client, job, body.idempotencyKey.trim(), actorFingerprint)
    return json({
      job: { jobId: persistence.jobId, status: persistence.status, payloadSha256: job.payloadSha256, recordId: compilation.recordId },
      persistence,
      canonicalReleaseAttempted: false,
      publicCandidateRoutesSupported: false,
      boundary: 'Queue submission writes only a bounded internal job. A worker may create an immutable noncanonical draft target; neither step can review or publish it.',
    }, persistence.idempotentReplay ? 200 : 202)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'The draft could not be queued.'
    if (!/failed \[/.test(message)) return json({ error: { code: 'invalid_request', message } }, 400)
    console.error('Epistemic factory enqueue failed:', message)
    return json({ error: { code: 'queue_unavailable', message: 'The epistemic factory queue is temporarily unavailable.' } }, 503)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
}
