import { DOSSIER_REVIEW_STATES, isLegalReviewTransition, type DossierReviewState } from './schema.ts'
import type { DossierPackage } from './package.ts'

/**
 * Revision workflow.
 *
 * draft -> validate -> internally audited -> revised draft.
 *
 * Canonical promotion is not reachable through the operator at all: it is
 * refused here regardless of the review-state ladder, because canonical status
 * requires an authority this tool deliberately does not hold.
 */

export const OPERATOR_FORBIDDEN_STATES: readonly DossierReviewState[] = ['canonical', 'externally-reviewed']

export interface TransitionRequest {
  from: DossierPackage
  toState: DossierReviewState
  decision?: { decision: string; rationale: string; decidedBy: 'internal-editorial'; decidedAt: string }
}

export interface TransitionRefusal {
  code: string
  message: string
}

export function refuseTransition(request: TransitionRequest): TransitionRefusal | null {
  const { from, toState, decision } = request

  if (!DOSSIER_REVIEW_STATES.includes(toState)) {
    return { code: 'unknown-state', message: `${toState} is not a declared review state.` }
  }

  if (OPERATOR_FORBIDDEN_STATES.includes(toState)) {
    return {
      code: 'state-not-operator-reachable',
      message:
        `${toState} cannot be set by the operator tool. External review and canonical status require an ` +
        'authority this tool does not hold, and claiming either here would misrepresent the record.',
    }
  }

  // Returning to draft after an audit is a legitimate revision, not a downgrade.
  const revisedDraft = from.reviewState === 'internally-audited' && toState === 'illustrative-draft'
  if (!revisedDraft && !isLegalReviewTransition(from.reviewState, toState)) {
    return {
      code: 'illegal-transition',
      message: `${from.reviewState} to ${toState} is not a single legal step.`,
    }
  }

  if (toState === 'internally-audited') {
    if (!decision) {
      return { code: 'decision-required', message: 'Internal audit requires a recorded reviewer decision.' }
    }
    if (!decision.rationale || decision.rationale.trim().length < 20) {
      return { code: 'rationale-required', message: 'A reviewer decision requires a substantive rationale.' }
    }
    if (decision.decidedBy !== 'internal-editorial') {
      return { code: 'reviewer-kind-invalid', message: 'Only internal-editorial decisions may be recorded.' }
    }
  }

  return null
}

/** True when the evidence changed, which requires a new revision and digest. */
export function requiresNewRevision(previous: DossierPackage, next: DossierPackage): boolean {
  return previous.canonicalPayloadDigest !== next.canonicalPayloadDigest
}
