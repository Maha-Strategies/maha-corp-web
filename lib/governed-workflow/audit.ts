import { sanitizeEvidenceReference } from './evidence.ts'
import type { EvidenceReference, GwsgTransition, UncertaintyDeclaration } from './types.ts'

/**
 * The sanitized projection.
 *
 * Every API response and every rendered view goes through this module. The
 * durable event shape already cannot hold document text, but a caller can
 * still attach content to a *response* by assembling one by hand. Routing all
 * output through one projection makes the metadata-only guarantee a property
 * of a single function that tests can attack directly.
 */

export type SanitizedTransition = {
  transitionId: string
  sequence: number
  priorState: GwsgTransition['priorState']
  nextState: GwsgTransition['nextState']
  occurredAt: string
  actor: { actorKind: GwsgTransition['actor']['actorKind']; actorRole: string; actorIdSha256: string }
  policyVersion: string
  policySha256: string
  inputSha256: string
  evidenceSetSha256: string
  evidenceRefs: { evidenceId: string; contentSha256: string }[]
  uncertaintyStatus: GwsgTransition['uncertaintyStatus']
  authorizationResult: GwsgTransition['authorizationResult']
  approvalState: GwsgTransition['approvalState']
  recoveryClassification: GwsgTransition['recoveryClassification']
  reasonCodes: GwsgTransition['reasonCodes']
  sideEffect: {
    intent: { intentId: string; operation: string; requestSha256: string; simulated: true } | null
    receipt: { intentId: string; receiptId: string; outcome: string; responseSha256: string | null; observedAt: string; simulated: true } | null
  }
  previousTransitionSha256: string | null
  transitionSha256: string
}

export function sanitizeTransition(event: GwsgTransition): SanitizedTransition {
  return {
    transitionId: event.transitionId,
    sequence: event.sequence,
    priorState: event.priorState,
    nextState: event.nextState,
    occurredAt: event.occurredAt,
    actor: { actorKind: event.actor.actorKind, actorRole: event.actor.actorRole, actorIdSha256: event.actor.actorIdSha256 },
    policyVersion: event.policyVersion,
    policySha256: event.policySha256,
    inputSha256: event.inputSha256,
    evidenceSetSha256: event.evidenceSetSha256,
    evidenceRefs: event.evidenceRefs.map((entry) => ({ evidenceId: entry.evidenceId, contentSha256: entry.contentSha256 })),
    uncertaintyStatus: event.uncertaintyStatus,
    authorizationResult: event.authorizationResult,
    approvalState: event.approvalState,
    recoveryClassification: event.recoveryClassification,
    reasonCodes: event.reasonCodes,
    sideEffect: {
      intent: event.sideEffect.intent ? { ...event.sideEffect.intent } : null,
      receipt: event.sideEffect.receipt ? { ...event.sideEffect.receipt } : null,
    },
    previousTransitionSha256: event.previousTransitionSha256,
    transitionSha256: event.transitionSha256,
  }
}

export function sanitizeTimeline(events: GwsgTransition[]): SanitizedTransition[] {
  return events.map(sanitizeTransition)
}

/** Uncertainty notes are authored by the workflow operator, not extracted. */
export function sanitizeUncertainty(entry: UncertaintyDeclaration) {
  return { uncertaintyId: entry.uncertaintyId, kind: entry.kind, blocksAutomatedDecision: entry.blocksAutomatedDecision, note: entry.note }
}

export function sanitizeEvidence(evidence: EvidenceReference[]) {
  return evidence.map(sanitizeEvidenceReference)
}

/**
 * Bounds every string a projection can carry.
 *
 * The retention guarantee is "references, digests, bounded classifications and
 * caller-supplied safe metadata". Length is the practical enforcement: a
 * digest is 71 characters and a state name is shorter, so anything long enough
 * to be a sentence of source text does not fit. Tests run this over every
 * fixture and every API response.
 */
export const MAX_PROJECTION_STRING_LENGTH = 200

export function findUnboundedStrings(value: unknown, path = '$'): { path: string; length: number }[] {
  if (typeof value === 'string') {
    return value.length > MAX_PROJECTION_STRING_LENGTH ? [{ path, length: value.length }] : []
  }
  if (Array.isArray(value)) return value.flatMap((entry, index) => findUnboundedStrings(entry, `${path}[${index}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => findUnboundedStrings(entry, `${path}.${key}`))
  }
  return []
}
