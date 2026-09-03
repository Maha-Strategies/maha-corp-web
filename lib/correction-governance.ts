import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * A proposed correction to public prose, bound to the exact text it corrects.
 *
 * The active revision is never touched. A correction produces a *new* revision
 * with its own digest, and a review is bound to that digest. If the corrected
 * text changes afterwards, the digest changes and the review no longer applies,
 * which is the whole point: a review of one sentence must not silently carry
 * over to a different sentence.
 */

export class CorrectionGovernanceError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'CorrectionGovernanceError'
  }
}

export interface ProposedCorrection {
  assertionId: string
  route: string
  /** The revision this correction is against. Never modified. */
  activeRevision: string
  activePageRevision: string
  correctedText: string
  correctionKind: 'narrow' | 'reframe-as-limitation' | 'split' | 'remove-pending-review'
  rationale: string
  proposedRevision: string
  provenanceDigest: string
  active: false
  appliesToRelease: null
}

export function proposeCorrection(input: {
  assertionId: string
  route: string
  activeRevision: string
  activePageRevision: string
  originalText: string
  correctedText: string
  correctionKind: ProposedCorrection['correctionKind']
  rationale: string
}): ProposedCorrection {
  if (input.correctedText.trim() === input.originalText.trim()) {
    throw new CorrectionGovernanceError('no-op-correction',
      'A correction must change the text. An unchanged sentence needs no revision.')
  }
  const proposedRevision = `sha256:${createHash('sha256')
    .update(canonicalJson({ route: input.route, text: input.correctedText, base: input.activeRevision }), 'utf8')
    .digest('hex')}`
  const provenanceDigest = `sha256:${createHash('sha256')
    .update(canonicalJson({
      assertionId: input.assertionId, from: input.activeRevision,
      to: proposedRevision, kind: input.correctionKind,
    }), 'utf8')
    .digest('hex')}`
  return {
    assertionId: input.assertionId, route: input.route,
    activeRevision: input.activeRevision, activePageRevision: input.activePageRevision,
    correctedText: input.correctedText, correctionKind: input.correctionKind,
    rationale: input.rationale, proposedRevision, provenanceDigest,
    active: false, appliesToRelease: null,
  }
}

export interface RemediationDecision {
  assertionId: string
  boundToRevision: string
  decidedBy: string
  decision: 'approved-for-preview' | 'rejected' | 'needs-more-evidence'
  decidedAt: string
}

/**
 * Check a decision still applies to the revision in front of us.
 *
 * Review inheritance is the failure this refuses: a decision made about one
 * corrected sentence must not authorise a later, different sentence just
 * because it sits at the same route.
 */
export function assertReviewBinds(decision: RemediationDecision, revision: string): void {
  if (decision.boundToRevision !== revision) {
    throw new CorrectionGovernanceError('review-inheritance-refused',
      `A decision bound to ${decision.boundToRevision.slice(0, 20)} cannot authorise ${revision.slice(0, 20)}. Re-review the corrected text.`)
  }
}

/**
 * The only path from a proposal to Production.
 *
 * Requires a separately authenticated release authority. A proposal alone can
 * never move, which is what makes the private artifacts safe to generate.
 */
export function assertMayReachProduction(input: {
  proposal: ProposedCorrection
  decision: RemediationDecision | null
  releaseAuthorityAuthenticated: boolean
}): void {
  if (!input.decision) {
    throw new CorrectionGovernanceError('undecided', 'No remediation decision exists for this correction.')
  }
  assertReviewBinds(input.decision, input.proposal.proposedRevision)
  if (input.decision.decision !== 'approved-for-preview') {
    throw new CorrectionGovernanceError('not-approved', `The decision is ${input.decision.decision}.`)
  }
  if (!input.releaseAuthorityAuthenticated) {
    throw new CorrectionGovernanceError('release-authority-required',
      'Reaching Production requires a separately authenticated release authority. An approved proposal is not one.')
  }
  if (input.proposal.active !== false || input.proposal.appliesToRelease !== null) {
    throw new CorrectionGovernanceError('proposal-not-inert',
      'A proposal must remain inactive and unbound to a release until the release path activates it.')
  }
}
