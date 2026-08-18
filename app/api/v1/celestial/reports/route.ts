import { compileEnterpriseCelestialReport, CelestialEnterpriseValidationError, parseCelestialEnterpriseRequest } from '@/lib/celestial-enterprise/contracts'
import { celestialError, celestialJson, openEnterpriseGate, readCelestialBody } from '@/lib/celestial-enterprise/route-support'
import { completedReportUnits } from '@/lib/celestial-enterprise/service'
import { getEnterpriseReportByClientRequestId, isInterpretationPackInstalled, recordCelestialUsage, saveEnterpriseReport } from '@/lib/celestial-enterprise/store'
import { enqueueWebhookEvent } from '@/lib/celestial-enterprise/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const gate = await openEnterpriseGate(request, 'reports:create')
  if (!gate.ok) return gate.response
  const body = await readCelestialBody(request)
  if (!body.ok) return body.response
  let status = 500
  let outputBytes = 0
  let reportCount = 0
  let billableUnits = 0
  try {
    const parsed = parseCelestialEnterpriseRequest(body.value)
    if (request.headers.get('x-maha-zero-data-retention') === 'true' && parsed.dataPolicy.saveReport) {
      status = 422
      return celestialError('retention_policy_conflict', 'This API credential enforces zero data retention; submit saveReport=false and retentionDays=0.', status)
    }
    if (!await isInterpretationPackInstalled(gate.client, gate.principal.tenantId, parsed.interpretationPack.packId, parsed.interpretationPack.version)) {
      status = 403
      return celestialError('pack_not_installed', 'Install this frozen interpretation-pack version for the organization before using it.', status)
    }
    const existing = parsed.dataPolicy.saveReport
      ? await getEnterpriseReportByClientRequestId(gate.client, gate.principal.tenantId, parsed.clientRequestId)
      : null
    const compiled = compileEnterpriseCelestialReport(gate.principal.tenantId, parsed, new Date().toISOString())
    if (existing) {
      if (existing.reproducibility.requestSha256 !== compiled.reproducibility.requestSha256) {
        status = 409
        return celestialError('client_request_conflict', 'clientRequestId was already used with a different canonical request.', status)
      }
      const response = { report: existing, idempotentReplay: true, billableUnits: 0 }
      outputBytes = new TextEncoder().encode(JSON.stringify(response)).byteLength; status = 200
      return celestialJson(response, status)
    }
    await saveEnterpriseReport(gate.client, gate.principal, compiled)
    await enqueueWebhookEvent(gate.client, gate.principal.tenantId, 'report.completed', {
      reportId: compiled.reportId, reportType: compiled.reportType, saved: compiled.saved,
      requestSha256: compiled.reproducibility.requestSha256, resultSha256: compiled.reproducibility.resultSha256,
    }).catch(() => undefined)
    reportCount = 1
    billableUnits = completedReportUnits(compiled.interpretationPack.packId)
    const response = { report: compiled, idempotentReplay: false, billableUnits }
    outputBytes = new TextEncoder().encode(JSON.stringify(response)).byteLength; status = 201
    return celestialJson(response, status, { Location: `/api/v1/celestial/reports/${compiled.reportId}` })
  } catch (error) {
    if (error instanceof CelestialEnterpriseValidationError) { status = 400; return celestialError('invalid_request', error.message, status, error.issues) }
    status = error instanceof Error && error.message === 'client_request_conflict' ? 409 : 502
    return celestialError(status === 409 ? 'client_request_conflict' : 'report_generation_failed', status === 409 ? 'clientRequestId is already in use.' : 'The report could not be generated or stored.', status)
  } finally {
    void recordCelestialUsage(gate.client, { organizationId: gate.principal.tenantId, keyId: gate.principal.keyId, operation: 'report.create', reportCount, billableUnits, inputBytes: body.bytes, outputBytes, status, occurredAtUtc: new Date().toISOString() }).catch(() => undefined)
  }
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } }) }
