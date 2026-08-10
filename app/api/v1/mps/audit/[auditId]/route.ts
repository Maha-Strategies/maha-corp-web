import Anthropic from '@anthropic-ai/sdk'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { MpsAuditError, auditInputHash, runMpsAudit, validateAuditPassage } from '@/lib/mps-audit-engine'
import { serializableMpsAuditResult } from '@/lib/mps-audit-jobs'
import {
  MAX_AUDIT_ATTEMPTS,
  MPS_AUDIT_MODEL,
  auditJobResponse,
  auditRetrievalPath,
  isStaleProcessing,
  retrievalTokenMatches,
  validAuditJobId,
  type StoredAuditJob,
} from '@/lib/x402/mps-audit-job'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Retrieval and resumption for an audit that has already been paid for.
//
// Two things make this route necessary rather than a convenience.
//
// A settled payment must not be able to disappear into a 502. If the model
// times out, the payer has been charged and has nothing; without a way back to
// the job, the only recovery available to an autonomous buyer is to pay again
// for work it already bought.
//
// And a paid job must be recoverable *without* a second payment, which is why
// this path is deliberately not priced. Exact-path matching in the offer
// catalog is what makes that safe: /api/v1/mps/audit is priced,
// /api/v1/mps/audit/{id} is a different path and matches no offer, so no
// challenge is issued here. Under the old prefix matching this path would have
// inherited the parent's price and demanded $0.10 to look at a finished job.
//
// The credential is the retrieval token, not the audit id. See
// lib/x402/mps-audit-job.ts for why the id is not treated as a capability.

const JOB_COLUMNS = 'public_id, client_request_id, input_hash, status, result, failure_code, attempt_count, created_at, payment_transaction, payer'

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function presentedToken(request: Request, body?: Record<string, unknown>): string {
  const header = request.headers.get('authorization') ?? ''
  if (/^Bearer /i.test(header)) return header.slice(7).trim()
  return typeof body?.retrievalToken === 'string' ? body.retrievalToken.trim() : ''
}

/**
 * Loads the job only if the presented credential matches.
 *
 * Every failure below answers 404 with one message. Distinguishing "no such
 * audit" from "wrong token" would turn the id space into an oracle: an agent
 * could enumerate ids, learn which exist, and know exactly which ones are
 * worth attacking. There is nothing a legitimate caller learns from the
 * distinction that it does not already know.
 */
async function authorizedJob(
  ledger: NonNullable<ReturnType<typeof createAgentInquiryLedger>>,
  auditId: string,
  token: string,
): Promise<{ job: StoredAuditJob } | { failure: Response }> {
  const notFound = json({ error: { code: 'not_found', message: 'No audit matches that id and retrieval token.' } }, 404)

  if (!validAuditJobId(auditId) || !token) return { failure: notFound }

  const { data, error } = await ledger.from('x402_mps_audits').select(JOB_COLUMNS).eq('public_id', auditId).maybeSingle()
  if (error) return { failure: json({ error: { code: 'ledger_unavailable', message: 'The audit ledger could not be read.' } }, 503) }
  if (!data) return { failure: notFound }

  const job = data as StoredAuditJob & { retrieval_token_hash?: string }
  const { data: secret, error: secretError } = await ledger.from('x402_mps_audits')
    .select('retrieval_token_hash').eq('public_id', auditId).maybeSingle()
  if (secretError || !secret) return { failure: notFound }

  if (!retrievalTokenMatches(token, String((secret as Record<string, unknown>).retrieval_token_hash ?? ''))) {
    return { failure: notFound }
  }
  return { job }
}

export async function GET(request: Request, context: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await context.params
  const ledger = createAgentInquiryLedger()
  if (!ledger) return json({ error: { code: 'ledger_unavailable', message: 'The audit ledger is not configured.' } }, 503)

  const authorized = await authorizedJob(ledger, auditId, presentedToken(request))
  if ('failure' in authorized) return authorized.failure

  const job = authorized.job
  return json({
    ...auditJobResponse(job),
    retrievalPath: auditRetrievalPath(job.public_id),
    ...(isStaleProcessing(job) ? { stalled: true, hint: 'This job has been processing longer than the model deadline. Resume it by POSTing the original passage to this path with your retrievalToken.' } : {}),
  }, 200)
}

/**
 * Resumes a paid job. Never charges for it again.
 *
 * The caller must resubmit the original passage, which is not a convenience
 * requirement -- it is forced by the retention promise. The offer publishes
 * sourceTextStored:false and means it, so there is no stored passage to re-run
 * the model against. The hash comparison below is what keeps that honest in
 * both directions: it proves the resubmitted text is the text that was paid
 * for, so a valid retrieval token cannot be used to buy an audit of something
 * else at the price of the original.
 *
 * `resume_x402_mps_audit` claims the attempt as a conditional UPDATE, so the
 * ceiling holds under concurrent resumes rather than being read-then-written
 * by two callers at once.
 */
export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await context.params

  let body: Record<string, unknown> = {}
  try {
    if (request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      body = await request.json() as Record<string, unknown>
    }
  } catch {
    return json({ error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } }, 400)
  }

  const ledger = createAgentInquiryLedger()
  if (!ledger) return json({ error: { code: 'ledger_unavailable', message: 'The audit ledger is not configured.' } }, 503)

  const authorized = await authorizedJob(ledger, auditId, presentedToken(request, body))
  if ('failure' in authorized) return authorized.failure
  const job = authorized.job

  if (job.status === 'completed') {
    return json({ ...auditJobResponse(job, { idempotentReplay: true }), retrievalPath: auditRetrievalPath(job.public_id) }, 200)
  }
  if (job.status === 'processing' && !isStaleProcessing(job)) {
    // Still in flight. Running the model again now would double our cost for
    // one payment and race two writers onto the same row.
    return json({ ...auditJobResponse(job), retrievalPath: auditRetrievalPath(job.public_id) }, 202)
  }

  let passage: string
  try {
    passage = validateAuditPassage(body.text)
  } catch (error) {
    return json({
      error: {
        code: 'passage_required',
        message: error instanceof Error ? error.message : 'The original passage is required to resume this audit.',
        detail: 'No source text is retained for this offer, so a resume must resubmit the passage that was originally audited.',
      },
    }, 400)
  }
  if (auditInputHash(passage) !== job.input_hash) {
    return json({
      error: {
        code: 'input_hash_mismatch',
        message: 'The submitted passage does not match the passage this audit was paid for.',
      },
    }, 409)
  }

  const { data: attempt, error: claimError } = await ledger.rpc('resume_x402_mps_audit', {
    p_public_id: auditId,
    p_max_attempts: MAX_AUDIT_ATTEMPTS,
  })
  if (claimError) return json({ error: { code: 'ledger_unavailable', message: 'The resume could not be recorded.' } }, 503)
  if (attempt === null || attempt === undefined) {
    return json({
      error: {
        code: 'retries_exhausted',
        message: `This audit has used its ${MAX_AUDIT_ATTEMPTS} model attempts. Contact support quoting the auditId; it will not be charged again.`,
        attemptsUsed: job.attempt_count,
        maxAttempts: MAX_AUDIT_ATTEMPTS,
      },
    }, 409)
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const result = await runMpsAudit(passage, async (prompt) => {
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
      console.error('x402 MPS audit resume write failed:', completeError?.code ?? 'missing_record', auditId)
      return json({
        ...auditJobResponse({ ...job, status: 'completed', result, failure_code: null, attempt_count: Number(attempt) }),
        retrievalPath: auditRetrievalPath(auditId),
        resultPersisted: false,
      }, 200)
    }
    return json({ ...auditJobResponse(completed as StoredAuditJob), retrievalPath: auditRetrievalPath(auditId) }, 200)
  } catch (error) {
    const failureCode = error instanceof MpsAuditError ? 'invalid_model_response' : 'model_unavailable'
    await ledger.from('x402_mps_audits')
      .update({ status: 'failed', failure_code: failureCode, completed_at: new Date().toISOString() })
      .eq('public_id', auditId)
    console.error('x402 MPS audit resume failed:', error instanceof Error ? error.name : 'unknown_error', auditId)
    const attemptsUsed = Number(attempt)
    return json({
      error: {
        code: failureCode,
        message: attemptsUsed < MAX_AUDIT_ATTEMPTS
          ? 'The audit did not complete. Resume again with your retrievalToken; this job will not be charged again.'
          : 'The audit did not complete and has exhausted its retry allowance. Contact support quoting the auditId.',
        resumable: attemptsUsed < MAX_AUDIT_ATTEMPTS,
        attemptsUsed,
        maxAttempts: MAX_AUDIT_ATTEMPTS,
      },
      auditId,
      retrievalPath: auditRetrievalPath(auditId),
      status: 'failed',
    }, 502)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' } })
}
