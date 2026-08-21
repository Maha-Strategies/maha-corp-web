/**
 * Verifies the committed sample assessment against the evidence it claims to
 * come from. Network-free, provider-free, zero cost.
 *
 * Two independent checks, because either alone can be fooled:
 *   1. Regenerate both surfaces and compare bytes -- catches a document edited
 *      after generation.
 *   2. Extract every measurement-shaped literal from the Markdown and require
 *      each one to appear in the set derived from committed evidence -- catches
 *      a figure hand-typed into the *generator*, which a byte comparison would
 *      happily reproduce.
 */
import { readFileSync } from 'node:fs'

import {
  SAMPLE_ASSESSMENT_MARKDOWN_PATH,
  SAMPLE_ASSESSMENT_PDF_PATH,
  buildSampleAssessment,
  sha256File,
} from '../lib/assessments/context-control-sample.ts'
import { renderSampleAssessmentMarkdown } from '../lib/assessments/context-control-markdown.ts'
import { renderSampleAssessmentPdf } from '../lib/assessments/context-control-pdf.ts'
import { collectDerivedFigures, unsupportedFigures } from '../lib/assessments/context-control-figures.ts'

const model = buildSampleAssessment()
const markdown = renderSampleAssessmentMarkdown(model)
const failures: string[] = []

if (readFileSync(SAMPLE_ASSESSMENT_MARKDOWN_PATH, 'utf8') !== markdown) {
  failures.push(`${SAMPLE_ASSESSMENT_MARKDOWN_PATH} does not reproduce from committed evidence.`)
}
const pdf = await renderSampleAssessmentPdf(model)
if (!Buffer.from(readFileSync(SAMPLE_ASSESSMENT_PDF_PATH)).equals(Buffer.from(pdf))) {
  failures.push(`${SAMPLE_ASSESSMENT_PDF_PATH} does not reproduce from committed evidence.`)
}

const unsupported = unsupportedFigures(markdown, collectDerivedFigures(model))
if (unsupported.length > 0) {
  failures.push(`Figures in the document are not derived from committed evidence: ${unsupported.join(', ')}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'valid',
  markdown: SAMPLE_ASSESSMENT_MARKDOWN_PATH,
  markdownSha256: `sha256:${sha256File(SAMPLE_ASSESSMENT_MARKDOWN_PATH)}`,
  pdf: SAMPLE_ASSESSMENT_PDF_PATH,
  pdfSha256: `sha256:${sha256File(SAMPLE_ASSESSMENT_PDF_PATH)}`,
  evidenceArtifactSha256: `sha256:${model.digests.evidenceArtifact}`,
  corpusLabelFreezeDigest: model.digests.corpusLabelFreeze,
  reproducesFromCommittedEvidence: true,
  everyFigureDerived: true,
  providerCallsMade: 0,
}, null, 2))
