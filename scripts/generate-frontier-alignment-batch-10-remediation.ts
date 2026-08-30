import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_9_REMEDIATION_PACKETS } from '../lib/frontier-alignment-batch-9.ts'
import {
  ALIGNMENT_BATCH_10_REMEDIATION_PACKETS,
  ALIGNMENT_BATCH_10_VERSION,
} from '../lib/frontier-alignment-batch-10.ts'
import {
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
} from '../lib/frontier-source-alignment.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'

function digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

const batch9Ids = new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.recordId))
const activeMismatches = FRONTIER_ALIGNMENT_AUDIT.filter(
  (entry) => entry.evidence.subjectAligned === 'mismatched',
)
const remainingPool = activeMismatches.filter((entry) => !batch9Ids.has(entry.recordId))

const packets = ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.map((packet) => {
  const active = alignmentFor(packet.recordId)
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === packet.recordId)
  if (!active || !record) throw new Error(`${packet.recordId}: no active alignment record.`)
  const prior = {
    sourceContractId: active.sourceContractId,
    sourceIdentifier: active.sourceIdentifier,
    sourceTitle: active.sourceTitle,
    locator: active.locator,
    verdict: active.evidence.subjectAligned,
    recordRevisionSha256: epistemicReviewTargetHash(record),
    blockers: alignmentBlockers(packet.recordId),
  }
  const packetWithoutDigest = {
    schemaVersion: ALIGNMENT_BATCH_10_VERSION,
    ...packet,
    prior,
  }
  return { ...packetWithoutDigest, packetDigest: digest(packetWithoutDigest) }
})

const domains = [...new Set(packets.map((packet) => packet.domainSlug))].sort()
const unlockCounts = {
  substantialPage: packets.filter((packet) => packet.priority.unlocks.includes('substantial-page')).length,
  evidenceDossier: packets.filter((packet) => packet.priority.unlocks.includes('evidence-dossier')).length,
  quantumBridge: packets.filter((packet) => packet.priority.unlocks.includes('quantum-bridge')).length,
}
const payloadWithoutDigest = {
  schemaVersion: ALIGNMENT_BATCH_10_VERSION,
  boundary: {
    reviewKind: 'internal-editorial-source-inspection',
    replacementSourcesApplied: 0,
    canonicalRecordsMutated: 0,
    canonicalReleasesCreated: 0,
    externallyReviewed: false,
    independentlyReproduced: false,
    sourceContentCommitted: false,
  },
  selection: {
    activeMismatches: activeMismatches.length,
    excludedBatch9Records: batch9Ids.size,
    eligibleRemainingMismatches: remainingPool.length,
    frozenRecords: packets.length,
    domains,
    unlockCounts,
    rubric: {
      productRelevance: '0–4',
      graphLeverage: '0–3',
      correctionValue: '0–2',
      inspectability: '0–1',
      minimumTotal: 8,
    },
  },
  counts: {
    replacementSourcesDiscovered: packets.length,
    replacementMetadataVerified: packets.filter((packet) => packet.replacement.inspection.metadataVerified).length,
    replacementContentInspected: packets.filter((packet) => packet.replacement.inspection.contentInspected).length,
    replacementLocatorsInspected: packets.filter((packet) => packet.replacement.inspection.exactLocatorInspected).length,
    blockedPendingReview: packets.filter((packet) => packet.disposition === 'blocked-pending-source-override-review').length,
    canonicalMutationsAuthorized: packets.filter((packet) => packet.canonicalMutationAuthorized).length,
    promotionEligible: packets.filter((packet) => packet.promotionEligible).length,
  },
  packets,
}
const payload = { ...payloadWithoutDigest, batchDigest: digest(payloadWithoutDigest) }

mkdirSync('content/frontier-alignment', { recursive: true })
mkdirSync('docs/frontier-audit', { recursive: true })
writeFileSync(
  'content/frontier-alignment/batch-10-remediation-packets.json',
  `${JSON.stringify(payload, null, 2)}\n`,
)

const row = (cells: readonly (string | number)[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Frontier source-alignment Batch 10 remediation packets',
  '',
  `Batch \`${payload.schemaVersion}\` · digest \`${payload.batchDigest}\``,
  '',
  'These are internally inspected replacement-source proposals, not source substitutions. Every packet remains private and blocked pending explicit source-override review. No active source binding, verdict, blocker, canonical record, release, page, sitemap entry, or publication decision changes in this batch.',
  '',
  '## Selection boundary',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  row(['Active mismatches', payload.selection.activeMismatches]),
  row(['Batch 9 records excluded', payload.selection.excludedBatch9Records]),
  row(['Eligible remaining pool', payload.selection.eligibleRemainingMismatches]),
  row(['Frozen Batch 10 cohort', payload.selection.frozenRecords]),
  row(['Substantial-page unlock candidates', payload.selection.unlockCounts.substantialPage]),
  row(['Evidence Dossier unlock candidates', payload.selection.unlockCounts.evidenceDossier]),
  row(['Quantum Bridge unlock candidates', payload.selection.unlockCounts.quantumBridge]),
  '',
  '## Governance counts',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  ...Object.entries(payload.counts).map(([key, value]) => row([key, value])),
  '',
  '## Frozen cohort',
  '',
  row(['Priority', 'Record', 'Domain', 'Product paths', 'Artifact', 'Depth', 'Status']),
  row(['---', '---', '---', '---', '---', '---', '---']),
  ...payload.packets
    .slice()
    .sort((a, b) => b.priority.total - a.priority.total
      || (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
    .map((packet) => row([
      packet.priority.total,
      `\`${packet.recordId.replace('urn:maha:record:', '')}\``,
      packet.domainSlug,
      packet.priority.unlocks.map((unlock) => `\`${unlock}\``).join(', '),
      `\`${packet.replacement.inspection.artifactVersion}\``,
      `\`${packet.replacement.inspection.inspectionDepth}\``,
      `\`${packet.disposition}\``,
    ])),
  '',
  '## Inspected replacement locators',
  '',
  ...payload.packets.flatMap((packet) => [
    `### ${packet.recordId.replace('urn:maha:record:', '')}`,
    '',
    `- Packet: \`${packet.packetDigest}\``,
    `- Replacement: ${packet.replacement.citation}`,
    `- Identifier: \`${packet.replacement.identifier}\``,
    `- Locator inspected: ${packet.replacement.inspection.inspectedContentLocation}`,
    `- Finding: ${packet.replacement.inspection.findings}`,
    `- Limitation: ${packet.replacement.inspection.limitation}`,
    `- Decision: \`${packet.disposition}\``,
    '',
  ]),
]
writeFileSync(
  'docs/frontier-audit/alignment-batch-10-remediation-packets.md',
  `${lines.join('\n').trimEnd()}\n`,
)

console.log(JSON.stringify({
  wrote: [
    'content/frontier-alignment/batch-10-remediation-packets.json',
    'docs/frontier-audit/alignment-batch-10-remediation-packets.md',
  ],
  selection: payload.selection,
  counts: payload.counts,
  batchDigest: payload.batchDigest,
}, null, 2))
