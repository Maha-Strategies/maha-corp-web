import { GWSG_HALTED_STATES, GWSG_TERMINAL_STATES, type GwsgState } from './types.ts'

/**
 * The reference state machine.
 *
 * Encoded as an explicit adjacency map rather than a set of guard clauses so
 * that the legal shape of a workflow is one readable object, and so that
 * "which states can reach `action_authorized`" is answerable by reading rather
 * than by tracing conditionals.
 */
export const GWSG_TRANSITIONS: Record<GwsgState, readonly GwsgState[]> = {
  draft: ['evidence_collected', 'needs_human_review', 'failed_recoverable', 'failed_final'],
  evidence_collected: ['policy_evaluated', 'needs_human_review', 'failed_recoverable', 'failed_final'],
  // A policy evaluation may end in denial, may require approval, or — where no
  // approval is required — may authorize directly. It can never skip to
  // `action_completed`: an action has to be authorized before it can complete.
  policy_evaluated: ['approval_pending', 'approved', 'denied', 'needs_human_review', 'failed_recoverable', 'failed_final'],
  approval_pending: ['approved', 'denied', 'expired', 'needs_human_review', 'failed_recoverable', 'failed_final'],
  approved: ['action_authorized', 'denied', 'expired', 'needs_human_review', 'failed_recoverable', 'failed_final'],
  action_authorized: ['action_completed', 'failed_recoverable', 'failed_final', 'needs_human_review', 'replay_blocked'],
  action_completed: ['closed', 'needs_human_review', 'failed_final'],
  closed: [],
  denied: [],
  expired: ['needs_human_review', 'failed_final'],
  // Recoverable failure returns to the last safe checkpoint, or escalates.
  failed_recoverable: ['evidence_collected', 'policy_evaluated', 'needs_human_review', 'failed_final'],
  failed_final: [],
  needs_human_review: ['policy_evaluated', 'approval_pending', 'denied', 'closed', 'failed_final'],
  replay_blocked: ['needs_human_review', 'failed_final'],
}

/**
 * States a recovery may resume from.
 *
 * `action_authorized` is absent deliberately. Once an action is authorized the
 * side effect may already have happened, so resuming there risks a second one;
 * that path routes to `indeterminate_side_effect` instead.
 */
export const GWSG_SAFE_CHECKPOINTS: readonly GwsgState[] = ['evidence_collected', 'policy_evaluated', 'approved'] as const

export function isTerminal(state: GwsgState): boolean {
  return GWSG_TERMINAL_STATES.includes(state)
}

export function isHalted(state: GwsgState): boolean {
  return GWSG_HALTED_STATES.includes(state)
}

export function canTransition(from: GwsgState, to: GwsgState): boolean {
  return GWSG_TRANSITIONS[from].includes(to)
}

/** States that require an action to have been authorized first. */
export function requiresPriorAuthorization(state: GwsgState): boolean {
  return state === 'action_completed'
}
