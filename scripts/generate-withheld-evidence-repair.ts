/**
 * Emits the deterministic withheld-record repair artifacts.
 *
 * No timestamps and no operational identifiers: a repair packet is a frozen
 * proposal derived from the record graph and the inspected passages recorded in
 * the module, so it regenerates byte-identically.
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

import {
  WITHHELD_EVIDENCE_REPAIR_VERSION,
  WITHHELD_REPAIR_BOUNDARY,
  WITHHELD_REPAIR_PACKETS,
} from '../lib/substantial-withheld-evidence-repair.ts'
import {
  REVISION_ALIGNMENT_AUDITS,
  REVISION_AUDIT_BOUNDARY,
  buildRereviewPackets,
} from '../lib/substantial-revision-alignment-audit.ts'

const artifact = {
  schemaVersion: WITHHELD_EVIDENCE_REPAIR_VERSION,
  cohort: 'substantial-publication-batch-2-withheld',
  boundary: WITHHELD_REPAIR_BOUNDARY,
  counts: {
    records: WITHHELD_REPAIR_PACKETS.length,
    withProposedRevision: WITHHELD_REPAIR_PACKETS.filter((packet) => packet.proposedRevision).length,
    inspectedPassages: WITHHELD_REPAIR_PACKETS.reduce((total, packet) => total + packet.inspectedPassages.length, 0),
    byDisposition: WITHHELD_REPAIR_PACKETS.reduce<Record<string, number>>((totals, packet) => {
      totals[packet.recommendedDisposition] = (totals[packet.recommendedDisposition] ?? 0) + 1
      return totals
    }, {}),
  },
  packets: WITHHELD_REPAIR_PACKETS,
  digest: `sha256:${createHash('sha256').update(JSON.stringify(WITHHELD_REPAIR_PACKETS)).digest('hex')}`,
}

writeFileSync('content/substantial-pages/withheld-evidence-repair-batch-2.json', `${JSON.stringify(artifact, null, 2)}\n`)

const lines: string[] = []
lines.push('# Batch 2 withheld records — evidence repair packets', '')
lines.push(WITHHELD_REPAIR_BOUNDARY, '')
lines.push(`Digest: \`${artifact.digest}\``, '')
lines.push('| Record | Disposition | Revision before | Revision after |', '|---|---|---|---|')
for (const packet of WITHHELD_REPAIR_PACKETS) {
  lines.push(`| ${packet.recordId.replace('urn:maha:record:', '')} | \`${packet.recommendedDisposition}\` | \`${packet.revisionDigests.before.slice(7, 23)}\` | \`${(packet.revisionDigests.after ?? '—').slice(7, 23)}\` |`)
}
lines.push('')
for (const packet of WITHHELD_REPAIR_PACKETS) {
  lines.push(`## \`${packet.recordId.replace('urn:maha:record:', '')}\``, '')
  lines.push('### Submitted, unchanged', '')
  lines.push(`- kind: \`${packet.submitted.recordKind}\``)
  lines.push(`- claim: ${packet.submitted.claimStatement}`)
  lines.push(`- source: ${packet.submitted.sourceUrl}`)
  lines.push(`- locator: ${packet.submitted.exactLocator}`, '')
  lines.push('### Audit findings', '')
  for (const finding of packet.auditFindings) lines.push(`- ${finding}`)
  lines.push('', '### Inspected passages', '')
  for (const passage of packet.inspectedPassages) {
    lines.push(`- **${passage.exactLocator}** — ${passage.reading}`)
    lines.push(`  - force: \`${passage.force}\` · normative keyword: \`${passage.normativeKeyword}\` · depth: \`${passage.inspectionDepth}\``)
    lines.push(`  - version relationship: ${passage.versionRelationship}`)
  }
  lines.push('')
  if (packet.proposedRevision) {
    lines.push('### Proposed revision', '')
    lines.push(`- kind: \`${packet.submitted.recordKind}\` → \`${packet.proposedRevision.recordKind}\``)
    lines.push(`- claim: ${packet.proposedRevision.claimStatement}`)
    lines.push(`- source: ${packet.proposedRevision.sourceUrl}`)
    lines.push(`- locator: ${packet.proposedRevision.sourceExactLocator}`)
    lines.push('- explicit unsupported extensions:')
    for (const extension of packet.proposedRevision.unsupportedExtensions) lines.push(`  - ${extension}`)
    lines.push('')
  }
  lines.push('### Disagreement and uncertainty', '')
  for (const item of packet.disagreements) lines.push(`- ${item}`)
  for (const item of packet.uncertainty) lines.push(`- ${item}`)
  lines.push('', '### Prohibited inferences', '')
  for (const item of packet.prohibitedInferences) lines.push(`- ${item}`)
  lines.push('', `**Recommended disposition:** \`${packet.recommendedDisposition}\``, '')
}
writeFileSync('docs/substantial-pages/withheld-evidence-repair-batch-2.md', lines.join('\n'))

const rereviewPackets = await buildRereviewPackets()
const auditArtifact = {
  schemaVersion: REVISION_ALIGNMENT_AUDITS[0]!.schemaVersion,
  cohort: 'substantial-publication-batch-2-withheld-revision-audit',
  boundary: REVISION_AUDIT_BOUNDARY,
  counts: {
    revisionsAudited: REVISION_ALIGNMENT_AUDITS.length,
    byOutcome: REVISION_ALIGNMENT_AUDITS.reduce<Record<string, number>>((totals, audit) => {
      totals[audit.outcome] = (totals[audit.outcome] ?? 0) + 1
      return totals
    }, {}),
    rereviewPacketsGenerated: rereviewPackets.length,
    reviewDecisionsRecorded: 0,
  },
  audits: REVISION_ALIGNMENT_AUDITS,
  rereviewPackets,
  digest: `sha256:${createHash('sha256').update(JSON.stringify([REVISION_ALIGNMENT_AUDITS, rereviewPackets])).digest('hex')}`,
}
writeFileSync('content/substantial-pages/revision-alignment-audit-batch-2.json', `${JSON.stringify(auditArtifact, null, 2)}\n`)

const auditLines: string[] = []
auditLines.push('# Batch 2 withheld records — proposed-revision alignment audit', '')
auditLines.push(REVISION_AUDIT_BOUNDARY, '')
auditLines.push(`Digest: \`${auditArtifact.digest}\``, '')
auditLines.push('| Record | Outcome | Superseded | Proposed | Audited |', '|---|---|---|---|---|')
for (const audit of REVISION_ALIGNMENT_AUDITS) {
  auditLines.push(`| ${audit.recordId.replace('urn:maha:record:', '')} | \`${audit.outcome}\` | \`${audit.supersededRevision.slice(7, 23)}\` | \`${audit.proposedRevision.slice(7, 23)}\` | \`${audit.auditedRevision.slice(7, 23)}\` |`)
}
auditLines.push('')
for (const audit of REVISION_ALIGNMENT_AUDITS) {
  auditLines.push(`## \`${audit.recordId.replace('urn:maha:record:', '')}\``, '')
  auditLines.push(`Audited canonical path: \`${audit.auditedCanonicalPath}\``, '')
  if (Object.keys(audit.correction).length > 0) auditLines.push(`Correction applied by this audit: \`${JSON.stringify(audit.correction)}\``, '')
  auditLines.push('| Dimension | Verdict | Finding |', '|---|---|---|')
  for (const dimension of audit.dimensions) auditLines.push(`| \`${dimension.dimension}\` | ${dimension.verdict} | ${dimension.finding} |`)
  auditLines.push('', `**Outcome: \`${audit.outcome}\`**`, '')
}
auditLines.push('## Reviewer packets', '')
auditLines.push(`${rereviewPackets.length} packet(s) generated, **0 review decisions recorded**. The internal rereview is a separate operation and was deliberately not performed here.`, '')
writeFileSync('docs/substantial-pages/revision-alignment-audit-batch-2.md', auditLines.join('\n'))

console.log(JSON.stringify({ counts: artifact.counts, digest: artifact.digest, audit: auditArtifact.counts, auditDigest: auditArtifact.digest }, null, 1))
