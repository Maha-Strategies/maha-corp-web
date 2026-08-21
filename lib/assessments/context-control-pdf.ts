import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { SAMPLE_ASSESSMENT_BANNER, type SampleAssessment } from './context-control-sample.ts'

/**
 * Renders the assessment model as a print-ready PDF.
 *
 * Built from the same model as the Markdown, never from the Markdown itself, so
 * the two surfaces cannot disagree about a number.
 *
 * Restraint is deliberate. This document's job is to be believed by an
 * architect and forwarded to a procurement reviewer, so it uses one accent,
 * ruled tables rather than filled ones, and states its synthetic-corpus banner
 * on every page rather than once on the cover where it can be skipped.
 */
const INK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.42, 0.46, 0.53)
const RULE = rgb(0.82, 0.85, 0.88)
const ACCENT = rgb(0.65, 0.42, 0.08)
const BANNER_BG = rgb(0.97, 0.95, 0.90)

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 54
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

/**
 * The standard PDF fonts are WinAnsi-encoded and throw on characters outside
 * it. Rather than discover that on an em dash three pages in, every string is
 * folded to a representable form before it is drawn.
 */
export function toWinAnsi(value: string): string {
  return value
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[→➔]/g, '->')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '')
}

type Fonts = { regular: PDFFont; bold: PDFFont; mono: PDFFont }

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') { lines.push(''); continue }
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue }
      if (current) lines.push(current)
      // A single token wider than the column (a digest) is broken on width
      // rather than allowed to run off the page.
      if (font.widthOfTextAtSize(word, size) > width) {
        let chunk = ''
        for (const character of word) {
          if (font.widthOfTextAtSize(chunk + character, size) > width) { lines.push(chunk); chunk = character }
          else chunk += character
        }
        current = chunk
      } else current = word
    }
    if (current) lines.push(current)
  }
  return lines
}

class Layout {
  readonly doc: PDFDocument
  readonly fonts: Fonts
  page!: PDFPage
  y = 0
  pageNumber = 0

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc
    this.fonts = fonts
    this.newPage()
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.pageNumber += 1
    // The banner sits at the top of every page, not only the cover. A page
    // photographed or forwarded on its own still says what it is.
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 26, width: PAGE_WIDTH, height: 26, color: BANNER_BG })
    this.page.drawText(toWinAnsi(SAMPLE_ASSESSMENT_BANNER), {
      x: MARGIN, y: PAGE_HEIGHT - 17, size: 7.5, font: this.fonts.bold, color: ACCENT,
    })
    this.page.drawLine({
      start: { x: MARGIN, y: 44 }, end: { x: PAGE_WIDTH - MARGIN, y: 44 }, thickness: 0.5, color: RULE,
    })
    this.page.drawText(toWinAnsi('Maha Strategies LLC - Context-Control Evidence Assessment (sample)'), {
      x: MARGIN, y: 32, size: 7, font: this.fonts.regular, color: MUTED,
    })
    const label = String(this.pageNumber)
    this.page.drawText(label, {
      x: PAGE_WIDTH - MARGIN - this.fonts.regular.widthOfTextAtSize(label, 7), y: 32,
      size: 7, font: this.fonts.regular, color: MUTED,
    })
    this.y = PAGE_HEIGHT - 52
  }

  space(needed: number): void {
    if (this.y - needed < 62) this.newPage()
  }

  text(value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; leading?: number; indent?: number } = {}): void {
    const size = options.size ?? 9
    const font = options.font ?? this.fonts.regular
    const leading = options.leading ?? size * 1.5
    const indent = options.indent ?? 0
    for (const line of wrap(toWinAnsi(value), font, size, CONTENT_WIDTH - indent)) {
      this.space(leading)
      if (line !== '') {
        this.page.drawText(line, { x: MARGIN + indent, y: this.y, size, font, color: options.color ?? INK })
      }
      this.y -= leading
    }
  }

  heading(value: string, level: 1 | 2 = 1): void {
    const size = level === 1 ? 13 : 10.5
    this.space(size * 3)
    this.y -= level === 1 ? 12 : 8
    this.text(value, { size, font: this.fonts.bold, leading: size * 1.35 })
    if (level === 1) {
      this.space(8)
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y + 6 },
        thickness: 0.8, color: INK,
      })
      this.y -= 8
    } else this.y -= 3
  }

  table(headers: string[], rows: string[][], widths: number[]): void {
    const size = 7.6
    const padding = 5
    const columnWidths = widths.map((fraction) => CONTENT_WIDTH * fraction)
    const drawRow = (cells: string[], font: PDFFont, color = INK): void => {
      const wrapped = cells.map((cell, index) => wrap(toWinAnsi(cell), font, size, columnWidths[index] - padding * 2))
      const height = Math.max(...wrapped.map((lines) => lines.length)) * (size * 1.4) + padding * 1.6
      this.space(height + 4)
      let x = MARGIN
      wrapped.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          this.page.drawText(line, { x: x + padding, y: this.y - padding - lineIndex * (size * 1.4) - size * 0.2, size, font, color })
        })
        x += columnWidths[index]
      })
      this.y -= height
      this.page.drawLine({
        start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.4, color: RULE,
      })
    }
    // A table that starts three lines from the bottom of a page splits into a
    // header and one orphaned row, which reads as a rendering fault rather
    // than a page break. Require room for the header plus three rows -- or the
    // whole table when it is shorter -- and move it wholesale if that is not
    // available.
    const estimatedRowHeight = size * 1.4 + padding * 1.6
    const keepTogether = (Math.min(rows.length, 3) + 1) * estimatedRowHeight + 34
    this.space(keepTogether)
    this.y -= 6
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 2 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y + 2 }, thickness: 0.8, color: INK,
    })
    drawRow(headers, this.fonts.bold, INK)
    for (const row of rows) drawRow(row, this.fonts.regular)
    this.y -= 8
  }

  bullets(items: string[], size = 9): void {
    for (const item of items) {
      this.space(size * 1.5)
      this.page.drawText('-', { x: MARGIN, y: this.y, size, font: this.fonts.regular, color: MUTED })
      this.text(item, { size, indent: 12 })
      this.y -= 2
    }
  }

  callout(title: string, body: string): void {
    const inner = CONTENT_WIDTH - 28
    // The title is a sentence, not a label, so it has to wrap like one. An
    // unwrapped title is the one thing on the page that runs off it.
    const titleLines = wrap(toWinAnsi(title), this.fonts.bold, 8.4, inner)
    const bodyLines = wrap(toWinAnsi(body), this.fonts.regular, 8.6, inner)
    const height = titleLines.length * 11.6 + bodyLines.length * 12.6 + 22
    this.space(height + 10)
    const top = this.y
    this.page.drawRectangle({ x: MARGIN, y: top - height + 12, width: CONTENT_WIDTH, height, color: rgb(0.975, 0.977, 0.98) })
    this.page.drawRectangle({ x: MARGIN, y: top - height + 12, width: 2.4, height, color: ACCENT })
    titleLines.forEach((line, index) => {
      this.page.drawText(line, { x: MARGIN + 14, y: top - index * 11.6, size: 8.4, font: this.fonts.bold, color: ACCENT })
    })
    const bodyTop = top - titleLines.length * 11.6 - 5
    bodyLines.forEach((line, index) => {
      this.page.drawText(line, { x: MARGIN + 14, y: bodyTop - index * 12.6, size: 8.6, font: this.fonts.regular, color: INK })
    })
    this.y -= height + 6
  }

  /** An ordered list. Separate from bullets so an item never gets two markers. */
  numbered(items: string[], size = 9): void {
    items.forEach((item, index) => {
      const marker = `${index + 1}.`
      this.space(size * 1.5)
      this.page.drawText(marker, { x: MARGIN, y: this.y, size, font: this.fonts.bold, color: MUTED })
      this.text(item, { size, indent: 16 })
      this.y -= 2
    })
  }

  /**
   * Starts a section. A fresh page only when the remaining space would leave a
   * stub, so short sections share a page instead of each claiming one and
   * padding the document with half-empty leaves.
   */
  section(title: string): void {
    if (this.y < 300) this.newPage()
    this.heading(title)
  }
}

export async function renderSampleAssessmentPdf(model: SampleAssessment): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Context-Control Evidence Assessment (sample)')
  doc.setAuthor(model.preparedBy)
  doc.setSubject(SAMPLE_ASSESSMENT_BANNER)
  doc.setProducer('Maha Strategies')
  doc.setCreator('scripts/generate-context-control-sample-assessment.ts')
  // Fixed dates keep the bytes reproducible, so the committed PDF can be
  // regenerated and compared rather than merely regenerated.
  doc.setCreationDate(new Date('2026-08-17T00:00:00Z'))
  doc.setModificationDate(new Date('2026-08-17T00:00:00Z'))

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  }
  const layout = new Layout(doc, fonts)
  const { corpus, configuration, findings, comparison, failure, trace, digests } = model

  // Cover
  layout.y = PAGE_HEIGHT - 190
  layout.text('MAHA STRATEGIES LLC', { size: 8, font: fonts.bold, color: MUTED })
  layout.y -= 10
  layout.text(model.title, { size: 25, font: fonts.bold, leading: 30 })
  layout.y -= 4
  layout.text(model.subtitle, { size: 11, color: MUTED, leading: 16 })
  layout.y -= 18
  layout.table(['Field', 'Value'], [
    ['Prepared by', model.preparedBy],
    ['Evaluation run', model.runLabel],
    ['Observed', model.observedDate],
    ['Corpus', `${corpus.workloadCount} synthetic workloads, ${corpus.callCount} calls`],
    ['Evidence artifact SHA-256', digests.evidenceArtifact],
  ], [0.3, 0.7])
  layout.callout(
    'READ THIS FIRST',
    'This document shows the shape and rigour of the evidence package a customer receives after a bounded Context-Control Evidence Assessment. Every figure in it comes from a frozen synthetic corpus. It is not a customer result, not a case study, and not a performance guarantee. Maha Strategies is not claiming WSO2 partnership, certification, approval, or customer validation.',
  )

  layout.section('1. Executive decision')
  layout.text('What was evaluated', { size: 10, font: fonts.bold })
  layout.text(`Three request paths through one WSO2 AI Gateway deployment, over ${corpus.workloadCount} frozen synthetic workloads of 20K-100K estimated tokens, ${corpus.callCount} calls in total:`)
  layout.numbered(findings.map((row) => row.label))
  layout.text('Each path answered the same labelled questions against the same source documents, under a frozen configuration with no automatic retries.')
  layout.y -= 6
  layout.text('Observed result', { size: 10, font: fonts.bold })
  layout.text(`On this synthetic corpus, the Maha path forwarded ${comparison.inputTokenReductionPercent}% fewer provider input tokens than the baseline (${model.tokensAvoided} tokens avoided) at ${comparison.costReductionPercent}% lower modeled cost (${model.costAvoidedUsd} avoided), while a path-blinded semantic adjudication scored ${findings[2].adjudicatedFacts} required facts answered - the same score the uncompressed baseline achieved, and against ${findings[1].adjudicatedFacts} for the gateway's native compressor. All ${model.successfulCalls} calls completed; none required a retry.`)
  layout.y -= 6
  layout.text('Recommended decision', { size: 10, font: fonts.bold })
  layout.callout(
    'PROCEED TO A BOUNDED EVALUATION ON A CUSTOMER-SHAPED WORKLOAD. DO NOT GENERALIZE THIS SYNTHETIC RESULT.',
    'The observed result is a reason to run a real evaluation, not a substitute for one. Nothing here establishes behaviour on customer documents, at customer volume, or under a customer’s own retention and citation requirements. The finding that would change a deployment decision - whether the reduction and the retention both survive real, messy source material - has not been measured and cannot be inferred from this corpus.',
  )
  layout.text('The result is stated above. The recommendation is stated here. They are deliberately separate: the first is a measurement, the second is a judgement about what to do next, and a reader should be able to reject the second while accepting the first.', { color: MUTED, size: 8.6 })

  layout.section('2. Scope and configuration')
  layout.text('The configuration below was frozen before any model call and is recorded in the committed reproduction manifest. Changing any of it invalidates comparison with these figures.')
  layout.table(['Setting', 'Value'], [
    ['Gateway product', configuration.gatewayProduct],
    ['Gateway version', configuration.gatewayVersion],
    ['Prompt Compressor version', configuration.promptCompressorVersion],
    ['Prompt Compressor retained ratio', String(configuration.promptCompressorRetainedRatio)],
    ['Maha interceptor version', configuration.mahaInterceptorVersion],
    ['Maha interceptor fail-closed', configuration.mahaInterceptorFailClosed ? 'Yes, both request and response phases' : 'No'],
    ['Model', configuration.model],
    ['Temperature', String(configuration.temperature)],
    ['Maximum output tokens', String(configuration.maxOutputTokens)],
    ['Automatic retries', `${configuration.automaticRetries} (zero-retry rule)`],
    ['Modeled input price', `$${configuration.pricingAssumptionUsdPerMillionTokens.input} per million tokens`],
    ['Modeled output price', `$${configuration.pricingAssumptionUsdPerMillionTokens.output} per million tokens`],
  ], [0.36, 0.64])
  layout.heading('Corpus', 2)
  layout.table(['Property', 'Value'], [
    ['Workloads', String(corpus.workloadCount)],
    ['Calls', `${corpus.callCount} (${corpus.workloadCount} workloads x 3 paths)`],
    ['Difficulty mix', `${corpus.difficulties.easy} easy, ${corpus.difficulties.medium} medium, ${corpus.difficulties.hard} hard`],
    ['Labelled required facts', String(corpus.requiredFactCount)],
    ['Expected citations', String(corpus.expectedCitationCount)],
    ['Nature', 'Synthetic. No customer data, personal data, or credentials.'],
    ['Label-freeze digest', corpus.labelFreezeDigest],
  ], [0.36, 0.64])
  layout.text('Every required fact, expected citation and prohibited assertion was labelled and digest-frozen before any path was run. Changing an input or a label after seeing model output fails validation rather than silently moving the target.', { size: 8.6, color: MUTED })

  layout.section('3. Aggregate findings')
  layout.text(`All figures below are read from the committed evidence artifact, which carries every one of the ${corpus.callCount} calls as an individual row and re-derives these totals from those rows. A hand-edited total fails validation rather than printing.`)
  layout.table(
    ['Path', 'Provider input tokens', 'Modeled cost', 'Latency p50', 'Latency p95'],
    findings.map((row) => [row.label, row.providerInputTokens, row.modeledCostUsd, row.latencyP50, row.latencyP95]),
    [0.3, 0.2, 0.16, 0.17, 0.17],
  )
  layout.heading('Required-fact retention, by scorer', 2)
  layout.text('Two scorers were applied to the same answers. They disagree, and any retention figure is meaningless without naming which one produced it.', { font: fonts.bold, size: 9 })
  layout.table(
    ['Path', 'Path-blinded semantic adjudication', 'Deterministic exact-span containment', 'Expected citations resolved'],
    findings.map((row) => [row.label, row.adjudicatedFacts, row.deterministicFacts, row.citations]),
    [0.28, 0.26, 0.26, 0.2],
  )
  layout.bullets([
    'Path-blinded semantic adjudication applies a fixed rubric to each answer with the path hidden from the reviewer, so a correct paraphrase counts as answered. This is the figure a business reader usually means by "did it keep the facts".',
    `Deterministic exact-span containment requires the labelled evidence span to appear literally. It is reproducible by anyone holding the corpus, and it under-counts: a correct paraphrase scores as a miss. That is why the baseline scores ${findings[0].deterministicFacts} under it while scoring ${findings[0].adjudicatedFacts} under adjudication.`,
    'Reporting only the first figure would overstate the result. Reporting only the second would understate it. Both are published per workload in the artifact.',
  ], 8.6)
  layout.heading('Other measured properties', 2)
  layout.bullets([
    `Prohibited assertions across all ${corpus.callCount} calls: ${model.prohibitedAssertions}.`,
    `Calls completing without retry: ${model.successfulCalls} of ${corpus.callCount}.`,
    `Maha non-expansion bypass engaged on ${model.bypassEngaged} of ${corpus.workloadCount} workloads (see section 5).`,
  ], 8.6)

  layout.section('4. Representative three-path trace')
  layout.callout(
    'ILLUSTRATIVE ONLY',
    'This is one workload, one call per path. It is not evidence for the aggregate in section 3.',
  )
  layout.table(['Property', 'Value'], [
    ['Trace', trace.traceId],
    ['Workload', `${trace.workloadId} (${trace.difficulty})`],
    ['Source documents', String(trace.documentCount)],
    ['Total source bytes', trace.sourceBytes],
  ], [0.36, 0.64])
  layout.table(
    ['Path', 'Input tokens', 'Output tokens', 'Latency', 'Modeled cost'],
    trace.rows.map((row) => [row.label, row.inputTokens, row.outputTokens, row.latencyMs, row.modeledCostUsd]),
    [0.32, 0.18, 0.16, 0.16, 0.18],
  )
  layout.text('The trace carries no source document text, no compiled context, no request headers, and no credential. On the Maha path it carries the pack identifier and the input and output hashes, so the selection that produced that answer can be identified without republishing the material it selected from.')
  layout.bullets(trace.limitations, 8.6)

  layout.section('5. Failure and boundary evidence')
  layout.text(`Reduction is only useful if the component fails safely. The behaviours below were exercised separately from the measurement run, with no provider credential and ${failure.liveProviderCalls} live provider calls (${failure.evaluationId}, ${failure.evaluatedDate}).`)
  layout.text(`The deployable policy pins passthroughOnError: false on both the request and response phases, with a ${failure.timeoutMillis} ms timeout. Fail-closed is the point: an invalid or absent evidence seal must not become a successful response.`)
  layout.table(
    ['Condition', 'Layer', 'Observed', 'Forwarded upstream?'],
    failure.cases.map((entry) => [entry.id, entry.layer, entry.observedStatus, entry.upstreamForwarded]),
    [0.3, 0.24, 0.28, 0.18],
  )
  layout.text(`The gateway-side behaviours were verified against the WSO2 Interceptor Service v1 policy implementation itself, not a Maha reimplementation of it. Tests passed: ${failure.upstreamTests.join(', ')}. Each scenario was measured ${failure.repetitionsPerScenario} times.`, { size: 8.6 })
  layout.heading('Non-expansion and minimum-size bypass', 2)
  layout.text('The interceptor does not substitute a compiled pack when the rendered whole-document input is below the minimum-size threshold, and above it still compares the compiled and original contexts and forwards the original whenever compilation would be the same size or larger. The response identifies the decision in its headers.')
  layout.text(`On this corpus the bypass engaged on ${model.bypassEngaged} of ${corpus.workloadCount} workloads, because every workload was 20K-100K tokens and compilation reduced all of them. That means the bypass path is present and declared but not exercised here - its behaviour on small or non-reducing payloads is unmeasured by this run.`, { font: fonts.bold, size: 8.8 })
  layout.heading('Explicitly unmeasured', 2)
  layout.bullets([
    'Behaviour on customer documents of any kind.',
    'Behaviour at production concurrency or sustained volume.',
    `Latency as a distribution: section 3 reports p50 and p95 across ${corpus.workloadCount} single observations, not repeated runs of the same workload.`,
    'The bypass path on small or non-reducing inputs.',
    'Any deployed-gateway network overhead beyond the measured call latency.',
    'Recovery behaviour after a partial or ambiguous settlement in production.',
  ], 8.6)

  layout.section('6. Limitations')
  layout.text('These are carried from the evidence artifact and the run records. None is rhetorical; each one bounds a claim above.', { color: MUTED, size: 8.6 })
  layout.bullets([
    ...model.artifactLimitations,
    ...failure.limitations,
    `The Prompt Compressor configuration used here (version ${configuration.promptCompressorVersion}, retained ratio ${configuration.promptCompressorRetainedRatio}) has not been confirmed by WSO2 or by a customer as the intended production setup. Its result must not be generalized until it has been.`,
    'Costs are modeled: the declared price assumption applied to observed token counts. They are not provider invoices and they are not a savings guarantee.',
    'The answer-bearing primary evidence - the durable checkpoint and the path-blinded adjudication - is not committed to the repository and is not distributed with this package, because both retain the model’s answer text for every call. The public artifact is independently checkable from its rows to its aggregates; full source-to-row regeneration additionally requires the digest-identified primary files, which are held outside the repository and must be digest-verified before use.',
    'This document describes a compatibility evaluation. It is not a regulatory certification, an accreditation, an endorsement by WSO2, or a statement about production reliability.',
  ], 8.6)

  layout.section('7. Recommended customer evaluation')
  layout.text('A fixed-scope engagement designed to answer one question: does the result above survive your material?')
  layout.y -= 4
  for (const [title, body] of [
    ['1. You supply one sanitized, representative workflow.', 'A single document set or RAG export that resembles what your system actually reads, with the facts and citations that must survive named in advance. No production credentials and no personal data.'],
    ['2. Configuration and spend are frozen before anything runs.', 'Gateway and policy versions, compressor ratio, model, temperature, output ceiling, an exact provider-spend ceiling, and the zero-retry rule are agreed and digest-recorded. Your labels are frozen at the same time, so the scoring target cannot move after results are seen.'],
    ['3. The same three paths run against it.', 'Baseline, your gateway’s native compressor, and Maha - identical inputs, identical labels, no automatic retries, a durable checkpoint after every call.'],
    ['4. You receive a private evidence package.', 'The structure of this document: per-workload rows, both retention scorers, latency, modeled cost, failure-path behaviour, and every limitation that applies to your run.'],
    ['5. Maha states a recommendation: proceed, revise, or stop.', 'Including stop. An evaluation that concludes the component does not help your workload is a successful evaluation, and it is delivered as plainly as the alternative.'],
  ] as [string, string][]) {
    layout.text(title, { size: 9.4, font: fonts.bold })
    layout.text(body, { size: 8.8, indent: 12 })
    layout.y -= 5
  }
  layout.text('Commercial terms for this engagement are quoted separately and are not part of this sample document.', { color: MUTED, size: 8.6 })

  layout.section('8. Technical appendix')
  layout.heading('Verify the figures in section 3', 2)
  layout.text('shasum -a 256 content/integrations/wso2-live-evaluation-evidence.json\nnpm run validate:wso2-live-evidence\nnpm run reproduce:wso2-evaluation', { font: fonts.mono, size: 8 })
  layout.text('The first prints the artifact digest below. The second re-derives every aggregate from the per-workload rows and fails on any inconsistency. The third is the frozen-corpus dry run: it contacts no gateway and makes no provider call.', { size: 8.6 })
  layout.heading('Verify this document', 2)
  layout.text('npm run validate:context-control-sample-assessment', { font: fonts.mono, size: 8 })
  layout.text('Regenerates the document from the committed evidence and fails if any figure in it differs from the artifact.', { size: 8.6 })
  layout.heading('Digests', 2)
  layout.table(['Artifact', 'SHA-256'], [
    ['Evidence artifact (published)', digests.evidenceArtifact],
    ['Frozen corpus label freeze', digests.corpusLabelFreeze],
    ['Reproduction manifest', digests.reproductionManifest],
    ['Failure-path evidence', digests.failurePathEvidence],
    ['Source checkpoint (not published)', digests.sourceCheckpoint],
    ['Source adjudication (not published)', digests.sourceAdjudication],
  ], [0.34, 0.66])
  layout.heading('Referenced materials', 2)
  layout.bullets([
    'Evaluation policy bundle: content/integrations/wso2-policy-bundle/ - secret-free proxy template, compatibility manifest with artifact digests, create-only installer, confirmation-gated uninstaller. Validate with npm run validate:wso2-policy-bundle.',
    'Frozen reproduction manifest: content/integrations/wso2-reproduction.json.',
    'Sanitized representative trace: content/integrations/wso2-sanitized-three-path-trace.json.',
    'Failure-path evidence: content/integrations/wso2-failure-path-result.json.',
    'Technical integration notes: docs/integrations/wso2-context-interceptor.md.',
    'Evidence recovery record: docs/integrations/wso2-live-evaluation-evidence-recovery.md.',
  ], 8.4)
  layout.heading('Data handling in this document', 2)
  layout.text('No model answer text, source document, prompt, credential, request body, response body, private file path, or customer-identifying content appears anywhere in this package.', { size: 8.6 })

  return doc.save()
}
