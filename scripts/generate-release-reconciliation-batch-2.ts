/**
 * Emits the deterministic batch two release-reconciliation artifact.
 *
 * Only data derived from the record graph is written here. Registry and route
 * observations are operational — they change with no code change — so they are
 * reported separately and never enter the deterministic corpus.
 */
import { writeFileSync } from 'node:fs'

import {
  RELEASE_RECONCILIATION_BOUNDARY,
  RELEASE_RECONCILIATION_STATES,
  RELEASE_RECONCILIATION_VERSION,
  SUBSTANTIAL_COHORT_STATES,
  cohortCounts,
  reconcileBatch2Releases,
  reconciliationDigest,
} from '../lib/substantial-release-reconciliation.ts'

const entries = reconcileBatch2Releases()

const byState = Object.fromEntries(
  RELEASE_RECONCILIATION_STATES.map((state) => [state, entries.filter((entry) => entry.state === state).length]),
)

const blockerTotals: Record<string, number> = {}
for (const entry of entries) for (const blocker of entry.blockers) blockerTotals[blocker] = (blockerTotals[blocker] ?? 0) + 1

const artifact = {
  schemaVersion: RELEASE_RECONCILIATION_VERSION,
  batch: 'substantial-publication-batch-2',
  boundary: RELEASE_RECONCILIATION_BOUNDARY,
  cohortStates: [...SUBSTANTIAL_COHORT_STATES],
  note: 'Registry state, route status, sitemap and llms.txt columns are null here by design: they are observations, not derivable facts. The release report carries them.',
  totals: {
    records: entries.length,
    releaseEligible: entries.filter((entry) => entry.releaseEligible).length,
    byState,
    deterministicCohort: cohortCounts(entries),
  },
  blockerTotals: Object.fromEntries(Object.entries(blockerTotals).sort(([left], [right]) => left.localeCompare(right))),
  digest: reconciliationDigest(entries),
  records: entries.map((entry) => ({
    recordId: entry.recordId,
    domainSlug: entry.domainSlug,
    canonicalUrl: entry.canonicalUrl,
    contractDigest: entry.contractDigest,
    auditedRecordRevision: entry.auditedRecordRevision,
    currentRecordRevision: entry.currentRecordRevision,
    releaseEligible: entry.releaseEligible,
    state: entry.state,
    blockers: entry.blockers,
    proposedAction: entry.proposedAction,
  })),
}

writeFileSync('content/substantial-pages/release-reconciliation-batch-2.json', `${JSON.stringify(artifact, null, 2)}\n`)

const lines: string[] = []
lines.push('# Batch two release reconciliation — deterministic preflight', '')
lines.push('Generated from the record graph alone. Registry and production observations are')
lines.push('operational and live in the release report, not here, so this file regenerates')
lines.push('byte-identically.', '')
lines.push(`Digest: \`${artifact.digest}\``, '')
lines.push('## States', '', '| State | Records |', '|---|---|')
for (const [state, count] of Object.entries(byState)) lines.push(`| \`${state}\` | ${count} |`)
lines.push('', '## Blockers', '', '| Blocker | Records |', '|---|---|')
for (const [blocker, count] of Object.entries(artifact.blockerTotals)) lines.push(`| \`${blocker}\` | ${count} |`)
lines.push('', '## Records', '')
lines.push('| Record | Domain | Release eligible | State |', '|---|---|---|---|')
for (const entry of entries) {
  lines.push(`| ${entry.recordId.replace('urn:maha:record:', '')} | ${entry.domainSlug} | ${entry.releaseEligible ? 'yes' : 'no'} | \`${entry.state}\` |`)
}
lines.push('', RELEASE_RECONCILIATION_BOUNDARY, '')
writeFileSync('docs/substantial-pages/release-reconciliation-batch-2.md', lines.join('\n'))

console.log(JSON.stringify({ records: entries.length, byState, releaseEligible: artifact.totals.releaseEligible, digest: artifact.digest }, null, 1))
