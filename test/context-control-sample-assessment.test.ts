import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { inflateSync } from 'node:zlib'

import {
  SAMPLE_ASSESSMENT_BANNER,
  SAMPLE_ASSESSMENT_MARKDOWN_PATH,
  SAMPLE_ASSESSMENT_PDF_PATH,
  buildSampleAssessment,
} from '../lib/assessments/context-control-sample.ts'
import { renderSampleAssessmentMarkdown } from '../lib/assessments/context-control-markdown.ts'
import { renderSampleAssessmentPdf, toWinAnsi } from '../lib/assessments/context-control-pdf.ts'
import { collectDerivedFigures, unsupportedFigures } from '../lib/assessments/context-control-figures.ts'
import { loadWso2LiveEvidence } from '../lib/integrations/wso2-live-evidence.ts'

const markdown = () => readFileSync(SAMPLE_ASSESSMENT_MARKDOWN_PATH, 'utf8')

test('the committed document reproduces byte-for-byte from committed evidence', () => {
  assert.equal(markdown(), renderSampleAssessmentMarkdown(buildSampleAssessment()))
})

test('the committed PDF reproduces byte-for-byte from committed evidence', async () => {
  const rendered = await renderSampleAssessmentPdf(buildSampleAssessment())
  assert.ok(Buffer.from(readFileSync(SAMPLE_ASSESSMENT_PDF_PATH)).equals(Buffer.from(rendered)))
})

/**
 * Byte comparison alone cannot catch a figure typed by hand into the generator:
 * regeneration would reproduce it faithfully. This checks provenance instead --
 * every measurement literal in the document must exist in the set derived from
 * committed evidence.
 */
test('every figure in the document is derived from committed evidence, not hand-entered', () => {
  const model = buildSampleAssessment()
  assert.deepEqual(unsupportedFigures(markdown(), collectDerivedFigures(model)), [])
})

test('a figure that drifts from the artifact is caught', () => {
  const model = buildSampleAssessment()
  const tampered = markdown().replace('98.84%', '99.90%')
  assert.notEqual(tampered, markdown())
  assert.ok(unsupportedFigures(tampered, collectDerivedFigures(model)).includes('99.90'))
})

test('headline aggregates match the evidence artifact exactly', () => {
  const evidence = loadWso2LiveEvidence()
  const document = markdown()
  for (const path of ['wso2-baseline', 'wso2-native-prompt-compressor', 'wso2-maha-context-compiler'] as const) {
    const aggregate = evidence.aggregates[path]
    assert.ok(document.includes(aggregate.providerInputTokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')))
    assert.ok(document.includes(`$${aggregate.costUsd}`))
  }
  assert.ok(document.includes(`${evidence.comparison.inputTokenReductionPercent}%`))
  assert.ok(document.includes(`${evidence.comparison.costReductionPercent}%`))
})

/**
 * Content streams are Flate-compressed, so scanning the raw bytes finds
 * nothing. Inflating every stream is the only way to assert on what the
 * document actually draws rather than on what the renderer intended.
 */
function pdfDrawnText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes)
  const parts: string[] = []
  let index = 0
  for (;;) {
    const start = buffer.indexOf('stream', index)
    if (start < 0) break
    const end = buffer.indexOf('endstream', start)
    if (end < 0) break
    let from = start + 'stream'.length
    if (buffer[from] === 0x0d) from += 1
    if (buffer[from] === 0x0a) from += 1
    try { parts.push(inflateSync(buffer.subarray(from, end)).toString('latin1')) } catch { /* not a Flate stream */ }
    index = end + 'endstream'.length
  }
  // pdf-lib writes drawn text as hex strings, so the literal never appears in
  // the stream until those are decoded.
  return parts
    .join('\n')
    .replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_match, hex: string) => Buffer.from(hex, 'hex').toString('latin1'))
}

test('every page of the PDF carries the synthetic-corpus banner', async () => {
  const model = buildSampleAssessment()
  const bytes = await renderSampleAssessmentPdf(model)
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.load(bytes)
  assert.ok(document.getPageCount() >= 5)

  const drawn = pdfDrawnText(bytes)
  // PDF text operators split strings, so match on a distinctive fragment that
  // survives the encoding rather than the whole sentence.
  const occurrences = drawn.split('not a customer result').length - 1
  assert.equal(
    occurrences,
    document.getPageCount(),
    `banner drawn ${occurrences} times for ${document.getPageCount()} pages`,
  )
  assert.ok(drawn.includes(toWinAnsi(SAMPLE_ASSESSMENT_BANNER).slice(0, 24)))
})

test('the markdown labels itself a sample on a synthetic corpus', () => {
  const document = markdown()
  assert.ok(document.includes(SAMPLE_ASSESSMENT_BANNER))
  assert.match(document, /not a customer result/)
  assert.match(document, /synthetic/i)
  assert.match(document, /not claiming[\s>]+WSO2 partnership, certification, approval, or customer validation/)
})

test('no retention figure appears without naming its scorer', () => {
  const document = markdown()
  assert.match(document, /Path-blinded semantic adjudication/)
  assert.match(document, /Deterministic exact-span containment/)
  // The two scorers disagree; if the document ever showed only one, this fails.
  const evidence = loadWso2LiveEvidence()
  const maha = evidence.aggregates['wso2-maha-context-compiler']
  assert.notEqual(maha.adjudicatedFacts.answered, maha.deterministicFacts.answered)
  assert.ok(document.includes(`${maha.deterministicFacts.answered} / ${maha.deterministicFacts.total}`))
  assert.ok(document.includes(`${maha.adjudicatedFacts.answered} / ${maha.adjudicatedFacts.total}`))
})

test('the recommendation refuses to generalize the synthetic result', () => {
  assert.match(markdown(), /Do not\s+generalize this synthetic result/)
  assert.match(markdown(), /proceed, revise, or stop/)
})

test('the representative trace is labelled illustrative, not aggregate evidence', () => {
  assert.match(markdown(), /is not evidence for the aggregate/)
})

test('unmeasured behaviour is stated as unmeasured', () => {
  const document = markdown()
  assert.match(document, /Explicitly unmeasured/)
  assert.match(document, /present and declared but not exercised here/)
  assert.match(document, /unmeasured by this run/)
})

test('required limitations are all present', () => {
  const document = markdown()
  for (const required of [
    /corpus is synthetic/i,
    /not committed to the repository/,
    /not currently available locally/,
    /confirmed by WSO2 or by a\s+customer/,
    /not provider invoices/,
    /not a regulatory\s+certification/,
    /single observation per call|not a percentile over repeated runs/,
  ]) {
    assert.match(document, required)
  }
})

test('no sensitive or customer-identifying content reaches the deliverable', async () => {
  const document = markdown()
  const pdfText = Buffer.from(readFileSync(SAMPLE_ASSESSMENT_PDF_PATH)).toString('latin1')
  for (const surface of [document, pdfText]) {
    for (const forbidden of [
      'reviewText', 'sk-ant', 'Bearer ', 'x-api-key', 'Authorization:',
      '/Users/', '/private/tmp', '.codex/worktrees',
      'RELEASE-1-ALPHA', 'INCIDENT-3-ALPHA',
      'ANTHROPIC_API_KEY', 'WSO2_CONTEXT_INTERCEPTOR_SECRET',
    ]) {
      assert.ok(!surface.includes(forbidden), `deliverable contains forbidden content: ${forbidden}`)
    }
  }
})

test('the PDF renderer folds characters the standard fonts cannot encode', () => {
  assert.equal(toWinAnsi('an em—dash and “quotes” and an arrow →'), 'an em-dash and "quotes" and an arrow ->')
  const model = buildSampleAssessment()
  // Every string the document draws must survive the fold without loss of meaning.
  assert.doesNotThrow(() => toWinAnsi(renderSampleAssessmentMarkdown(model)))
})
