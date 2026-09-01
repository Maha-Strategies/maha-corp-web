/**
 * What a review tier actually is, stated so a machine cannot be read as a person.
 *
 * The 38-record cohort was decided by an automated process. Recording that as
 * `internal-editorial` would have placed it in the same tier as review a person
 * performed, and every downstream reader - the assurance tier, the public
 * registry, an operator report - would have inherited that confusion. The
 * distinction matters most precisely where it is easiest to lose: a decision
 * carries no byline, so nothing about it objects to being attributed to someone.
 *
 * So the tier is declared rather than implied, with every property a reader
 * might otherwise assume set explicitly to what it actually is. All five of the
 * assurances below are false for this tier, and saying so once here is what
 * stops each consumer guessing separately.
 */

export const REVIEW_TIER_VERSION = 'maha-review-tier/1.0' as const

export interface ReviewTierDeclaration {
  reviewerKind: string
  /** Was the reviewer independent of the party seeking release? */
  independent: boolean
  /** Does this constitute expert endorsement of the claim? */
  expertEndorsement: boolean
  /** Was the record reviewed by anyone outside this organisation? */
  externallyReviewed: boolean
  /** Did a person make this decision? */
  humanReviewed: boolean
  /** Whether release authority is held separately from the reviewer. */
  releaseAuthority: 'separate' | 'same'
  /** What the tier does establish. Deliberately narrow. */
  verifies: string
  /** What it does not, however it is read. */
  doesNotEstablish: readonly string[]
  /** The sentence public and operator surfaces must carry verbatim. */
  publicStatement: string
}

/** Every reviewer kind whose decisions are produced by a machine. */
export const MACHINE_REVIEWER_KINDS = ['automated-internal-editorial'] as const
export type MachineReviewerKind = (typeof MACHINE_REVIEWER_KINDS)[number]

const AUTOMATED_INTERNAL_EDITORIAL: ReviewTierDeclaration = {
  reviewerKind: 'automated-internal-editorial',
  independent: false,
  expertEndorsement: false,
  externallyReviewed: false,
  humanReviewed: false,
  releaseAuthority: 'separate',
  verifies: 'deterministic evidence-policy compliance',
  doesNotEstablish: [
    'scientific truth',
    'independent reproduction',
    'expert consensus',
    'external endorsement',
    'fitness for any decision the reader may make',
  ],
  publicStatement: 'This tier verifies deterministic evidence-policy compliance. It does not establish scientific truth, independent reproduction or expert consensus, and no decision in it was made by a person.',
}

export const REVIEW_TIERS: Readonly<Record<string, ReviewTierDeclaration>> = {
  'automated-internal-editorial': AUTOMATED_INTERNAL_EDITORIAL,
}

export class ReviewTierRefused extends Error {
  code: 'unknown-machine-reviewer-kind' | 'machine-decision-attributed-to-person' | 'tier-assurance-overstated'

  constructor(code: ReviewTierRefused['code'], message: string) {
    super(message)
    this.name = 'ReviewTierRefused'
    this.code = code
  }
}

/**
 * Refuses any machine-generated reviewer kind that has not been declared.
 *
 * Fail-closed by construction: a new automated reviewer has to be added here,
 * with its assurances written down, before its decisions can be used. The
 * alternative - accepting unknown kinds and hoping they are honest about
 * themselves - is how a second automated tier would quietly inherit the first
 * one's standing.
 */
export function assertMachineReviewerPermitted(reviewerKind: string): ReviewTierDeclaration | null {
  const declared = REVIEW_TIERS[reviewerKind]
  if (declared) return declared
  // Anything that looks machine-generated and is not declared is refused. Human
  // tiers pass through untouched; this is not a general allowlist.
  if (/^(automated|machine|synthetic|generated|agent)[-_]/i.test(reviewerKind)) {
    throw new ReviewTierRefused('unknown-machine-reviewer-kind',
      `${reviewerKind} is machine-generated but has no declared tier. Declare its assurances before using its decisions.`)
  }
  return null
}

/** Refuses a decision that names a person while claiming a machine tier. */
export function assertNoPersonAttribution(
  reviewerKind: string,
  attribution: { displayName?: string | null; reviewerId?: string | null } = {},
): void {
  if (!REVIEW_TIERS[reviewerKind]) return
  if (attribution.displayName || attribution.reviewerId) {
    throw new ReviewTierRefused('machine-decision-attributed-to-person',
      'A machine-generated decision cannot carry a reviewer identity.')
  }
}

/** Refuses a declaration that claims an assurance the tier does not have. */
export function assertTierNotOverstated(declaration: ReviewTierDeclaration): void {
  if (!MACHINE_REVIEWER_KINDS.includes(declaration.reviewerKind as MachineReviewerKind)) return
  if (declaration.independent || declaration.expertEndorsement
    || declaration.externallyReviewed || declaration.humanReviewed) {
    throw new ReviewTierRefused('tier-assurance-overstated',
      'A machine tier cannot declare itself independent, expert, external or human.')
  }
  if (declaration.releaseAuthority !== 'separate') {
    throw new ReviewTierRefused('tier-assurance-overstated',
      'A machine tier must not also hold release authority.')
  }
}
