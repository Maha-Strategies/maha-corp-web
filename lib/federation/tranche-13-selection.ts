/**
 * Tranche 13 cohort selection.
 *
 * The policy is the one Tranches 9 and 10 recorded: highest calibrated utility
 * after the prior tranches, with dependency closure, a four-page property/topic
 * cap, proportional property caps, and prior-tranche definitions treated as
 * satisfied prerequisites.
 *
 * Two things about this tranche differ from its predecessors and are handled
 * explicitly rather than inherited.
 *
 * Rank is unusable. The mythology migration left `rank` and `tranche` on the
 * candidate objects non-contiguous — the 428 unreviewed candidates span ranks 1
 * to 1,624 and legacy tranches 1 to 4 — so selecting ranks 1,101-1,200 would
 * pick an arbitrary set. Ordering is by `scores.weighted`, the calibrated
 * utility the candidate map itself computes, with candidateId as the tiebreak
 * so the result is stable rather than dependent on file order.
 *
 * Proportional coverage is no longer fully satisfiable. The earlier tranches
 * held a property mix of 31/25/18/10/6/5/5. The remaining inventory cannot
 * supply it: agentic-publishing has 8 candidates left against a target of 10,
 * and mayon-rajan has 4 against 5. The policy says "where the remaining
 * inventory permits", so each property target is capped by what exists and the
 * shortfall is redistributed to the properties that still have depth, in a
 * fixed order. The shortfall is recorded rather than absorbed silently.
 */

export type Candidate = {
  candidateId: string
  siteId: string
  groupId: string
  routeRole: string
  path: string
  title: string
  conceptId: string
  conceptFamilyId: string
  conceptAuthority: { canonicalOwner: string; role: string; boundary: string }
  // Present on every candidate in the frozen map and used by the page
  // specifications. They were absent from this type and nothing noticed,
  // because tsconfig excludes `scripts` and the generators lived there.
  url: string
  searchIntent: string
  typedRelationships?: unknown[]
  scores: { weighted: number }
  rank: number
  tranche: number
}

/** The property mix Tranches 9 and 10 held, used as the proportional target. */
export const PROPORTIONAL_TARGET: Record<string, number> = {
  'maha-strategies': 31,
  'maha-research': 25,
  'maha-policy': 18,
  'agentic-publishing': 10,
  'maha-os': 6,
  'mayone-maharajan': 5,
  'mayon-rajan': 5,
}

/** Redistribution order when a property cannot meet its target. Fixed, so the outcome is reproducible. */
const REDISTRIBUTION_ORDER = ['maha-strategies', 'maha-policy', 'maha-research']

export const TOPIC_CAP = 4

/**
 * The topic a candidate belongs to, taken from its path.
 *
 * Tranche 10 capped on site::topic where topic is the concept slug — the
 * segment before the route role, so /clearing/tamil-religion/marutam/relationship
 * is topic `marutam`. Capping on `groupId` instead collapses whole families into
 * one bucket: it selected 41 candidates rather than 100 and displaced 387, which
 * is how the difference was noticed.
 */
export function topicOf(candidate: Pick<Candidate, 'path'>): string {
  const parts = candidate.path.split('/').filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? 'unknown')
}
export const COHORT_SIZE = 100

/** Calibrated utility descending, candidateId ascending. Deterministic. */
export function byUtility(a: Candidate, b: Candidate): number {
  return b.scores.weighted - a.scores.weighted || a.candidateId.localeCompare(b.candidateId)
}

export type SelectionResult = {
  selected: Candidate[]
  propertyTargets: Record<string, number>
  shortfalls: { siteId: string; target: number; available: number }[]
  topicCapHits: string[]
}

/**
 * Selects the cohort.
 *
 * Caps are applied while walking the utility order, so a high-utility candidate
 * is only displaced by a cap, never by file position.
 */
export function selectCohort(remaining: readonly Candidate[], size = COHORT_SIZE): SelectionResult {
  const available: Record<string, number> = {}
  for (const c of remaining) available[c.siteId] = (available[c.siteId] ?? 0) + 1

  const targets: Record<string, number> = {}
  const shortfalls: { siteId: string; target: number; available: number }[] = []
  let deficit = 0
  for (const [siteId, target] of Object.entries(PROPORTIONAL_TARGET)) {
    const have = available[siteId] ?? 0
    targets[siteId] = Math.min(target, have)
    if (have < target) {
      shortfalls.push({ siteId, target, available: have })
      deficit += target - have
    }
  }
  // Redistribute in a fixed order, bounded by what each property still has.
  for (const siteId of REDISTRIBUTION_ORDER) {
    if (deficit === 0) break
    const room = (available[siteId] ?? 0) - (targets[siteId] ?? 0)
    const take = Math.min(room, deficit)
    targets[siteId] = (targets[siteId] ?? 0) + take
    deficit -= take
  }

  const perProperty: Record<string, number> = {}
  const perTopic: Record<string, number> = {}
  const topicCapHits: string[] = []
  const selected: Candidate[] = []

  for (const c of [...remaining].sort(byUtility)) {
    if (selected.length >= size) break
    if ((perProperty[c.siteId] ?? 0) >= (targets[c.siteId] ?? 0)) continue
    const topicKey = `${c.siteId}::${topicOf(c)}`
    if ((perTopic[topicKey] ?? 0) >= TOPIC_CAP) {
      topicCapHits.push(`${topicKey} (${c.candidateId})`)
      continue
    }
    selected.push(c)
    perProperty[c.siteId] = (perProperty[c.siteId] ?? 0) + 1
    perTopic[topicKey] = (perTopic[topicKey] ?? 0) + 1
  }

  return { selected, propertyTargets: targets, shortfalls, topicCapHits }
}

export type DependencyState =
  | 'live'
  | 'satisfied-by-earlier-tranche'
  | 'present-in-tranche-13'
  | 'missing'
  | 'incorrectly-owned'
  | 'awaiting-definition-review'

/**
 * Where an application route's canonical definition stands.
 *
 * A route whose own role is `definition` owns its concept and depends on
 * nothing. Anything else depends on a definition for the same concept, owned by
 * the property named in conceptAuthority. A definition owned by the wrong
 * property is reported as incorrectly-owned rather than accepted, because an
 * application route may not redefine its dependency.
 */
export function resolveDependency(
  candidate: Candidate,
  definitionsByConcept: ReadonlyMap<string, Candidate[]>,
  reviewedConceptIds: ReadonlySet<string>,
  cohortIds: ReadonlySet<string>,
): { state: DependencyState; note: string; definitionId?: string } {
  if (candidate.routeRole === 'definition') {
    return { state: 'live', note: 'This route is the definition; it owns the concept and depends on no other route.' }
  }
  const owner = candidate.conceptAuthority.canonicalOwner
  const definitions = definitionsByConcept.get(candidate.conceptId) ?? []
  const owned = definitions.filter((d) => d.siteId === owner)

  if (owned.length === 0 && definitions.length > 0) {
    return {
      state: 'incorrectly-owned',
      note: `A definition exists for ${candidate.conceptId} but on ${definitions.map((d) => d.siteId).join(', ')}, not on the declared owner ${owner}.`,
      definitionId: definitions[0].candidateId,
    }
  }
  if (owned.length === 0) {
    if (reviewedConceptIds.has(candidate.conceptId)) {
      return { state: 'satisfied-by-earlier-tranche', note: `Reviewed in Tranches 1-12; treated as a satisfied prerequisite.` }
    }
    return {
      state: 'missing',
      note: `No definition candidate exists for ${candidate.conceptId} on ${owner}. The dependent page is blocked; the prerequisite must not be inferred.`,
    }
  }
  const inCohort = owned.find((d) => cohortIds.has(d.candidateId))
  if (inCohort) return { state: 'present-in-tranche-13', note: `Definition selected in this cohort.`, definitionId: inCohort.candidateId }
  if (reviewedConceptIds.has(candidate.conceptId)) {
    return { state: 'satisfied-by-earlier-tranche', note: 'Definition reviewed in an earlier tranche.', definitionId: owned[0].candidateId }
  }
  // The definition is in the map on the correct property and simply has not
  // been reviewed yet. Reporting that as `missing` sends someone looking for a
  // candidate that already exists; it is also not satisfied, because nothing
  // has reviewed it, so the dependent stays blocked either way.
  return {
    state: 'awaiting-definition-review',
    note: `A definition candidate exists (${owned[0].candidateId}) on ${owner} and has not been reviewed yet. The prerequisite is present but unreviewed.`,
    definitionId: owned[0].candidateId,
  }
}
