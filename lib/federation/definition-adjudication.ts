/**
 * Route-or-support adjudication for the 32 definitions added in map v3.
 *
 * The question is not whether these concepts matter. It is whether each needs a
 * crawlable public route, or whether it can carry its identity, definition,
 * lineage and dependency utility as a canonical graph object with no route.
 *
 * The test applied is the one the brief sets: a definition earns a public route
 * on independent discovery, explanatory or machine-resolution utility. Being
 * the target of a dependency is not enough — a dependent needs the concept
 * defined somewhere resolvable, which a graph object provides.
 *
 * On the evidence, none of the 32 earns a route:
 *
 * - None has route-specific demand. All 32 carry observedQueries 0 on a
 *   category prior, and their own demandEvidence warning says the score orders
 *   research and is not route-specific search evidence.
 * - None was ever allocated one. All 32 have weighted score 0 and rank null,
 *   appear in neither activeRanks (1,628) nor the per-property allocation, and
 *   that allocation independently sums to 1,628 active candidates and exactly
 *   4,000 projected routes. They were added to repair dependency gaps, not
 *   through the scoring that assigns route budget.
 * - Machine resolution is satisfied without a page. The dependency is on the
 *   concept definition, and a graph object holds it.
 *
 * Three of the 32 reached evidence-ready in Tranche 18 and could be published
 * on their inspected sources. They are still not promoted, because promotion
 * costs a route: the budget is full at 1,628, so each would displace a reviewed
 * candidate under Model B. Displacing reviewed work for a concept with no
 * observed demand is a bad trade. The path stays open — demand evidence would
 * reopen it — and the replacement criteria are recorded rather than exercised.
 */
import {
  DEFERRED_PENDING_IMPLEMENTATION,
  EXTERNAL_AUTHORITY_REQUIRED,
  FIRST_PARTY_DEFINITIONS,
} from './first-party-definitions.ts'

export type DefinitionDisposition =
  | 'public-canonical-route-required'
  | 'non-route-graph-object'
  | 'deferred-pending-implementation'
  | 'requires-external-authority'
  | 'duplicative-of-existing-route'

export type EvidenceGroup = 'externally-grounded' | 'first-party' | 'deferred' | 'external-authority-required'

export type Adjudication = {
  conceptId: string
  candidateId: string
  disposition: DefinitionDisposition
  /** Which of the four preserved evidence groups this concept belongs to. */
  evidenceGroup: EvidenceGroup
  /** The Tranche 18 review outcome. Not re-decided here. */
  tranche18State: string
  routeInV4: false
  dependentsAtStake: number
  reason: string
}

/**
 * The three definitions that reached evidence-ready in Tranche 18 on inspected
 * external sources. Their basis is independent, and must not be confused with
 * the first-party group.
 */
export const EXTERNALLY_GROUNDED_CONCEPTS: readonly string[] = [
  'urn:maha:concept:computation:error-budgets',
  'urn:maha:concept:evidence:audit-export',
  'urn:maha:concept:evidence:version-relationship',
]

const REASONS: Record<EvidenceGroup, string> = {
  'externally-grounded':
    'Evidence-ready on inspected external sources, so it could be published. Not promoted: the route budget is ' +
    'full at 1,628, so a route here displaces a reviewed candidate, and this concept has no observed route-specific ' +
    'demand to justify that trade. Retained as a canonical graph object with its independent basis intact.',
  'first-party':
    'Defined first-party, because the concept is this organisation\'s own and no external authority uses the term. ' +
    'A first-party definition establishes what Maha means, not what the field holds, which is thin ground for a ' +
    'crawlable page and sufficient ground for a resolvable graph object.',
  deferred:
    'Nothing in the codebase implements this concept. A route would publish an intention as though it were ' +
    'behaviour. Held as an identity only, with no definition attached, until an implementation exists.',
  'external-authority-required':
    'An established concept with a real external authority. A Maha definition route would manufacture authority ' +
    'where a standard already exists. Retained as an identity so dependents can reference the concept, with no ' +
    'Maha definition attached.',
}

export function evidenceGroupOf(conceptId: string): EvidenceGroup | null {
  if (EXTERNALLY_GROUNDED_CONCEPTS.includes(conceptId)) return 'externally-grounded'
  if (FIRST_PARTY_DEFINITIONS.some((d) => d.conceptId === conceptId)) return 'first-party'
  if (DEFERRED_PENDING_IMPLEMENTATION.some((d) => d.conceptId === conceptId)) return 'deferred'
  if (EXTERNAL_AUTHORITY_REQUIRED.some((d) => d.conceptId === conceptId)) return 'external-authority-required'
  return null
}

const DISPOSITION_BY_GROUP: Record<EvidenceGroup, DefinitionDisposition> = {
  'externally-grounded': 'non-route-graph-object',
  'first-party': 'non-route-graph-object',
  deferred: 'deferred-pending-implementation',
  'external-authority-required': 'requires-external-authority',
}

export function adjudicate(
  additions: readonly { candidateId: string; conceptId: string; unlocksDependents: number }[],
  tranche18: ReadonlyMap<string, string>,
): Adjudication[] {
  return additions
    .map((c) => {
      const evidenceGroup = evidenceGroupOf(c.conceptId)
      if (!evidenceGroup) {
        throw new Error(`${c.conceptId} belongs to no evidence group; adjudication would be a guess.`)
      }
      return {
        conceptId: c.conceptId,
        candidateId: c.candidateId,
        disposition: DISPOSITION_BY_GROUP[evidenceGroup],
        evidenceGroup,
        tranche18State: tranche18.get(c.conceptId) ?? 'not-reviewed',
        routeInV4: false as const,
        dependentsAtStake: c.unlocksDependents,
        reason: REASONS[evidenceGroup],
      }
    })
    .sort((a, b) => a.conceptId.localeCompare(b.conceptId))
}
