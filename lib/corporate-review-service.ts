import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createPractitionerReviewClient } from './practitioner-review-store.ts'
import { authorizePractitionerReview } from './practitioner-review.ts'
import { buildCorporateReport, type CorporateReportInput } from './corporate-report.ts'
import { CORPORATE_RULES, corporateRuleDigest, corporateEventDigest, type CorporateTrust, type CorporateReview, type EventReview } from './corporate-synthesis.ts'
import { digestOf } from './celestial-hypotheses/canonical.ts'

export type ReviewRow = { kind: 'rule' | 'event'; target: string; grantHash: string | null; expiresAt: string | null; snapshot: CorporateReview | EventReview; actorFingerprint: string; attestations: Record<string, boolean> }
export interface CorporateReviewStore { append(row: ReviewRow, idempotencyKey: string): Promise<void>; rules(): Promise<ReviewRow[]>; events(target: string, grantHash: string): Promise<ReviewRow[]> }
const hash = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`
const seal = <T extends object>(body: T) => ({ ...body, recordDigest: digestOf(body) })
const exactToken = (request: Request, expected?: string) => {
  const actual = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  return !!expected && expected.length >= 32 && !!actual && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}
export const CORPORATE_PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }
export function createCorporateReviewStore(): CorporateReviewStore | null {
  const client = createPractitionerReviewClient()
  if (!client) return null
  const read = async (kind: string, target?: string, grantHash?: string) => {
    let q = client.from('corporate_review_records').select('record_snapshot').eq('kind', kind)
    if (target) q = q.eq('target', target)
    if (grantHash) q = q.eq('grant_hash', grantHash)
    const { data, error } = await q.order('created_at', { ascending: true }).limit(1001)
    if (error || !data || data.length > 1000) throw new Error('review-store-unavailable')
    return data.map(r => r.record_snapshot as ReviewRow)
  }
  return {
    async append(row, idempotencyKey) {
      const { error } = await client.rpc('append_corporate_review', { p_record: row, p_idempotency_hash: hash(`${row.actorFingerprint}:${idempotencyKey}`), p_request_digest: digestOf(row) })
      if (error) throw new Error('review-write-refused')
    },
    rules: () => read('rule'), events: (target, grantHash) => read('event', target, grantHash),
  }
}
export async function readCorporateTrust(input: CorporateReportInput, privateGrant: string, store: CorporateReviewStore | null, now = new Date()): Promise<CorporateTrust> {
  if (!store) return {}
  const rules = await store.rules()
  let events: ReviewRow[] = []
  if (privateGrant) {
    if (!/^[a-f0-9]{64}$/.test(privateGrant)) throw new Error('invalid-private-receipt')
    events = await store.events(corporateEventDigest(input), hash(privateGrant))
    if (!events.length) throw new Error('invalid-private-receipt')
  }
  // Never fall back to old approvals when the latest event receipt expires.
  const latestTime = Math.max(...events.map(row => Date.parse(row.snapshot.reviewedAt)))
  const latest = events.filter(row => Date.parse(row.snapshot.reviewedAt) === latestTime)
  const current = latest.length > 0 && latest.every(row => row.expiresAt && Date.parse(row.expiresAt) > now.getTime())
  const eventReviews = current ? events.map(row => row.snapshot as EventReview) : []
  return { ruleReviews: rules.filter(r => r.kind === 'rule').map(r => r.snapshot as CorporateReview), eventReviews }
}

async function boundedJson(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new Error('missing-body')
  const chunks: Uint8Array[] = []; let length = 0
  while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 750_000) { await reader.cancel(); throw new Error('body-too-large') } chunks.push(part.value) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}
// Authenticated POST only; documents are decoded and hashed in memory, not saved.
export async function handleCorporateReview(request: Request, storeFactory = createCorporateReviewStore, now = new Date()) {
  const respond = (body: unknown, status: number) => Response.json(body, { status, headers: CORPORATE_PRIVATE_HEADERS })
  if (request.method !== 'POST' || new URL(request.url).search) return respond({ error: 'post-without-query-required' }, 405)
  const practitioner = authorizePractitionerReview(request)
  const maha = exactToken(request, process.env.MAHA_ANALOGY_APPROVAL_TOKEN)
  const verifier = exactToken(request, process.env.CORPORATE_EVENT_REVIEW_TOKEN)
  if (!practitioner.authorized && !maha && !verifier) return respond({ error: 'unauthorized' }, 401)
  if (!request.headers.get('content-type')?.startsWith('application/json')) return respond({ error: 'json-required' }, 415)
  let body: Record<string, unknown>
  try { body = await boundedJson(request) } catch { return respond({ error: 'invalid-or-oversized-body' }, 400) }
  const key = request.headers.get('idempotency-key')
  if (!key || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) return respond({ error: 'idempotency-key-required' }, 400)
  const reviewedAt = now.toISOString(), reviewId = `corpreview_${randomUUID()}`
  const actorFingerprint = hash(request.headers.get('authorization')!)
  let row: ReviewRow; let privateGrant: string | undefined
  try {
    if (body.kind === 'rule') {
      const rule = CORPORATE_RULES.find(r => r.id === body.ruleId)
      if (!rule || body.targetDigest !== corporateRuleDigest(rule)) throw new Error('stale-or-unknown-rule')
      if (rule.layer === 'traditional' ? !practitioner.authorized : !maha) return respond({ error: 'wrong-review-authority' }, 403)
      if (!['accepted', 'revise'].includes(String(body.decision))) throw new Error('invalid-decision')
      if (body.decision === 'accepted' && (body.sourceRead !== true || body.prerequisitesChecked !== true || body.boundariesChecked !== true || body.qualifiedForScope !== true)) throw new Error('explicit-scoped-attestations-required')
      const snapshot = seal({ reviewId, ruleId: rule.id, targetDigest: corporateRuleDigest(rule), layer: rule.layer, scope: rule.layer === 'traditional' ? 'source-and-rule' as const : 'maha-analogy-approval' as const, decision: body.decision as 'accepted' | 'revise', reviewedAt })
      row = { kind: 'rule', target: rule.id, grantHash: null, expiresAt: null, snapshot, actorFingerprint, attestations: { sourceRead: body.sourceRead === true, prerequisitesChecked: body.prerequisitesChecked === true, boundariesChecked: body.boundariesChecked === true, qualifiedForScope: body.qualifiedForScope === true } }
    } else if (body.kind === 'event') {
      if (!verifier) return respond({ error: 'wrong-review-authority' }, 403)
      if (body.consentToRetainFingerprints !== true || !['inspected-record', 'revise'].includes(String(body.decision))) throw new Error('consent-and-decision-required')
      const input = body.input as CorporateReportInput
      buildCorporateReport(input) // same event validation as the visitor flow
      if (!input.evidenceAttachment || !['certificate-issued', 'filing-accepted'].includes(input.eventType)) throw new Error('formation-document-required')
      if (body.decision === 'inspected-record') {
        if (body.recordRead !== true || body.eventTypeChecked !== true || body.timePrecisionChecked !== true || body.locationBasisChecked !== true) throw new Error('event-inspection-required')
        if (typeof body.documentBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.documentBase64)) throw new Error('document-required')
        const bytes = Buffer.from(body.documentBase64, 'base64')
        if (!bytes.length || bytes.length > 500_000 || bytes.length !== input.evidenceAttachment.byteLength || `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== input.evidenceAttachment.sha256) throw new Error('document-mismatch')
      }
      if (body.privateGrant !== undefined && (typeof body.privateGrant !== 'string' || !/^[a-f0-9]{64}$/.test(body.privateGrant))) throw new Error('invalid-private-receipt')
      if (body.decision === 'revise' && !body.privateGrant) throw new Error('revocation-requires-receipt')
      privateGrant = body.privateGrant as string || randomBytes(32).toString('hex')
      const snapshot = seal({ reviewId, eventDigest: corporateEventDigest(input), documentDigest: input.evidenceAttachment.sha256, decision: body.decision as 'inspected-record' | 'revise', reviewedAt })
      row = { kind: 'event', target: snapshot.eventDigest, grantHash: hash(privateGrant), expiresAt: new Date(now.getTime() + 30 * 86400000).toISOString(), snapshot, actorFingerprint, attestations: { consentToRetainFingerprints: true, recordRead: body.recordRead === true, eventTypeChecked: body.eventTypeChecked === true, timePrecisionChecked: body.timePrecisionChecked === true, locationBasisChecked: body.locationBasisChecked === true } }
    } else throw new Error('unknown-review-kind')
  } catch { return respond({ error: 'review-validation-failed' }, 400) }
  const store = storeFactory()
  if (!store) return respond({ error: 'review-store-unavailable' }, 503)
  try { await store.append(row, key) } catch { return respond({ error: 'review-write-refused' }, 409) }
  return respond({ reviewId, target: row.target, ...(privateGrant ? { privateGrant, expiresAt: row.expiresAt } : {}), boundary: 'Scoped operator attestation; not a legal opinion, product endorsement or empirical validation.' }, 201)
}
