import type { SupabaseClient } from '@supabase/supabase-js'

import type { CelestialEnterpriseReport } from './contracts.ts'
import { decryptReportPayload, encryptReportPayload, type CelestialPrincipal } from './security.ts'

export async function isInterpretationPackInstalled(client: SupabaseClient, tenantId: string, packId: string, version: string): Promise<boolean> {
  if (packId === 'facts-only') return true
  const { data, error } = await client.from('celestial_organization_packs').select('pack_id').eq('organization_id', tenantId).eq('pack_id', packId).eq('version', version).maybeSingle()
  if (error) throw new Error(`Pack entitlement read failed: ${error.message}`)
  return Boolean(data)
}

export async function saveEnterpriseReport(client: SupabaseClient, principal: CelestialPrincipal, report: CelestialEnterpriseReport): Promise<void> {
  if (!report.saved || !report.expiresAtUtc) return
  const encrypted = encryptReportPayload(principal.tenantId, report.reportId, report)
  const { error } = await client.from('celestial_enterprise_reports').insert({
    report_id: report.reportId, organization_id: principal.tenantId, client_request_id: report.clientRequestId,
    report_type: report.reportType, pack_id: report.interpretationPack.packId, pack_version: report.interpretationPack.version,
    consent_policy_version: report.dataGovernance.consentPolicyVersion, consent_basis: report.dataGovernance.consentBasis,
    consent_reference_sha256: report.dataGovernance.consentReferenceSha256,
    request_sha256: report.reproducibility.requestSha256, result_sha256: report.reproducibility.resultSha256,
    encrypted_payload: encrypted.ciphertext, encryption_key_version: encrypted.keyVersion,
    generated_at: report.generatedAtUtc, expires_at: report.expiresAtUtc, created_by_member_id: principal.memberId,
  })
  if (error?.code === '23505') throw new Error('client_request_conflict')
  if (error) throw new Error(`Report persistence failed: ${error.message}`)
}

export async function getEnterpriseReport(client: SupabaseClient, tenantId: string, reportId: string): Promise<CelestialEnterpriseReport | null> {
  const { data, error } = await client.from('celestial_enterprise_reports').select('encrypted_payload, deleted_at, expires_at').eq('organization_id', tenantId).eq('report_id', reportId).maybeSingle()
  if (error) throw new Error(`Report read failed: ${error.message}`)
  if (!data || data.deleted_at || !data.encrypted_payload || new Date(String(data.expires_at)) <= new Date()) return null
  return decryptReportPayload<CelestialEnterpriseReport>(tenantId, reportId, String(data.encrypted_payload))
}

export async function getEnterpriseReportByClientRequestId(client: SupabaseClient, tenantId: string, clientRequestId: string): Promise<CelestialEnterpriseReport | null> {
  const { data, error } = await client.from('celestial_enterprise_reports').select('report_id, encrypted_payload, deleted_at, expires_at').eq('organization_id', tenantId).eq('client_request_id', clientRequestId).maybeSingle()
  if (error) throw new Error(`Report idempotency read failed: ${error.message}`)
  if (!data || data.deleted_at || !data.encrypted_payload || new Date(String(data.expires_at)) <= new Date()) return null
  return decryptReportPayload<CelestialEnterpriseReport>(tenantId, String(data.report_id), String(data.encrypted_payload))
}

export async function deleteEnterpriseReport(client: SupabaseClient, principal: CelestialPrincipal, reportId: string): Promise<boolean> {
  const { data, error } = await client.rpc('delete_celestial_enterprise_report', { p_organization_id: principal.tenantId, p_report_id: reportId, p_actor_member_id: principal.memberId })
  if (error) throw new Error(`Report deletion failed: ${error.message}`)
  return data === true
}

export async function recordCelestialUsage(client: SupabaseClient, input: { organizationId: string; keyId: string; operation: string; reportCount: number; billableUnits: number; inputBytes: number; outputBytes: number; status: number; occurredAtUtc: string }): Promise<void> {
  const { error } = await client.from('celestial_enterprise_usage_events').insert({
    organization_id: input.organizationId, api_key_id: input.keyId, operation: input.operation,
    report_count: input.reportCount, billable_units: input.billableUnits, input_bytes: input.inputBytes, output_bytes: input.outputBytes,
    status: input.status, occurred_at: input.occurredAtUtc,
  })
  if (error) throw new Error(`Usage metering failed: ${error.message}`)
}
