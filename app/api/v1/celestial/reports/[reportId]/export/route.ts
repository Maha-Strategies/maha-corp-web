import { generateEvidenceJson, generateEvidencePdf } from '@/lib/celestial-enterprise/export'
import { celestialError, openEnterpriseGate, validReportId } from '@/lib/celestial-enterprise/route-support'
import { getEnterpriseReport } from '@/lib/celestial-enterprise/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ reportId: string }> }

export async function GET(request: Request, context: Context) {
  const gate = await openEnterpriseGate(request, 'reports:export')
  if (!gate.ok) return gate.response
  const { reportId } = await context.params
  if (!validReportId(reportId)) return celestialError('invalid_report_id', 'The report identifier is malformed.', 400)
  const format = new URL(request.url).searchParams.get('format') ?? 'json'
  if (format !== 'json' && format !== 'pdf') return celestialError('invalid_export_format', 'format must be json or pdf.', 400)
  try {
    const report = await getEnterpriseReport(gate.client, gate.principal.tenantId, reportId)
    if (!report) return celestialError('report_not_found', 'The report does not exist, expired, or was deleted.', 404)
    const body: BodyInit = format === 'pdf'
      ? new Blob([Uint8Array.from(await generateEvidencePdf(report))], { type: 'application/pdf' })
      : generateEvidenceJson(report)
    return new Response(body, { headers: {
      'Cache-Control': 'no-store', 'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${reportId}-evidence.${format}"`,
      'X-Maha-Celestial-API-Version': report.apiVersion, 'X-Content-Type-Options': 'nosniff',
    } })
  } catch { return celestialError('export_failed', 'The evidence export could not be generated.', 502) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, OPTIONS' } }) }
