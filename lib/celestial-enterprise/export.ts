import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { canonicalJson, digestOf } from '../celestial-hypotheses/canonical.ts'
import type { CelestialEnterpriseReport } from './contracts.ts'

export function generateEvidenceJson(report: CelestialEnterpriseReport): string {
  return canonicalJson({ exportVersion: 'celestial-evidence-export/1', exportedArtifactSha256: digestOf(report), report })
}

function wrap(value: string, width = 88): string[] {
  const words = value.replaceAll(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  for (const word of words) {
    const last = lines.at(-1)
    if (!last || last.length + word.length + 1 > width) lines.push(word)
    else lines[lines.length - 1] = `${last} ${word}`
  }
  return lines
}

export async function generateEvidencePdf(report: CelestialEnterpriseReport): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  let page = document.addPage([612, 792])
  let y = 738
  const line = (value: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    for (const text of wrap(value, options.size && options.size > 11 ? 68 : 88)) {
      if (y < 48) { page = document.addPage([612, 792]); y = 744 }
      page.drawText(text, { x: 42, y, size: options.size ?? 9, font: options.bold ? bold : regular, color: options.color ?? rgb(0.12, 0.14, 0.18) })
      y -= (options.size ?? 9) + 5
    }
  }
  page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: rgb(0.05, 0.09, 0.16) })
  page.drawText('MAHA CELESTIAL // EVIDENCE EXPORT', { x: 42, y: 767, size: 13, font: bold, color: rgb(1, 1, 1) })
  line(`Report ${report.reportId}`, { bold: true, size: 14 })
  line(`${report.reportType} · ${report.interpretationPack.packId}@${report.interpretationPack.version}`)
  line(`Generated UTC: ${report.generatedAtUtc} · Tenant: ${report.tenantId}`)
  y -= 8
  line('Reproducibility', { bold: true, size: 11 })
  line(`Request: ${report.reproducibility.requestSha256}`)
  line(`Result: ${report.reproducibility.resultSha256}`)
  line(`Pack: ${report.interpretationPack.packSha256}`)
  line(`Registry: ${report.reproducibility.astrologyRegistryVersion} · Compiler: ${report.reproducibility.compilerVersion}`)
  line(report.reproducibility.guarantee)
  y -= 8
  line('Data governance', { bold: true, size: 11 })
  line(`Consent basis: ${report.dataGovernance.consentBasis} · Consent reference: ${report.dataGovernance.consentReferenceSha256}`)
  line(`Saved: ${String(report.saved)} · Retention: ${report.dataGovernance.retentionDays} days · Expires: ${report.expiresAtUtc ?? 'not retained'}`)
  y -= 8
  line('Interpretive boundaries', { bold: true, size: 11 })
  for (const boundary of report.boundaries) line(`• ${boundary}`)
  y -= 8
  line('Evidence manifest', { bold: true, size: 11 })
  line('This PDF is a human-readable evidence summary. Export the JSON form for the complete canonical calculation, geometry, rule, passage, exclusion, and provenance record.')
  line(`Complete canonical report digest: ${digestOf(report)}`)
  return document.save()
}
