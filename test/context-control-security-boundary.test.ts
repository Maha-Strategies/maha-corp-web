import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import test from 'node:test'

import {
  ALL_CLAIMS,
  BOUNDARY_MANIFEST_PATH,
  BOUNDARY_MARKDOWN_PATH,
  BOUNDARY_PDF_PATH,
  SECTIONS,
  buildSourceManifest,
} from '../lib/security/context-control-boundary.ts'
import { renderBoundaryMarkdown } from '../lib/security/context-control-boundary-markdown.ts'
import { renderBoundaryPdf, toWinAnsi } from '../lib/security/context-control-boundary-pdf.ts'
import {
  PROHIBITED_PATTERNS,
  REQUIRED_SECTION_IDS,
  findMissingBoundaries,
  findMissingSections,
  findProhibited,
  findSensitive,
  findUnbackedClaims,
  findUnrenderedClaims,
} from '../lib/security/context-control-boundary-checks.ts'

const markdown = () => readFileSync(BOUNDARY_MARKDOWN_PATH, 'utf8')
const manifest = () => JSON.parse(readFileSync(BOUNDARY_MANIFEST_PATH, 'utf8'))

test('the committed document, manifest and PDF reproduce from the claim model', async () => {
  assert.equal(markdown(), renderBoundaryMarkdown())
  assert.equal(readFileSync(BOUNDARY_MANIFEST_PATH, 'utf8'), `${JSON.stringify(buildSourceManifest(), null, 2)}\n`)
  const pdf = await renderBoundaryPdf()
  assert.ok(Buffer.from(readFileSync(BOUNDARY_PDF_PATH)).equals(Buffer.from(pdf)))
})

test('every required section is present', () => {
  assert.deepEqual(findMissingSections(), [])
  for (const id of REQUIRED_SECTION_IDS) {
    const section = SECTIONS.find((candidate) => candidate.id === id)
    assert.ok(section && section.claims.length > 0, `section ${id} is empty`)
  }
})

test('every claim maps to a committed source whose bytes still match', () => {
  assert.deepEqual(findUnbackedClaims(manifest()), [])
  for (const claim of ALL_CLAIMS) {
    assert.ok(claim.sources.length > 0, `${claim.id} has no source`)
  }
})

test('a claim whose source has drifted is rejected', () => {
  const tampered = manifest()
  tampered.sources[0].sha256 = `sha256:${'0'.repeat(64)}`
  const problems = findUnbackedClaims(tampered)
  assert.ok(problems.length > 0)
  assert.ok(problems.some((problem) => problem.includes('has changed since the claim was written')))
})

test('a claim citing a file that does not exist is rejected', () => {
  const tampered = manifest()
  tampered.claims[0].sources = [{ path: 'lib/does-not-exist.ts' }]
  assert.ok(findUnbackedClaims(tampered).some((problem) => problem.includes('missing source')))
})

test('every claim in the model actually appears in the document', () => {
  assert.deepEqual(findUnrenderedClaims(markdown()), [])
})

test('no prohibited compliance, certification or guarantee claim is made', () => {
  assert.deepEqual(findProhibited(markdown()), [])
  const pdfText = pdfDrawnText(readFileSync(BOUNDARY_PDF_PATH))
  assert.deepEqual(findProhibited(pdfText), [])
})

/**
 * The prohibition list has to catch the affirmative form without tripping on
 * the document's own denials. If a bare keyword ban were used, "Maha is not a
 * WSO2 partner" would fail and the disclaimer would get deleted to make the
 * test pass -- the exact wrong outcome.
 */
test('the prohibition patterns catch affirmative claims and spare denials', () => {
  for (const [sample, expected] of [
    ['Maha is SOC 2 Type II certified.', 'soc2'],
    ['We are ISO 27001 compliant.', 'iso27001'],
    ['HIPAA ready for healthcare workloads.', 'hipaa'],
    ['All context is encrypted at rest.', 'encryption-at-rest'],
    ['All context is encrypted in transit.', 'encryption-in-transit'],
    ['We never store your data.', 'never-store'],
    ['An official WSO2 partner.', 'wso2-partnership'],
    ['Endorsed by WSO2.', 'endorsement'],
    ['Guaranteed savings of 90 percent.', 'guaranteed-savings'],
    ['Prevents prompt injection.', 'prevents-injection'],
  ] as [string, string][]) {
    assert.ok(findProhibited(sample).includes(expected), `"${sample}" should trip ${expected}`)
  }

  for (const denial of [
    'Maha is not a WSO2 partner and claims no WSO2 endorsement, certification, approval or customer validation.',
    'Maha holds no security certification or regulatory attestation, and this document is not one.',
    'Maha does not claim universal zero retention.',
    'It does not verify claims and does not protect against prompt injection, data exfiltration or a hostile document.',
    'No saving, latency, availability or provider behaviour is guaranteed.',
  ]) {
    assert.deepEqual(findProhibited(denial), [], `denial wrongly flagged: ${denial}`)
  }
})

test('the boundaries that make the document honest cannot be edited out', () => {
  assert.deepEqual(findMissingBoundaries(markdown()), [])
  // Removing a disclaimer must fail rather than quietly ship.
  const stripped = markdown().replace(/Maha does not claim universal zero retention[^\n]*/, '')
  assert.ok(findMissingBoundaries(stripped).includes('no-universal-retention'))
})

test('no credential, private path or sensitive string reaches either surface', () => {
  assert.deepEqual(findSensitive(markdown()), [])
  assert.deepEqual(findSensitive(pdfDrawnText(readFileSync(BOUNDARY_PDF_PATH))), [])
})

test('the source-text boundary is stated at its true width, not its widest', () => {
  const document = markdown()
  // The three halves of an honest retention claim: processed, returned, and
  // out of Maha's hands. Dropping any one makes the other two misleading.
  assert.match(document, /processed in the request that carries it/)
  assert.match(document, /returns the passages it selected, verbatim/)
  assert.match(document, /may retain the same text under settings Maha neither sets nor sees/)
  assert.match(document, /neither route handler imports or invokes any/)
})

test('fail-closed evidence is scoped to local contract tests', () => {
  const failClosed = SECTIONS.find((section) => section.id === 'fail-closed')
  assert.ok(failClosed?.lead && /local contract test/i.test(failClosed.lead))
  assert.match(failClosed.lead, /None of it is a statement about your deployed environment/i)
  for (const claim of failClosed.claims) {
    assert.ok(claim.sources.some((source) => source.kind === 'test' || source.kind === 'evidence'),
      `${claim.id} asserts behaviour without a test or evidence source`)
  }
})

test('the PDF is exactly one page and carries the scope footer', async () => {
  const bytes = await renderBoundaryPdf()
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.load(bytes)
  assert.equal(document.getPageCount(), 1, 'the boundary one-pager must be one page')
  const drawn = pdfDrawnText(bytes)
  assert.ok(drawn.includes('Not a security certification'))
  assert.ok(drawn.includes('Context-Control Security and Data Boundary'))
})

test('the PDF and the Markdown say the same thing', async () => {
  const drawn = pdfDrawnText(await renderBoundaryPdf()).replace(/\s+/g, ' ')
  for (const claim of ALL_CLAIMS) {
    // Compare on a distinctive fragment: PDF text is line-broken by the
    // renderer, so whole-sentence equality would only prove the wrapper works.
    const fragment = toWinAnsi(claim.text).split(/\s+/).slice(0, 6).join(' ')
    assert.ok(drawn.includes(fragment), `claim ${claim.id} is in the Markdown but not the PDF`)
  }
})

/** pdf-lib writes drawn text as Flate-compressed hex strings. */
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
    try { parts.push(inflateSync(buffer.subarray(from, end)).toString('latin1')) } catch { /* not Flate */ }
    index = end + 'endstream'.length
  }
  return parts.join('\n').replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_m, hex: string) => Buffer.from(hex, 'hex').toString('latin1'))
}

test('the prohibition list itself is not silently emptied', () => {
  assert.ok(PROHIBITED_PATTERNS.length >= 15)
  for (const id of ['soc2', 'iso27001', 'hipaa', 'pci', 'gdpr', 'encryption-at-rest', 'never-store', 'wso2-partnership']) {
    assert.ok(PROHIBITED_PATTERNS.some((entry) => entry.id === id), `prohibition ${id} was removed`)
  }
})
