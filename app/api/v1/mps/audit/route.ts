import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { MpsAuditError, auditInputHash, runMpsAudit, validateAuditPassage } from '@/lib/mps-audit-engine'
import { IDEMPOTENCY_KEY_HEADER, INPUT_HASH_HEADER } from '@/lib/x402/admission'
import { parseMpsAuditJobRequest, serializableMpsAuditResult } from '@/lib/mps-audit-jobs'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from '@/lib/x402/offers'
import { discoverySourceFrom, recordOfferUsage } from '@/lib/x402/offer-telemetry'
import { withSlotRelease } from '@/lib/x402/slot'
import {
  MPS_AUDIT_MODEL,
  auditJobResponse,
  auditRetrievalPath,
  createAuditJobId,
  deriveRetrievalToken,
  retrievalTokenHash,
  type StoredAuditJob,
} from '@/lib/x402/mps-audit-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BODY_BYTES = 32_768
const JOB_COLUMNS = 'public_id, client_request_id, input_hash, status, result, failure_code, attempt_count, created_at, payment_transaction, payer'

// Autonomous MPS audit, bought with an x402 payment.
//
// The existing credential/prepaid route at /api/mps-audits is unchanged and
// untouched. This one holds no credential, consumes no prepaid credit, and
// shares only the audit engine.
//
// The ordering below is the whole design. A payment is settled by proxy.ts
// before this handler runs, so by the time we reach the model boundary the
// caller has already been charged. Everything between here and that boundary
// exists to make sure the charge is attached to something the payer can come
// back to: the job row, carrying the payment transaction, is committed first,
// and only then is Anthropic called. A model timeout after that point loses a
// model call, not a customer's money.

function json(body: unknown, status: number, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

const handler = async (request: Request): Promise<Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  }

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return json({ error: { code: 'payload_too_large', message: 'Request body exceeds the 32 KB limit.' } }, 413)
  }

  let input: { clientRequestId: string; passage: string; inputHash: string }
  try {
    const body = parseMpsAuditJobRequest(JSON.parse(raw))
    const passage = validateAuditPassage(body.text)
    input = { clientRequestId: body.clientRequestId, passage, inputHash: auditInputHash(passage) }
  } catch (error) {
    const status = error instanceof MpsAuditError ? error.status : 400
    return json({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request body.' } }, status)
  }

  // Injected by proxy.ts after settlement. A request without them did not pay,
  // and cannot reach here: the proxy answers it with a 402 or a 401 first.
  // Checked anyway, because the alternative to a cheap assertion here is a
  // job row with no payment attached to it.
  const paymentTransaction = request.headers.get('x-maha-payment-transaction') ?? ''
  const payer = request.headers.get('x-maha-payment-payer') ?? ''
  if (!paymentTransaction || !payer) {
    return json({ error: { code: 'payment_required', message: 'This endpoint is payable with x402 on Base Mainnet.' } }, 402)
  }

  // The gateway claimed idempotency against a *declared* input hash before it
  // settled, because the payment is decided before any body is read. This is
  // where that declaration is made honest: the job exists for the hash that was
  // paid for, and a body that does not hash to it is refused rather than
  // quietly audited under someone else's claim.
  const declaredHash = (request.headers.get(INPUT_HASH_HEADER) ?? '').trim().toLowerCase()
  if (declaredHash && declaredHash !== input.inputHash) {
    return json({
      error: {
        code: 'input_hash_mismatch',
        message: 'The request body does not hash to the x-maha-input-hash this payment was claimed against.',
        detail: 'The idempotency claim is taken before the body is read, so the declared hash is what the payment bought. Send the passage that hashes to it, or use a new idempotency key for different input.',
        declaredInputHash: declaredHash,
        actualInputHash: input.inputHash,
      },
    }, 409)
  }
  // The key and the request id are one identity. Allowing them to differ would
  // give a payer two ways to name the same job and no way to reconcile them.
  const declaredKey = (request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? '').trim()
  if (declaredKey && declaredKey !== input.clientRequestId) {
    return json({
      error: {
        code: 'idempotency_key_mismatch',
        message: 'x-maha-idempotency-key must equal clientRequestId.',
      },
    }, 409)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) {
    // The payment settled but nothing can be recorded. Refusing before the
    // model boundary means we have not also spent model tokens on a job we
    // cannot hand back.
    console.error('x402 MPS audit ledger unavailable after settlement', paymentTransaction)
    return json({
      error: {
        code: 'ledger_unavailable',
        message: 'The audit ledger is unavailable and no audit was started. Retain your payment receipt and retry; contact support quoting the transaction if this persists.',
        paymentTransaction,
      },
    }, 503)
  }

  // A payer replaying its own clientRequestId is asking about the job it has
  // already paid for. Returning that job -- rather than starting a second one
  // -- is what stops a retry after a timeout from being charged twice.
  const known = await ledger.from('x402_mps_audits').select(JOB_COLUMNS)
    .eq('payer', payer).eq('client_request_id', input.clientRequestId).maybeSingle()
  if (known.error) {
    return json({ error: { code: 'ledger_unavailable', message: 'The audit ledger could not be read.' } }, 503)
  }
  if (known.data) {
    const job = known.data as StoredAuditJob
    if (job.input_hash !== input.inputHash) {
      return json({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different source text.' } }, 409)
    }
    // The credential is re-issued here, and that is the recovery path. A payer
    // whose original response was lost to a timeout or a crash asks again with
    // the same clientRequestId: the admission claim already settled, so this
    // costs nothing, and the derived token is handed back. Recovery therefore
    // never depends on a secret that existed only in a response that never
    // arrived.
    return json({
      ...auditJobResponse(job, { idempotentReplay: true, retrievalToken: deriveRetrievalToken(job.public_id) ?? undefined }),
      retrievalPath: auditRetrievalPath(job.public_id),
    }, job.status === 'processing' ? 202 : 200)
  }

  const auditId = createAuditJobId()
  // Derived, not remembered. A crash between the insert below and this
  // response no longer destroys the only copy of the credential: it can be
  // recomputed on any instance, and the free idempotent replay re-issues it.
  const retrievalToken = deriveRetrievalToken(auditId)
  if (!retrievalToken) {
    console.error('X402_RETRIEVAL_TOKEN_SECRET is unset; a paid audit would not be recoverable')
    return json({
      error: {
        code: 'retrieval_credential_unavailable',
        message: 'This offer is not fully configured and no audit was started. No model call was made.',
        paymentTransaction,
      },
    }, 503)
  }

  // ---- The job is committed before the model is called. ----
  const { error: createError } = await ledger.from('x402_mps_audits').insert({
    public_id: auditId,
    retrieval_token_hash: retrievalTokenHash(retrievalToken),
    payment_transaction: paymentTransaction,
    payer,
    client_request_id: input.clientRequestId,
    input_hash: input.inputHash,
    status: 'processing',
    model: MPS_AUDIT_MODEL,
    attempt_count: 1,
  })
  if (createError) {
    // 23505 on (payer, client_request_id) is a concurrent duplicate of this
    // same request; on payment_transaction it is a replayed admission. Either
    // way the payer already has a job, so hand that back instead of a second.
    if (createError.code === '23505') {
      const replay = await ledger.from('x402_mps_audits').select(JOB_COLUMNS)
        .eq('payer', payer).eq('client_request_id', input.clientRequestId).maybeSingle()
      if (!replay.error && replay.data) {
        const job = replay.data as StoredAuditJob
        return json({
          ...auditJobResponse(job, { idempotentReplay: true }),
          retrievalPath: auditRetrievalPath(job.public_id),
        }, job.status === 'processing' ? 202 : 200)
      }
    }
    console.error('x402 MPS audit job creation failed:', createError.code, paymentTransaction)
    return json({
      error: {
        code: 'ledger_unavailable',
        message: 'The audit could not be recorded and no model call was made. Retain your payment receipt and contact support quoting the transaction.',
        paymentTransaction,
      },
    }, 503)
  }

  // ---- ANTHROPIC MODEL BOUNDARY ----
  // Reachable only with a settled payment and a committed job row above.
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const result = await runMpsAudit(input.passage, async (prompt) => {
      const message = await client.messages.create({
        model: MPS_AUDIT_MODEL,
        max_tokens: 1_500,
        messages: [{ role: 'user', content: prompt }],
      })
      return message.content.map((block) => block.type === 'text' ? block.text : '').join('\n')
    })

    const { data: completed, error: completeError } = await ledger.from('x402_mps_audits')
      .update({ status: 'completed', result: serializableMpsAuditResult(result), completed_at: new Date().toISOString() })
      .eq('public_id', auditId).select(JOB_COLUMNS).maybeSingle()

    if (completeError || !completed) {
      // The audit ran. Returning it while flagging that the write failed beats
      // withholding work the caller has already paid for; the job stays
      // resumable, so a later retrieval reconciles.
      console.error('x402 MPS audit completion write failed:', completeError?.code ?? 'missing_record', auditId)
      return json({
        ...auditJobResponse(
          { public_id: auditId, client_request_id: input.clientRequestId, input_hash: input.inputHash, status: 'completed', result, failure_code: null, attempt_count: 1 },
          { retrievalToken },
        ),
        retrievalPath: auditRetrievalPath(auditId),
        resultPersisted: false,
      }, 201)
    }

    return json({
      ...auditJobResponse(completed as StoredAuditJob, { retrievalToken }),
      retrievalPath: auditRetrievalPath(auditId),
    }, 201)
  } catch (error) {
    const failureCode = error instanceof MpsAuditError ? 'invalid_model_response' : 'model_unavailable'
    const { error: failError } = await ledger.from('x402_mps_audits')
      .update({ status: 'failed', failure_code: failureCode, completed_at: new Date().toISOString() })
      .eq('public_id', auditId)
    if (failError) console.error('x402 MPS audit failure write failed:', failError.code, auditId)
    console.error('x402 MPS audit execution failed:', error instanceof Error ? error.name : 'unknown_error', auditId)

    // 502, but never an untraceable one: the response carries the auditId and
    // the retrieval credential, so the payer leaves holding everything needed
    // to resume the job it has already paid for.
    return json({
      error: {
        code: failureCode,
        message: 'The audit did not complete. Resume it at the retrieval path with your retrievalToken; this job is paid for and will not be charged again.',
      },
      auditId,
      retrievalToken,
      retrievalPath: auditRetrievalPath(auditId),
      paymentTransaction,
      status: 'failed',
      resumable: true,
    }, 502)
  }
}

const metered = async (request: Request): Promise<Response> => {
  const response = await handler(request)
  await recordOfferUsage({
    offerId: MPS_AUTONOMOUS_AUDIT_OFFER.id,
    eventKind: 'invocation',
    status: response.status,
    discoverySource: discoverySourceFrom(request.headers),
  })
  return response
}

// The slot is held from admission and freed here, including when the model
// call throws. With a cap of 2 and a model call in the middle, a leaked slot
// would refuse half of all paying callers until its TTL lapsed.
export const POST = withSlotRelease(metered)

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
