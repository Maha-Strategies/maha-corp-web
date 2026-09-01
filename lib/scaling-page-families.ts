/**
 * What each public page family owes a reader, and how a route is classified.
 *
 * The target is a thousand pages that are individually worth landing on, and
 * the way that target goes wrong is combinatorial: cross every record with
 * every other, or every tradition with every date, and the count arrives while
 * the value does not. So a family is defined by the information it must carry,
 * not by the URL shape it can generate, and the gate below refuses a page that
 * would exist only because a template could produce it.
 *
 * Nothing here decides truth. A family contract says a claim must carry an
 * exact locator and an inspected-content status; it does not say the claim is
 * correct, and metadata is never allowed to stand in for explanation.
 */

export const PAGE_FAMILY_VERSION = 'maha-scaling-page-families/1.0' as const

/** The information a family must carry before a route may exist for it. */
export type InformationRequirement =
  | 'direct-answer'
  | 'mechanism'
  | 'claim-level-attribution'
  | 'exact-locator'
  | 'inspected-content-status'
  | 'bounded-comparison'
  | 'supported-calculation'
  | 'limitations'
  | 'related-records'
  | 'typed-bridges'
  | 'canonical-metadata'
  | 'structured-data'
  | 'unique-search-intent'

export interface PageFamily {
  id: string
  label: string
  /** Route prefixes this family owns. Matched longest-first. */
  prefixes: readonly string[]
  /** Every requirement a page in this family must satisfy. */
  requires: readonly InformationRequirement[]
  /**
   * Whether a page needs an active canonical release naming its exact revision.
   * Families built from released evidence do; editorial and product surfaces
   * do not, and claiming they did would be theatre.
   */
  requiresCanonicalRelease: boolean
  /** Why a reader would land here rather than on a neighbouring page. */
  searchIntent: string
}

/**
 * Families in classification order.
 *
 * Order matters: `/knowledge/epistemic-system` is methodology, not a record,
 * and would otherwise be swallowed by the record prefix.
 */
export const PAGE_FAMILIES: readonly PageFamily[] = [
  {
    id: 'methodology',
    label: 'Methodology and governance',
    prefixes: ['/knowledge/epistemic-system', '/method', '/governed-workflow', '/doctrine', '/audit', '/policy', '/protocols'],
    requires: ['direct-answer', 'mechanism', 'limitations', 'canonical-metadata', 'unique-search-intent'],
    requiresCanonicalRelease: false,
    searchIntent: 'How the evidence and release process works, and what it does not claim.',
  },
  {
    id: 'substantial-record',
    label: 'Substantial canonical record',
    prefixes: ['/knowledge/'],
    requires: [
      'direct-answer', 'mechanism', 'claim-level-attribution', 'exact-locator', 'inspected-content-status',
      'limitations', 'related-records', 'typed-bridges', 'canonical-metadata', 'structured-data', 'unique-search-intent',
    ],
    requiresCanonicalRelease: true,
    searchIntent: 'A specific technical concept, mechanism, method, measurement or comparison.',
  },
  {
    id: 'book-chapter',
    label: 'Open book chapter',
    prefixes: ['/books/'],
    requires: ['direct-answer', 'canonical-metadata', 'unique-search-intent'],
    requiresCanonicalRelease: false,
    searchIntent: 'A named chapter of a published long-form work.',
  },
  {
    id: 'intelligence-brief',
    label: 'Intelligence and analysis',
    prefixes: ['/intelligence', '/insights', '/reports', '/research', '/rapid-intelligence-brief'],
    requires: ['direct-answer', 'claim-level-attribution', 'limitations', 'canonical-metadata', 'unique-search-intent'],
    requiresCanonicalRelease: false,
    searchIntent: 'A dated analytical position on a named situation.',
  },
  {
    id: 'product-tool',
    label: 'Product, tool and developer surface',
    prefixes: ['/apps', '/tools', '/software', '/developers', '/mps', '/context-compiler', '/utilities', '/recipes', '/pricing', '/navigator'],
    requires: ['direct-answer', 'canonical-metadata', 'unique-search-intent'],
    requiresCanonicalRelease: false,
    searchIntent: 'What a specific tool does and how to use it.',
  },
  {
    id: 'case-study',
    label: 'Case study and consulting',
    prefixes: ['/case-studies', '/consulting', '/projects', '/guides'],
    requires: ['direct-answer', 'limitations', 'canonical-metadata', 'unique-search-intent'],
    requiresCanonicalRelease: false,
    searchIntent: 'A worked engagement or an explicit service boundary.',
  },
  {
    id: 'corporate',
    label: 'Corporate and legal',
    prefixes: ['/about', '/contact', '/terms', '/start', '/network'],
    requires: ['direct-answer', 'canonical-metadata'],
    requiresCanonicalRelease: false,
    searchIntent: 'Who the organisation is and how to reach it.',
  },
]

/** The family a public path belongs to, by longest matching prefix. */
export function classifyPath(path: string): PageFamily | null {
  let best: PageFamily | null = null
  let bestLength = -1
  for (const family of PAGE_FAMILIES) {
    for (const prefix of family.prefixes) {
      const matches = prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)
      if (matches && prefix.length > bestLength) { best = family; bestLength = prefix.length }
    }
  }
  return best
}

export type FamilyRefusal =
  | 'unknown-family'
  | 'missing-required-information'
  | 'release-required'
  | 'duplicate-route'
  | 'search-intent-not-distinct'

export interface PageCandidate {
  path: string
  /** Which requirements this candidate can actually satisfy. */
  satisfies: readonly InformationRequirement[]
  hasActiveCanonicalRelease: boolean
  /** A short phrase describing the question this page answers. */
  searchIntent: string
}

export interface FamilyVerdict {
  path: string
  familyId: string | null
  eligible: boolean
  refusals: readonly FamilyRefusal[]
  missing: readonly InformationRequirement[]
}

/**
 * Whether a candidate may become a crawlable route.
 *
 * Deliberately unforgiving about the two failures that produce thin pages at
 * scale: a family requirement that cannot be met, and a search intent that
 * duplicates one already taken. A page that cannot say something the site does
 * not already say is not a page.
 */
export function evaluateCandidate(
  candidate: PageCandidate,
  takenPaths: ReadonlySet<string>,
  takenIntents: ReadonlySet<string>,
): FamilyVerdict {
  const family = classifyPath(candidate.path)
  const refusals: FamilyRefusal[] = []
  if (!family) {
    return { path: candidate.path, familyId: null, eligible: false, refusals: ['unknown-family'], missing: [] }
  }
  const satisfied = new Set(candidate.satisfies)
  const missing = family.requires.filter((requirement) => !satisfied.has(requirement))
  if (missing.length > 0) refusals.push('missing-required-information')
  if (family.requiresCanonicalRelease && !candidate.hasActiveCanonicalRelease) refusals.push('release-required')
  if (takenPaths.has(candidate.path)) refusals.push('duplicate-route')
  const intent = candidate.searchIntent.trim().toLowerCase()
  if (intent.length === 0 || takenIntents.has(intent)) refusals.push('search-intent-not-distinct')
  return { path: candidate.path, familyId: family.id, eligible: refusals.length === 0, refusals, missing }
}
