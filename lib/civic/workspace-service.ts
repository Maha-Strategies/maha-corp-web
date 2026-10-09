import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import { CivicHttpError, civicInputError, civicResponse, readCivicJson } from './http.ts'
import { civicDigest } from './receipt.ts'
import { changeConsultation, changeSafetyCase, citizenCaseView, validateSafetyCase, WorkspaceError } from './workspace-engine.ts'
import { citizenCaseActionSchema, consultationActionSchema, consultationSchema, operatorCaseActionSchema, publicSummarySchema, type Consultation, type SafetyCase } from './workspace-types.ts'

export type WorkspaceRow<T> = { state: T; operationId: string | null; operationDigest: string | null }
export interface WorkspaceStore {
  lookup(kind: 'case' | 'consultation', id: string, keyHash?: string): Promise<WorkspaceRow<SafetyCase | Consultation> | null>
  list(kind: 'case' | 'consultation', before?: string): Promise<(SafetyCase | Consultation)[]>
  commit(kind: 'case' | 'consultation', state: SafetyCase | Consultation, revision: number, operationId: string, operationDigest: string, keyHash?: string): Promise<SafetyCase | Consultation>
  publicFeed(): Promise<unknown>
}
const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')
export function createWorkspaceStore(): WorkspaceStore | null {
  const client = createAgentInquiryLedger()
  if (!client) return null
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc(name, args)
    if (error) {
      if (error.message.includes('workspace_conflict')) throw new WorkspaceError('The record changed. Reload before editing.', 409)
      if (error.message.includes('workspace_access')) throw new WorkspaceError('Record unavailable or access key invalid.', 404)
      throw new WorkspaceError('The participation workspace is unavailable.', 503)
    }
    return data
  }
  return {
    lookup: (kind, id, keyHash) => call('read_civic_workspace_record', { p_kind: kind, p_id: id, p_key_hash: keyHash ?? null }),
    list: (kind, before) => call('list_civic_workspace_records', { p_kind: kind, p_before: before ?? null }),
    commit: (kind, state, revision, operationId, operationDigest, keyHash) => call('commit_civic_workspace_record', {
      p_kind: kind, p_state: state, p_revision: revision, p_operation_id: operationId, p_operation_digest: operationDigest, p_key_hash: keyHash ?? null,
    }),
    publicFeed: () => call('read_civic_public_participation'),
  }
}
export interface WorkspaceContext { store: WorkspaceStore | null; operatorToken?: string; now?: Date }
export const workspaceContext = (): WorkspaceContext => ({ store: createWorkspaceStore(), operatorToken: process.env.CIVIC_SAFETY_REVIEW_TOKEN })
function operatorAuthorized(request: Request, token?: string) {
  if (!token || token.length < 32) return false
  const supplied = Buffer.from(request.headers.get('authorization') ?? ''), expected = Buffer.from(`Bearer ${token}`)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
function errorResponse(error: unknown) {
  if (error instanceof WorkspaceError) return civicResponse({ error: error.message }, error.status)
  if (error instanceof CivicHttpError || error instanceof z.ZodError || error instanceof SyntaxError) return civicInputError(error)
  return civicResponse({ error: 'The participation workspace is unavailable. Keep your access key and retry.' }, 503)
}
function replay<T>(row: WorkspaceRow<T> | null, operationId: string, digest: string) {
  if (row?.operationId !== operationId) return false
  if (row.operationDigest !== digest) throw new WorkspaceError('An operation ID was reused for different content.', 409)
  return true
}
export async function handleCitizenCase(request: Request, context = workspaceContext()) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return civicResponse({ error: 'Use this site to access a private case.' }, 403)
  const key = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
  if (!key) return civicResponse({ error: 'A private case access key is required.' }, 401)
  if (!context.store) return errorResponse(new WorkspaceError('The private workspace is unavailable.', 503))
  try {
    const action = citizenCaseActionSchema.parse(await readCivicJson(request, 16000))
    const row = await context.store.lookup('case', action.id, hashKey(key))
    if (!row) throw new WorkspaceError('Record unavailable or access key invalid.', 404)
    const state = validateSafetyCase(row.state)
    if (action.action === 'read') return civicResponse({ case: citizenCaseView(state) })
    const digest = civicDigest({ actor: 'citizen', action })
    if (replay(row, action.operationId, digest)) return civicResponse({ case: citizenCaseView(state) })
    const changed = changeSafetyCase(state, action, 'citizen', context.now)
    const saved = await context.store.commit('case', changed, action.expectedRevision, action.operationId, digest, hashKey(key))
    return civicResponse({ case: citizenCaseView(validateSafetyCase(saved)) })
  } catch (error) { return errorResponse(error) }
}
const adminEnvelope = z.object({ kind: z.enum(['case', 'consultation']), input: z.unknown() }).strict()
export async function handleWorkspaceAdmin(request: Request, context = workspaceContext()) {
  if (!operatorAuthorized(request, context.operatorToken)) return civicResponse({ error: 'Operator authorization required.' }, 401)
  if (!context.store) return errorResponse(new WorkspaceError('The workspace is unavailable.', 503))
  try {
    const envelope = adminEnvelope.parse(await readCivicJson(request, 250000))
    if (envelope.kind === 'case') {
      const action = operatorCaseActionSchema.parse(envelope.input)
      if (action.action === 'list') {
        const states = (await context.store.list('case', action.before)).map(validateSafetyCase)
        return civicResponse({ cases: states, nextCursor: states.length === 50 ? states[49].id : null })
      }
      const row = await context.store.lookup('case', action.id)
      if (!row) throw new WorkspaceError('Case not found or expired.', 404)
      const state = validateSafetyCase(row.state)
      if (action.action === 'read') return civicResponse({ case: state })
      const digest = civicDigest({ actor: 'operator', action })
      if (replay(row, action.operationId, digest)) return civicResponse({ case: state })
      const next = changeSafetyCase(state, action, 'operator', context.now)
      return civicResponse({ case: validateSafetyCase(await context.store.commit('case', next, action.expectedRevision, action.operationId, digest)) })
    }
    const action = consultationActionSchema.parse(envelope.input)
    if (action.action === 'list') return civicResponse({ consultations: (await context.store.list('consultation')).map(item => consultationSchema.parse(item)) })
    const row = await context.store.lookup('consultation', action.id)
    const digest = civicDigest({ actor: 'operator', action })
    if (replay(row, action.operationId, digest)) return civicResponse({ consultation: consultationSchema.parse(row!.state) })
    const state = changeConsultation(row ? consultationSchema.parse(row.state) : null, action, context.now)
    return civicResponse({ consultation: consultationSchema.parse(await context.store.commit('consultation', state, action.expectedRevision, action.operationId, digest)) })
  } catch (error) { return errorResponse(error) }
}
export const participationFeedSchema = z.object({
  summaries: z.array(z.object({ summary: publicSummarySchema, digest: z.string().regex(/^[a-f0-9]{64}$/), publishedAt: z.string().datetime() }).strict()).max(100),
  consultations: z.array(consultationSchema).max(50),
}).strict()
export async function handlePublicParticipation(context = workspaceContext()) {
  if (!context.store) return civicResponse({ available: false, summaries: [], consultations: [] }, 503)
  try {
    const feed = participationFeedSchema.parse(await context.store.publicFeed())
    if (feed.summaries.some(item => civicDigest(item.summary) !== item.digest)
      || feed.consultations.some(item => item.status === 'draft' || !item.privacyReviewed || civicDigest(item.packet) !== item.packetDigest)) throw new Error('Invalid public projection.')
    return civicResponse({ available: true, ...feed, limitation: 'These are consented operator summaries and voluntary consultations, not representative public-opinion measurements.' })
  } catch { return civicResponse({ available: false, error: 'Published participation records are unavailable.', summaries: [], consultations: [] }, 503) }
}
