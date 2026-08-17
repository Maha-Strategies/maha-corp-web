import { celestialError, celestialJson, openEnterpriseGate, validReportId } from '@/lib/celestial-enterprise/route-support'
import { deleteEnterpriseReport, getEnterpriseReport } from '@/lib/celestial-enterprise/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ reportId: string }> }

export async function GET(request: Request, context: Context) {
  const gate = await openEnterpriseGate(request, 'reports:read')
  if (!gate.ok) return gate.response
  const { reportId } = await context.params
  if (!validReportId(reportId)) return celestialError('invalid_report_id', 'The report identifier is malformed.', 400)
  try {
    const report = await getEnterpriseReport(gate.client, gate.principal.tenantId, reportId)
    return report ? celestialJson({ report }) : celestialError('report_not_found', 'The report does not exist, expired, or was deleted.', 404)
  } catch { return celestialError('report_read_failed', 'The report could not be read.', 502) }
}

export async function DELETE(request: Request, context: Context) {
  const gate = await openEnterpriseGate(request, 'reports:delete')
  if (!gate.ok) return gate.response
  const { reportId } = await context.params
  if (!validReportId(reportId)) return celestialError('invalid_report_id', 'The report identifier is malformed.', 400)
  try {
    return await deleteEnterpriseReport(gate.client, gate.principal, reportId)
      ? celestialJson({ reportId, deleted: true })
      : celestialError('report_not_found', 'The report does not exist or was already deleted.', 404)
  } catch { return celestialError('report_deletion_failed', 'The report could not be deleted.', 502) }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET, DELETE, OPTIONS' } }) }
