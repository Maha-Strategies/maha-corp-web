import { mkdirSync, writeFileSync } from 'node:fs'

import { SUBSTANTIAL_SCALE_REVIEW_MANIFEST } from '../lib/substantial-scale-internal-review.ts'

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })

writeFileSync(
  'content/substantial-pages/release-scale-review.json',
  `${JSON.stringify(SUBSTANTIAL_SCALE_REVIEW_MANIFEST, null, 2)}\n`,
)

const domains = Object.entries(Object.groupBy(SUBSTANTIAL_SCALE_REVIEW_MANIFEST.records, (record) => record.domainSlug))
  .map(([domain, records]) => [domain, records?.length ?? 0] as const)
  .sort(([left], [right]) => left.localeCompare(right))
const lines = [
  '# Substantial Release-scale Review',
  '',
  `Schema \`${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.schemaVersion}\` · input date \`${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.inputDate}\``,
  '',
  'This private manifest freezes 64 exact revisions selected from records that were content-inspected, alignment-clear, substantial-quality eligible, and absent from the active-release registry at selection. It creates no release by itself.',
  '',
  '| Measure | Count |',
  '| --- | ---: |',
  `| Records | ${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.records} |`,
  `| Canary | ${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.canary} |`,
  `| Exact-revision scoped decisions | ${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.scopedDecisions} |`,
  '',
  '| Domain | Records |',
  '| --- | ---: |',
  ...domains.map(([domain, count]) => `| ${domain} | ${count} |`),
  '',
  '## Boundary',
  '',
  SUBSTANTIAL_SCALE_REVIEW_MANIFEST.boundary,
  '',
  `Manifest digest: \`${SUBSTANTIAL_SCALE_REVIEW_MANIFEST.manifestDigest}\``,
  '',
]
writeFileSync('docs/substantial-pages/release-scale-review.md', lines.join('\n'))

console.log(JSON.stringify({
  records: SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.records,
  decisions: SUBSTANTIAL_SCALE_REVIEW_MANIFEST.counts.scopedDecisions,
  manifestDigest: SUBSTANTIAL_SCALE_REVIEW_MANIFEST.manifestDigest,
}))
