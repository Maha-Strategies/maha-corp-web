/**
 * Emits the deterministic Batch 2 remainder review artifacts.
 *
 * Nothing operational is written here: no timestamps, release identifiers, or
 * production observations, so the artifacts regenerate byte-identically. The
 * production run records its own append-only operational observation.
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import { EXPERT_REVIEW_CRITERIA } from '../lib/epistemic-review.ts'
import { BATCH_2_INTERNAL_REVIEW_PACKETS } from '../lib/substantial-internal-review-batch-2.ts'
import {
  BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS,
  BATCH_2_REMAINDER_REVIEWS,
  INTERNAL_REVIEW_REMAINDER_SUMMARY,
  INTERNAL_REVIEW_REMAINDER_VERSION,
  remainderInternalReviewInputs,
} from '../lib/substantial-internal-review-remainder.ts'

const summary = INTERNAL_REVIEW_REMAINDER_SUMMARY
const inputs = remainderInternalReviewInputs()
const packetById = new Map(BATCH_2_INTERNAL_REVIEW_PACKETS.map((packet) => [packet.recordId, packet]))

const records = BATCH_2_REMAINDER_REVIEWS.map((entry) => {
  const packet = packetById.get(entry.recordId)!
  const decisions = inputs.filter((input) => input.recordId === entry.recordId)
  return {
    recordId: entry.recordId,
    domainSlug: packet.domainSlug,
    title: packet.title,
    targetSha256: packet.targetSha256,
    contractDigest: packet.contractDigest,
    packetDigest: packet.packetDigest,
    disposition: entry.disposition,
    sourceFidelityBasis: entry.sourceFidelityBasis,
    releaseKind: entry.releaseKind,
    sources: packet.sources.map((source) => ({ sourceId: source.sourceId, title: source.title, exactLocator: source.exactLocator, rightsBasis: source.rightsBasis })),
    findings: entry.scopes,
    unsatisfied: entry.unsatisfied,
    blockers: entry.blockers,
    remediation: entry.remediation,
    scopedDecisions: decisions.length,
    criterionDecisions: decisions.reduce((total, decision) => total + decision.criteria.length, 0),
    driftReAudit: packet.driftReAudit,
  }
})

const artifact = {
  schemaVersion: INTERNAL_REVIEW_REMAINDER_VERSION,
  cohort: 'substantial-publication-batch-2-remainder',
  assuranceTier: 'internally-reviewed-canonical',
  boundary: summary.boundary,
  criteriaPerRecord: Object.values(EXPERT_REVIEW_CRITERIA).reduce((total, criteria) => total + criteria.length, 0),
  counts: {
    reviewed: records.length,
    approved: summary.approved.length,
    rejected: summary.rejected.length,
    reviseAndRereview: summary.reviseAndRereview.length,
    blocked: summary.blocked.length,
    initialReleaseCandidates: summary.initialReleaseCandidates.length,
    supersedingReleaseCandidates: summary.supersedingReleaseCandidates.length,
    recordedReviewDecisions: inputs.length,
    criterionDecisions: inputs.reduce((total, decision) => total + decision.criteria.length, 0),
    stillWithheld: summary.stillWithheld.length,
  },
  sets: {
    reviewed: [...BATCH_2_INTERNAL_REVIEW_REMAINDER_IDS],
    approved: [...summary.approved],
    rejected: [...summary.rejected],
    reviseAndRereview: [...summary.reviseAndRereview],
    blocked: [...summary.blocked],
    initialReleaseCandidates: [...summary.initialReleaseCandidates],
    supersedingReleaseCandidates: [...summary.supersedingReleaseCandidates],
    stillWithheld: [...summary.stillWithheld],
  },
  records,
  digest: `sha256:${createHash('sha256').update(JSON.stringify(records)).digest('hex')}`,
}

writeFileSync('content/substantial-pages/internal-review-batch-2-remainder.json', `${JSON.stringify(artifact, null, 2)}\n`)

const lines: string[] = []
lines.push('# Batch 2 internal review — remaining 22 records', '')
lines.push(summary.boundary, '')
lines.push(`Digest: \`${artifact.digest}\``, '')
lines.push('## Counts', '', '| Set | Records |', '|---|---|')
lines.push(`| reviewed | ${artifact.counts.reviewed} |`)
lines.push(`| approved | ${artifact.counts.approved} |`)
lines.push(`| rejected | ${artifact.counts.rejected} |`)
lines.push(`| revise-and-rereview | ${artifact.counts.reviseAndRereview} |`)
lines.push(`| blocked | ${artifact.counts.blocked} |`)
lines.push(`| initial-release candidates | ${artifact.counts.initialReleaseCandidates} |`)
lines.push(`| superseding-release candidates | ${artifact.counts.supersedingReleaseCandidates} |`)
lines.push(`| recorded review decisions | ${artifact.counts.recordedReviewDecisions} |`)
lines.push(`| criterion decisions | ${artifact.counts.criterionDecisions} |`)
lines.push(`| still withheld | ${artifact.counts.stillWithheld} |`, '')
lines.push('Released records are reported by the production operator, not by this artifact: publication is an operational fact and is recorded in the append-only observation.', '')
lines.push('## Withheld records', '')
for (const record of records.filter((entry) => entry.disposition !== 'approved')) {
  lines.push(`### \`${record.recordId.replace('urn:maha:record:', '')}\` — ${record.disposition}`, '')
  lines.push(`Blockers: ${record.blockers.map((code) => `\`${code}\``).join(', ')}`, '')
  for (const item of record.unsatisfied) lines.push(`- **${item.scope} / ${item.criterionId} unsatisfied.** ${item.reason}`)
  lines.push('', `**Remediation.** ${record.remediation}`, '')
}
lines.push('## Approved records', '', '| Record | Domain | Release kind | Scoped decisions | Criterion decisions |', '|---|---|---|---|---|')
for (const record of records.filter((entry) => entry.disposition === 'approved')) {
  lines.push(`| ${record.recordId.replace('urn:maha:record:', '')} | ${record.domainSlug} | ${record.releaseKind} | ${record.scopedDecisions} | ${record.criterionDecisions} |`)
}
lines.push('')
writeFileSync('docs/substantial-pages/internal-review-batch-2-remainder.md', lines.join('\n'))

console.log(JSON.stringify({ counts: artifact.counts, digest: artifact.digest }, null, 1))
