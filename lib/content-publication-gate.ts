import { createHash, randomUUID } from 'node:crypto'

export const CONTENT_TOPIC_CLUSTERS = ['mps_claim_verification', 'research_intelligence', 'document_data_extraction', 'receipt_operations', 'ai_infrastructure'] as const
export const CONTENT_CANDIDATE_ACTIONS = ['approve_draft', 'withhold_noindex', 'reject'] as const
type ContentTopicCluster = typeof CONTENT_TOPIC_CLUSTERS[number]
type ContentCandidateAction = typeof CONTENT_CANDIDATE_ACTIONS[number]
type EvidenceType = 'primary' | 'official' | 'public_data' | 'internal'

export type ContentEvidence = { url: string; title: string; sourceType: EvidenceType; publishedOn: string; note: string }
export type PolicyChecks = { readerFirst: boolean; originalAnalysis: boolean; notDoorway: boolean; attributionComplete: boolean; sourceIndependenceReviewed: boolean; humanReviewRequired: boolean }

function line(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max || /[\r\n]/.test(parsed)) throw new Error(`${field} must contain between ${min} and ${max} characters on one line.`)
  return parsed
}
function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new Error(`${field} must be an ISO date.`)
  return value
}
function evidence(value: unknown): ContentEvidence[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) throw new Error('evidence must contain between 3 and 5 sources.')
  const parsed = value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`evidence[${index}] must be an object.`)
    const record = item as Record<string, unknown>
    const rawUrl = line(record.url, `evidence[${index}].url`, 8, 2_000)
    let url: URL
    try { url = new URL(rawUrl) } catch { throw new Error(`evidence[${index}].url must be an absolute HTTPS URL.`) }
    if (url.protocol !== 'https:') throw new Error(`evidence[${index}].url must be an absolute HTTPS URL.`)
    if (record.sourceType !== 'primary' && record.sourceType !== 'official' && record.sourceType !== 'public_data' && record.sourceType !== 'internal') throw new Error(`evidence[${index}].sourceType is not supported.`)
    return { url: url.toString(), title: line(record.title, `evidence[${index}].title`, 3, 240), sourceType: record.sourceType as EvidenceType, publishedOn: date(record.publishedOn, `evidence[${index}].publishedOn`), note: line(record.note, `evidence[${index}].note`, 10, 750) }
  })
  if (new Set(parsed.map((item) => new URL(item.url).hostname)).size < 3) throw new Error('evidence must use at least 3 independent source domains.')
  return parsed
}
function policyChecks(value: unknown): PolicyChecks {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('policyChecks must be an object.')
  const record = value as Record<string, unknown>
  const requiredKeys = ['readerFirst', 'originalAnalysis', 'notDoorway', 'attributionComplete', 'humanReviewRequired'] as const
  const parsed = Object.fromEntries(requiredKeys.map((key) => {
    if (typeof record[key] !== 'boolean') throw new Error(`policyChecks.${key} must be a boolean.`)
    return [key, record[key]]
  })) as Omit<PolicyChecks, 'sourceIndependenceReviewed'>
  // An older deployed form may not know this newer review control. It may
  // still record a candidate, but it must fail closed as evidence_collecting.
  if (record.sourceIndependenceReviewed !== undefined && typeof record.sourceIndependenceReviewed !== 'boolean') throw new Error('policyChecks.sourceIndependenceReviewed must be a boolean.')
  return { ...parsed, sourceIndependenceReviewed: record.sourceIndependenceReviewed === true }
}

export function contentCandidateId() { return `contentcand_${randomUUID().replaceAll('-', '')}` }
export function contentCandidateHash(value: string) { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

export function contentQualityScore(input: { evidence: ContentEvidence[]; policyChecks: PolicyChecks; originalValue: string; readerOutcome: string }, now = new Date()): number {
  const sourceScore = input.evidence.length >= 5 ? 40 : input.evidence.length === 4 ? 35 : 30
  const evidenceTypeScore = input.evidence.some((item) => item.sourceType === 'primary' || item.sourceType === 'official' || item.sourceType === 'public_data') ? 10 : 0
  const freshCutoff = new Date(now); freshCutoff.setUTCFullYear(freshCutoff.getUTCFullYear() - 1)
  const freshnessScore = input.evidence.some((item) => new Date(`${item.publishedOn}T00:00:00.000Z`) >= freshCutoff) ? 10 : 0
  const policyScore = Object.values(input.policyChecks).every(Boolean) ? 10 : 0
  const valueScore = input.originalValue.length >= 120 && input.readerOutcome.length >= 50 ? 30 : input.originalValue.length >= 80 ? 20 : 10
  return sourceScore + evidenceTypeScore + freshnessScore + policyScore + valueScore
}

export function parseContentCandidate(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.topicCluster !== 'string' || !CONTENT_TOPIC_CLUSTERS.includes(body.topicCluster as ContentTopicCluster)) throw new Error('topicCluster is not supported.')
  const proposedPath = line(body.proposedPath, 'proposedPath', 3, 181)
  if (!/^\/[a-z0-9][a-z0-9/-]{1,180}$/.test(proposedPath) || proposedPath.endsWith('/')) throw new Error('proposedPath must be a lowercase Maha path without a trailing slash.')
  const parsedEvidence = evidence(body.evidence)
  const parsedPolicyChecks = policyChecks(body.policyChecks)
  const readerQuestion = line(body.readerQuestion, 'readerQuestion', 20, 500)
  const readerOutcome = line(body.readerOutcome, 'readerOutcome', 20, 750)
  const originalValue = line(body.originalValue, 'originalValue', 40, 1_500)
  return { topicCluster: body.topicCluster as ContentTopicCluster, proposedPath, readerQuestion, readerOutcome, originalValue, authorAttribution: line(body.authorAttribution, 'authorAttribution', 3, 160), evidence: parsedEvidence, policyChecks: parsedPolicyChecks, qualityScore: contentQualityScore({ evidence: parsedEvidence, policyChecks: parsedPolicyChecks, originalValue, readerOutcome }), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}

export function parseContentCandidateAction(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  if (typeof body.action !== 'string' || !CONTENT_CANDIDATE_ACTIONS.includes(body.action as ContentCandidateAction)) throw new Error('action is not supported.')
  const candidateId = line(body.candidateId, 'candidateId', 12, 80)
  if (!/^contentcand_[a-f0-9]{32}$/.test(candidateId)) throw new Error('candidateId is not valid.')
  return { candidateId, action: body.action as ContentCandidateAction, note: body.note === undefined || body.note === '' ? '' : line(body.note, 'note', 3, 2_000), idempotencyKey: line(body.idempotencyKey, 'idempotencyKey', 8, 120) }
}
