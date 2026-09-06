import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import { RESEARCH_INTAKE_EVIDENCE_PACK_OFFER } from './offers.ts'

export const RESEARCH_INTAKE_MODEL = 'claude-sonnet-4-6'
export const MAX_RESEARCH_INTAKE_ATTEMPTS = 3

export type StoredResearchIntakeJob = {
  public_id: string
  client_request_id: string
  input_hash: string
  status: 'processing' | 'completed' | 'failed'
  result: Record<string, unknown> | null
  failure_code: string | null
  section_count: number
  sections_completed: number
  sections_failed: number
  total_model_calls: number
  created_at: string
  payment_transaction: string
  payer: string
}

export function createResearchIntakeJobId(): string {
  return `intake_${randomUUID().replaceAll('-', '')}`
}

export function validResearchIntakeJobId(value: string): boolean {
  return /^intake_[a-f0-9]{32}$/.test(value)
}

export function deriveResearchIntakeRetrievalToken(jobId: string, secret = process.env.X402_RETRIEVAL_TOKEN_SECRET): string | null {
  if (!validResearchIntakeJobId(jobId) || !secret?.trim()) return null
  return `rirt_${createHmac('sha256', secret).update(`research-intake:${jobId}`, 'utf8').digest('base64url')}`
}

export function researchIntakeRetrievalTokenHash(token: string): string {
  return `sha256:${createHash('sha256').update(token, 'utf8').digest('hex')}`
}

export function researchIntakeRetrievalTokenMatches(presented: string, storedHash: string): boolean {
  if (!/^rirt_[A-Za-z0-9_-]{43}$/.test(presented) || !/^sha256:[a-f0-9]{64}$/.test(storedHash)) return false
  const candidate = Buffer.from(researchIntakeRetrievalTokenHash(presented))
  const expected = Buffer.from(storedHash)
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function researchIntakeRetrievalPath(packId: string): string {
  return `${RESEARCH_INTAKE_EVIDENCE_PACK_OFFER.path}/${packId}`
}

export function researchIntakeJobResponse(
  job: Pick<StoredResearchIntakeJob, 'public_id' | 'client_request_id' | 'input_hash' | 'status' | 'result' | 'failure_code' | 'section_count' | 'sections_completed' | 'sections_failed' | 'total_model_calls'>,
  options: { retrievalToken?: string; idempotentReplay?: boolean } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    packId: job.public_id,
    ...(options.retrievalToken ? { retrievalToken: options.retrievalToken } : {}),
    clientRequestId: job.client_request_id,
    inputHash: job.input_hash,
    status: job.status,
    idempotentReplay: Boolean(options.idempotentReplay),
    retrievalPath: researchIntakeRetrievalPath(job.public_id),
    progress: {
      sectionCount: job.section_count,
      sectionsCompleted: job.sections_completed,
      sectionsFailed: job.sections_failed,
      totalModelCalls: job.total_model_calls,
    },
  }
  if (job.status === 'completed' && job.result) base.pack = job.result
  if (job.status === 'processing') {
    base.retryAfterSeconds = 10
    base.hint = 'Replay the original paid request or poll the retrieval path. No further payment is required.'
  }
  if (job.status === 'failed') {
    base.error = {
      code: job.failure_code ?? 'research_intake_failed',
      message: 'Replay the same request and payment claim to retry only failed or missing sections of this already-paid job. Completed sections are not rerun.',
      resumable: job.sections_failed > 0,
    }
  }
  return base
}
