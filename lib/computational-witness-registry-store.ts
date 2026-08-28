import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { WitnessRegistryConflictError, type WitnessRegistryRead, type WitnessRegistryStore, type WitnessSubmissionPlan } from './computational-witness-registry.ts'

export function createComputationalWitnessRegistryClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export class SupabaseComputationalWitnessRegistryStore implements WitnessRegistryStore {
  constructor(private readonly client: SupabaseClient) {}

  async submit(plan: WitnessSubmissionPlan) {
    const { data, error } = await this.client.rpc('record_computational_witness_receipt', {
      p_tenant_id: plan.tenantId,
      p_receipt: plan.receipt,
      p_job_id_sha256: plan.jobIdSha256,
      p_binding_sha256: plan.bindingSha256,
      p_idempotency_hash: plan.idempotencyHash,
      p_request_sha256: plan.requestSha256,
      p_actor_fingerprint: plan.actorFingerprint,
      p_retention_days: plan.retentionDays,
    })
    if (error) {
      if (error.code === 'P0001') throw new WitnessRegistryConflictError()
      throw new Error(`Witness receipt persistence failed [${error.code ?? 'unknown'}].`)
    }
    return data as { status: 'created' | 'idempotent' | 'replay'; receiptSha256: string; retainedUntil: string; payloadAvailable: boolean }
  }

  async read(tenantId: string, receiptSha256: string): Promise<WitnessRegistryRead | null> {
    const { data, error } = await this.client.rpc('read_computational_witness_receipt', { p_tenant_id: tenantId, p_receipt_sha256: receiptSha256 })
    if (error) throw new Error(`Witness receipt read failed [${error.code ?? 'unknown'}].`)
    return data as WitnessRegistryRead | null
  }

  async purge(tenantId: string, receiptSha256: string, actorFingerprint: string) {
    const { data, error } = await this.client.rpc('purge_computational_witness_payload', { p_tenant_id: tenantId, p_receipt_sha256: receiptSha256, p_actor_fingerprint: actorFingerprint, p_reason: 'tenant-request' })
    if (error) throw new Error(`Witness payload purge failed [${error.code ?? 'unknown'}].`)
    return data as { receiptSha256: string; payloadPurged: boolean; immutableIdentityRetained: boolean }
  }
}

export function productionWitnessRegistryStore(): WitnessRegistryStore | null {
  const client = createComputationalWitnessRegistryClient()
  return client ? new SupabaseComputationalWitnessRegistryStore(client) : null
}

export async function purgeExpiredComputationalWitnessPayloads(client: SupabaseClient, now: string, limit = 500): Promise<number> {
  const { data, error } = await client.rpc('purge_expired_computational_witness_payloads', { p_now: now, p_limit: limit })
  if (error) throw new Error(`Witness expiry purge failed [${error.code ?? 'unknown'}].`)
  return Number(data ?? 0)
}
