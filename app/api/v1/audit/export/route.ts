import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { generateCSV, generatePDF, computeSequenceHash } from '@/lib/audit/exporter'
import type { AuditLedgerEntry, AuditExportPayload } from '@/lib/audit/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const redis = Redis.fromEnv()

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function timeBound(value: string | null, fallback: number): number | null {
  if (value === null) return fallback
  if (!/^\d{1,16}$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  // proxy.ts authenticates every /api/v1 route and overwrites this value with
  // the verified key id. The client never selects the ledger namespace.
  const clientId = request.headers.get('x-maha-api-key-id')
  if (!clientId) return json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, 401)

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') ?? 'csv').toLowerCase()
  const startTime = timeBound(searchParams.get('startTime'), 0)
  const endTime = timeBound(searchParams.get('endTime'), Date.now())
  if (format !== 'csv' && format !== 'pdf') return json({ error: { code: 'invalid_format', message: 'format must be csv or pdf.' } }, 400)
  if (startTime === null || endTime === null || startTime > endTime) return json({ error: { code: 'invalid_time_range', message: 'startTime and endTime must be valid epoch-millisecond values.' } }, 400)

  try {
    const rawEntries = await redis.zrange<string[]>(`ledger:tenant:${clientId}:entries`, startTime, endTime, { byScore: true })
    const entries: AuditLedgerEntry[] = rawEntries.map((item) => JSON.parse(item) as AuditLedgerEntry)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'csv') {
      return new NextResponse(generateCSV(entries), { headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="maha_audit_${clientId}_${timestamp}.csv"`,
        'Cache-Control': 'no-store',
      } })
    }

    const payload: AuditExportPayload = {
      generatedAt: new Date().toISOString(), tenantId: clientId, entries,
      summary: {
        totalJobs: entries.length,
        totalCreditsConsumed: entries.reduce((total, entry) => total + Math.abs(entry.creditDelta), 0),
        verificationHash: computeSequenceHash(entries),
      },
    }
    return new NextResponse(Buffer.from(await generatePDF(payload)), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="maha_audit_${clientId}_${timestamp}.pdf"`,
      'Cache-Control': 'no-store',
    } })
  } catch (error) {
    console.error('[AUDIT_EXPORT_ERROR]', error instanceof Error ? error.name : 'unknown_error')
    return json({ error: { code: 'audit_export_unavailable', message: 'The audit export could not be generated.' } }, 503)
  }
}
