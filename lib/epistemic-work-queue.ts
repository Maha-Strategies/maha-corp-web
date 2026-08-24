import { randomUUID } from 'node:crypto'

import type { EpistemicExpertReview } from './epistemic-review.ts'
import { epistemicOperationsHash } from './epistemic-review.ts'
import type { ExpertReviewScope } from './epistemic-schema.ts'
import { EXPERT_REVIEW_SCOPES } from './epistemic-schema.ts'
import { sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_WORKFLOW_VERSION = 'maha-epistemic-workflow/1.0' as const

export const SOURCE_COMPLETION_ACTIONS = [
  'triage',
  'assign',
  'start',
  'submit-evidence',
  'return',
  'close',
] as const

export const SOURCE_COMPLETION_STATES = [
  'untriaged',
  'queued',
  'assigned',
  'in-progress',
  'ready-for-reingestion',
  'closed',
] as const

export type SourceCompletionAction = (typeof SOURCE_COMPLETION_ACTIONS)[number]
export type SourceCompletionState = (typeof SOURCE_COMPLETION_STATES)[number]
export type QueueLane = 'source-completion' | 'expert-review' | 'release-control'
export type QueuePriority = 'critical' | 'high' | 'normal' | 'low'

export interface CompletionEvidence {
  blockerCode: string
  sourceUrl: string
  exactLocator: string | null
  proposedValue?: string | null
  note: string
  rightsBasis: string | null
}

export interface SourceCompletionEventInput {
  recordId: string
  targetSha256: string
  action: SourceCompletionAction
  blockerCodes: string[]
  assigneeId: string | null
  assigneeName: string | null
  evidence: CompletionEvidence[]
  note: string
  idempotencyKey: string
}

export interface SourceCompletionEvent extends Omit<SourceCompletionEventInput, 'idempotencyKey'> {
  schemaVersion: typeof EPISTEMIC_WORKFLOW_VERSION
  eventId: string
  previousState: SourceCompletionState
  nextState: SourceCompletionState
  occurredAt: string
  eventSha256: string
}

export interface QueueReviewProgress {
  scopes: Partial<Record<ExpertReviewScope, {
    status: 'missing' | 'stale' | 'approved' | 'abstained' | 'changes-requested'
    latestReviewId?: string | null
    reviewedAt?: string | null
  }>>
}

export interface EpistemicQueueTarget {
  recordId: string
  domainSlug: string
  title: string
  reviewTargetSha256: string
  sourcePublicPath: string
  gateDecision: { publicEligible: boolean; reasons: string[] }
  reviewProgress?: QueueReviewProgress | null
}

export interface SourceCompletionQueueItem {
  lane: 'source-completion'
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  sourcePublicPath: string
  priority: QueuePriority
  state: SourceCompletionState
  blockers: Array<{ code: string; category: string; label: string; priority: QueuePriority }>
  assignee: { id: string; name: string } | null
  evidenceCount: number
  lastEventAt: string | null
}

export interface ExpertReviewQueueItem {
  lane: 'expert-review'
  recordId: string
  domainSlug: string
  title: string
  targetSha256: string
  sourcePublicPath: string
  scope: ExpertReviewScope
  status: 'missing' | 'stale' | 'abstained' | 'changes-requested'
  priority: QueuePriority
  latestReviewId: string | null
  reviewedAt: string | null
}

const SHA256 = /^sha256:[a-f0-9]{64}$/
const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const ASSIGNEE_ID = /^[a-z][a-z0-9_-]{7,63}$/

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`)
  return value as Record<string, unknown>
}

function line(value: unknown, label: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string.`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${label} must contain ${minimum}-${maximum} characters.`)
  return normalized
}

function nullableLine(value: unknown, label: string, maximum: number): string | null {
  if (value === null || value === undefined || value === '') return null
  return line(value, label, 1, maximum)
}

function lines(value: unknown, label: string, maximumItems: number, maximumLength: number): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`${label} must contain no more than ${maximumItems} entries.`)
  const parsed = value.map((entry, index) => line(entry, `${label}[${index}]`, 1, maximumLength))
  if (new Set(parsed).size !== parsed.length) throw new Error(`${label} cannot contain duplicates.`)
  return parsed
}

function parseEvidence(value: unknown): CompletionEvidence[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('evidence must contain no more than 50 entries.')
  return value.map((entry, index) => {
    const candidate = object(entry, `evidence[${index}]`)
    const sourceUrl = line(candidate.sourceUrl, `evidence[${index}].sourceUrl`, 8, 500)
    if (!sourceUrl.startsWith('https://')) throw new Error(`evidence[${index}].sourceUrl must use HTTPS.`)
    return {
      blockerCode: line(candidate.blockerCode, `evidence[${index}].blockerCode`, 3, 240),
      sourceUrl,
      exactLocator: nullableLine(candidate.exactLocator, `evidence[${index}].exactLocator`, 500),
      proposedValue: nullableLine(candidate.proposedValue, `evidence[${index}].proposedValue`, 4000),
      note: line(candidate.note, `evidence[${index}].note`, 20, 2000),
      rightsBasis: nullableLine(candidate.rightsBasis, `evidence[${index}].rightsBasis`, 120),
    }
  })
}

export function parseSourceCompletionEvent(value: unknown): SourceCompletionEventInput {
  const candidate = object(value, 'source completion event')
  const action = line(candidate.action, 'action', 3, 40) as SourceCompletionAction
  if (!SOURCE_COMPLETION_ACTIONS.includes(action)) throw new Error('action is unsupported.')
  const recordId = line(candidate.recordId, 'recordId', 10, 180)
  const targetSha256 = line(candidate.targetSha256, 'targetSha256', 71, 71)
  if (!RECORD_ID.test(recordId)) throw new Error('recordId must be a Maha record URN.')
  if (!SHA256.test(targetSha256)) throw new Error('targetSha256 must be a SHA-256 digest.')
  const assigneeId = nullableLine(candidate.assigneeId, 'assigneeId', 64)
  const assigneeName = nullableLine(candidate.assigneeName, 'assigneeName', 120)
  if ((assigneeId === null) !== (assigneeName === null)) throw new Error('assigneeId and assigneeName must be supplied together.')
  if (assigneeId && !ASSIGNEE_ID.test(assigneeId)) throw new Error('assigneeId must be a stable lower-case identifier.')
  return {
    recordId,
    targetSha256,
    action,
    blockerCodes: lines(candidate.blockerCodes ?? [], 'blockerCodes', 100, 240),
    assigneeId,
    assigneeName,
    evidence: parseEvidence(candidate.evidence ?? []),
    note: line(candidate.note, 'note', 20, 4000),
    idempotencyKey: line(candidate.idempotencyKey, 'idempotencyKey', 8, 160),
  }
}

export function nextSourceCompletionState(previous: SourceCompletionState, action: SourceCompletionAction): SourceCompletionState {
  const transitions: Record<SourceCompletionState, Partial<Record<SourceCompletionAction, SourceCompletionState>>> = {
    untriaged: { triage: 'queued' },
    queued: { assign: 'assigned', start: 'in-progress' },
    assigned: { assign: 'assigned', start: 'in-progress', 'submit-evidence': 'ready-for-reingestion' },
    'in-progress': { assign: 'assigned', 'submit-evidence': 'ready-for-reingestion' },
    'ready-for-reingestion': { return: 'in-progress', close: 'closed' },
    closed: {},
  }
  const next = transitions[previous][action]
  if (!next) throw new Error(`Action ${action} is not allowed from ${previous}.`)
  return next
}

export function buildSourceCompletionEvent(
  input: SourceCompletionEventInput,
  priorEvents: readonly SourceCompletionEvent[],
  gateReasons: readonly string[],
  occurredAt = new Date(),
): SourceCompletionEvent {
  if (!Number.isFinite(occurredAt.getTime())) throw new Error('occurredAt must be valid.')
  const relevant = priorEvents
    .filter((event) => event.recordId === input.recordId && event.targetSha256 === input.targetSha256)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
  const previousState = relevant.at(-1)?.nextState ?? 'untriaged'
  const nextState = nextSourceCompletionState(previousState, input.action)
  const allowedBlockers = new Set(gateReasons.filter((reason) => queueLaneForReason(reason) === 'source-completion'))
  if (!input.blockerCodes.length) throw new Error('At least one source-completion blocker is required.')
  for (const blocker of input.blockerCodes) {
    if (!allowedBlockers.has(blocker)) throw new Error(`Blocker ${blocker} is not present on this frozen target.`)
  }
  if (['assign', 'start', 'submit-evidence'].includes(input.action) && !input.assigneeId) {
    throw new Error(`Action ${input.action} requires an assignee.`)
  }
  if (input.action === 'submit-evidence') {
    if (!input.evidence.length) throw new Error('submit-evidence requires at least one evidence item.')
    const covered = new Set(input.evidence.map((entry) => entry.blockerCode))
    for (const blocker of input.blockerCodes) if (!covered.has(blocker)) throw new Error(`Evidence is missing for blocker ${blocker}.`)
  }
  const unsigned = {
    schemaVersion: EPISTEMIC_WORKFLOW_VERSION,
    eventId: `epiwork_${randomUUID().replaceAll('-', '')}`,
    recordId: input.recordId,
    targetSha256: input.targetSha256,
    action: input.action,
    previousState,
    nextState,
    blockerCodes: input.blockerCodes,
    assigneeId: input.assigneeId,
    assigneeName: input.assigneeName,
    evidence: input.evidence,
    note: input.note,
    occurredAt: occurredAt.toISOString(),
  }
  return { ...unsigned, eventSha256: sha256Canonical(unsigned) }
}

export function sourceCompletionIdempotencyHash(value: string): string {
  return epistemicOperationsHash(value)
}

export function queueLaneForReason(reason: string): QueueLane {
  if (reason === 'approval-review-missing' || reason.startsWith('expert-review-')) return 'expert-review'
  if (
    reason === 'public-promotion-not-requested'
    || reason === 'review-state-not-canonical'
    || reason === 'publication-date-missing'
    || reason === 'canonical-version-missing'
  ) return 'release-control'
  return 'source-completion'
}

export function blockerDescriptor(code: string) {
  const category = code.startsWith('source-') || code.startsWith('quotation-') ? 'source record'
    : code.startsWith('claim-') ? 'claim evidence'
      : code.startsWith('section-') ? 'content structure'
        : code.startsWith('bridge-') || code.startsWith('formal-') ? 'cross-domain bridge'
          : code.startsWith('duplicate-') || code.startsWith('invalid-') ? 'record integrity'
            : 'record boundary'
  const priority: QueuePriority = code.includes('missing') || code.includes('unresolved') ? 'high'
    : code.includes('invalid') || code.includes('duplicate') || code.includes('exceeds') ? 'critical'
      : 'normal'
  return { code, category, label: code.replaceAll(':', ' · ').replaceAll('-', ' '), priority }
}

function highestPriority(priorities: readonly QueuePriority[]): QueuePriority {
  const order: QueuePriority[] = ['critical', 'high', 'normal', 'low']
  return order.find((priority) => priorities.includes(priority)) ?? 'low'
}

export function buildSourceCompletionQueue(
  targets: readonly EpistemicQueueTarget[],
  events: readonly SourceCompletionEvent[],
): SourceCompletionQueueItem[] {
  return targets.flatMap((target) => {
    const blockers = target.gateDecision.reasons
      .filter((reason) => queueLaneForReason(reason) === 'source-completion')
      .map(blockerDescriptor)
    if (!blockers.length) return []
    const relevant = events
      .filter((event) => event.recordId === target.recordId && event.targetSha256 === target.reviewTargetSha256)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    const latest = relevant.at(-1)
    return [{
      lane: 'source-completion' as const,
      recordId: target.recordId,
      domainSlug: target.domainSlug,
      title: target.title,
      targetSha256: target.reviewTargetSha256,
      sourcePublicPath: target.sourcePublicPath,
      priority: highestPriority(blockers.map((blocker) => blocker.priority)),
      state: latest?.nextState ?? 'untriaged',
      blockers,
      assignee: latest?.assigneeId && latest.assigneeName ? { id: latest.assigneeId, name: latest.assigneeName } : null,
      evidenceCount: relevant.reduce((total, event) => total + event.evidence.length, 0),
      lastEventAt: latest?.occurredAt ?? null,
    }]
  }).sort((left, right) => left.state.localeCompare(right.state) || left.title.localeCompare(right.title))
}

export function buildExpertReviewQueue(
  targets: readonly EpistemicQueueTarget[],
  reviews: readonly EpistemicExpertReview[],
): ExpertReviewQueueItem[] {
  return targets.flatMap((target) => {
    const progress = target.reviewProgress?.scopes ?? {}
    return EXPERT_REVIEW_SCOPES.flatMap((scope) => {
      const scoped = progress[scope]
      if (scoped?.status === 'approved') return []
      const latest = reviews
        .filter((review) => review.recordId === target.recordId && review.targetSha256 === target.reviewTargetSha256 && review.scope === scope)
        .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt))
        .at(-1)
      const status = scoped?.status ?? 'missing'
      const priority: QueuePriority = status === 'changes-requested' ? 'critical' : status === 'stale' ? 'high' : 'normal'
      return [{
        lane: 'expert-review' as const,
        recordId: target.recordId,
        domainSlug: target.domainSlug,
        title: target.title,
        targetSha256: target.reviewTargetSha256,
        sourcePublicPath: target.sourcePublicPath,
        scope,
        status,
        priority,
        latestReviewId: latest?.reviewId ?? scoped?.latestReviewId ?? null,
        reviewedAt: latest?.reviewedAt ?? scoped?.reviewedAt ?? null,
      }]
    })
  }).sort((left, right) => left.status.localeCompare(right.status) || left.title.localeCompare(right.title) || left.scope.localeCompare(right.scope))
}

export function buildQueueSummary(source: readonly SourceCompletionQueueItem[], expert: readonly ExpertReviewQueueItem[]) {
  return {
    sourceRecords: source.length,
    untriaged: source.filter((item) => item.state === 'untriaged').length,
    active: source.filter((item) => ['queued', 'assigned', 'in-progress'].includes(item.state)).length,
    readyForReingestion: source.filter((item) => item.state === 'ready-for-reingestion').length,
    expertScopes: expert.length,
    expertChangesRequested: expert.filter((item) => item.status === 'changes-requested').length,
    expertStale: expert.filter((item) => item.status === 'stale').length,
  }
}

export const EPISTEMIC_WORK_QUEUE_BOUNDARY = 'Queue state coordinates source completion and expert review against a frozen candidate. Evidence submission does not alter the candidate, satisfy the publication gate, or create a public page; corrected content must be re-ingested and reviewed under its new hash.'
