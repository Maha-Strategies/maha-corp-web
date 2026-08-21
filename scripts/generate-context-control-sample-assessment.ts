/**
 * Renders the sample Context-Control Evidence Assessment.
 *
 * Both surfaces come from one model built out of committed evidence, so a
 * figure cannot be edited into the document without the regeneration check
 * catching it.
 *
 *   node --experimental-strip-types scripts/generate-context-control-sample-assessment.ts
 *   node --experimental-strip-types scripts/generate-context-control-sample-assessment.ts --check
 *
 * Makes no network call of any kind.
 */
import { readFileSync, writeFileSync } from 'node:fs'

import {
  SAMPLE_ASSESSMENT_MARKDOWN_PATH,
  SAMPLE_ASSESSMENT_PDF_PATH,
  buildSampleAssessment,
  sha256File,
} from '../lib/assessments/context-control-sample.ts'
import { renderSampleAssessmentMarkdown } from '../lib/assessments/context-control-markdown.ts'
import { renderSampleAssessmentPdf } from '../lib/assessments/context-control-pdf.ts'

const checkOnly = process.argv.includes('--check')

const model = buildSampleAssessment()
const markdown = renderSampleAssessmentMarkdown(model)
const pdf = await renderSampleAssessmentPdf(model)

if (checkOnly) {
  const failures: string[] = []
  if (readFileSync(SAMPLE_ASSESSMENT_MARKDOWN_PATH, 'utf8') !== markdown) {
    failures.push(`${SAMPLE_ASSESSMENT_MARKDOWN_PATH} does not reproduce from the committed evidence.`)
  }
  if (!Buffer.from(readFileSync(SAMPLE_ASSESSMENT_PDF_PATH)).equals(Buffer.from(pdf))) {
    failures.push(`${SAMPLE_ASSESSMENT_PDF_PATH} does not reproduce from the committed evidence.`)
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    process.exit(1)
  }
  console.log(JSON.stringify({
    status: 'reproduced',
    markdown: SAMPLE_ASSESSMENT_MARKDOWN_PATH,
    pdf: SAMPLE_ASSESSMENT_PDF_PATH,
    evidenceArtifactSha256: `sha256:${model.digests.evidenceArtifact}`,
    providerCallsMade: 0,
  }, null, 2))
} else {
  writeFileSync(SAMPLE_ASSESSMENT_MARKDOWN_PATH, markdown)
  writeFileSync(SAMPLE_ASSESSMENT_PDF_PATH, pdf)
  console.log(JSON.stringify({
    status: 'written',
    markdown: SAMPLE_ASSESSMENT_MARKDOWN_PATH,
    markdownSha256: `sha256:${sha256File(SAMPLE_ASSESSMENT_MARKDOWN_PATH)}`,
    pdf: SAMPLE_ASSESSMENT_PDF_PATH,
    pdfSha256: `sha256:${sha256File(SAMPLE_ASSESSMENT_PDF_PATH)}`,
    evidenceArtifactSha256: `sha256:${model.digests.evidenceArtifact}`,
    corpusLabelFreezeDigest: model.digests.corpusLabelFreeze,
    providerCallsMade: 0,
  }, null, 2))
}
