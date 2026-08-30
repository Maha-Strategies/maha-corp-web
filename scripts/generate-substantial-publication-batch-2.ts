import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { alignmentFor } from '../lib/frontier-source-alignment.ts'
import { pilotAlignmentFor } from '../lib/pilot-source-alignment.ts'
import { SUBSTANTIAL_PUBLICATION_PAGES } from '../lib/substantial-page-publication.ts'
import {
  SUBSTANTIAL_BATCH_2_PAGES,
  SUBSTANTIAL_BATCH_2_RECORD_IDS,
  SUBSTANTIAL_PUBLICATION_BATCH_2_DATE,
  SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION,
} from '../lib/substantial-page-publication-batch-2.ts'

/**
 * Emits the batch-two publication set and its depth report.
 *
 * Reads committed modules only. Contacts nothing, mutates no production data,
 * and embeds no capture timestamp: the one date printed is the publication
 * input date. Batch one is read for comparison and is never regenerated here.
 */

/* --------------------------------------------- candidate qualification ---- */

interface Rejection {
  recordId: string
  domainSlug: string
  blockers: readonly string[]
}

interface FrozenSelection {
  selected: number
  domains: Record<string, number>
  qualifiedNotSelected: { recordId: string; domainSlug: string; reason: string }[]
  rejected: Rejection[]
}

// Batch 2 is a historical publication artifact. Later source inspections must
// feed a new batch rather than rewriting which records were qualified or
// rejected on 2026-08-26. The digest prevents this committed snapshot from
// becoming a convenient self-referential input that silently accepts edits.
const FROZEN_SELECTION_SHA256 = 'a35eddbbde538fe87777d4a46f480ce29a80ea9143fe97896bd7c224a658f078'
const committedPayload = JSON.parse(
  readFileSync('content/substantial-pages/publication-batch-2.json', 'utf8'),
) as { selection: FrozenSelection }
const frozenSelectionSha256 = createHash('sha256')
  .update(JSON.stringify(committedPayload.selection))
  .digest('hex')
if (frozenSelectionSha256 !== FROZEN_SELECTION_SHA256) {
  throw new Error('Batch 2 frozen selection snapshot failed its digest check.')
}
const { qualifiedNotSelected, rejected } = committedPayload.selection

/* --------------------------------------------------------------- totals --- */

const eligible = SUBSTANTIAL_BATCH_2_PAGES.filter((page) => page.quality.eligible)
const sum = (pages: readonly (typeof SUBSTANTIAL_BATCH_2_PAGES)[number][], pick: (page: (typeof SUBSTANTIAL_BATCH_2_PAGES)[number]) => number) =>
  pages.reduce((total, page) => total + pick(page), 0)

const batch2Totals = {
  records: SUBSTANTIAL_BATCH_2_PAGES.length,
  eligible: eligible.length,
  blocked: SUBSTANTIAL_BATCH_2_PAGES.length - eligible.length,
  before: {
    sections: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.before.sections),
    paragraphs: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.before.paragraphs),
    informationCharacters: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.before.informationCharacters),
  },
  after: {
    sections: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.after.sections),
    paragraphs: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.after.paragraphs),
    informationCharacters: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.depth.after.informationCharacters),
  },
  claimsExplained: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.quality.evidenceCoverage.claimsExplained),
  claimsTotal: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.quality.evidenceCoverage.claimsTotal),
  unsupportedParagraphs: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.quality.evidenceCoverage.unsupportedExplanationParagraphs),
  relatedRecords: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.contract.relatedRecords.length),
  mathematicalBridges: sum(SUBSTANTIAL_BATCH_2_PAGES, (page) => page.mathematicalBridges.length),
  comparisonApplicable: SUBSTANTIAL_BATCH_2_PAGES.filter((page) => page.contract.comparison.status === 'included').length,
  calculationApplicable: SUBSTANTIAL_BATCH_2_PAGES.filter((page) => page.contract.calculation.status === 'included').length,
  inspectedLocatorCoverage: SUBSTANTIAL_BATCH_2_PAGES.filter((page) => {
    const pilot = pilotAlignmentFor(page.contract.recordId)
    const frontier = pilot ? null : alignmentFor(page.contract.recordId)
    return Boolean(pilot?.inspectedContentLocation ?? frontier?.evidence.inspectedContentLocation)
  }).length,
}

const batch1Totals = {
  records: SUBSTANTIAL_PUBLICATION_PAGES.length,
  eligible: SUBSTANTIAL_PUBLICATION_PAGES.filter((page) => page.quality.eligible).length,
  before: {
    sections: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.before.sections, 0),
    paragraphs: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.before.paragraphs, 0),
    informationCharacters: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.before.informationCharacters, 0),
  },
  after: {
    sections: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.after.sections, 0),
    paragraphs: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.after.paragraphs, 0),
    informationCharacters: SUBSTANTIAL_PUBLICATION_PAGES.reduce((total, page) => total + page.depth.after.informationCharacters, 0),
  },
}

const domains: Record<string, number> = {}
for (const page of SUBSTANTIAL_BATCH_2_PAGES) domains[page.domainSlug] = (domains[page.domainSlug] ?? 0) + 1

mkdirSync('content/substantial-pages', { recursive: true })
mkdirSync('docs/substantial-pages', { recursive: true })

const payload = {
  schemaVersion: SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION,
  publicationDate: SUBSTANTIAL_PUBLICATION_BATCH_2_DATE,
  compilerNote:
    'Batch two compiles against the full canonical corpus. Batch one compiled against the forty-record frontier canary and is unchanged; widening its graph would alter its related-record selection and digest, so the correction is version-scoped rather than retroactive.',
  selection: {
    selected: SUBSTANTIAL_BATCH_2_RECORD_IDS.length,
    domains,
    qualifiedNotSelected,
    rejected,
  },
  totals: { batch2: batch2Totals, batch1: batch1Totals },
  pages: SUBSTANTIAL_BATCH_2_PAGES,
}
writeFileSync('content/substantial-pages/publication-batch-2.json', `${JSON.stringify(payload, null, 2)}\n`)

const row = (cells: readonly string[]) => `| ${cells.join(' | ')} |`
const blockerTotals: Record<string, number> = {}
for (const entry of rejected) for (const code of entry.blockers) blockerTotals[code] = (blockerTotals[code] ?? 0) + 1

const lines: string[] = []
lines.push('# Substantial-page Publication Batch 2', '')
lines.push(
  `Publication \`${SUBSTANTIAL_PUBLICATION_BATCH_2_VERSION}\` · input date \`${SUBSTANTIAL_PUBLICATION_BATCH_2_DATE}\``,
  '',
)
lines.push('This generated report measures source-bound information depth. Character counts are descriptive and are never publication criteria.', '')
lines.push(
  '**Compiler note.** Batch two compiles against the full canonical corpus. Batch one compiled against the forty-record frontier canary, which contained all twenty of its records but only four of the forty-four batch-two candidates. Widening the graph changes batch one’s related-record selection and digest, so the correction is version-scoped: batch one stays at `publication/1.0` and is not regenerated.',
  '',
)

lines.push('## Selection', '')
lines.push(row(['Measure', 'Count']), row(['---', '---']))
lines.push(row(['Selected', String(batch2Totals.records)]))
lines.push(row(['Currently eligible', String(batch2Totals.eligible)]))
lines.push(row(['Blocked', String(batch2Totals.blocked)]))
lines.push(row(['Qualified but not selected', String(qualifiedNotSelected.length)]))
lines.push(row(['Rejected by blocker', String(rejected.length)]))
lines.push('')
lines.push(row(['Domain', 'Records']), row(['---', '---']))
for (const [domain, count] of Object.entries(domains).sort()) lines.push(row([domain, String(count)]))
lines.push('')

lines.push('## Per-record qualification and gate', '')
lines.push(
  row(['Record', 'Domain', 'Gate', 'Claims', 'Related', 'Bridges', 'Comparison', 'Calculation', 'Before chars', 'After chars', 'Delta']),
  row(new Array(11).fill('---')),
)
for (const page of SUBSTANTIAL_BATCH_2_PAGES) {
  lines.push(
    row([
      `\`${page.contract.recordId.replace('urn:maha:record:', '')}\``,
      page.domainSlug,
      page.quality.eligible ? 'pass' : 'BLOCK',
      `${page.quality.evidenceCoverage.claimsExplained}/${page.quality.evidenceCoverage.claimsTotal}`,
      String(page.contract.relatedRecords.length),
      String(page.mathematicalBridges.length),
      page.contract.comparison.status,
      page.contract.calculation.status,
      String(page.depth.before.informationCharacters),
      String(page.depth.after.informationCharacters),
      String(page.depth.characterDelta),
    ]),
  )
}
lines.push('')

lines.push('## Applicability', '')
lines.push(
  `Comparison was genuinely applicable on **${batch2Totals.comparisonApplicable}** of ${batch2Totals.records} pages and calculation on **${batch2Totals.calculationApplicable}**. Every batch-two record carries exactly one source-bound claim and declares no reproducible numerical inputs, so a second supported side and a reproducible expression both genuinely fail to exist. Manufacturing either from an adjacent title would be an overclaim, and the gate records the decision rather than hiding it.`,
  '',
)

lines.push('## Rejected candidates', '')
if (!rejected.length) lines.push('None.', '')
else {
  lines.push(row(['Blocker', 'Records']), row(['---', '---']))
  for (const [code, count] of Object.entries(blockerTotals).sort()) lines.push(row([`\`${code}\``, String(count)]))
  lines.push('')
  lines.push(row(['Record', 'Domain', 'Blockers']), row(['---', '---', '---']))
  for (const entry of rejected) {
    lines.push(row([`\`${entry.recordId.replace('urn:maha:record:', '')}\``, entry.domainSlug, entry.blockers.map((code) => `\`${code}\``).join(', ')]))
  }
  lines.push('')
}

lines.push('## Qualified but not selected', '')
if (!qualifiedNotSelected.length) lines.push('None.', '')
else {
  lines.push(
    'These records pass every gate and remain available for a later batch. They were held back by the per-domain cap or the stated relevance preference, not by a blocker.',
    '',
  )
  lines.push(row(['Record', 'Domain']), row(['---', '---']))
  for (const entry of qualifiedNotSelected) {
    lines.push(row([`\`${entry.recordId.replace('urn:maha:record:', '')}\``, entry.domainSlug]))
  }
  lines.push('')
}

lines.push('## Depth, batch 1 and batch 2 reported separately', '')
lines.push(
  row(['Population', 'Records', 'Eligible', 'Before sections', 'After sections', 'Before paragraphs', 'After paragraphs', 'Before chars', 'After chars']),
  row(new Array(9).fill('---')),
)
lines.push(
  row([
    'batch 1',
    String(batch1Totals.records),
    String(batch1Totals.eligible),
    String(batch1Totals.before.sections),
    String(batch1Totals.after.sections),
    String(batch1Totals.before.paragraphs),
    String(batch1Totals.after.paragraphs),
    String(batch1Totals.before.informationCharacters),
    String(batch1Totals.after.informationCharacters),
  ]),
)
lines.push(
  row([
    'batch 2',
    String(batch2Totals.records),
    String(batch2Totals.eligible),
    String(batch2Totals.before.sections),
    String(batch2Totals.after.sections),
    String(batch2Totals.before.paragraphs),
    String(batch2Totals.after.paragraphs),
    String(batch2Totals.before.informationCharacters),
    String(batch2Totals.after.informationCharacters),
  ]),
)
lines.push(
  row([
    '**cumulative**',
    String(batch1Totals.records + batch2Totals.records),
    String(batch1Totals.eligible + batch2Totals.eligible),
    String(batch1Totals.before.sections + batch2Totals.before.sections),
    String(batch1Totals.after.sections + batch2Totals.after.sections),
    String(batch1Totals.before.paragraphs + batch2Totals.before.paragraphs),
    String(batch1Totals.after.paragraphs + batch2Totals.after.paragraphs),
    String(batch1Totals.before.informationCharacters + batch2Totals.before.informationCharacters),
    String(batch1Totals.after.informationCharacters + batch2Totals.after.informationCharacters),
  ]),
)
lines.push('')

lines.push('## Coverage', '')
lines.push(row(['Measure', 'Batch 2']), row(['---', '---']))
lines.push(row(['Claim coverage', `${batch2Totals.claimsExplained}/${batch2Totals.claimsTotal}`]))
lines.push(row(['Inspected-locator coverage', `${batch2Totals.inspectedLocatorCoverage}/${batch2Totals.records}`]))
lines.push(row(['Unsupported explanatory paragraphs', String(batch2Totals.unsupportedParagraphs)]))
lines.push(row(['Related-record links', String(batch2Totals.relatedRecords)]))
lines.push(row(['Typed mathematical bridges', String(batch2Totals.mathematicalBridges)]))
lines.push(row(['Information dimensions per page', '9']))
lines.push('')

lines.push('## Gate boundary', '')
lines.push(
  '- Eligibility is recomputed from live canonical data at compile time; a persisted `eligible` field is never trusted.',
  '- Every explanatory paragraph is bound to a canonical claim and its declared source.',
  '- Comparison and calculation are included only when the record supplies the required supported sides or reproducible inputs.',
  '- Typed bridges preserve their classification, so an analogy is never rendered as an equivalence.',
  '- Word or character count cannot make a page eligible.',
  '',
)

writeFileSync('docs/substantial-pages/publication-batch-2.md', `${lines.join('\n')}\n`)

console.log(
  JSON.stringify(
    {
      wrote: ['content/substantial-pages/publication-batch-2.json', 'docs/substantial-pages/publication-batch-2.md'],
      selected: batch2Totals.records,
      eligible: batch2Totals.eligible,
      blocked: batch2Totals.blocked,
      qualifiedNotSelected: qualifiedNotSelected.length,
      rejected: rejected.length,
      domains,
      comparisonApplicable: batch2Totals.comparisonApplicable,
      calculationApplicable: batch2Totals.calculationApplicable,
      bridges: batch2Totals.mathematicalBridges,
    },
    null,
    2,
  ),
)
