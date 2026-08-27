/**
 * Emits the deterministic rereview artifacts: one reviewer packet and one
 * decision ledger per revision, one summary, and one release-readiness
 * preflight report. No timestamps and no operational identifiers.
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { auditedRecord, revisionAudit } from '../lib/substantial-revision-alignment-audit.ts'
import {
  REPAIRED_REREVIEW_BOUNDARY,
  REPAIRED_REREVIEW_CHECKLIST_VERSION,
  REPAIRED_REREVIEW_LEDGERS,
  REREVIEW_DIMENSIONS,
  releasePreflightReports,
} from '../lib/substantial-repaired-record-rereview.ts'

const preflight = releasePreflightReports()

const reviewerPackets = REPAIRED_REREVIEW_LEDGERS.map((ledger) => {
  const record = auditedRecord(ledger.recordId)
  const audit = revisionAudit(ledger.recordId)!
  const source = record.sources[0]!
  const unsigned = {
    recordId: ledger.recordId,
    revisionSha256: ledger.revisionSha256,
    auditDigest: audit.auditDigest,
    auditedCanonicalPath: audit.auditedCanonicalPath,
    title: record.title,
    slug: record.slug,
    recordKind: record.recordKind,
    claimStatement: record.claims[0]!.statement,
    claimScope: record.claims[0]!.scope,
    claimBoundary: record.claims[0]!.boundary,
    sourceTitle: source.title,
    sourceUrl: source.url,
    sourceIdentifiers: source.identifiers,
    exactLocator: source.exactLocator,
    rightsBasis: source.rights.basis,
    boundaries: record.boundaries,
    prohibitedInferences: record.prohibitedInferences,
    checklistVersion: REPAIRED_REREVIEW_CHECKLIST_VERSION,
    boundary: REPAIRED_REREVIEW_BOUNDARY,
  }
  return { ...unsigned, packetDigest: `sha256:${createHash('sha256').update(JSON.stringify(unsigned)).digest('hex')}` }
})

const artifact = {
  schemaVersion: REPAIRED_REREVIEW_CHECKLIST_VERSION,
  cohort: 'substantial-publication-batch-2-repaired-revisions',
  boundary: REPAIRED_REREVIEW_BOUNDARY,
  dimensions: [...REREVIEW_DIMENSIONS],
  summary: {
    revisionsReviewed: REPAIRED_REREVIEW_LEDGERS.length,
    dimensionDecisions: REPAIRED_REREVIEW_LEDGERS.reduce((total, ledger) => total + ledger.decisions.length, 0),
    byState: REPAIRED_REREVIEW_LEDGERS.reduce<Record<string, number>>((totals, ledger) => {
      totals[ledger.state] = (totals[ledger.state] ?? 0) + 1
      return totals
    }, {}),
    canonicalReleasesCreated: 0,
    releaseAuthorityUsed: false,
    frozenRemainderCohortModified: false,
  },
  reviewerPackets,
  ledgers: REPAIRED_REREVIEW_LEDGERS,
  releasePreflight: preflight,
  digest: `sha256:${createHash('sha256').update(JSON.stringify([reviewerPackets, REPAIRED_REREVIEW_LEDGERS, preflight])).digest('hex')}`,
}

writeFileSync('content/substantial-pages/repaired-record-rereview-batch-2.json', `${JSON.stringify(artifact, null, 2)}\n`)

const lines: string[] = []
lines.push('# Batch 2 repaired revisions — internal rereview', '')
lines.push(REPAIRED_REREVIEW_BOUNDARY, '')
lines.push(`Digest: \`${artifact.digest}\``, '')
lines.push('## Summary', '', '| Record | Revision | Approve | Revise | Withhold | State |', '|---|---|---|---|---|---|')
for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
  lines.push(`| ${ledger.recordId.replace('urn:maha:record:', '')} | \`${ledger.revisionSha256.slice(7, 23)}\` | ${ledger.verdictTotals.approve} | ${ledger.verdictTotals.revise} | ${ledger.verdictTotals.withhold} | \`${ledger.state}\` |`)
}
lines.push('')
lines.push(`Canonical releases created: **${artifact.summary.canonicalReleasesCreated}**. Release authority used: **no**. Frozen 20-record remainder cohort modified: **no**.`, '')
for (const ledger of REPAIRED_REREVIEW_LEDGERS) {
  lines.push(`## \`${ledger.recordId.replace('urn:maha:record:', '')}\``, '')
  lines.push(`Revision \`${ledger.revisionSha256}\``, '')
  lines.push('| Dimension | Verdict | Rationale | Disagreement or uncertainty |', '|---|---|---|---|')
  for (const decision of ledger.decisions) {
    lines.push(`| \`${decision.dimension}\` | **${decision.verdict}** | ${decision.rationale} | ${decision.disagreementsOrUncertainty} |`)
  }
  lines.push('', `**State: \`${ledger.state}\`**`)
  if (ledger.blockingDimensions.length > 0) lines.push('', `Blocking: ${ledger.blockingDimensions.map((dimension) => `\`${dimension}\``).join(', ')}`)
  lines.push('')
}
lines.push('## Release-readiness preflight', '')
lines.push('| Record | Internally approved | Canonical release created | Release authority used | In frozen cohort |', '|---|---|---|---|---|')
for (const report of preflight) {
  lines.push(`| ${report.recordId.replace('urn:maha:record:', '')} | ${report.internallyApproved ? 'yes' : 'no'} | no | no | no |`)
}
lines.push('')
for (const report of preflight) lines.push(`- **${report.recordId.replace('urn:maha:record:', '')}** — ${report.proposedNextStep}`)
lines.push('')
lines.push('Internal approval is an editorial state. It creates no canonical release, and neither record joins the frozen 20-record remainder cohort. A separate two-record repaired-revision canary is proposed for a later task and is deliberately not created or dispatched here.', '')
writeFileSync('docs/substantial-pages/repaired-record-rereview-batch-2.md', lines.join('\n'))

console.log(JSON.stringify({ summary: artifact.summary, digest: artifact.digest }, null, 1))
