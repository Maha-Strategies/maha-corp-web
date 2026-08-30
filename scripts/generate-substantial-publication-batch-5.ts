import { mkdirSync, writeFileSync } from 'node:fs'

import {
  SUBSTANTIAL_BATCH_5_PAGES,
  SUBSTANTIAL_PUBLICATION_BATCH_5_DATE,
  SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION,
} from '../lib/substantial-page-publication-batch-5.ts'
import {
  FROZEN_RELEASE_REGISTRY_GENERATED_AT,
  FROZEN_RELEASE_REGISTRY_SHA256,
  FROZEN_RELEASE_REGISTRY_SOURCE,
  SUBSTANTIAL_PUBLICATION_QUEUE,
  SUBSTANTIAL_PUBLICATION_QUEUE_VERSION,
} from '../lib/substantial-publication-queue.ts'

const sum = (pick: (page: (typeof SUBSTANTIAL_BATCH_5_PAGES)[number]) => number) =>
  SUBSTANTIAL_BATCH_5_PAGES.reduce((total, page) => total + pick(page), 0)

const blockerTotals = Object.fromEntries(
  [...new Set(SUBSTANTIAL_PUBLICATION_QUEUE.flatMap((entry) => entry.blockerCodes))]
    .sort()
    .map((code) => [code, SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => entry.blockerCodes.includes(code)).length]),
)

const totals = {
  activeCanonicalReleasesObserved: SUBSTANTIAL_PUBLICATION_QUEUE.length,
  exactRevisionReviewedAlignmentClearReleases: SUBSTANTIAL_BATCH_5_PAGES.length,
  withheldActiveReleases: SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => !entry.eligibleForBatch5).length,
  publicSubstantialRoutesBefore: 55,
  publicSubstantialRoutesAfter: 55,
  netNewRoutes: 0,
  upgradedExistingRoutes: SUBSTANTIAL_BATCH_5_PAGES.length,
  priorInformationCharacters: sum((page) => page.depthUpgrade.priorInformationCharacters),
  currentInformationCharacters: sum((page) => page.depthUpgrade.currentInformationCharacters),
  informationCharacterDelta: sum((page) => page.depthUpgrade.characterDelta),
  priorExplanationSections: sum((page) => page.depthUpgrade.priorExplanationSections),
  currentExplanationSections: sum((page) => page.depthUpgrade.currentExplanationSections),
  explanationSectionDelta: sum((page) => page.depthUpgrade.sectionDelta),
  minimumPerPageCharacterDelta: Math.min(...SUBSTANTIAL_BATCH_5_PAGES.map((page) => page.depthUpgrade.characterDelta)),
  claimsExplained: sum((page) => page.quality.evidenceCoverage.claimsExplained),
  claimsTotal: sum((page) => page.quality.evidenceCoverage.claimsTotal),
  unsupportedExplanationParagraphs: sum((page) => page.quality.evidenceCoverage.unsupportedExplanationParagraphs),
  comparisonsIncluded: SUBSTANTIAL_BATCH_5_PAGES.filter((page) => page.contract.comparison.status === 'included').length,
  calculationsIncluded: SUBSTANTIAL_BATCH_5_PAGES.filter((page) => page.contract.calculation.status === 'included').length,
}

const queuePayload = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_QUEUE_VERSION,
  frozenRegistry: {
    source: FROZEN_RELEASE_REGISTRY_SOURCE,
    generatedAt: FROZEN_RELEASE_REGISTRY_GENERATED_AT,
    sha256: FROZEN_RELEASE_REGISTRY_SHA256,
  },
  boundary: 'This deterministic queue is a sanitized build input. Eligibility requires inspected and alignment-clear evidence, complete exact-revision review, and an active canonical release whose revision and path match the current record. It grants no release authority.',
  totals: {
    observed: SUBSTANTIAL_PUBLICATION_QUEUE.length,
    eligible: SUBSTANTIAL_BATCH_5_PAGES.length,
    blocked: SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => !entry.eligibleForBatch5).length,
    blockerTotals,
  },
  entries: SUBSTANTIAL_PUBLICATION_QUEUE,
}

const publicationPayload = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION,
  publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_5_DATE,
  boundary: 'Batch 5 upgrades only already reachable, exact-revision substantial pages. It adds source identity, inspected locators, rights and reuse boundaries. It creates no canonical release and no new public route. Unsupported comparisons and calculations remain explicitly not applicable.',
  totals,
  pages: SUBSTANTIAL_BATCH_5_PAGES,
}

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })
writeFileSync('content/substantial-pages/publication-batch-5-queue.json', `${JSON.stringify(queuePayload, null, 2)}\n`)
writeFileSync('content/substantial-pages/publication-batch-5.json', `${JSON.stringify(publicationPayload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const blockedEntries = SUBSTANTIAL_PUBLICATION_QUEUE.filter((entry) => !entry.eligibleForBatch5)
const lines = [
  '# Substantial-page Publication Batch 5',
  '',
  `Publication \`${SUBSTANTIAL_PUBLICATION_BATCH_5_VERSION}\` · input date \`${SUBSTANTIAL_PUBLICATION_BATCH_5_DATE}\` · queue \`${SUBSTANTIAL_PUBLICATION_QUEUE_VERSION}\``,
  '',
  '## Honest result',
  '',
  'The frozen Production registry contains 46 active releases. Thirty-four satisfy all three publication gates, but every one already had a substantial page. Batch 5 therefore deepens 34 reachable pages and adds zero new routes. Publishing 25–50 genuinely new URLs would require additional governed canonical releases.',
  '',
  row(['Measure', 'Count']),
  row(['---', '---']),
  row(['Active canonical releases observed', String(totals.activeCanonicalReleasesObserved)]),
  row(['Three-gate eligible releases', String(totals.exactRevisionReviewedAlignmentClearReleases)]),
  row(['Withheld active releases', String(totals.withheldActiveReleases)]),
  row(['Existing routes upgraded', String(totals.upgradedExistingRoutes)]),
  row(['Net-new routes', String(totals.netNewRoutes)]),
  '',
  '## Three-gate queue',
  '',
  'A page enters this batch only when its source has been content-inspected and found alignment-clear, all four required review scopes bind the exact current revision, and an active canonical release binds that same revision and canonical path.',
  '',
  row(['Record', 'Release', 'Evidence', 'Review', 'Release match', 'Result']),
  row(['---', '---', '---', '---', '---', '---']),
  ...SUBSTANTIAL_PUBLICATION_QUEUE.map((entry) => row([
    `\`${entry.recordId.replace('urn:maha:record:', '')}\``,
    `\`${entry.releaseId}\``,
    entry.inspectedAndAlignmentClear ? 'clear' : 'BLOCK',
    entry.exactRevisionReviewed ? 'exact' : 'BLOCK',
    entry.releaseRevisionMatchesRecord && entry.releasePathMatchesRecord ? 'exact' : 'BLOCK',
    entry.eligibleForBatch5 ? 'publishable' : entry.blockerCodes.map((code) => `\`${code}\``).join(', '),
  ])),
  '',
  '## Measured depth',
  '',
  row(['Measure', 'Before', 'After', 'Delta']),
  row(['---', '---', '---', '---']),
  row(['Information characters', String(totals.priorInformationCharacters), String(totals.currentInformationCharacters), `+${totals.informationCharacterDelta}`]),
  row(['Explanation sections', String(totals.priorExplanationSections), String(totals.currentExplanationSections), `+${totals.explanationSectionDelta}`]),
  '',
  `Every upgraded page increased by at least **${totals.minimumPerPageCharacterDelta}** evidence-bound information characters. Claim coverage is **${totals.claimsExplained}/${totals.claimsTotal}**, with **${totals.unsupportedExplanationParagraphs}** unsupported explanatory paragraphs. Character count describes the result; eligibility is controlled by evidence coverage and information-value gates rather than word count.`,
  '',
  '## Comparisons and calculations',
  '',
  `Included comparisons: **${totals.comparisonsIncluded}**. Included calculations: **${totals.calculationsIncluded}**. The eligible records do not provide two supported comparison sides or reproducible numeric operands, so the compiler preserves explicit not-applicable decisions instead of inventing content.`,
  '',
  '## Withheld releases',
  '',
  row(['Record', 'Blockers']),
  row(['---', '---']),
  ...blockedEntries.map((entry) => row([
    `\`${entry.recordId.replace('urn:maha:record:', '')}\``,
    entry.blockerCodes.map((code) => `\`${code}\``).join(', '),
  ])),
  '',
  '## Boundary',
  '',
  'Canonical release and internal review establish controlled publication lineage. They do not establish truth, independent replication, safety, predictive validity, or commercial fitness. Metadata-only, stale, unreleased, path-mismatched, and source-misaligned records remain outside this explanatory projection.',
]
writeFileSync('docs/substantial-pages/publication-batch-5.md', `${lines.join('\n')}\n`)
