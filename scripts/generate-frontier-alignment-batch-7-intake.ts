import { mkdirSync, writeFileSync } from 'node:fs'

import { ALIGNMENT_BATCH_7_INTAKE } from '../lib/frontier-alignment-batch-7-intake.ts'

mkdirSync('content/frontier-alignment', { recursive: true })
mkdirSync('docs/frontier-audit', { recursive: true })

writeFileSync(
  'content/frontier-alignment/batch-7-intake.json',
  `${JSON.stringify(ALIGNMENT_BATCH_7_INTAKE, null, 2)}\n`,
)

const lines = [
  '# Frontier source-alignment Batch 7 intake',
  '',
  'This freezes the complete remaining inspection backlog. It is an intake queue, not a completed alignment batch: no source is treated as read, no locator is created, and no verdict or canonical state changes here.',
  '',
  `Records: ${ALIGNMENT_BATCH_7_INTAKE.recordCount} · source contracts: ${ALIGNMENT_BATCH_7_INTAKE.sourceContractCount} · inaccessible: ${ALIGNMENT_BATCH_7_INTAKE.inaccessibleCount} · metadata-only or otherwise insufficient: ${ALIGNMENT_BATCH_7_INTAKE.metadataOrInsufficientCount}`,
  '',
  '| Domain | Records |',
  '| --- | ---: |',
  ...Object.entries(ALIGNMENT_BATCH_7_INTAKE.domainCounts).map(([domain, count]) => `| ${domain} | ${count} |`),
  '',
  '## Publication boundary',
  '',
  '- Explanatory eligible: 0.',
  '- Canonical eligible: 0.',
  '- Every record is blocked by both `source-not-inspected` and `source-assignment-positional-legacy`.',
  '- Recovery can locate candidate artifacts, but only a subsequent inspected-content judgement with an exact locator can change alignment state.',
  '',
  `Digest: \`${ALIGNMENT_BATCH_7_INTAKE.digest}\``,
  '',
]

writeFileSync('docs/frontier-audit/alignment-batch-7-intake.md', lines.join('\n'))
console.log(JSON.stringify(ALIGNMENT_BATCH_7_INTAKE, null, 2))
