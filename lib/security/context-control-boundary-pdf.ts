import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { BOUNDARY_VERSION, SECTIONS, VERIFICATION_COMMANDS } from './context-control-boundary.ts'

/**
 * One page, two columns, from the same claim objects the Markdown renders.
 *
 * One page is a constraint, not a preference: a procurement reviewer reads the
 * first page of everything and the second page of very little. The renderer
 * throws if the content does not fit, rather than silently spilling onto a
 * second page nobody opens.
 */
const INK = rgb(0.06, 0.09, 0.16)
const MUTED = rgb(0.40, 0.45, 0.52)
const RULE = rgb(0.80, 0.83, 0.87)
const ACCENT = rgb(0.11, 0.30, 0.55)

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 34
const GUTTER = 20
const COLUMN_W = (PAGE_W - MARGIN * 2 - GUTTER) / 2
const BODY_SIZE = 6.9
const BODY_LEAD = 8.5

/** Standard PDF fonts are WinAnsi; fold anything they cannot encode. */
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

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of toWinAnsi(text).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue }
    if (line) out.push(line)
    line = word
  }
  if (line) out.push(line)
  return out
}

export async function renderBoundaryPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Context-Control Security and Data Boundary')
  doc.setAuthor('Maha Strategies LLC')
  doc.setSubject('Evidence summary for the Maha Context Compiler and its bounded WSO2 interceptor integration')
  doc.setCreator('scripts/generate-context-control-security-boundary.ts')
  // Fixed so the committed bytes are reproducible and can be re-derived.
  doc.setCreationDate(new Date('2026-08-21T00:00:00Z'))
  doc.setModificationDate(new Date('2026-08-21T00:00:00Z'))

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const mono = await doc.embedFont(StandardFonts.Courier)

  const page: PDFPage = doc.addPage([PAGE_W, PAGE_H])

  // Masthead
  let y = PAGE_H - MARGIN - 6
  page.drawText(toWinAnsi('MAHA STRATEGIES LLC'), { x: MARGIN, y, size: 6.6, font: bold, color: MUTED })
  const version = toWinAnsi(`VERSION ${BOUNDARY_VERSION}`)
  page.drawText(version, { x: PAGE_W - MARGIN - bold.widthOfTextAtSize(version, 6.6), y, size: 6.6, font: bold, color: MUTED })
  y -= 17
  page.drawText(toWinAnsi('Context-Control Security and Data Boundary'), { x: MARGIN, y, size: 16.5, font: bold, color: INK })
  y -= 12
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.1, color: INK })
  y -= 12

  for (const line of wrap(
    'An evidence summary for a technical or procurement reviewer. Every statement below is traceable to committed source, a test, or a published artifact, and the mapping is machine-checkable. It claims no certification, no compliance status, no partnership, and no guaranteed outcome. Where a boundary is narrower than it might sound, the narrow version is the one written down.',
    regular, 7.4, PAGE_W - MARGIN * 2,
  )) {
    page.drawText(line, { x: MARGIN, y, size: 7.4, font: regular, color: INK })
    y -= 9.4
  }
  y -= 6
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.4, color: RULE })

  // Two columns
  const columnTop = y - 13
  const columnBottom = MARGIN + 30
  let column = 0
  let cursor = columnTop
  const columnX = () => MARGIN + column * (COLUMN_W + GUTTER)

  const need = (height: number): void => {
    if (cursor - height >= columnBottom) return
    if (column === 1) throw new Error('The security boundary no longer fits one page. Shorten a claim rather than adding a page.')
    column = 1
    cursor = columnTop
  }

  for (const section of SECTIONS) {
    need(22)
    page.drawText(toWinAnsi(section.title.toUpperCase()), { x: columnX(), y: cursor, size: 7.2, font: bold, color: ACCENT })
    cursor -= 3
    page.drawLine({ start: { x: columnX(), y: cursor }, end: { x: columnX() + COLUMN_W, y: cursor }, thickness: 0.4, color: RULE })
    cursor -= 8.5

    if (section.lead) {
      for (const line of wrap(section.lead, italic, 6.5, COLUMN_W)) {
        need(BODY_LEAD)
        page.drawText(line, { x: columnX(), y: cursor, size: 6.5, font: italic, color: MUTED })
        cursor -= 7.8
      }
      cursor -= 1.5
    }

    for (const claim of section.claims) {
      const lines = wrap(claim.text, regular, BODY_SIZE, COLUMN_W - 7)
      // Keep the marker with at least the first two lines of its claim.
      need(BODY_LEAD * Math.min(lines.length, 2))
      page.drawText('-', { x: columnX(), y: cursor, size: BODY_SIZE, font: regular, color: MUTED })
      lines.forEach((line, index) => {
        if (index > 0) need(BODY_LEAD)
        page.drawText(line, { x: columnX() + 7, y: cursor, size: BODY_SIZE, font: regular, color: INK })
        cursor -= BODY_LEAD
      })
      cursor -= 2
    }
    cursor -= 4
  }

  need(24)
  page.drawText(toWinAnsi('VERIFY IT YOURSELF'), { x: columnX(), y: cursor, size: 7.2, font: bold, color: ACCENT })
  cursor -= 3
  page.drawLine({ start: { x: columnX(), y: cursor }, end: { x: columnX() + COLUMN_W, y: cursor }, thickness: 0.4, color: RULE })
  cursor -= 9
  for (const entry of VERIFICATION_COMMANDS) {
    need(BODY_LEAD * 2)
    for (const line of wrap(entry.command, mono, 6.2, COLUMN_W)) {
      page.drawText(line, { x: columnX(), y: cursor, size: 6.2, font: mono, color: INK })
      cursor -= 7.6
    }
    for (const line of wrap(entry.what, regular, 6.4, COLUMN_W - 7)) {
      need(7.6)
      page.drawText(line, { x: columnX() + 7, y: cursor, size: 6.4, font: italic, color: MUTED })
      cursor -= 7.6
    }
    cursor -= 2.5
  }
  for (const line of wrap('No credential is needed for any of the above, and none of them contacts a gateway, a model provider, or any Maha production system.', regular, 6.4, COLUMN_W)) {
    need(7.6)
    page.drawText(line, { x: columnX(), y: cursor, size: 6.4, font: regular, color: INK })
    cursor -= 7.6
  }

  // Footer
  page.drawLine({ start: { x: MARGIN, y: MARGIN + 20 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 20 }, thickness: 0.4, color: RULE })
  const footer = 'Covers the Maha Context Compiler and its bounded WSO2 interceptor integration only. Not a security certification, a regulatory attestation, a WSO2 endorsement, or a substitute for your own review.'
  let footerY = MARGIN + 11
  for (const line of wrap(footer, regular, 6.1, PAGE_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y: footerY, size: 6.1, font: regular, color: MUTED })
    footerY -= 7.2
  }

  if (doc.getPageCount() !== 1) throw new Error('The security boundary must be exactly one page.')
  return doc.save()
}
