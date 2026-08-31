import { mkdirSync, renameSync, writeFileSync } from 'node:fs'

import {
  SUBSTANTIAL_BATCH_3_PAGES,
  SUBSTANTIAL_BATCH_3_RELEASE_REGISTRY_GENERATED_AT,
  SUBSTANTIAL_BATCH_3_WITHHELD,
  SUBSTANTIAL_PUBLICATION_BATCH_3_DATE,
  SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION,
} from '../lib/substantial-page-publication-batch-3.ts'

const sum = (pick: (page: (typeof SUBSTANTIAL_BATCH_3_PAGES)[number]) => number) =>
  SUBSTANTIAL_BATCH_3_PAGES.reduce((total, page) => total + pick(page), 0)

const totals = {
  activeRegistryReleases: 46,
  priorBatchRecordIds: 50,
  releaseMatchedContracts: SUBSTANTIAL_BATCH_3_PAGES.length,
  repairedReplacementContracts: 2,
  newlyAlignmentClearContracts: 5,
  netNewPages: 5,
  activeNovelCandidates: SUBSTANTIAL_BATCH_3_WITHHELD.length,
  before: {
    sections: sum((page) => page.depth.before.sections),
    paragraphs: sum((page) => page.depth.before.paragraphs),
    informationCharacters: sum((page) => page.depth.before.informationCharacters),
  },
  after: {
    sections: sum((page) => page.depth.after.sections),
    paragraphs: sum((page) => page.depth.after.paragraphs),
    informationCharacters: sum((page) => page.depth.after.informationCharacters),
  },
  claimsExplained: sum((page) => page.quality.evidenceCoverage.claimsExplained),
  claimsTotal: sum((page) => page.quality.evidenceCoverage.claimsTotal),
  unsupportedParagraphs: sum((page) => page.quality.evidenceCoverage.unsupportedExplanationParagraphs),
}

const payload = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION,
  publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_3_DATE,
  releaseRegistryGeneratedAt: SUBSTANTIAL_BATCH_3_RELEASE_REGISTRY_GENERATED_AT,
  boundary:
    'Batch 3 selects only exact-revision active canonical releases. It restores substantial material for two repaired Batch 2 records and adds five release-matched references made alignment-clear by later source inspection. Eleven active releases remain withheld because source-alignment blockers make explanatory publication ineligible.',
  totals,
  withheldActiveCandidates: SUBSTANTIAL_BATCH_3_WITHHELD,
  pages: SUBSTANTIAL_BATCH_3_PAGES,
}

/**
 * Publishes generated artifacts atomically so concurrent readers see either
 * the previous complete file or the next complete file, never a truncated
 * intermediate write. Node's test runner executes files concurrently, and a
 * JSON import racing a direct write otherwise fails before either test can
 * evaluate its actual invariant.
 */
const writeGeneratedFile = (path: string, contents: string) => {
  const temporaryPath = `${path}.${process.pid}.tmp`
  writeFileSync(temporaryPath, contents)
  renameSync(temporaryPath, path)
}

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })
writeGeneratedFile('content/substantial-pages/publication-batch-3.json', `${JSON.stringify(payload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Substantial-page Publication Batch 3',
  '',
  `Publication \`${SUBSTANTIAL_PUBLICATION_BATCH_3_VERSION}\` · input date \`${SUBSTANTIAL_PUBLICATION_BATCH_3_DATE}\` · frozen public registry \`${SUBSTANTIAL_BATCH_3_RELEASE_REGISTRY_GENERATED_AT}\``,
  '',
  'Batch 3 is release-aware. It intersects active canonical release, exact revision and route match, inspected source alignment, and a freshly recomputed substantial quality gate before public projection.',
  '',
  '## Honest result',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  row(['Active canonical releases observed', String(totals.activeRegistryReleases)]),
  row(['Release-matched contracts selected', String(totals.releaseMatchedContracts)]),
  row(['Repaired replacement contracts', String(totals.repairedReplacementContracts)]),
  row(['Later alignment-clear contracts', String(totals.newlyAlignmentClearContracts)]),
  row(['Net-new substantial routes', String(totals.netNewPages)]),
  row(['Novel active candidates evaluated', String(totals.activeNovelCandidates)]),
  '',
  'Two selected records were already in Batch 2, but their evidence revisions and public paths changed during repair. Batch 2’s persisted contracts therefore fail the revision guard. Five previously withheld active records now pass source alignment after later content inspection. Batch 3 binds all seven to exact active releases without rewriting either prior artifact.',
  '',
  '## Selected exact releases',
  '',
  row(['Record', 'Release', 'Revision', 'Gate', 'Before chars', 'After chars']),
  row(['---', '---', '---', '---', '---', '---']),
  ...SUBSTANTIAL_BATCH_3_PAGES.map((page) => row([
    `\`${page.contract.recordId.replace('urn:maha:record:', '')}\``,
    `\`${page.releaseEvidence.releaseId}\``,
    `\`${page.releaseEvidence.targetSha256.slice(0, 19)}…\``,
    page.quality.eligible ? 'pass' : 'BLOCK',
    String(page.depth.before.informationCharacters),
    String(page.depth.after.informationCharacters),
  ])),
  '',
  '## Withheld active candidates',
  '',
  'These routes are canonical and revision-matched, but canonical release is not evidence eligibility. Their substantial explanatory layer remains absent until their listed source-alignment blockers are repaired and re-audited.',
  '',
  row(['Record', 'Domain', 'Blockers']),
  row(['---', '---', '---']),
  ...SUBSTANTIAL_BATCH_3_WITHHELD.map((entry) => row([
    `\`${entry.recordId.replace('urn:maha:record:', '')}\``,
    entry.domainSlug,
    entry.blockers.map((blocker) => `\`${blocker}\``).join(', '),
  ])),
  '',
  '## Depth',
  '',
  row(['Population', 'Sections', 'Paragraphs', 'Information characters']),
  row(['---', '---', '---', '---']),
  row(['Canonical records before enrichment', String(totals.before.sections), String(totals.before.paragraphs), String(totals.before.informationCharacters)]),
  row(['Release-matched substantial contracts', String(totals.after.sections), String(totals.after.paragraphs), String(totals.after.informationCharacters)]),
  '',
  `Claim coverage is **${totals.claimsExplained}/${totals.claimsTotal}** with **${totals.unsupportedParagraphs}** unsupported explanatory paragraphs. Character counts are descriptive and are not gate criteria.`,
  '',
  '## Boundary',
  '',
  'Internal review and canonical release establish traceable publication lineage, not truth, independent replication, safety, predictive validity, or commercial fitness. No blocked record is upgraded merely because its route is live.',
  '',
]
writeGeneratedFile('docs/substantial-pages/publication-batch-3.md', `${lines.join('\n')}\n`)
