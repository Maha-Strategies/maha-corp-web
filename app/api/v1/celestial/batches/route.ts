import { compileEnterpriseCelestialReport, CelestialEnterpriseValidationError, parseCelestialEnterpriseRequest } from '@/lib/celestial-enterprise/contracts'
import { celestialError, celestialJson, openEnterpriseGate, readCelestialBody } from '@/lib/celestial-enterprise/route-support'
import { completedReportUnits } from '@/lib/celestial-enterprise/service'
import { getEnterpriseReportByClientRequestId, isInterpretationPackInstalled, recordCelestialUsage, saveEnterpriseReport } from '@/lib/celestial-enterprise/store'
import { enqueueWebhookEvent } from '@/lib/celestial-enterprise/webhooks'
import { digestOf } from '@/lib/celestial-hypotheses/canonical'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const BATCH_ID = /^[a-z][a-z0-9_-]{7,95}$/

export async function POST(request: Request) {
  const gate = await openEnterpriseGate(request, 'batches:create')
  if (!gate.ok) return gate.response
  const body = await readCelestialBody(request)
  if (!body.ok) return body.response
  const input = body.value && typeof body.value === 'object' ? body.value as Record<string, unknown> : {}
  if (!BATCH_ID.test(String(input.clientRequestId ?? '')) || !Array.isArray(input.requests) || input.requests.length < 1 || input.requests.length > 25) return celestialError('invalid_batch', 'clientRequestId and 1–25 report requests are required.', 400)
  const clientRequestId = String(input.clientRequestId)
  const batchId = `celbatch_${digestOf({ tenantId: gate.principal.tenantId, clientRequestId }).slice(7, 31)}`
  const { data: existing } = await gate.client.from('celestial_batch_jobs').select('batch_id, status, result_manifest, completed_count, failed_count').eq('organization_id', gate.principal.tenantId).eq('client_request_id', clientRequestId).maybeSingle()
  if (existing) return celestialJson({ batchId: existing.batch_id, status: existing.status, results: existing.result_manifest, completedCount: existing.completed_count, failedCount: existing.failed_count, idempotentReplay: true, billableUnits: 0 })
  const { error: insertError } = await gate.client.from('celestial_batch_jobs').insert({ batch_id: batchId, organization_id: gate.principal.tenantId, client_request_id: clientRequestId, status: 'processing', request_count: input.requests.length, created_by_member_id: gate.principal.memberId })
  if (insertError) return celestialError('batch_write_failed', 'The batch could not be accepted.', 502)
  const results: Array<Record<string, unknown>> = []
  let completed = 0, failed = 0, billableUnits = 0
  for (const item of input.requests) {
    try {
      const parsed = parseCelestialEnterpriseRequest(item)
      if (request.headers.get('x-maha-zero-data-retention') === 'true' && parsed.dataPolicy.saveReport) throw new CelestialEnterpriseValidationError(['This credential enforces zero data retention.'])
      if (!await isInterpretationPackInstalled(gate.client, gate.principal.tenantId, parsed.interpretationPack.packId, parsed.interpretationPack.version)) throw new CelestialEnterpriseValidationError(['The interpretation pack is not installed for this organization.'])
      const previous = parsed.dataPolicy.saveReport ? await getEnterpriseReportByClientRequestId(gate.client, gate.principal.tenantId, parsed.clientRequestId) : null
      const report = compileEnterpriseCelestialReport(gate.principal.tenantId, parsed, new Date().toISOString())
      if (previous && previous.reproducibility.requestSha256 !== report.reproducibility.requestSha256) throw new CelestialEnterpriseValidationError(['clientRequestId conflicts with a previously saved request.'])
      if (!previous) await saveEnterpriseReport(gate.client, gate.principal, report)
      const output = previous ?? report
      const units = previous ? 0 : completedReportUnits(output.interpretationPack.packId)
      billableUnits += units; completed += 1
      results.push({ clientRequestId: parsed.clientRequestId, status: 'completed', reportId: output.reportId, saved: output.saved, resultSha256: output.reproducibility.resultSha256, billableUnits: units })
    } catch (error) {
      failed += 1
      results.push({ status: 'failed', error: { code: 'invalid_or_failed_report', message: error instanceof CelestialEnterpriseValidationError ? error.message : 'Report generation failed.', issues: error instanceof CelestialEnterpriseValidationError ? error.issues : undefined } })
    }
  }
  const status = failed === 0 ? 'completed' : completed === 0 ? 'failed' : 'partially-failed'
  await gate.client.from('celestial_batch_jobs').update({ status, completed_count: completed, failed_count: failed, result_manifest: results, completed_at: new Date().toISOString() }).eq('organization_id', gate.principal.tenantId).eq('batch_id', batchId)
  await recordCelestialUsage(gate.client, { organizationId: gate.principal.tenantId, keyId: gate.principal.keyId, operation: 'batch.create', reportCount: completed, billableUnits, inputBytes: body.bytes, outputBytes: new TextEncoder().encode(JSON.stringify(results)).byteLength, status: 200, occurredAtUtc: new Date().toISOString() }).catch(() => undefined)
  await enqueueWebhookEvent(gate.client, gate.principal.tenantId, status === 'completed' ? 'batch.completed' : 'batch.partially-failed', { batchId, completedCount: completed, failedCount: failed }).catch(() => undefined)
  return celestialJson({ batchId, status, completedCount: completed, failedCount: failed, results, idempotentReplay: false, billableUnits }, 200)
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } }) }
