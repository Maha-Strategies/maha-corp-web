/**
 * Pages about sources, built from what the source was actually read to say.
 *
 * The legacy corpus grew the other way round: pick a topic, then find a
 * citation for it. That produced 48 sources spread across 238 records, 40 of
 * them assigned to exactly five records apiece - one per record kind - which is
 * the shape of a template rather than of evidence. Batch 12B then found seven
 * of fifteen records citing sources about entirely different subjects.
 *
 * A source-reference page inverts that order. It starts from a source that was
 * opened and read, aggregates only the claims already released against it, and
 * asserts nothing of its own. That is why it cannot repeat the defect: there is
 * no step at which a topic goes looking for a citation.
 *
 * Its authority is deliberately empty. Model A below: the page is a projection
 * of released record claims and inherits no factual authority beyond them. A
 * page cannot make a claim true that its records did not already carry, and if
 * every bound record were withdrawn the page would have nothing left to say.
 */

export const SOURCE_REFERENCE_VERSION = 'maha-source-evidence-reference/1.0' as const

/**
 * Why projection, not independent release.
 *
 * Model B - giving each source page its own exact-revision review and canonical
 * release - would create a second authority that can assert things no record
 * asserts, and a second ledger to keep in sync with the first. The failure mode
 * is precise: a page released in its own right could outlive the withdrawal of
 * the record it drew from, and would then be the only place a retracted claim
 * still stood. Projection cannot do that, because it has nothing of its own.
 */
export const GOVERNANCE_MODEL = {
  chosen: 'A',
  name: 'projection-of-released-claims',
  inheritsFactualAuthority: false,
  requiresOwnCanonicalRelease: false,
  rationale: 'A source page states only what already-released records state. It gains no authority of its own, so a withdrawn record removes its claim from the page rather than leaving it stranded behind a second release.',
  failClosed: 'Every displayed claim must trace to an active released revision. A claim whose record is unreleased, superseded or withdrawn is dropped, and a page left with no claims is not eligible.',
} as const

export type InspectionDepth =
  | 'section-or-full-text'
  | 'abstract-only'
  | 'landing-page-only'
  | 'inaccessible'
  | 'identity-conflicted'
  | 'source-mismatched'

/** The dimensions a source page owes a reader. Absence of any is a refusal. */
export const INFORMATION_DIMENSIONS = [
  'source-identification',
  'question-investigated',
  'method-or-evidence-type',
  'inspected-passages',
  'supported-findings',
  'not-established',
  'study-or-specification-scope',
  'version-and-access',
  'rights-and-quotation-boundary',
  'related-released-records',
  'bridges',
  'limitations',
  'claim-level-locators',
  'canonical-metadata',
  'unique-search-intent',
] as const
export type InformationDimension = (typeof INFORMATION_DIMENSIONS)[number]

export interface BoundClaim {
  recordId: string
  /** The exact revision the claim is taken from. */
  revisionSha256: string
  /** Whether that revision is an active canonical release right now. */
  activeRelease: boolean
  locator: string
  statement: string
}

export interface SourcePageCandidate {
  sourceId: string
  identityVerified: boolean
  inspectionDepth: InspectionDepth
  exactLocators: readonly string[]
  rightsBasis: string
  claims: readonly BoundClaim[]
  satisfies: readonly InformationDimension[]
  route: string
  searchIntent: string
  alignmentMismatch: boolean
}

export type SourcePageRefusal =
  | 'identity-unverified'
  | 'not-inspected-beyond-metadata'
  | 'no-exact-locator'
  | 'no-rights-basis'
  | 'no-active-released-record'
  | 'unreleased-claim-present'
  | 'unresolved-alignment-mismatch'
  | 'missing-information-dimension'
  | 'duplicate-route'
  | 'duplicate-search-intent'
  | 'duplicates-an-existing-record-page'

export interface SourcePageVerdict {
  sourceId: string
  eligible: boolean
  refusals: readonly SourcePageRefusal[]
  missingDimensions: readonly InformationDimension[]
  releasedClaimCount: number
}

/** Only these depths can carry a page. The rest are named so they cannot pass. */
const PAGE_CAPABLE: ReadonlySet<InspectionDepth> = new Set(['section-or-full-text'])

/**
 * Whether a source may become a public page.
 *
 * Two refusals do the real work. An abstract-only source is refused however
 * complete the rest of its packet looks, because the page would present
 * section-level findings that nobody read. And a single unreleased claim
 * refuses the whole page rather than being quietly dropped, because silently
 * shrinking a page is how an aggregate starts disagreeing with its records.
 */
export function evaluateSourcePage(
  candidate: SourcePageCandidate,
  takenRoutes: ReadonlySet<string>,
  takenIntents: ReadonlySet<string>,
  existingRecordRoutes: ReadonlySet<string>,
): SourcePageVerdict {
  const refusals: SourcePageRefusal[] = []
  if (!candidate.identityVerified) refusals.push('identity-unverified')
  if (!PAGE_CAPABLE.has(candidate.inspectionDepth)) refusals.push('not-inspected-beyond-metadata')
  if (candidate.exactLocators.length === 0) refusals.push('no-exact-locator')
  if (candidate.rightsBasis.trim().length === 0) refusals.push('no-rights-basis')
  if (candidate.alignmentMismatch) refusals.push('unresolved-alignment-mismatch')

  const released = candidate.claims.filter((claim) => claim.activeRelease)
  if (released.length === 0) refusals.push('no-active-released-record')
  if (candidate.claims.some((claim) => !claim.activeRelease)) refusals.push('unreleased-claim-present')

  const missing = INFORMATION_DIMENSIONS.filter((dimension) => !candidate.satisfies.includes(dimension))
  if (missing.length > 0) refusals.push('missing-information-dimension')

  if (takenRoutes.has(candidate.route)) refusals.push('duplicate-route')
  if (existingRecordRoutes.has(candidate.route)) refusals.push('duplicates-an-existing-record-page')
  const intent = candidate.searchIntent.trim().toLowerCase()
  if (intent.length === 0 || takenIntents.has(intent)) refusals.push('duplicate-search-intent')

  return {
    sourceId: candidate.sourceId,
    eligible: refusals.length === 0,
    refusals,
    missingDimensions: missing,
    releasedClaimCount: released.length,
  }
}

/**
 * Prohibited output shapes, checked against rendered page text.
 *
 * Word count is deliberately not among them. A long page that reproduces a
 * source's prose is worse than a short one that says what the source shows, and
 * gating on length rewards the first.
 */
export const PROHIBITED_PAGE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'implied independent replication', pattern: /\b(we|maha)\s+(replicated|reproduced|verified experimentally|confirmed independently)\b/i },
  { name: 'modelling presented as measurement', pattern: /\b(simulation|model|calculation)\s+(shows|proves|demonstrates)\s+that\s+.{0,40}\bmeasured\b/i },
  { name: 'abstract presented as section support', pattern: /\bas the (methods|results|discussion) section (shows|reports)\b/i },
  { name: 'private reviewer material', pattern: /\breject-or-hold\b|\breview packet\b|\bpacketDigest\b|\breviewerId\b/i },
  { name: 'unbounded quotation', pattern: /"[^"]{400,}"/ },
]

export function scanRenderedPage(text: string): readonly string[] {
  return PROHIBITED_PAGE_PATTERNS.filter((shape) => shape.pattern.test(text)).map((shape) => shape.name)
}
