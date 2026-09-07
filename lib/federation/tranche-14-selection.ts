/**
 * Tranche 14 selection: dependency-first.
 *
 * Tranche 13 left 38 candidates blocked on 17 distinct prerequisites. The brief
 * asks that high-fan-out definitions be prioritised, and the diagnosis showed
 * that policy has almost no room to operate here: of the 17, only four exist in
 * the remaining pool, and each of those unlocks exactly one dependent. The
 * thirteen prerequisites that would unlock the rest — claim intake, evidence
 * dossiers, runtime witness receipts, uncertainty recording, and nine more, all
 * declared to maha-research — are absent from the frozen candidate map
 * altogether.
 *
 * So the rule is: select every available prerequisite first, ordered by fan-out
 * and then by candidate id, and fill the rest by the established policy. That
 * yields four unlocks rather than thirty-eight, and the shortfall is a property
 * of the map rather than of the selection. Inventing the missing definitions
 * would manufacture the unlock, which is the one thing the brief forbids.
 */
import {
  byUtility, COHORT_SIZE, PROPORTIONAL_TARGET, TOPIC_CAP, topicOf,
  type Candidate,
} from './tranche-13-selection.ts'

export { byUtility, COHORT_SIZE, PROPORTIONAL_TARGET, TOPIC_CAP, topicOf }
export type { Candidate }

export type Prerequisite = {
  conceptId: string
  declaredOwner: string
  /** Tranche 13 candidates this definition would unblock. */
  unlocks: number
  /** The definition candidate in the remaining pool, when one exists. */
  supplierCandidateId: string | null
  supplierPath: string | null
  availability: 'available-in-pool' | 'wrong-owner-in-pool' | 'absent-from-frozen-map'
}

/**
 * Diagnoses one required concept against the pool.
 *
 * `wrong-owner-in-pool` is kept as a distinct outcome even though none occurs:
 * collapsing it into "absent" would hide a repairable mis-ownership behind a
 * finding that reads as a gap in the map.
 */
export function diagnosePrerequisite(
  conceptId: string,
  declaredOwner: string,
  unlocks: number,
  pool: readonly Candidate[],
): Prerequisite {
  const atOwner = pool.find(
    (c) => c.conceptId === conceptId && c.routeRole === 'definition' && c.siteId === declaredOwner)
  if (atOwner) {
    return {
      conceptId, declaredOwner, unlocks,
      supplierCandidateId: atOwner.candidateId, supplierPath: atOwner.path,
      availability: 'available-in-pool',
    }
  }
  const elsewhere = pool.find((c) => c.conceptId === conceptId && c.routeRole === 'definition')
  if (elsewhere) {
    return {
      conceptId, declaredOwner, unlocks,
      supplierCandidateId: elsewhere.candidateId, supplierPath: elsewhere.path,
      availability: 'wrong-owner-in-pool',
    }
  }
  return { conceptId, declaredOwner, unlocks, supplierCandidateId: null, supplierPath: null, availability: 'absent-from-frozen-map' }
}

/** Highest fan-out first; candidate id breaks ties so the order is reproducible. */
export function byFanOut(a: Prerequisite, b: Prerequisite): number {
  return b.unlocks - a.unlocks || (a.conceptId < b.conceptId ? -1 : a.conceptId > b.conceptId ? 1 : 0)
}

export type Tranche14Selection = {
  entries: Candidate[]
  prerequisitesSelected: Prerequisite[]
  projectedUnlocks: number
  poolBefore: number
  poolAfter: number
  shortfalls: { siteId: string; target: number; available: number; selected: number }[]
}

/**
 * Selects the cohort, prerequisites first.
 *
 * The topic cap applies to the filler but not to a prerequisite: a definition
 * that unblocks dependents is selected because of what it unblocks, and letting
 * a cap displace it would defeat the whole dependency-first ordering. The
 * exemption is bounded — only prerequisites are exempt, and there are four.
 */
export function selectTranche14(
  pool: readonly Candidate[],
  prerequisites: readonly Prerequisite[],
  size = COHORT_SIZE,
): Tranche14Selection {
  const available = [...prerequisites].filter((p) => p.availability === 'available-in-pool').sort(byFanOut)
  const byId = new Map(pool.map((c) => [c.candidateId, c]))

  const chosen: Candidate[] = []
  const takenIds = new Set<string>()
  for (const prerequisite of available) {
    const candidate = prerequisite.supplierCandidateId ? byId.get(prerequisite.supplierCandidateId) : undefined
    if (candidate && !takenIds.has(candidate.candidateId)) {
      chosen.push(candidate)
      takenIds.add(candidate.candidateId)
    }
  }

  const perTopic = new Map<string, number>()
  for (const c of chosen) {
    const key = `${c.siteId}::${topicOf(c)}`
    perTopic.set(key, (perTopic.get(key) ?? 0) + 1)
  }

  const remaining = [...pool].filter((c) => !takenIds.has(c.candidateId)).sort(byUtility)
  const perSite = new Map<string, number>()
  for (const c of chosen) perSite.set(c.siteId, (perSite.get(c.siteId) ?? 0) + 1)

  const availableBySite = new Map<string, number>()
  for (const c of pool) availableBySite.set(c.siteId, (availableBySite.get(c.siteId) ?? 0) + 1)

  // Proportional targets, bounded by what the pool actually holds. A target
  // above the remaining inventory is a shortfall to record, not a quota to miss
  // quietly.
  const targets = new Map<string, number>()
  for (const [siteId, target] of Object.entries(PROPORTIONAL_TARGET)) {
    targets.set(siteId, Math.min(target, availableBySite.get(siteId) ?? 0))
  }

  for (const pass of [true, false]) {
    for (const candidate of remaining) {
      if (chosen.length >= size) break
      if (takenIds.has(candidate.candidateId)) continue
      const topicKey = `${candidate.siteId}::${topicOf(candidate)}`
      if ((perTopic.get(topicKey) ?? 0) >= TOPIC_CAP) continue
      const target = targets.get(candidate.siteId) ?? 0
      const taken = perSite.get(candidate.siteId) ?? 0
      // First pass honours the proportional target; the second fills whatever
      // capacity the targets could not absorb.
      if (pass && taken >= target) continue
      chosen.push(candidate)
      takenIds.add(candidate.candidateId)
      perTopic.set(topicKey, (perTopic.get(topicKey) ?? 0) + 1)
      perSite.set(candidate.siteId, taken + 1)
    }
  }

  const shortfalls = Object.entries(PROPORTIONAL_TARGET)
    .map(([siteId, target]) => ({
      siteId, target,
      available: availableBySite.get(siteId) ?? 0,
      selected: perSite.get(siteId) ?? 0,
    }))
    .filter((s) => s.selected < s.target)
    .sort((a, b) => a.siteId.localeCompare(b.siteId))

  return {
    entries: chosen,
    prerequisitesSelected: available,
    projectedUnlocks: available.reduce((sum, p) => sum + p.unlocks, 0),
    poolBefore: pool.length,
    poolAfter: pool.length - chosen.length,
    shortfalls,
  }
}
