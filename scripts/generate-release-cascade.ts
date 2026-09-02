import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentBlockers, alignmentFor } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { REVIEW_AXES } from '../lib/exact-revision-review.ts'
import { REVIEW_TIERS } from '../lib/review-tier.ts'
import { sourceSlug } from '../lib/source-reference-projection.ts'
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }

/**
 * What releasing each of the 33 actually unlocks.
 *
 * Not 33 pages. A release unlocks its own canonical route, and it may complete
 * a source-reference aggregate - but only if every other record bound to that
 * source is already released, since one unreleased claim refuses the whole
 * page. Most of the 33 sit in groups where several siblings are still
 * unreleased, so the marginal source page arrives on the last release of a set
 * rather than on each one.
 */

const TIER = REVIEW_TIERS['automated-internal-editorial']
const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const active = observation.releases.filter((entry) => entry.status === 'active')
const releasedIds = new Set(active.map((entry) => entry.recordId))
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const clear = (id: string) => pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0

const readyIds = (projection.projections as { recordId: string; classification: string }[])
  .filter((entry) => entry.classification === 'release-ready').map((entry) => entry.recordId).sort()

type SourceEntry = (typeof inventory.sources)[number]
const sourceOf = new Map<string, SourceEntry>()
for (const source of inventory.sources as SourceEntry[]) {
  for (const bound of source.boundRecords) sourceOf.set(bound.recordId, source)
}

/** Records still unreleased in a source's set, ignoring the record itself. */
const siblingsUnreleased = (recordId: string) => {
  const source = sourceOf.get(recordId)
  if (!source) return null
  return source.boundRecords.filter((bound) => bound.recordId !== recordId && !releasedIds.has(bound.recordId)).length
}

const cascade = readyIds.map((recordId) => {
  const record = records.get(recordId)!
  const source = sourceOf.get(recordId)
  const remaining = siblingsUnreleased(recordId)
  // A source page becomes possible only when this release is the last one
  // missing, and only if the source was inspected deeply and is not mismatched.
  const completesSourceSet = remaining === 0 && source !== undefined
    && source.inspectionDepth === 'section-or-full-text' && !source.identityConflicted
  const bridges = ((record.bridges ?? []) as unknown[]).length
  const components = {
    directRoute: 10,
    completesSourceAggregate: completesSourceSet ? 12 : 0,
    // Being one of several still missing is worth something, but far less: the
    // page does not arrive until the last of them.
    advancesSourceAggregate: remaining !== null && remaining > 0 ? Math.max(0, 6 - remaining) : 0,
    bridgeEndpoints: Math.min(bridges, 5) * 2,
    domainConnectivity: Math.min([...records.values()].filter((entry) => entry.domainSlug === record.domainSlug).length, 30) / 6,
    alignmentCurrent: clear(recordId) ? 5 : 0,
  }
  const total = Math.round(Object.values(components).reduce((sum, value) => sum + value, 0) * 100) / 100
  return {
    recordId,
    domainSlug: record.domainSlug,
    revisionSha256: digest(record),
    auditSha256: digest(alignmentFor(recordId) ?? null),
    reviewAxes: [...REVIEW_AXES],
    reviewBundleDigest: digest({ recordId, revision: digest(record), axes: [...REVIEW_AXES], tier: TIER.reviewerKind }),
    releaseClassification: releasedIds.has(recordId) ? 'superseding' : 'initial',
    directRouteUnlocked: 1,
    completesSourceAggregate: completesSourceSet,
    additionalSourcePagesUnlocked: completesSourceSet ? 1 : 0,
    sourceSetRemaining: remaining,
    sourceSlug: source ? sourceSlug(source.sourceId) : null,
    bridgeEndpoints: bridges,
    alignmentClear: clear(recordId),
    staleOrSupersedingRisk: releasedIds.has(recordId) ? 'superseding-existing-release' : 'none',
    components,
    total,
  }
}).sort((a, b) => b.total - a.total || a.recordId.localeCompare(b.recordId))

/* ------------------------------------------------------- canary of five -- */

/**
 * Five records, at least three domains, chosen greedily by unlock value.
 *
 * Domain spread is a constraint rather than a score: taking the top five by
 * value alone would cluster, and a cluster proves the pipeline against one set
 * of source conventions instead of three.
 */
const canary: typeof cascade = []
for (const entry of cascade) {
  if (canary.length >= 5) break
  const domains = new Set(canary.map((selected) => selected.domainSlug))
  const slotsLeft = 5 - canary.length
  const domainsNeeded = Math.max(0, 3 - domains.size)
  // Reserve the last slots for unseen domains when three are not yet covered.
  if (domains.has(entry.domainSlug) && slotsLeft <= domainsNeeded) continue
  canary.push(entry)
}
const remainder = cascade.filter((entry) => !canary.includes(entry))

mkdirSync('content/release-cascade', { recursive: true })
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

write('content/release-cascade/cascade-model.json', {
  schemaVersion: 'maha-release-cascade/1.0',
  releaseReadyCount: cascade.length,
  scoringModel: {
    directRoute: '10 for the record’s own canonical route',
    completesSourceAggregate: '12 when this release is the last one missing from a deeply inspected, unmismatched source set',
    advancesSourceAggregate: 'max(0, 6 - siblings still unreleased); the page arrives only on the last of them',
    bridgeEndpoints: 'min(bridges,5) x 2',
    domainConnectivity: 'min(domain size,30) / 6',
    alignmentCurrent: '5 when the record is alignment-clear now',
  },
  directRoutesUnlocked: cascade.length,
  sourcePagesUnlocked: cascade.filter((entry) => entry.completesSourceAggregate).length,
  note: 'Direct routes and source pages are disjoint: a source page is a new route, a record route is its own. Neither is counted twice.',
  cascade,
})
write('content/release-cascade/canary-manifest.json', {
  schemaVersion: 'maha-release-canary/1.0', released: false, executed: false,
  tier: TIER, releaseAuthority: 'separate, required for activation and not held by the reviewer',
  cohortSize: canary.length, domains: [...new Set(canary.map((entry) => entry.domainSlug))].sort(),
  directRoutes: canary.length,
  sourcePagesUnlocked: canary.filter((entry) => entry.completesSourceAggregate).length,
  canary,
  boundary: 'A prepared cohort. Nothing here is released, dispatched or public.',
})
write('content/release-cascade/remainder-manifest.json', {
  schemaVersion: 'maha-release-remainder/1.0', released: false,
  cohortSize: remainder.length,
  directRoutes: remainder.length,
  sourcePagesUnlocked: remainder.filter((entry) => entry.completesSourceAggregate).length,
  controls: {
    staleReview: 'a review bundle naming a revision other than the one released refuses',
    mismatch: 'a record without current alignment clearance refuses',
    aggregate: 'one unreleased claim refuses the whole source page rather than shrinking it',
  },
  remainder,
  boundary: 'A prepared remainder. Nothing here is released.',
})

process.stdout.write(`${JSON.stringify({
  releaseReady: cascade.length,
  directRoutes: cascade.length,
  sourcePagesUnlockedByAll33: cascade.filter((entry) => entry.completesSourceAggregate).length,
  canary: { size: canary.length, domains: [...new Set(canary.map((entry) => entry.domainSlug))].length, sourcePages: canary.filter((entry) => entry.completesSourceAggregate).length },
  remainder: { size: remainder.length, sourcePages: remainder.filter((entry) => entry.completesSourceAggregate).length },
}, null, 2)}\n`)
