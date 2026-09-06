import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { auditInputHash } from '@/lib/mps-audit-engine'
import { parseResearchIntakeInput, researchIntakeInputHash } from '@/lib/research-intake-evidence-pack'
import { IDEMPOTENCY_KEY_HEADER, INPUT_HASH_HEADER } from '@/lib/x402/admission'
import { RESEARCH_INTAKE_EVIDENCE_PACK_OFFER } from '@/lib/x402/offers'
import { discoverySourceFrom, recordOfferUsage } from '@/lib/x402/offer-telemetry'
import {
  RESEARCH_INTAKE_MODEL, createResearchIntakeJobId, deriveResearchIntakeRetrievalToken,
  researchIntakeJobResponse, researchIntakeRetrievalTokenHash, type StoredResearchIntakeJob,
} from '@/lib/x402/research-intake-job'
import {
  RESEARCH_INTAKE_JOB_COLUMNS, executeResearchIntakeSections, researchIntakeSectionsFor,
} from '@/lib/x402/research-intake-runtime'
import { withSlotRelease } from '@/lib/x402/slot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function json(body: unknown, status: number) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }) }

const handler = async (request: Request): Promise<Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > RESEARCH_INTAKE_EVIDENCE_PACK_OFFER.maxRequestBytes) return json({ error: { code: 'payload_too_large', message: 'Request exceeds the 64 KB limit.' } }, 413)
  let input: ReturnType<typeof parseResearchIntakeInput>
  try { input = parseResearchIntakeInput(JSON.parse(raw)) } catch (error) { return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }
  const inputHash = researchIntakeInputHash(input)
  const paymentTransaction = request.headers.get('x-maha-payment-transaction') ?? ''
  const payer = request.headers.get('x-maha-payment-payer') ?? ''
  if (!paymentTransaction || !payer) return json({ error: { code: 'payment_required', message: 'This endpoint requires x402 payment on Base Mainnet.' } }, 402)
  if ((request.headers.get(INPUT_HASH_HEADER) ?? '').trim().toLowerCase() !== inputHash) return json({ error: { code: 'input_hash_mismatch', message: 'The body does not match the input hash authorized before settlement.' } }, 409)
  if ((request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? '').trim() !== input.clientRequestId) return json({ error: { code: 'idempotency_key_mismatch', message: 'x-maha-idempotency-key must equal clientRequestId.' } }, 409)

  const ledger = createAgentInquiryLedger()
  if (!ledger) return json({ error: { code: 'ledger_unavailable', message: 'No model call was made. Retain the payment receipt and retry.' } }, 503)
  const known = await ledger.from('x402_research_intake_packs').select(RESEARCH_INTAKE_JOB_COLUMNS).eq('payer', payer).eq('client_request_id', input.clientRequestId).maybeSingle()
  if (known.error) return json({ error: { code: 'ledger_unavailable', message: 'The intake ledger could not be read.' } }, 503)
  if (known.data) {
    const job = known.data as StoredResearchIntakeJob
    if (job.input_hash !== inputHash) return json({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used for different input.' } }, 409)
    const rows = await researchIntakeSectionsFor(ledger, job.public_id)
    if (rows.error) return json({ error: { code: 'ledger_unavailable', message: 'Section progress could not be read.' } }, 503)
    return json(researchIntakeJobResponse(job, rows.data, { idempotentReplay: true, retrievalToken: deriveResearchIntakeRetrievalToken(job.public_id) ?? undefined }), job.status === 'processing' ? 202 : 200)
  }

  const packId = createResearchIntakeJobId()
  const retrievalToken = deriveResearchIntakeRetrievalToken(packId)
  if (!retrievalToken) return json({ error: { code: 'retrieval_credential_unavailable', message: 'No model call was made. Retain the payment receipt and retry.' } }, 503)
  const created = await ledger.rpc('create_x402_research_intake_job', {
    p_public_id: packId, p_retrieval_token_hash: researchIntakeRetrievalTokenHash(retrievalToken),
    p_payment_transaction: paymentTransaction, p_payer: payer, p_client_request_id: input.clientRequestId,
    p_input_hash: inputHash, p_model: RESEARCH_INTAKE_MODEL,
    p_sections: input.sections.map((section, index) => ({ section_order: index + 1, source_id: section.sourceId, section_id: section.sectionId, source_section_hash: auditInputHash(section.text) })),
  })
  if (created.error) {
    if (created.error.code === '23505') {
      const replay = await ledger.from('x402_research_intake_packs').select(RESEARCH_INTAKE_JOB_COLUMNS).eq('payer', payer).eq('client_request_id', input.clientRequestId).maybeSingle()
      if (!replay.error && replay.data) {
        const job = replay.data as StoredResearchIntakeJob
        const rows = await researchIntakeSectionsFor(ledger, job.public_id)
        if (!rows.error) return json(researchIntakeJobResponse(job, rows.data, { idempotentReplay: true, retrievalToken: deriveResearchIntakeRetrievalToken(job.public_id) ?? undefined }), job.status === 'processing' ? 202 : 200)
      }
    }
    return json({ error: { code: 'ledger_unavailable', message: 'No model call was made. Retain the payment receipt and retry.' } }, 503)
  }
  const rows = await researchIntakeSectionsFor(ledger, packId)
  if (rows.error || rows.data.length !== input.sections.length) return json({ error: { code: 'ledger_unavailable', message: 'Section checkpoints could not be confirmed. No model call was made.' } }, 503)
  const job: StoredResearchIntakeJob = { public_id: packId, client_request_id: input.clientRequestId, input_hash: inputHash, status: 'processing', result: null, failure_code: null, created_at: new Date().toISOString(), payment_transaction: paymentTransaction, payer }
  return executeResearchIntakeSections({ ledger, job, input, sectionRows: rows.data, retrievalToken, successStatus: 201 })
}

const metered = async (request: Request) => {
  const response = await handler(request)
  await recordOfferUsage({ offerId: RESEARCH_INTAKE_EVIDENCE_PACK_OFFER.id, eventKind: 'invocation', status: response.status, discoverySource: discoverySourceFrom(request.headers) })
  return response
}
export const POST = withSlotRelease(metered)
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
