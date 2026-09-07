/**
 * The definition-role contract repair.
 *
 * Thirty-two candidates across Tranches 13-17 were held at `revise` because
 * their route role is `definition` while their declared contract is
 * `owner-application`, whose boundary reads "may apply; cannot redefine". A
 * definition page must own its concept, so the two cannot both be right.
 *
 * Reviewing every definition candidate in the map settles which one is wrong.
 * All 169 sit on the property that owns the concept they define — siteId equals
 * conceptAuthority.canonicalOwner in every case. The role is correct. The
 * contract is not.
 *
 * The cause is a gap in the vocabulary rather than 169 individual mistakes. The
 * map has three contract roles — owner-application, local-application and
 * source-led-religion-application — and no role for a route that defines its
 * own concept. Every boundary text in the map says the route "cannot redefine
 * or inherit the authority of its canonical owner", which is the right thing to
 * say about an application and the wrong thing to say about a definition. The
 * map was built as though every route applies a concept someone else defines.
 *
 * The repair is expressed as a rule and applied when a candidate is
 * adjudicated. The frozen map is not rewritten: its digest is bound into every
 * tranche artifact and into Codex's Tranches 1-12, and editing it would
 * invalidate those bindings to fix a labelling error. A rule that is recorded,
 * digest-bound and narrow leaves the freeze intact and auditable.
 */

export type ConceptAuthority = { canonicalOwner: string; role: string; boundary: string }
export type RepairableCandidate = {
  conceptId?: string
  candidateId: string
  siteId: string
  routeRole: string
  conceptAuthority: ConceptAuthority
}

export const CANONICAL_OWNER_ROLE = 'canonical-owner'

/**
 * Whether the repair applies.
 *
 * Deliberately narrow, and a predicate rather than a list of 169 ids: a route
 * whose role is `definition`, carrying an application contract, on the property
 * that owns the concept. A definition on a property that does *not* own the
 * concept is a different fault — the role would be wrong, not the contract —
 * and this rule leaves it alone rather than quietly promoting it.
 */
export function repairApplies(candidate: RepairableCandidate): boolean {
  if (candidate.routeRole !== 'definition') return false
  if (candidate.conceptAuthority.role === CANONICAL_OWNER_ROLE) return false
  return candidate.siteId === candidate.conceptAuthority.canonicalOwner
}

/**
 * The corrected contract.
 *
 * The boundary is rewritten rather than dropped. A definition still has limits:
 * it owns the concept on this property and does not thereby own how other
 * properties apply it, and owning a definition is not evidence for it.
 */
export function repairedAuthority(candidate: RepairableCandidate): ConceptAuthority {
  const applied = candidate.conceptAuthority.boundary.match(/may apply (\w+)/)
  const family = applied ? applied[1] : 'this concept'
  return {
    canonicalOwner: candidate.conceptAuthority.canonicalOwner,
    role: CANONICAL_OWNER_ROLE,
    boundary:
      `This route is the canonical definition of ${family} for ${candidate.siteId}. It owns the concept on this ` +
      'property and does not govern how other properties apply it. Owning a definition is not evidence for it: ' +
      'the definition still requires an inspected source like any other claim.',
  }
}

/** Applies the repair where it holds, and returns the candidate untouched otherwise. */
export function withRepairedContract<T extends RepairableCandidate>(candidate: T): T {
  return repairApplies(candidate) ? { ...candidate, conceptAuthority: repairedAuthority(candidate) } : candidate
}

export type RepairSummary = {
  inspected: number
  repaired: number
  /** Definition routes on a property that does not own the concept. */
  roleWrongNotContract: string[]
  byProperty: Record<string, number>
}

export function summariseRepair(candidates: readonly RepairableCandidate[]): RepairSummary {
  const definitions = candidates.filter((c) => c.routeRole === 'definition')
  const repaired = definitions.filter(repairApplies)
  const byProperty: Record<string, number> = {}
  for (const c of repaired) byProperty[c.siteId] = (byProperty[c.siteId] ?? 0) + 1
  return {
    inspected: definitions.length,
    repaired: repaired.length,
    roleWrongNotContract: definitions
      .filter((c) => c.siteId !== c.conceptAuthority.canonicalOwner)
      .map((c) => c.candidateId)
      .sort(),
    byProperty: Object.fromEntries(Object.entries(byProperty).sort(([a], [b]) => a.localeCompare(b))),
  }
}

/**
 * Whether a reported dependency gap is a genuine absence from the map.
 *
 * The distinction the v3 addition rests on. A concept whose definition exists
 * on the declared owner is not absent, however the dependency was reported —
 * it is unreviewed, and adding a second definition would duplicate it. Exported
 * so the rule is testable on a constructed case rather than only on data that
 * happens to contain no counter-example.
 */
export function dependencyGapIsGenuine(
  conceptId: string,
  declaredOwner: string,
  candidates: readonly RepairableCandidate[],
): boolean {
  return !candidates.some(
    (c) => c.conceptId === conceptId && c.routeRole === 'definition' && c.siteId === declaredOwner)
}
