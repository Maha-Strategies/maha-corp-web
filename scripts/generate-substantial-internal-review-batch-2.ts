import { mkdirSync, writeFileSync } from 'node:fs'

import { BATCH_2_INTERNAL_REVIEW_MANIFEST } from '../lib/substantial-internal-review-batch-2.ts'

const jsonPath = 'content/substantial-pages/internal-review-batch-2.json'
const markdownPath = 'docs/substantial-pages/internal-review-batch-2.md'
mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })
writeFileSync(jsonPath, `${JSON.stringify(BATCH_2_INTERNAL_REVIEW_MANIFEST, null, 2)}\n`)
const lines = [
  '# Batch two internal-review packets', '',
  `Digest: \`${BATCH_2_INTERNAL_REVIEW_MANIFEST.manifestDigest}\``, '',
  BATCH_2_INTERNAL_REVIEW_MANIFEST.boundary, '',
  `Records: ${BATCH_2_INTERNAL_REVIEW_MANIFEST.counts.records} · pending criteria: ${BATCH_2_INTERNAL_REVIEW_MANIFEST.counts.criteriaPending} · drift re-audits: ${BATCH_2_INTERNAL_REVIEW_MANIFEST.counts.driftReAudits}`, '',
  '| Record | Domain | Target | Drift re-audit | Packet |', '|---|---|---|---|---|',
  ...BATCH_2_INTERNAL_REVIEW_MANIFEST.records.map((packet) => `| ${packet.recordId.replace('urn:maha:record:', '')} | ${packet.domainSlug} | \`${packet.targetSha256}\` | ${packet.driftReAudit?.classification ?? 'no'} | \`${packet.packetDigest}\` |`),
  '', 'The JSON artifact is the reviewer packet source of truth. Every criterion is pending; this index is not an approval shortcut.', '',
]
writeFileSync(markdownPath, lines.join('\n'))
console.log(JSON.stringify({ jsonPath, markdownPath, counts: BATCH_2_INTERNAL_REVIEW_MANIFEST.counts, digest: BATCH_2_INTERNAL_REVIEW_MANIFEST.manifestDigest }, null, 2))

