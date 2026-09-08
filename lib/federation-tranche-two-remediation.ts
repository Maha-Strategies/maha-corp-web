/**
 * Federation Tranche 2 — remediation of the fifteen non-ready candidates.
 *
 * Tranche 2 partitioned 100 candidates into 85 evidence-ready, 9 revise, 5
 * blocked and 1 rejected as duplicative. This module reassesses only the 15
 * that did not reach evidence-ready, and it reassesses the *reason* as much as
 * the candidate.
 *
 * That distinction turned out to matter. Five candidates were blocked because
 * "the observed canonical Publish definition route could not be inspected".
 * Re-inspected on 2026-09-05, every one of those routes answered 200. The
 * finding was an inspection failure, not a fact about the corpus — and a wrong
 * reason is worse than a block, because it cannot be argued with.
 *
 * Being able to read a source is not the same as the source supporting a page.
 * Several candidates stay non-ready after inspection, for reasons that are now
 * specific: the canonical already covers the facet, or an offer's own
 * exclusions rule the topic out. A remediation pass that unblocked all fifteen
 * would be evidence that it was not really checking.
 *
 * Additive only. Nothing here modifies a Tranche 1 or Tranche 2 artifact, and
 * nothing here creates a public route. Determinations are proposals for a
 * later, separately-approved implementation pass.
 */

/** What a reassessment concluded about a candidate. */
export const OUTCOMES = [
  /** The original reason did not survive inspection and the candidate is ready. */
  'promote-to-evidence-ready',
  /** Ready only with a narrower scope than proposed; the narrowing is recorded. */
  'promote-with-narrowed-scope',
  /** Still not ready, but the recorded reason was wrong and is replaced. */
  'hold-with-corrected-reason',
  /** Still not ready for the reason originally given, now verified. */
  'hold-reason-confirmed',
  /** Rejected; a canonical owner exists elsewhere. */
  'reject-duplicative',
] as const
export type Outcome = (typeof OUTCOMES)[number]

/** Why a candidate could not reach evidence-ready. */
export const HOLD_GROUNDS = [
  'no-inspected-authority-defines-the-term',
  'no-manuscript-passage-establishes-authorial-use',
  'canonical-owner-already-covers-this-facet',
  'offer-terms-exclude-this-topic',
  'offer-terms-do-not-cover-this-topic',
  'customer-outcomes-not-established',
] as const
export type HoldGround = (typeof HOLD_GROUNDS)[number]

/**
 * A source actually fetched during this pass, with what came back.
 *
 * `httpStatus` is recorded rather than a boolean, because "could not be
 * inspected" is exactly the claim this pass exists to check, and a status code
 * is checkable by someone who does not trust this file.
 */
export type Inspection = {
  url: string
  observedOn: string
  httpStatus: number
  /** Section headings, where the source is an HTML document. */
  sections?: string[]
  /** What the source does establish, in this pass's words. */
  establishes: string
  /** What a reader might expect it to establish and it does not. */
  doesNotEstablish: string
}

export type Determination = {
  candidateId: string
  proposedUrl: string
  /** The disposition Tranche 2 recorded. Never edited there; restated here. */
  originalDisposition: 'revise' | 'blocked' | 'reject-as-duplicative'
  originalReason: string
  outcome: Outcome
  /** Required whenever the outcome is not a promotion. */
  holdGround?: HoldGround
  /** URLs of inspections in this pass that the outcome rests on. */
  restsOn: string[]
  /** For a narrowed promotion: what the page may and may not say. */
  narrowedScope?: { mayState: string[]; mayNotState: string[] }
  /** The canonical owner, when one exists and outranks this candidate. */
  canonicalOwner?: string
  finding: string
}

export class RemediationContractError extends Error {
  readonly failures: string[]
  constructor(failures: string[]) {
    super(`Remediation refused:\n  - ${failures.join('\n  - ')}`)
    this.name = 'RemediationContractError'
    this.failures = failures
  }
}

const PROMOTIONS: readonly Outcome[] = ['promote-to-evidence-ready', 'promote-with-narrowed-scope']
export const isPromotion = (outcome: Outcome) => PROMOTIONS.includes(outcome)

/**
 * Every reason a determination is refused.
 *
 * The rule doing the real work: a promotion must rest on a source inspected in
 * this pass that returned 200. Without it, "the route could not be inspected"
 * would be answerable by asserting that it could.
 */
export function determinationFailures(
  determination: Determination,
  inspections: readonly Inspection[],
): string[] {
  const f: string[] = []
  const need = (cond: unknown, message: string) => { if (!cond) f.push(`${determination.candidateId}: ${message}`) }
  const byUrl = new Map(inspections.map((i) => [i.url, i]))

  need(determination.candidateId.startsWith('cand_'), 'candidateId must be a Tranche 2 candidate id')
  need(determination.proposedUrl.startsWith('https://'), 'proposedUrl must be absolute')
  need(OUTCOMES.includes(determination.outcome), 'outcome must be a known outcome')
  need(determination.originalReason.trim().length > 0, 'the original reason must be restated, not discarded')
  need(determination.finding.trim().length > 0, 'a determination must say what was found')

  need(determination.restsOn.length > 0, 'a determination must name the sources it rests on')
  for (const url of determination.restsOn) {
    need(byUrl.has(url), `rests on ${url}, which was not inspected in this pass`)
  }

  if (isPromotion(determination.outcome)) {
    const reachable = determination.restsOn
      .map((u) => byUrl.get(u))
      .filter((i): i is Inspection => i !== undefined && i.httpStatus === 200)
    need(reachable.length > 0,
      'a promotion must rest on at least one source that answered 200 in this pass')
    need(determination.holdGround === undefined, 'a promotion cannot also carry a hold ground')
  } else {
    need(determination.holdGround !== undefined && HOLD_GROUNDS.includes(determination.holdGround),
      'a candidate that stays non-ready must name the ground on which it is held')
  }

  if (determination.outcome === 'promote-with-narrowed-scope') {
    need((determination.narrowedScope?.mayState.length ?? 0) > 0,
      'a narrowed promotion must say what the page may state')
    need((determination.narrowedScope?.mayNotState.length ?? 0) > 0,
      'a narrowed promotion must say what the page may not state; a narrowing with no exclusions is not a narrowing')
  }

  if (determination.outcome === 'reject-duplicative') {
    need(determination.canonicalOwner?.startsWith('https://'),
      'a duplicative rejection must name the canonical owner it defers to')
  }

  if (determination.outcome === 'hold-with-corrected-reason') {
    need(determination.finding !== determination.originalReason,
      'a corrected reason must differ from the reason it corrects')
  }
  return f
}

export function assertDeterminations(
  determinations: readonly Determination[],
  inspections: readonly Inspection[],
): void {
  const failures = determinations.flatMap((d) => determinationFailures(d, inspections))
  const ids = determinations.map((d) => d.candidateId)
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (duplicated.length > 0) failures.push(`a candidate is determined twice: ${[...new Set(duplicated)].join(', ')}`)
  if (failures.length > 0) throw new RemediationContractError(failures)
}

/** Recursively key-sorted JSON, so a digest tracks content and not key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}
