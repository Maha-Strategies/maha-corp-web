import { mkdirSync, writeFileSync } from 'node:fs'

import releaseSnapshot from '../content/substantial-pages/publication-batch-6-release-snapshot.json' with { type: 'json' }
import {
  SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_PAGES,
  SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_PRIOR_PACKAGE_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS,
  SUBSTANTIAL_BATCH_6_RECORD_IDS,
  SUBSTANTIAL_PUBLICATION_BATCH_6_DATE,
  SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION,
} from '../lib/substantial-page-publication-batch-6.ts'

const totals = {
  activeCanonicalReleases: SUBSTANTIAL_BATCH_6_ACTIVE_RECORD_IDS.length,
  previouslyLiveSubstantialPages: SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS.length,
  stalePriorPackagesExcluded: SUBSTANTIAL_BATCH_6_PRIOR_PACKAGE_RECORD_IDS.length - SUBSTANTIAL_BATCH_6_PRIOR_ACTIVE_PAGE_RECORD_IDS.length,
  newlyCompiledPages: SUBSTANTIAL_BATCH_6_PAGES.length,
  projectedLiveSubstantialPages: SUBSTANTIAL_BATCH_6_PROJECTED_RECORD_IDS.length,
  activeReleasesWithoutEligibleSubstantialPage: SUBSTANTIAL_BATCH_6_BLOCKED_ACTIVE_RECORD_IDS.length,
  claimsExplained: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.quality.evidenceCoverage.claimsExplained, 0),
  claimsTotal: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.quality.evidenceCoverage.claimsTotal, 0),
  unsupportedExplanationParagraphs: SUBSTANTIAL_BATCH_6_PAGES.reduce(
    (total, page) => total + page.quality.evidenceCoverage.unsupportedExplanationParagraphs,
    0,
  ),
  explanationSections: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.contract.explanations.length, 0),
  limitations: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.contract.limitations.length, 0),
  informationCharacters: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.depth.after.informationCharacters, 0),
  characterDelta: SUBSTANTIAL_BATCH_6_PAGES.reduce((total, page) => total + page.depth.characterDelta, 0),
  comparisonsIncluded: SUBSTANTIAL_BATCH_6_PAGES.filter((page) => page.contract.comparison.status === 'included').length,
  calculationsIncluded: SUBSTANTIAL_BATCH_6_PAGES.filter((page) => page.contract.calculation.status === 'included').length,
}

const payload = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION,
  publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_6_DATE,
  releaseSnapshot: {
    schemaVersion: releaseSnapshot.schemaVersion,
    source: releaseSnapshot.source,
    generatedAt: releaseSnapshot.generatedAt,
    sourceSha256: releaseSnapshot.sourceSha256,
    counts: releaseSnapshot.counts,
    activeRecordIds: releaseSnapshot.activeRecordIds,
  },
  boundary:
    'A page is projected only when a content-inspected, subject-aligned source; an exact-revision internal review; and an active canonical release all bind the same record revision and path. Internal review is not independent expert endorsement, peer review, replication, scientific validation, safety certification or commercial fitness.',
  totals,
  recordIds: SUBSTANTIAL_BATCH_6_RECORD_IDS,
  pages: SUBSTANTIAL_BATCH_6_PAGES,
}

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })
writeFileSync('content/substantial-pages/publication-batch-6.json', `${JSON.stringify(payload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const lines = [
  '# Substantial-page Publication Batch 6',
  '',
  `Publication \`${SUBSTANTIAL_PUBLICATION_BATCH_6_VERSION}\` · input date \`${SUBSTANTIAL_PUBLICATION_BATCH_6_DATE}\``,
  '',
  '## Result',
  '',
  `The Production registry snapshot contains ${totals.activeCanonicalReleases} active canonical releases. ${totals.previouslyLiveSubstantialPages} already bind an active substantial package. Batch 6 compiles ${totals.newlyCompiledPages} additional exact-revision pages. ${totals.activeReleasesWithoutEligibleSubstantialPage} active releases remain excluded because inspected evidence or alignment does not satisfy the substantial-page gate; canonical release alone never fills that gap.`,
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  row(['Active canonical releases', String(totals.activeCanonicalReleases)]),
  row(['Previously live substantial pages', String(totals.previouslyLiveSubstantialPages)]),
  row(['Newly compiled pages', String(totals.newlyCompiledPages)]),
  row(['Stale prior packages excluded', String(totals.stalePriorPackagesExcluded)]),
  row(['Projected live substantial pages', String(totals.projectedLiveSubstantialPages)]),
  row(['Active releases without eligible substantial material', String(totals.activeReleasesWithoutEligibleSubstantialPage)]),
  row(['Claims explained', `${totals.claimsExplained}/${totals.claimsTotal}`]),
  row(['Unsupported explanatory paragraphs', String(totals.unsupportedExplanationParagraphs)]),
  row(['Explanation sections', String(totals.explanationSections)]),
  row(['Limitations', String(totals.limitations)]),
  row(['Evidence-bound information characters', String(totals.informationCharacters)]),
  row(['Information-character delta over seed records', `+${totals.characterDelta}`]),
  '',
  '## Three-gate publication proof',
  '',
  'Every page below passed all three independent requirements: content-inspected and subject-aligned evidence with an exact locator, the four exact-revision internal review scopes, and an active canonical release matching both revision digest and canonical path. Metadata-only, stale, unreleased and source-misaligned records remain excluded.',
  '',
  row(['Record', 'Release target', 'Source inspection', 'Review', 'Result']),
  row(['---', '---', '---', '---', '---']),
  ...SUBSTANTIAL_BATCH_6_PAGES.map((page) => row([
    `\`${page.contract.recordId.replace('urn:maha:record:', '')}\``,
    `\`${page.releaseEvidence.targetSha256.slice(0, 18)}…\``,
    page.reviewEvidence.alignment.sourceContentInspected ? 'content inspected' : 'BLOCK',
    page.releaseEvidence.approvalScopes.length === 4 ? 'four exact scopes' : 'BLOCK',
    page.quality.eligible ? 'published' : 'BLOCK',
  ])),
  '',
  '## Comparisons and calculations',
  '',
  `Included comparisons: **${totals.comparisonsIncluded}**. Included calculations: **${totals.calculationsIncluded}**. Applicability is derived from each record. Missing numerical inputs, equations, units, uncertainty propagation, or a second supported comparison side remain explicit not-applicable decisions; the compiler never fills those gaps with invented values.`,
  '',
  '## Boundary',
  '',
  payload.boundary,
]
writeFileSync('docs/substantial-pages/publication-batch-6.md', `${lines.join('\n')}\n`)

process.stdout.write(`${JSON.stringify(totals)}\n`)
