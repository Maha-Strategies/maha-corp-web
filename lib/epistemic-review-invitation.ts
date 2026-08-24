import { createHash, randomBytes, randomUUID } from 'node:crypto'

import {
  EXPERT_REVIEW_SCOPES,
  type ExpertReviewScope,
} from './epistemic-schema.ts'
import {
  expertReviewProfileHash,
  parseEpistemicExpertReview,
  parseExpertReviewerSnapshot,
  type ExpertReviewerSnapshot,
} from './epistemic-review.ts'
import { getEpistemicPhase4PilotEntry, EPISTEMIC_PHASE4_PILOT_VERSION } from './epistemic-pilot-corpus.ts'
import { sha256Canonical } from './epistemic-publication.ts'

export const EPISTEMIC_REVIEW_INVITATION_VERSION = 'maha-epistemic-review-invitation/1.0' as const
export const EPISTEMIC_REVIEW_INVITATION_EVENT_VERSION = 'maha-epistemic-review-invitation-event/1.0' as const

export type EpistemicReviewInvitationStatus = 'active' | 'expired' | 'consumed' | 'revoked' | 'superseded-target'

export interface EpistemicReviewInvitationInput {
  recordId: string
  domainSlug: string
  targetSha256: string
  scope: ExpertReviewScope
  reviewer: ExpertReviewerSnapshot
  note: string
  expiresAt: string
  idempotencyKey: string
}

export interface EpistemicReviewInvitation {
  schemaVersion: typeof EPISTEMIC_REVIEW_INVITATION_VERSION
  invitationId: string
  pilotManifestVersion: typeof EPISTEMIC_PHASE4_PILOT_VERSION
  recordId: string
  domainSlug: string
  targetSha256: string
  scope: ExpertReviewScope
  reviewer: ExpertReviewerSnapshot
  reviewerProfileSha256: string
  tokenSha256: string
  note: string
  expiresAt: string
  createdAt: string
  invitedByFingerprint: string
  invitationSha256: string
}

export interface EpistemicReviewInvitationCredential {
  invitation: EpistemicReviewInvitation
  token: string
}

export interface EpistemicReviewInvitationEvent {
  schemaVersion: typeof EPISTEMIC_REVIEW_INVITATION_EVENT_VERSION
  eventId: string
  invitationId: string
  action: 'consume' | 'revoke'
  reviewId: string | null
  reason: string
  actorFingerprint: string
  occurredAt: string
  eventSha256: string
}

const SHA256 = /^sha256:[a-f0-9]{64}$/
const RECORD_ID = /^urn:maha:record:[a-z0-9]+(?:-[a-z0-9]+)*$/
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const INVITATION_ID = /^epiinvite_[a-f0-9]{32}$/

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

function parseInstant(value: unknown, label: string): Date {
  const iso = line(value, label, 20, 40)
  if (!iso.endsWith('Z')) throw new Error(`${label} must be a UTC ISO-8601 timestamp.`)
  const parsed = new Date(iso)
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`)
  return parsed
}

export function epistemicReviewInvitationTokenHash(token: string): string {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`
}

export function parseEpistemicReviewInvitationRequest(
  value: unknown,
  now = new Date(),
): EpistemicReviewInvitationInput {
  if (!Number.isFinite(now.getTime())) throw new Error('now must be valid.')
  const candidate = object(value, 'invitation')
  const recordId = line(candidate.recordId, 'recordId', 10, 180)
  const domainSlug = line(candidate.domainSlug, 'domainSlug', 2, 80)
  const targetSha256 = line(candidate.targetSha256, 'targetSha256', 71, 71)
  const scope = line(candidate.scope, 'scope', 3, 40) as ExpertReviewScope
  if (!RECORD_ID.test(recordId)) throw new Error('recordId must be a Maha record URN.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(domainSlug)) throw new Error('domainSlug is invalid.')
  if (!SHA256.test(targetSha256)) throw new Error('targetSha256 must be a SHA-256 digest.')
  if (!EXPERT_REVIEW_SCOPES.includes(scope)) throw new Error('scope is unsupported.')
  const pilot = getEpistemicPhase4PilotEntry(recordId)
  if (!pilot || pilot.domainSlug !== domainSlug) throw new Error('The invitation target is outside the bounded Phase 4 pilot corpus.')
  const reviewer = parseExpertReviewerSnapshot(candidate.reviewer)
  if (!reviewer.domains.includes(domainSlug)) throw new Error('reviewer.domains must include the invitation domain.')
  const expiresAt = parseInstant(candidate.expiresAt, 'expiresAt')
  const lifetime = expiresAt.getTime() - now.getTime()
  if (lifetime < 60 * 60 * 1000 || lifetime > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('expiresAt must be between one hour and 30 days after creation.')
  }
  return {
    recordId,
    domainSlug,
    targetSha256,
    scope,
    reviewer,
    note: line(candidate.note, 'note', 20, 1000),
    expiresAt: expiresAt.toISOString(),
    idempotencyKey: line(candidate.idempotencyKey, 'idempotencyKey', 8, 160),
  }
}

export function buildEpistemicReviewInvitation(
  input: EpistemicReviewInvitationInput,
  invitedByFingerprint: string,
  createdAt = new Date(),
): EpistemicReviewInvitationCredential {
  if (!SHA256.test(invitedByFingerprint)) throw new Error('invitedByFingerprint must be a SHA-256 digest.')
  if (!Number.isFinite(createdAt.getTime())) throw new Error('createdAt must be valid.')
  const token = randomBytes(32).toString('base64url')
  const unsigned = {
    schemaVersion: EPISTEMIC_REVIEW_INVITATION_VERSION,
    invitationId: `epiinvite_${randomUUID().replaceAll('-', '')}`,
    pilotManifestVersion: EPISTEMIC_PHASE4_PILOT_VERSION,
    recordId: input.recordId,
    domainSlug: input.domainSlug,
    targetSha256: input.targetSha256,
    scope: input.scope,
    reviewer: input.reviewer,
    reviewerProfileSha256: expertReviewProfileHash(input.reviewer),
    tokenSha256: epistemicReviewInvitationTokenHash(token),
    note: input.note,
    expiresAt: input.expiresAt,
    createdAt: createdAt.toISOString(),
    invitedByFingerprint,
  }
  return { invitation: { ...unsigned, invitationSha256: sha256Canonical(unsigned) }, token }
}

export function authorizeEpistemicReviewInvitation(request: Request): { tokenSha256: string } | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  if (!token || !TOKEN.test(token)) return null
  return { tokenSha256: epistemicReviewInvitationTokenHash(token) }
}

export function parseInvitedEpistemicExpertReview(
  value: unknown,
  invitation: EpistemicReviewInvitation,
) {
  const candidate = object(value, 'review submission')
  return parseEpistemicExpertReview({
    recordId: invitation.recordId,
    domainSlug: invitation.domainSlug,
    targetSha256: invitation.targetSha256,
    scope: invitation.scope,
    reviewer: invitation.reviewer,
    criteria: candidate.criteria,
    disagreements: candidate.disagreements ?? [],
    rationale: candidate.rationale,
    supersedesReviewId: nullableLine(candidate.supersedesReviewId, 'supersedesReviewId', 42),
    idempotencyKey: candidate.idempotencyKey,
  })
}

export function buildEpistemicReviewInvitationEvent(
  input: {
    invitationId: string
    action: 'consume' | 'revoke'
    reviewId?: string | null
    reason: string
    actorFingerprint: string
  },
  occurredAt = new Date(),
): EpistemicReviewInvitationEvent {
  if (!INVITATION_ID.test(input.invitationId)) throw new Error('invitationId is invalid.')
  if (!SHA256.test(input.actorFingerprint)) throw new Error('actorFingerprint must be a SHA-256 digest.')
  if (!Number.isFinite(occurredAt.getTime())) throw new Error('occurredAt must be valid.')
  const reason = line(input.reason, 'reason', 20, 1000)
  const reviewId = input.reviewId ?? null
  if (input.action === 'consume' && !/^epireview_[a-f0-9]{32}$/.test(reviewId ?? '')) {
    throw new Error('A consumption event must identify the recorded review.')
  }
  if (input.action === 'revoke' && reviewId !== null) throw new Error('A revocation event cannot identify a review.')
  const unsigned = {
    schemaVersion: EPISTEMIC_REVIEW_INVITATION_EVENT_VERSION,
    eventId: `epiinviteevent_${randomUUID().replaceAll('-', '')}`,
    invitationId: input.invitationId,
    action: input.action,
    reviewId,
    reason,
    actorFingerprint: input.actorFingerprint,
    occurredAt: occurredAt.toISOString(),
  }
  return { ...unsigned, eventSha256: sha256Canonical(unsigned) }
}

export function epistemicReviewInvitationStatus(
  invitation: EpistemicReviewInvitation,
  event: EpistemicReviewInvitationEvent | null | undefined,
  now = new Date(),
  currentTargetSha256?: string | null,
): EpistemicReviewInvitationStatus {
  if (event?.action === 'consume') return 'consumed'
  if (event?.action === 'revoke') return 'revoked'
  if (new Date(invitation.expiresAt).getTime() <= now.getTime()) return 'expired'
  if (currentTargetSha256 && currentTargetSha256 !== invitation.targetSha256) return 'superseded-target'
  return 'active'
}

export function privateEpistemicReviewInvitationDto(
  invitation: EpistemicReviewInvitation,
  event: EpistemicReviewInvitationEvent | null | undefined,
  currentTargetSha256?: string | null,
) {
  return {
    invitationId: invitation.invitationId,
    pilotManifestVersion: invitation.pilotManifestVersion,
    recordId: invitation.recordId,
    domainSlug: invitation.domainSlug,
    targetSha256: invitation.targetSha256,
    scope: invitation.scope,
    reviewer: invitation.reviewer,
    note: invitation.note,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    status: epistemicReviewInvitationStatus(invitation, event, new Date(), currentTargetSha256),
    terminalEvent: event ? {
      action: event.action,
      reviewId: event.reviewId,
      reason: event.reason,
      occurredAt: event.occurredAt,
    } : null,
  }
}

export const EPISTEMIC_REVIEW_INVITATION_BOUNDARY = 'A reviewer invitation authorizes one versioned reviewer identity to submit one decision for one scope on one exact Phase 4 pilot hash. It grants no operations, re-ingestion, or publication authority and does not establish empirical truth.'
