import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { parseResearchIntakeInput, researchIntakeInputHash } from '@/lib/research-intake-evidence-pack'
import {
  MAX_RESEARCH_INTAKE_ATTEMPTS, researchIntakeJobResponse, researchIntakeRetrievalTokenMatches,
  validResearchIntakeJobId, type StoredResearchIntakeJob,
} from '@/lib/x402/research-intake-job'
import {
  RESEARCH_INTAKE_JOB_COLUMNS, executeResearchIntakeSections, researchIntakeSectionsFor,
} from '@/lib/x402/research-intake-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function json(body: unknown, status: number) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }
function token(request: Request) { const value = request.headers.get('authorization') ?? ''; return /^Bearer /i.test(value) ? value.slice(7).trim() : '' }

async function authorized(request: Request, packId: string) {
  const notFound = json({ error: { code: 'not_found', message: 'No pack matches that id and retrieval token.' } }, 404)
  if (!validResearchIntakeJobId(packId) || !token(request)) return { failure: notFound } as const
  const ledger = createAgentInquiryLedger()
  if (!ledger) return { failure: json({ error: { code: 'ledger_unavailable', message: 'The intake ledger is unavailable.' } }, 503) } as const
  const jobResult = await ledger.from('x402_research_intake_packs').select(RESEARCH_INTAKE_JOB_COLUMNS).eq('public_id', packId).maybeSingle()
  const secret = await ledger.from('x402_research_intake_packs').select('retrieval_token_hash').eq('public_id', packId).maybeSingle()
  if (jobResult.error || secret.error) return { failure: json({ error: { code: 'ledger_unavailable', message: 'The intake ledger could not be read.' } }, 503) } as const
  if (!jobResult.data || !secret.data || !researchIntakeRetrievalTokenMatches(token(request), String((secret.data as Record<string, unknown>).retrieval_token_hash ?? ''))) return { failure: notFound } as const
  return { ledger, job: jobResult.data as StoredResearchIntakeJob } as const
}

export async function GET(request: Request, context: { params: Promise<{ packId: string }> }) {
  const { packId } = await context.params
  const access = await authorized(request, packId)
  if ('failure' in access) return access.failure
  const rows = await researchIntakeSectionsFor(access.ledger, packId)
  if (rows.error) return json({ error: { code: 'ledger_unavailable', message: 'Section progress could not be read.' } }, 503)
  return json(researchIntakeJobResponse(access.job, rows.data), 200)
}

export async function POST(request: Request, context: { params: Promise<{ packId: string }> }) {
  const { packId } = await context.params
  const access = await authorized(request, packId)
  if ('failure' in access) return access.failure
  const { ledger, job } = access
  const rows = await researchIntakeSectionsFor(ledger, packId)
  if (rows.error) return json({ error: { code: 'ledger_unavailable', message: 'Section progress could not be read.' } }, 503)
  if (job.status === 'completed') return json(researchIntakeJobResponse(job, rows.data, { idempotentReplay: true }), 200)

  let input: ReturnType<typeof parseResearchIntakeInput>
  try { input = parseResearchIntakeInput(await request.json()) } catch (error) { return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'The original request is required.' } }, 400) }
  if (researchIntakeInputHash(input) !== job.input_hash || input.clientRequestId !== job.client_request_id) return json({ error: { code: 'input_mismatch', message: 'The resubmitted request is not the request this paid pack is bound to.' } }, 409)

  const claim = await ledger.rpc('claim_x402_research_intake_sections', { p_pack_public_id: packId, p_max_attempts: MAX_RESEARCH_INTAKE_ATTEMPTS })
  if (claim.error) return json({ error: { code: 'ledger_unavailable', message: 'The retry could not be claimed.' } }, 503)
  const claimed = Number(claim.data)
  if (claimed === 0) {
    const latest = await researchIntakeSectionsFor(ledger, packId)
    return json(researchIntakeJobResponse(job, latest.data), 200)
  }
  if (claimed < 0) {
    const exhausted = rows.data.some((row) => row.status !== 'completed' && row.attempt_count >= MAX_RESEARCH_INTAKE_ATTEMPTS)
    return json({
      ...researchIntakeJobResponse(job, rows.data),
      error: { code: exhausted ? 'retry_exhausted' : 'retry_in_progress', message: exhausted ? 'At least one unfinished section exhausted its retry allowance.' : 'Another recovery attempt is still processing.' },
    }, exhausted ? 409 : 202)
  }
  const claimedRows = await researchIntakeSectionsFor(ledger, packId)
  if (claimedRows.error) return json({ error: { code: 'ledger_unavailable', message: 'Claimed section progress could not be read.' } }, 503)
  await ledger.from('x402_research_intake_packs').update({ status: 'processing', failure_code: null }).eq('public_id', packId)
  return executeResearchIntakeSections({ ledger, job: { ...job, status: 'processing', failure_code: null }, input, sectionRows: claimedRows.data })
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
