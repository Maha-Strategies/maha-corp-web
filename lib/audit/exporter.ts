import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import { AuditLedgerEntry, AuditExportPayload } from './types';

/**
 * Generates an RFC 4180-compliant CSV string from ledger entries.
 */
export function generateCSV(entries: AuditLedgerEntry[]): string {
  const headers = [
    'Transaction ID',
    'Timestamp (UTC)',
    'Engine',
    'Type',
    'Credit Delta',
    'Input Hash',
    'Output Hash',
    'HMAC Signature',
    'Status'
  ];

  const rows = entries.map((e) => [
    e.id,
    new Date(e.timestamp).toISOString(),
    e.engine,
    e.entryType,
    e.creditDelta.toString(),
    e.inputHash,
    e.outputHash,
    e.hmacSignature,
    e.status
  ]);

  const escapeField = (field: string) => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvContent = [
    headers.map(escapeField).join(','),
    ...rows.map((row) => row.map(escapeField).join(','))
  ].join('\r\n');

  return csvContent;
}

/**
 * Generates a compliance-ready PDF document containing audit trail and verification summary.
 */
export async function generatePDF(payload: AuditExportPayload): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]); // Standard Letter size
  const { height, width } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const margin = 40;
  let yPosition = height - margin;

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 60,
    width: width,
    height: 60,
    color: rgb(0.05, 0.09, 0.16) // Maha Navy
  });

  page.drawText('MAHA STRATEGIES // PROVENANCE AUDIT REPORT', {
    x: margin,
    y: height - 38,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  yPosition -= 80;

  // Metadata Summary Section
  page.drawText(`Tenant ID: ${payload.tenantId}`, { x: margin, y: yPosition, size: 10, font: fontBold });
  page.drawText(`Generated: ${payload.generatedAt}`, { x: margin + 250, y: yPosition, size: 10, font: fontRegular });
  yPosition -= 16;
  page.drawText(`Total Operations: ${payload.summary.totalJobs}`, { x: margin, y: yPosition, size: 10, font: fontRegular });
  page.drawText(`Credits Settled: ${payload.summary.totalCreditsConsumed}`, { x: margin + 250, y: yPosition, size: 10, font: fontRegular });
  yPosition -= 16;
  page.drawText(`Sequence Hash: ${payload.summary.verificationHash.slice(0, 32)}...`, { x: margin, y: yPosition, size: 9, font: fontMono, color: rgb(0.3, 0.3, 0.3) });

  yPosition -= 24;

  // Table Headers
  const tableTop = yPosition;
  page.drawLine({
    start: { x: margin, y: tableTop },
    end: { x: width - margin, y: tableTop },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });

  yPosition -= 15;
  page.drawText('Timestamp (UTC)', { x: margin, y: yPosition, size: 8, font: fontBold });
  page.drawText('Engine', { x: margin + 110, y: yPosition, size: 8, font: fontBold });
  page.drawText('Delta', { x: margin + 200, y: yPosition, size: 8, font: fontBold });
  page.drawText('HMAC Proof Snippet', { x: margin + 250, y: yPosition, size: 8, font: fontBold });
  page.drawText('Status', { x: margin + 460, y: yPosition, size: 8, font: fontBold });

  yPosition -= 8;
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });

  // Table Rows
  for (const entry of payload.entries) {
    if (yPosition < 50) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - margin;
    }

    yPosition -= 16;
    const dateStr = new Date(entry.timestamp).toISOString().replace('T', ' ').slice(0, 19);

    page.drawText(dateStr, { x: margin, y: yPosition, size: 8, font: fontRegular });
    page.drawText(entry.engine, { x: margin + 110, y: yPosition, size: 8, font: fontRegular });
    page.drawText(`${entry.creditDelta}`, { x: margin + 200, y: yPosition, size: 8, font: fontRegular });
    page.drawText(entry.hmacSignature.slice(0, 28) + '...', { x: margin + 250, y: yPosition, size: 7, font: fontMono });
    page.drawText(entry.status, {
      x: margin + 460,
      y: yPosition,
      size: 8,
      font: fontBold,
      color: entry.status === 'COMPLETED' ? rgb(0, 0.5, 0.2) : rgb(0.8, 0.1, 0.1)
    });
  }

  return await pdfDoc.save();
}

/**
 * Computes an aggregate cryptographic checksum over the audit sequence to guarantee tamper evidence.
 */
export function computeSequenceHash(entries: AuditLedgerEntry[]): string {
  const hash = crypto.createHash('sha256');
  entries.forEach((e) => {
    hash.update(`${e.id}:${e.timestamp}:${e.hmacSignature}:${e.creditDelta}`);
  });
  return hash.digest('hex');
}