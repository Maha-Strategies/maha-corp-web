import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import { alignmentBlockers, alignmentFor } from '../lib/frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import batch12a from '../content/batch-12a/source-investigations.json' with { type: 'json' }
import batch12b from '../content/batch-12b/source-investigations.json' with { type: 'json' }

/**
 * How far each source is from carrying a reference page, and what it would cost.
 *
 * The zero-cascade result came from every release-ready record sitting in a set
 * with siblings still unreleased. This measures that distance per source and,
 * more importantly, what kind of action closes it: a release is cheap, an
 * inspection is slower, and a source replacement means the record was never
 * about this source in the first place.
 *
 * Positional co-assignment is not membership. A record that shares a source
 * only because a template put it there counts against the cluster, not toward
 * it, until record-level alignment says otherwise.
 */

const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
const active = observation.releases.filter((entry) => entry.status === 'active')
const releasedIds = new Set(active.map((entry) => entry.recordId))
const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const clear = (id: string) => pilotAlignmentFor(id) ? isPilotAlignmentClear(id) : alignmentBlockers(id).length === 0

const reviewState = new Map((projection.projections as { recordId: string; classification: string }[])
  .map((entry) => [entry.recordId, entry.classification]))

/** Records a batch proved need a different source entirely. */
const needsReplacement = new Set<string>()
for (const entry of batch12a.investigations as Record<string, unknown>[]) {
  if (entry.candidateReplacement || entry.subjectAlignmentVerdict === 'mismatched') needsReplacement.add(String(entry.recordId))
}
for (const source of batch12b.sources as Record<string, unknown>[]) {
  if (source.verdict === 'subject-mismatch') for (const id of source.records as string[]) needsReplacement.add(id)
}

type SourceEntry = (typeof inventory.sources)[number]
const graph = (inventory.sources as SourceEntry[]).map((source) => {
  const bound = source.boundRecords.map((entry) => {
    const recordId = entry.recordId
    const alignmentClear = clear(recordId)
    return {
      recordId,
      revisionSha256: entry.revisionSha256,
      released: releasedIds.has(recordId),
      alignmentClear,
      reviewState: reviewState.get(recordId) ?? 'not-projected',
      // Positional co-assignment does not make a record part of the cluster.
      // Only record-level alignment does.
      validClusterMember: alignmentClear && !needsReplacement.has(recordId),
      needsSourceReplacement: needsReplacement.has(recordId),
    }
  })

  const unreleased = bound.filter((entry) => !entry.released)
  const actions = {
    // Cheapest: alignment-clear, exact-reviewed, just needs releasing.
    releaseOnly: unreleased.filter((entry) => entry.validClusterMember && entry.reviewState === 'release-ready').length,
    // Needs a review before it can be released.
    reviewThenRelease: unreleased.filter((entry) => entry.validClusterMember && entry.reviewState !== 'release-ready').length,
    // Needs source inspection before anything else.
    inspectThenReviewThenRelease: unreleased.filter((entry) => !entry.validClusterMember && !entry.needsSourceReplacement).length,
    // The record is not about this source at all.
    replaceSource: unreleased.filter((entry) => entry.needsSourceReplacement).length,
  }
  const governedActions = actions.releaseOnly + (actions.reviewThenRelease * 2)
    + (actions.inspectThenReviewThenRelease * 3) + (actions.replaceSource * 4)

  return {
    sourceId: source.sourceId,
    title: source.title,
    inspectionDepth: source.inspectionDepth,
    identityConflicted: source.identityConflicted,
    rightsBasis: source.rightsBasis,
    totalBoundRecords: bound.length,
    releasedRecords: bound.filter((entry) => entry.released).length,
    unreleasedRecords: unreleased.length,
    alignmentClearUnreleased: unreleased.filter((entry) => entry.alignmentClear).length,
    alignmentBlocked: bound.filter((entry) => !entry.alignmentClear).length,
    lackingExactReview: bound.filter((entry) => entry.reviewState !== 'release-ready' && !entry.released).length,
    requiringSourceReplacement: bound.filter((entry) => entry.needsSourceReplacement).length,
    mismatched: source.identityConflicted ? bound.length : 0,
    validClusterMembers: bound.filter((entry) => entry.validClusterMember).length,
    actions,
    // The honest number: how many governed acts stand between here and a page.
    minimumGovernedActions: unreleased.length === 0 ? 0 : governedActions,
    pageBlockedBy: source.inspectionDepth !== 'section-or-full-text' ? 'shallow-inspection'
      : source.identityConflicted ? 'mismatch'
      : unreleased.length > 0 ? 'unreleased-records'
      : bound.filter((entry) => entry.released).length < 2 ? 'too-thin' : null,
    boundRecords: bound,
  }
}).sort((a, b) => a.sourceId.localeCompare(b.sourceId))

const blocked = graph.filter((entry) => entry.pageBlockedBy !== null)

mkdirSync('content/source-cluster', { recursive: true })
writeFileSync('content/source-cluster/deficit-graph.json', `${JSON.stringify({
  schemaVersion: 'maha-source-cluster-deficit/1.0',
  uniqueSources: graph.length,
  eligibleNow: graph.filter((entry) => entry.pageBlockedBy === null).length,
  blocked: blocked.length,
  blockedBy: blocked.reduce((counts: Record<string, number>, entry) => {
    counts[String(entry.pageBlockedBy)] = (counts[String(entry.pageBlockedBy)] ?? 0) + 1
    return counts
  }, {}),
  actionCost: {
    releaseOnly: 1, reviewThenRelease: 2, inspectThenReviewThenRelease: 3, replaceSource: 4,
    note: 'Weights are the number of governed decisions each path needs, so a cluster needing one release ranks above one needing one inspection.',
  },
  deficitDistribution: blocked.reduce((counts: Record<string, number>, entry) => {
    const key = String(entry.unreleasedRecords)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {}),
  sources: graph,
  boundary: 'A private model of distance to eligibility. Positional co-assignment is counted against a cluster, never toward it.',
  graphDigest: digest(graph),
}, null, 2)}\n`)

process.stdout.write(`${JSON.stringify({
  uniqueSources: graph.length,
  eligibleNow: graph.filter((entry) => entry.pageBlockedBy === null).length,
  blockedBy: blocked.reduce((counts: Record<string, number>, entry) => {
    counts[String(entry.pageBlockedBy)] = (counts[String(entry.pageBlockedBy)] ?? 0) + 1
    return counts
  }, {}),
  smallestDeficits: blocked.filter((entry) => entry.pageBlockedBy === 'unreleased-records')
    .sort((a, b) => a.minimumGovernedActions - b.minimumGovernedActions)
    .slice(0, 8)
    .map((entry) => ({ source: entry.sourceId.slice(0, 40), unreleased: entry.unreleasedRecords, actions: entry.minimumGovernedActions, breakdown: entry.actions })),
}, null, 2)}\n`)
