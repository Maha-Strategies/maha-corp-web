import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from '../lib/repaired-revision-canary-targets.ts'
import graph from '../content/source-cluster/deficit-graph.json' with { type: 'json' }

/**
 * Batch 1 is chosen by deficit, not by size. The 20-record cluster is the
 * largest theoretical prize on the graph and is deliberately excluded: its
 * distance to a page is 52 governed acts, which is not a batch, it is a
 * programme. Frozen before any research so the research cannot pick winners.
 */

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((r) => [r.id, r]))
const eligible = (graph.sources as Record<string, unknown>[]).filter((s) => s.pageBlockedBy === 'unreleased-records')
const ranked = [...eligible].sort((a, b) => a.minimumGovernedActions - b.minimumGovernedActions
  || a.unreleasedRecords - b.unreleasedRecords || a.sourceId.localeCompare(b.sourceId))
const selected = ranked.slice(0, 5)
const excluded = ranked.slice(5)

const cohort = selected.map((source) => {
  const openRecords = (source.boundRecords as Record<string, unknown>[]).filter((r) => !r.released)
  // Deduplicate: the inventory binds one MCP record twice under one source.
  const seen = new Set<string>()
  const unique = openRecords.filter((r) => !seen.has(r.recordId) && seen.add(r.recordId))
  return {
    sourceId: source.sourceId,
    title: source.title,
    inspectionDepth: source.inspectionDepth,
    rightsBasis: source.rightsBasis,
    boundRecordCount: new Set((source.boundRecords as { recordId: string }[]).map((r) => r.recordId)).size,
    releasedRecords: source.releasedRecords,
    minimumGovernedActions: source.minimumGovernedActions,
    openRecords: unique.map((r) => ({
      recordId: r.recordId,
      revisionSha256: r.revisionSha256,
      alignmentClear: r.alignmentClear,
      reviewState: r.reviewState,
      blockers: pilotAlignmentFor(r.recordId) ? [] : alignmentBlockers(r.recordId),
      claim: records.get(r.recordId)?.claim ?? null,
      requiredAction: r.alignmentClear ? 'release' : 'inspect-then-review-then-release',
    })),
  }
})

const frozen = {
  schemaVersion: 'maha-source-cluster-cohort/1.0',
  batch: 'source-cluster-closure-batch-1',
  frozenAt: '2026-09-02',
  selectionRule: 'smallest minimumGovernedActions, ties broken by fewest unreleased records then source id',
  frozenBeforeResearch: true,
  clusters: cohort,
  totals: {
    clusters: cohort.length,
    openRecords: cohort.reduce((n, c) => n + c.openRecords.length, 0),
    needingInspection: cohort.reduce((n, c) => n + c.openRecords.filter((r) => !r.alignmentClear).length, 0),
    needingReleaseOnly: cohort.reduce((n, c) => n + c.openRecords.filter((r) => r.alignmentClear).length, 0),
    governedActions: cohort.reduce((n, c) => n + c.minimumGovernedActions, 0),
  },
  deliberatelyExcluded: excluded.slice(0, 3).map((s) => ({ sourceId: s.sourceId, actions: s.minimumGovernedActions, unreleased: s.unreleasedRecords })),
  largestClusterExcluded: (() => {
    const biggest = [...eligible].sort((a, b) => b.unreleasedRecords - a.unreleasedRecords)[0]
    return { sourceId: biggest.sourceId, unreleasedRecords: biggest.unreleasedRecords,
      minimumGovernedActions: biggest.minimumGovernedActions,
      reason: 'Largest theoretical yield, worst honest deficit. Excluded by rule, not by preference.' }
  })(),
}

mkdirSync('content/source-cluster', { recursive: true })
const digest = `sha256:${createHash('sha256').update(canonicalJson(frozen), 'utf8').digest('hex')}`
writeFileSync('content/source-cluster/batch-1-cohort.json', `${JSON.stringify({ ...frozen, cohortDigest: digest }, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ totals: frozen.totals, digest,
  clusters: cohort.map((c) => ({ source: c.sourceId.slice(0, 46), acts: c.minimumGovernedActions, open: c.openRecords.length,
    inspect: c.openRecords.filter((r) => !r.alignmentClear).map((r) => r.recordId.replace('urn:maha:record:', '')) })),
  excluded: frozen.largestClusterExcluded }, null, 2)}\n`)
