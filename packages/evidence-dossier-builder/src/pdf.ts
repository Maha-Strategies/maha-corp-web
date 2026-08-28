import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import type { EvidenceDossier } from './schema.ts'
import type { DossierCalculationAttachment } from '../../wasm-kernel/src/dossier.ts'

const PAGE = { width: 612, height: 792, margin: 54, footer: 36 }

function ascii(value: string): string {
  return value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[\u2010-\u2015]/g, '-')
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of ascii(text).split('\n')) {
    let line = ''
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= width) return [word]
      const chunks: string[] = []; let chunk = ''
      for (const character of word) {
        if (chunk && font.widthOfTextAtSize(chunk + character, size) > width) { chunks.push(chunk); chunk = character } else chunk += character
      }
      if (chunk) chunks.push(chunk)
      return chunks
    })
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate
      else { if (line) lines.push(line); line = word }
    }
    if (line) lines.push(line)
    if (!paragraph.trim()) lines.push('')
  }
  return lines
}

export async function renderEvidenceDossierPdf(input: {
  dossier: EvidenceDossier
  attachments: readonly DossierCalculationAttachment[]
  packageVersion: string
  engagementLabel: string
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const fixed = new Date(input.dossier.generatedAt)
  pdf.setTitle(ascii(input.dossier.title)); pdf.setAuthor('Maha Strategies')
  pdf.setSubject('Evidence Dossier - source-bound claims and deterministic calculation receipts')
  pdf.setCreator('Maha Evidence Dossier Builder'); pdf.setProducer('Maha Evidence Dossier Builder')
  pdf.setCreationDate(fixed); pdf.setModificationDate(fixed)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)
  let page: PDFPage; let y = 0
  const newPage = () => { page = pdf.addPage([PAGE.width, PAGE.height]); y = PAGE.height - PAGE.margin }
  newPage()
  const line = (text: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = options.size ?? 9.5; const font = options.font ?? regular; const gap = options.gap ?? 4
    for (const row of wrap(text, font, size, PAGE.width - PAGE.margin * 2)) {
      if (y < PAGE.footer + size * 2) newPage()
      page.drawText(row, { x: PAGE.margin, y, size, font, color: options.color ?? rgb(0.12, 0.15, 0.18) })
      y -= size * 1.35
    }
    y -= gap
  }
  const heading = (text: string) => { y -= 6; line(text.toUpperCase(), { size: 11, font: bold, color: rgb(0.12, 0.34, 0.42), gap: 7 }) }

  line('MAHA STRATEGIES / EVIDENCE DOSSIER', { size: 9, font: bold, color: rgb(0.12, 0.34, 0.42) })
  line(input.dossier.title, { size: 21, font: bold, gap: 10 })
  line(input.dossier.inquiry, { size: 11, gap: 10 })
  line(`${input.packageVersion} | ${input.engagementLabel} | Review state: ${input.dossier.reviewState}`, { size: 8.5, font: mono })
  line(`Dossier digest: ${input.dossier.provenanceBundle.dossierDigest}`, { size: 7.5, font: mono })
  heading('Evidence boundary'); line(input.dossier.disclaimer)
  heading('Claims')
  for (const claim of input.dossier.claims) {
    line(`${claim.claimId} - ${claim.epistemicStatus}`, { font: bold, gap: 2 })
    line(claim.auditedStatement)
    line(`Scope: ${claim.verificationScope} | Uncertainty: ${claim.uncertainty}`, { size: 8.5 })
    line(`Sources: ${claim.sourceIds.join(', ')} | Passages: ${claim.passageIds.join(', ')}`, { size: 8, font: mono })
  }
  heading('Deterministic calculation receipts')
  if (!input.attachments.length) line('No calculation receipt is attached. No calculation support is claimed.')
  for (const attachment of input.attachments) {
    const receipt = attachment.receipt
    line(`${receipt.module}.${receipt.operation}`, { font: bold, gap: 2 })
    line(`Supports claims: ${attachment.claimIds.join(', ')}`)
    line(`Output: ${JSON.stringify(receipt.output)} | Uncertainty: ${JSON.stringify(receipt.uncertainty)}`)
    line(`Precision: ${receipt.precisionPolicy}`)
    line(`Receipt: ${receipt.receiptSha256}`, { size: 7.5, font: mono })
    line(`Kernel: ${receipt.kernelVersion} ${receipt.kernelSha256}`, { size: 7.5, font: mono })
  }
  heading('Sources and inspected passages')
  for (const source of input.dossier.sources) line(`${source.sourceId} - ${source.verificationState} - ${source.correctedCitation ?? source.submittedCitation}`)
  for (const passage of input.dossier.passages) line(`${passage.passageId} - ${passage.sourceId} - ${passage.locator ?? 'No locator'} - ${passage.excerpt}`)
  heading('Limitations and prohibited uses')
  for (const item of input.dossier.limitations) line(`- ${item}`)
  for (const item of input.dossier.prohibitedUses) line(`- ${item}`)

  const pages = pdf.getPages()
  pages.forEach((item, index) => item.drawText(`Maha Evidence Dossier | Page ${index + 1} of ${pages.length}`, { x: PAGE.margin, y: 20, size: 7.5, font: regular, color: rgb(0.35, 0.38, 0.4) }))
  return pdf.save({ useObjectStreams: false, addDefaultPage: false, objectsPerTick: Number.POSITIVE_INFINITY })
}
