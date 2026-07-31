import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { generateCSV, generatePDF, computeSequenceHash } from '@/lib/audit/exporter';
import { AuditLedgerEntry, AuditExportPayload } from '@/lib/audit/types';

const redis = Redis.fromEnv();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const startTime = parseInt(searchParams.get('startTime') || '0', 10);
    const endTime = parseInt(searchParams.get('endTime') || Date.now().toString(), 10);

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing required tenantId parameter' }, { status: 400 });
    }

    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json({ error: 'Invalid format requested. Supported formats: csv, pdf' }, { status: 400 });
    }

    // Query double-entry ledger logs indexed in Upstash Redis by timestamp range
    const ledgerKey = `ledger:tenant:${tenantId}:entries`;
    const rawEntries: string[] = await redis.zrange(
      ledgerKey,
      startTime,
      endTime,
      { byScore: true }
    );

    const entries: AuditLedgerEntry[] = rawEntries.map((item) => typeof item === 'string' ? JSON.parse(item) : item);

    // Calculate aggregated audit totals
    const totalCreditsConsumed = entries.reduce((acc, curr) => acc + Math.abs(curr.creditDelta), 0);
    const sequenceHash = computeSequenceHash(entries);

    const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'csv') {
      const csvData = generateCSV(entries);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="maha_audit_${tenantId}_${timestampIso}.csv"`,
          'Cache-Control': 'no-store, max-age=0'
        }
      });
    }

    // PDF Format Export
    const payload: AuditExportPayload = {
      generatedAt: new Date().toISOString(),
      tenantId,
      entries,
      summary: {
        totalJobs: entries.length,
        totalCreditsConsumed,
        verificationHash: sequenceHash
      }
    };

    const pdfBuffer = await generatePDF(payload);

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="maha_audit_${tenantId}_${timestampIso}.pdf"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error) {
    console.error('[Audit Export Error]:', error);
    return NextResponse.json({ error: 'Internal audit export failure' }, { status: 500 });
  }
}