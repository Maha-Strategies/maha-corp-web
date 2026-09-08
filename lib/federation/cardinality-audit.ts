/**
 * Cardinality audit for the federation candidate map.
 *
 * Map v3 contradicts itself. Its summary says 1,628 active candidates and
 * 4,000 projected routes, both carried over from v2 unchanged, while its own
 * counts block says 1,660 after Tranche 18 added 32 canonical definitions.
 * 2,372 observed + 1,660 is 4,032, so at most one of those numbers can be
 * right.
 *
 * This module derives every figure from the arrays rather than reading any
 * summary, and reports each disagreement as a defect. It computes; it does not
 * repair. The repair is a separate decision recorded in the adjudication.
 */

export const TARGET_CANONICAL_ROUTES = 4000

export type CandidateFacts = { candidateId: string; url: string; rank: number | null }

export type CardinalityInput = {
  observedCanonicalRoutes: number
  /** Candidates that occupy a place in the route budget. */
  routeCandidates: readonly CandidateFacts[]
  /** Canonical objects that carry identity and dependency utility but no route. */
  graphObjects: readonly CandidateFacts[]
  summary: { activeCandidates: number; projectedCanonicalRoutes: number }
  allocation: readonly { siteId: string; observed: number; activeCandidates: number; projected: number }[]
  activeRanksLength: number
  lineage: { addedCandidates: number; supersededCandidates: number }
  /** candidateId -> the tranche that reviewed it. */
  coverage: ReadonlyMap<string, string>
}

export type CardinalityDefect = { code: string; detail: string; expected: number; actual: number }

export type CardinalityAudit = {
  derived: {
    observedCanonicalRoutes: number
    routeCandidateCount: number
    graphObjectCount: number
    totalObjects: number
    uniqueCandidateIds: number
    uniqueCanonicalUrls: number
    projectedCanonicalRoutes: number
    activeRanksLength: number
    lineageAdded: number
    lineageSuperseded: number
    coveredByATranche: number
    coveredByNoTranche: number
  }
  declared: { summaryActiveCandidates: number; summaryProjectedCanonicalRoutes: number }
  defects: readonly CardinalityDefect[]
  consistent: boolean
}

export function auditCardinality(input: CardinalityInput): CardinalityAudit {
  const all = [...input.routeCandidates, ...input.graphObjects]
  const routeCandidateCount = input.routeCandidates.length
  const graphObjectCount = input.graphObjects.length
  const projected = input.observedCanonicalRoutes + routeCandidateCount

  const uncovered = all.filter((c) => !input.coverage.has(c.candidateId)).length

  const derived: CardinalityAudit['derived'] = {
    observedCanonicalRoutes: input.observedCanonicalRoutes,
    routeCandidateCount,
    graphObjectCount,
    totalObjects: all.length,
    uniqueCandidateIds: new Set(all.map((c) => c.candidateId)).size,
    uniqueCanonicalUrls: new Set(all.map((c) => c.url)).size,
    projectedCanonicalRoutes: projected,
    activeRanksLength: input.activeRanksLength,
    lineageAdded: input.lineage.addedCandidates,
    lineageSuperseded: input.lineage.supersededCandidates,
    coveredByATranche: all.length - uncovered,
    coveredByNoTranche: uncovered,
  }

  const defects: CardinalityDefect[] = []
  const check = (code: string, expected: number, actual: number, detail: string) => {
    if (expected !== actual) defects.push({ code, detail, expected, actual })
  }

  check('summary-active-candidates-disagrees-with-array', routeCandidateCount, input.summary.activeCandidates,
    'The summary states an active candidate count that the route-candidate array does not contain.')
  check('projected-total-disagrees-with-summary', projected, input.summary.projectedCanonicalRoutes,
    'Observed routes plus route candidates does not equal the projected total the summary declares.')
  check('projected-total-off-target', TARGET_CANONICAL_ROUTES, projected,
    'Observed routes plus route candidates does not reach the 4,000-route target the baseline sets.')
  check('duplicate-candidate-ids', all.length, derived.uniqueCandidateIds,
    'Two objects share a candidate id.')
  check('duplicate-canonical-urls', all.length, derived.uniqueCanonicalUrls,
    'Two objects claim the same canonical URL.')
  check('active-ranks-disagrees-with-route-candidates', routeCandidateCount, input.activeRanksLength,
    'The ranked ordering does not cover exactly the route candidates.')
  check('candidates-covered-by-no-tranche', 0, uncovered,
    'Objects exist that no tranche reviewed.')

  const sum = (k: 'observed' | 'activeCandidates' | 'projected') =>
    input.allocation.reduce((t, a) => t + a[k], 0)
  check('allocation-observed-disagrees', input.observedCanonicalRoutes, sum('observed'),
    'Per-property observed routes do not sum to the baseline observation.')
  check('allocation-active-disagrees', routeCandidateCount, sum('activeCandidates'),
    'Per-property active candidates do not sum to the route-candidate array.')
  check('allocation-projected-disagrees', projected, sum('projected'),
    'Per-property projected routes do not sum to the derived projection.')

  // A route added to the budget must displace one, or the budget grows. Graph
  // objects are outside the budget, so they are exempt by construction — which
  // is exactly why the disposition of each addition has to be recorded.
  check('additions-without-supersessions', input.lineage.addedCandidates - graphObjectCount,
    input.lineage.supersededCandidates,
    'Additions that entered the route budget were not matched by supersessions.')

  return { derived, declared: {
    summaryActiveCandidates: input.summary.activeCandidates,
    summaryProjectedCanonicalRoutes: input.summary.projectedCanonicalRoutes,
  }, defects, consistent: defects.length === 0 }
}
