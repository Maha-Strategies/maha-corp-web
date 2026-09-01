import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import { classifyPath, PAGE_FAMILIES } from './scaling-page-families.ts'

/**
 * How far the public surface is from a thousand pages, and what stands between.
 *
 * The number that matters is not the gap. It is which of four things each
 * missing page is waiting on, because only one of them is work this repository
 * can do. Compiling a page from evidence that is already released and already
 * inspected is cheap; the other three require a human decision that must not be
 * manufactured to make a chart look better.
 *
 * Counts are derived from a committed observation of the live public surface,
 * so this is reproducible without a network and cannot drift with a deploy.
 * Drafts, redirects, aliases, pagination, filters and parameter permutations
 * are not pages and are not counted as any.
 */

export const SCALING_CAPACITY_VERSION = 'maha-scaling-capacity/1.0' as const
export const PAGE_TARGET = 1_000 as const

export interface FamilyInventory {
  familyId: string
  label: string
  crawlable: number
  requiresCanonicalRelease: boolean
}

export type CapacityBucket =
  | 'publishable-now'
  | 'blocked-on-canonical-release'
  | 'blocked-on-exact-revision-review'
  | 'blocked-on-source-inspection'
  | 'requires-new-records-or-sources'

export interface CapacityModel {
  schemaVersion: typeof SCALING_CAPACITY_VERSION
  target: typeof PAGE_TARGET
  observedAt: string
  sourceDigests: Readonly<Record<string, string>>
  crawlable: number
  gapToTarget: number
  families: readonly FamilyInventory[]
  unclassified: readonly string[]
  buckets: Readonly<Record<CapacityBucket, number>>
  /** Records released and inspected but not yet given a substantial page. */
  publishableNowRecordIds: readonly string[]
  /**
   * What this model can and cannot see.
   *
   * Exact-revision review is only observable through an active canonical
   * release carrying all four scopes, because that is the only place the
   * repository can read a review decision from. A record may well have been
   * reviewed without being released; nothing here can tell. So
   * blocked-on-canonical-release reads zero as a limit of observation, not as a
   * finding, and those records are counted against review instead. Saying so is
   * cheaper than a bucket that quietly cannot fill.
   */
  observability: {
    reviewObservedVia: string
    canonicalReleaseBucketObservable: boolean
    note: string
  }
  boundary: string
}

const paths = observation.sitemapPaths as readonly string[]

/** The crawlable inventory, by family. Every path lands in exactly one. */
export function familyInventory(): { families: FamilyInventory[]; unclassified: string[] } {
  const counts = new Map<string, number>()
  const unclassified: string[] = []
  for (const path of paths) {
    const family = classifyPath(path)
    if (!family) { unclassified.push(path); continue }
    counts.set(family.id, (counts.get(family.id) ?? 0) + 1)
  }
  return {
    families: PAGE_FAMILIES.map((family) => ({
      familyId: family.id,
      label: family.label,
      crawlable: counts.get(family.id) ?? 0,
      requiresCanonicalRelease: family.requiresCanonicalRelease,
    })),
    unclassified: unclassified.sort(),
  }
}

export interface RecordState {
  recordId: string
  alignmentClear: boolean
  exactRevisionReviewed: boolean
  activeCanonicalRelease: boolean
  hasSubstantialPage: boolean
}

/**
 * Which bucket a record's missing page is waiting on.
 *
 * Ordered by what has to happen first. A record that is neither inspected nor
 * released is reported against inspection, because releasing it is not the next
 * possible step.
 */
export function bucketFor(state: RecordState): CapacityBucket | null {
  if (state.hasSubstantialPage) return null
  if (!state.alignmentClear) return 'blocked-on-source-inspection'
  if (!state.exactRevisionReviewed) return 'blocked-on-exact-revision-review'
  if (!state.activeCanonicalRelease) return 'blocked-on-canonical-release'
  return 'publishable-now'
}

export function buildCapacityModel(states: readonly RecordState[]): CapacityModel {
  const { families, unclassified } = familyInventory()
  const buckets: Record<CapacityBucket, number> = {
    'publishable-now': 0,
    'blocked-on-canonical-release': 0,
    'blocked-on-exact-revision-review': 0,
    'blocked-on-source-inspection': 0,
    'requires-new-records-or-sources': 0,
  }
  const publishable: string[] = []
  for (const state of states) {
    const bucket = bucketFor(state)
    if (!bucket) continue
    buckets[bucket] += 1
    if (bucket === 'publishable-now') publishable.push(state.recordId)
  }

  const crawlable = paths.length
  const gap = Math.max(0, PAGE_TARGET - crawlable)
  // Whatever the four evidence buckets cannot supply has to come from records
  // or sources that do not exist yet. Naming that remainder is the point.
  const fromEvidence = buckets['publishable-now'] + buckets['blocked-on-canonical-release']
    + buckets['blocked-on-exact-revision-review'] + buckets['blocked-on-source-inspection']
  buckets['requires-new-records-or-sources'] = Math.max(0, gap - fromEvidence)

  return {
    schemaVersion: SCALING_CAPACITY_VERSION,
    target: PAGE_TARGET,
    observedAt: observation.observedAt as string,
    sourceDigests: Object.fromEntries(Object.entries(observation.sources as Record<string, { sha256: string }>)
      .map(([key, value]) => [key, value.sha256])),
    crawlable,
    gapToTarget: gap,
    families,
    unclassified,
    buckets,
    publishableNowRecordIds: publishable.sort(),
    observability: {
      reviewObservedVia: 'active canonical release carrying all four required scopes',
      canonicalReleaseBucketObservable: false,
      note: 'A record reviewed but not released is indistinguishable here from one never reviewed, so both are counted against exact-revision review.',
    },
    boundary: 'Counts crawlable canonical URLs observed on the public surface. It does not assert that any page ranks, is indexed, or that any claim on it is true.',
  }
}
