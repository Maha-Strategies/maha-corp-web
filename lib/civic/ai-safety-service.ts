import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { aiSafetyRecordSchema, aiSafetyReviewSchema, aiSafetySubmissionSchema, type AiSafetyRecord, type AiSafetySubmission } from './ai-safety.ts'
import { civicDigest, immutableSnapshot } from './receipt.ts'
import { CivicHttpError, civicInputError, civicResponse, readCivicJson } from './http.ts'
import { initialSafetyCase } from './workspace-engine.ts'

export function makeAiSafetyRecord(input: AiSafetySubmission, now = new Date()): AiSafetyRecord {
  const submission = aiSafetySubmissionSchema.parse(input)
  const payload = { version: 'civic-ai-safety-1' as const, id: submission.submissionId,
    receivedAt: now.toISOString(), submissionDigest: civicDigest(submission) }
  return immutableSnapshot({ receipt: { ...payload, digest: civicDigest(payload) }, submission, status: 'received', review: null })
}
export function verifyAiSafetyRecord(input: unknown): AiSafetyRecord {
  const record = aiSafetyRecordSchema.parse(input)
  const { digest, ...payload } = record.receipt
  if (record.receipt.id !== record.submission.submissionId || civicDigest(record.submission) !== payload.submissionDigest
    || civicDigest(payload) !== digest || (record.status === 'received') !== (record.review === null)) throw new Error('Invalid private receipt.')
  return immutableSnapshot(record)
}
export interface AiSafetyStore {
  supportsCaseAccess?: boolean
  ready(): Promise<boolean>
  submit(record: AiSafetyRecord, visitorHash: string, caseKeyHash?: string): Promise<AiSafetyRecord>
  list(before?: string): Promise<AiSafetyRecord[]>
  review(input: ReturnType<typeof aiSafetyReviewSchema.parse>): Promise<AiSafetyRecord | null>
}
export class AiSafetyStoreError extends Error {
  kind: 'rate-limited' | 'conflict' | 'unavailable'
  constructor(kind: 'rate-limited' | 'conflict' | 'unavailable') { super(kind); this.kind = kind }
}
export function createAiSafetyStore(): AiSafetyStore | null {
  const client = createAgentInquiryLedger()
  if (!client) return null
  return {
    supportsCaseAccess: true,
    async ready() {
      const { data, error } = await client.rpc('civic_workspace_version')
      return !error && data === 1
    },
    async submit(record, visitorHash, caseKeyHash) {
      if (!caseKeyHash) throw new AiSafetyStoreError('unavailable')
      const { data, error } = await client.rpc('submit_civic_safety_case', { p_record: record, p_visitor_hash: visitorHash,
        p_key_hash: caseKeyHash, p_state: initialSafetyCase(record) })
      if (error) throw new AiSafetyStoreError(error.message.includes('safety_rate_limited') ? 'rate-limited' : error.message.includes('safety_id_conflict') ? 'conflict' : 'unavailable')
      return verifyAiSafetyRecord(data)
    },
    async list(before) {
      const { data, error } = await client.rpc('read_civic_safety_inbox', { p_before: before ?? null })
      if (error || !Array.isArray(data) || data.length > 50) throw new AiSafetyStoreError('unavailable')
      return data.map(verifyAiSafetyRecord)
    },
    async review(input) {
      const { data, error } = await client.rpc('review_civic_safety_concern', { p_id: input.id, p_status: input.status, p_note: input.note })
      if (error) throw new AiSafetyStoreError('unavailable')
      return data === null ? null : verifyAiSafetyRecord(data)
    },
  }
}
export interface AiSafetyContext {
  store: AiSafetyStore | null; enabled: boolean; secret?: string; operatorToken?: string; trustedVercelProxy?: boolean; now?: Date
}
export function aiSafetyContext(): AiSafetyContext {
  return { store: createAiSafetyStore(), enabled: process.env.CIVIC_SAFETY_INTAKE_ENABLED === 'true',
    secret: process.env.CIVIC_SAFETY_RATE_LIMIT_SECRET, operatorToken: process.env.CIVIC_SAFETY_REVIEW_TOKEN,
    trustedVercelProxy: process.env.VERCEL === '1' }
}
function configured(context: AiSafetyContext) {
  return context.enabled && !!context.store && (context.secret?.length ?? 0) >= 32 && (context.operatorToken?.length ?? 0) >= 32
}
const unavailable = () => civicResponse({ error: 'The private AI safety inbox is unavailable. Submission could not be confirmed; keep your draft and retry later.' }, 503)

export async function safetyIntakeStatus(context = aiSafetyContext()) {
  let accepting = false
  try { accepting = !!configured(context) && await context.store!.ready() } catch { /* Fail closed. */ }
  return civicResponse({ accepting, storage: 'private-operator-inbox', publishesAutomatically: false,
    usesGenerativeAi: false, responseGuaranteed: false })
}
export async function submitSafetyConcern(request: Request, context = aiSafetyContext()) {
  if (!configured(context)) return unavailable()
  const accessKey = request.headers.get('x-civic-case-key')
  if (context.store?.supportsCaseAccess && !accessKey?.match(/^[a-f0-9]{64}$/)) return civicResponse({ error: 'Create and retain a private case access key before submitting.' }, 400)
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return civicResponse({ error: 'Submit from this site.' }, 403)
  let submission: AiSafetySubmission
  try { submission = aiSafetySubmissionSchema.parse(await readCivicJson(request, 24000)) }
  catch (error) { return civicInputError(error) }
  const now = context.now ?? new Date()
  // Only trust the hosting platform's header. Other hosts share a conservative bucket.
  const ip = context.trustedVercelProxy ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'shared-host'
  const visitorHash = createHmac('sha256', context.secret!).update(`${now.toISOString().slice(0, 10)}\n${ip}`).digest('hex')
  try {
    const stored = verifyAiSafetyRecord(await context.store!.submit(makeAiSafetyRecord(submission, now), visitorHash,
      accessKey ? createHash('sha256').update(accessKey).digest('hex') : undefined))
    if (stored.receipt.submissionDigest !== civicDigest(submission)) throw new AiSafetyStoreError('unavailable')
    return civicResponse({ status: 'received', receipt: stored.receipt,
      message: 'Saved to the private operator review inbox. This acknowledgment does not verify the concern or guarantee a response.' }, 201)
  } catch (error) {
    if (error instanceof AiSafetyStoreError && error.kind === 'rate-limited') return civicResponse({ error: 'The submission limit has been reached. Keep your draft and try again after the next UTC day.' }, 429)
    if (error instanceof AiSafetyStoreError && error.kind === 'conflict') return civicResponse({ error: 'This submission ID already belongs to a different draft. Start a new submission.' }, 409)
    return unavailable()
  }
}
function authorized(request: Request, context: AiSafetyContext) {
  if (!context.operatorToken || context.operatorToken.length < 32) return false
  const actual = Buffer.from(request.headers.get('authorization') ?? ''), expected = Buffer.from(`Bearer ${context.operatorToken}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export async function safetyInbox(request: Request, context = aiSafetyContext()) {
  if (!authorized(request, context)) return civicResponse({ error: 'Operator authorization required.' }, 401)
  if (!context.store) return unavailable()
  try {
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams
      if ([...query.keys()].some(key => key !== 'before')) throw new CivicHttpError('Unknown query parameter.', 400)
      const before = query.get('before') ?? undefined
      if (before !== undefined) aiSafetyRecordSchema.shape.receipt.shape.id.parse(before)
      const records = (await context.store.list(before)).map(verifyAiSafetyRecord)
      return civicResponse({ records, nextCursor: records.length === 50 ? records[49].receipt.id : null })
    }
    const input = aiSafetyReviewSchema.parse(await readCivicJson(request, 12000))
    const record = await context.store.review(input)
    return record ? civicResponse({ record: verifyAiSafetyRecord(record) }) : civicResponse({ error: 'Concern not found or expired.' }, 404)
  } catch (error) {
    if (error instanceof CivicHttpError || error instanceof SyntaxError || (error instanceof Error && error.name === 'ZodError')) return civicInputError(error)
    return unavailable()
  }
}
