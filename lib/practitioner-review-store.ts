import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { digestOf } from './celestial-hypotheses/canonical.ts'
import { practitionerReviewHash, type PractitionerReviewRecord } from './practitioner-review.ts'

export function createPractitionerReviewClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function listPractitionerReviews(client: SupabaseClient): Promise<PractitionerReviewRecord[]> {
  const { data, error } = await client.from('practitioner_review_records').select('record_snapshot').order('reviewed_at', { ascending: false }).limit(500)
  if (error) throw new Error(`Practitioner reviews read failed: ${error.message}`)
  return (data ?? []).map((row) => row.record_snapshot as PractitionerReviewRecord)
}

export async function insertPractitionerReview(client: SupabaseClient, record: PractitionerReviewRecord, idempotencyKey: string, actorFingerprint: string) {
  const { data, error } = await client.rpc('record_practitioner_review', {
    p_record: record,
    p_profile_sha256: digestOf(record.reviewer),
    p_idempotency_hash: practitionerReviewHash(idempotencyKey),
    p_actor_fingerprint: actorFingerprint,
  })
  if (error) throw new Error(`Practitioner review insert failed [${error.code ?? 'unknown'}]: ${error.message}`)
  return data as { reviewId: string; verdict: string; idempotentReplay: boolean }
}
