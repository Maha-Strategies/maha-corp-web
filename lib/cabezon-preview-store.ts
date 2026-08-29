import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  CabezonPreviewError,
  type CabezonEnquiryPlan,
  type CabezonLifecycle,
  type CabezonLifecycleStore,
} from './cabezon-preview.ts'

type LifecycleResult = { status: 'created' | 'idempotent'; lifecycle: CabezonLifecycle }

export function createCabezonPreviewClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

function persistenceError(message: string, error: { code?: string; message?: string } | null): never {
  if (error?.code === 'P0001') throw new CabezonPreviewError(409, 'idempotency_conflict', 'Idempotency-Key was already used for a different CABEZON Preview action.')
  if (error?.code === 'P0002') throw new CabezonPreviewError(404, 'lifecycle_not_found', 'CABEZON Preview lifecycle was not found.')
  if (error?.code === 'P0003') throw new CabezonPreviewError(409, 'lifecycle_state_invalid', 'CABEZON Preview lifecycle is not in the required state.')
  throw new Error(`${message} [${error?.code ?? 'unknown'}].`)
}

export class SupabaseCabezonLifecycleStore implements CabezonLifecycleStore {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) { this.client = client }

  async submitEnquiry(plan: CabezonEnquiryPlan): Promise<LifecycleResult> {
    const { data, error } = await this.client.rpc('record_cabezon_preview_enquiry', {
      p_lifecycle: plan.lifecycle,
      p_question_sha256: plan.questionSha256,
      p_decision_context_sha256: plan.decisionContextSha256,
    })
    if (error || !data) persistenceError('CABEZON Preview enquiry persistence failed', error)
    return data as LifecycleResult
  }

  async recordDelivery(input: Parameters<CabezonLifecycleStore['recordDelivery']>[0]): Promise<LifecycleResult> {
    const { data, error } = await this.client.rpc('record_cabezon_preview_delivery', {
      p_lifecycle_id: input.lifecycleId,
      p_idempotency_hash: input.idempotencyHash,
      p_request_sha256: input.requestSha256,
      p_delivered_at: input.deliveredAt,
      p_delivery_reference: input.deliveryReference,
      p_updated_lifecycle: input.updatedLifecycle,
    })
    if (error || !data) persistenceError('CABEZON Preview delivery persistence failed', error)
    return data as LifecycleResult
  }

  async acknowledge(input: Parameters<CabezonLifecycleStore['acknowledge']>[0]): Promise<LifecycleResult> {
    const { data, error } = await this.client.rpc('record_cabezon_preview_acknowledgement', {
      p_lifecycle_id: input.lifecycleId,
      p_idempotency_hash: input.idempotencyHash,
      p_request_sha256: input.requestSha256,
      p_delivery_reference_sha256: input.deliveryReferenceSha256,
      p_acknowledgement_sha256: input.acknowledgementSha256,
      p_acknowledged_at: input.acknowledgedAt,
      p_updated_lifecycle: input.updatedLifecycle,
    })
    if (error || !data) persistenceError('CABEZON Preview acknowledgement persistence failed', error)
    return data as LifecycleResult
  }

  async read(lifecycleId: string): Promise<CabezonLifecycle | null> {
    const { data, error } = await this.client.rpc('read_cabezon_preview_lifecycle', { p_lifecycle_id: lifecycleId })
    if (error) persistenceError('CABEZON Preview lifecycle read failed', error)
    return data as CabezonLifecycle | null
  }
}

export function productionCabezonPreviewStore(): CabezonLifecycleStore | null {
  const client = createCabezonPreviewClient()
  return client ? new SupabaseCabezonLifecycleStore(client) : null
}
