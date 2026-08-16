/**
 * Persistence for the hypothesis registry.
 *
 * Follows the repository's service-role ledger pattern: a factory that returns
 * null when Supabase is unconfigured, so a deployment without credentials fails
 * closed with a 503 rather than silently accepting registrations into nothing.
 *
 * There is no update path for outcomes or analyses in this module, and none can
 * be added usefully — the migration revokes both from service_role.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { HYPOTHESIS_REGISTRY_VERSION, type AnalysisResult, type ExperimentDraft, type ExperimentLifecycle, type ExperimentRegistration, type OutcomeRecord } from './types.ts'
import { registrationDigest } from './registration.ts'

export type RegistryClient = SupabaseClient

export function createHypothesisRegistryClient(): RegistryClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface StoredExperiment {
  experimentId: string
  status: ExperimentLifecycle
  draft: ExperimentDraft
  notes: string | null
  registrationSha256: string | null
  registeredAtUtc: string | null
}

const EXPERIMENT_COLUMNS = 'experiment_id, status, draft, notes, registration_sha256, registered_at'

function toStored(row: Record<string, unknown>): StoredExperiment {
  return {
    experimentId: String(row.experiment_id),
    status: row.status as ExperimentLifecycle,
    draft: row.draft as ExperimentDraft,
    notes: (row.notes as string | null) ?? null,
    registrationSha256: (row.registration_sha256 as string | null) ?? null,
    registeredAtUtc: row.registered_at ? new Date(String(row.registered_at)).toISOString() : null,
  }
}

export async function insertDraft(client: RegistryClient, draft: ExperimentDraft, notes: string | null): Promise<StoredExperiment> {
  const { data, error } = await client
    .from('celestial_hypothesis_experiments')
    .insert({
      experiment_id: draft.experimentId,
      participant_pseudonym: draft.participantPseudonym,
      status: 'draft',
      study_role: draft.studyRole,
      registry_version: HYPOTHESIS_REGISTRY_VERSION,
      draft,
      draft_sha256: registrationDigest(draft),
      notes,
      tradition_id: draft.hypothesis.traditionId,
      activity_type: draft.activityType,
      fact_bundle_id: draft.factBundleId,
      fact_bundle_sha256: draft.factBundleSha256,
      analysis_plan_version: draft.analysisPlan.planVersion,
    })
    .select(EXPERIMENT_COLUMNS)
    .single()

  if (error) throw new Error(`Draft insert failed: ${error.message}`)
  return toStored(data as Record<string, unknown>)
}

export async function getExperiment(client: RegistryClient, experimentId: string): Promise<StoredExperiment | null> {
  const { data, error } = await client
    .from('celestial_hypothesis_experiments')
    .select(EXPERIMENT_COLUMNS)
    .eq('experiment_id', experimentId)
    .maybeSingle()

  if (error) throw new Error(`Experiment read failed: ${error.message}`)
  return data ? toStored(data as Record<string, unknown>) : null
}

/**
 * Updates a draft in place. Rejected by the database trigger if the row has
 * already been registered, so a lost race cannot edit a locked experiment.
 */
export async function updateDraft(client: RegistryClient, draft: ExperimentDraft, notes: string | null): Promise<StoredExperiment> {
  const { data, error } = await client
    .from('celestial_hypothesis_experiments')
    .update({
      draft,
      draft_sha256: registrationDigest(draft),
      notes,
      tradition_id: draft.hypothesis.traditionId,
      activity_type: draft.activityType,
      fact_bundle_id: draft.factBundleId,
      fact_bundle_sha256: draft.factBundleSha256,
      analysis_plan_version: draft.analysisPlan.planVersion,
    })
    .eq('experiment_id', draft.experimentId)
    .eq('status', 'draft')
    .select(EXPERIMENT_COLUMNS)
    .single()

  if (error) throw new Error(`Draft update failed: ${error.message}`)
  return toStored(data as Record<string, unknown>)
}

export async function lockRegistration(client: RegistryClient, registration: ExperimentRegistration): Promise<StoredExperiment> {
  // Conditioned on status='draft' so two concurrent registrations cannot both
  // take a lock; the loser affects zero rows and surfaces as an error.
  const { data, error } = await client
    .from('celestial_hypothesis_experiments')
    .update({
      status: 'registered',
      registration_sha256: registration.registrationSha256,
      registered_at: registration.registeredAtUtc,
    })
    .eq('experiment_id', registration.experimentId)
    .eq('status', 'draft')
    .eq('draft_sha256', registration.registrationSha256)
    .select(EXPERIMENT_COLUMNS)
    .single()

  if (error) throw new Error(`Registration lock failed: ${error.message}`)
  return toStored(data as Record<string, unknown>)
}

export class DuplicateOutcome extends Error {}

export async function appendOutcome(client: RegistryClient, outcome: OutcomeRecord & { registrationSha256: string }): Promise<void> {
  const { error } = await client.from('celestial_hypothesis_outcomes').insert({
    outcome_sha256: outcome.outcomeSha256,
    experiment_id: outcome.experimentId,
    idempotency_key: outcome.idempotencyKey,
    value: outcome.value,
    observed_at: outcome.observedAtUtc,
    retrieved_at: outcome.retrievedAtUtc,
    data_source_id: outcome.dataSourceId,
    raw_value_sha256: outcome.rawValueSha256,
    registration_sha256: outcome.registrationSha256,
  })

  // 23505 is unique_violation: the idempotency key, or the identical outcome,
  // has already been recorded.
  if (error?.code === '23505') throw new DuplicateOutcome('This outcome has already been recorded for this experiment.')
  if (error) throw new Error(`Outcome insert failed: ${error.message}`)

  const { error: statusError } = await client
    .from('celestial_hypothesis_experiments')
    .update({ status: 'outcome-recorded' })
    .eq('experiment_id', outcome.experimentId)
    .eq('status', 'registered')

  if (statusError) throw new Error(`Experiment status advance failed: ${statusError.message}`)
}

export async function listOutcomes(client: RegistryClient, experimentId: string): Promise<OutcomeRecord[]> {
  const { data, error } = await client
    .from('celestial_hypothesis_outcomes')
    .select('outcome_sha256, experiment_id, idempotency_key, value, observed_at, retrieved_at, data_source_id, raw_value_sha256')
    .eq('experiment_id', experimentId)
    .order('observed_at', { ascending: true })

  if (error) throw new Error(`Outcome read failed: ${error.message}`)
  return (data ?? []).map((row) => ({
    experimentId: String(row.experiment_id),
    idempotencyKey: String(row.idempotency_key),
    value: Number(row.value),
    observedAtUtc: new Date(String(row.observed_at)).toISOString(),
    retrievedAtUtc: new Date(String(row.retrieved_at)).toISOString(),
    dataSourceId: String(row.data_source_id),
    rawValueSha256: String(row.raw_value_sha256),
    outcomeSha256: String(row.outcome_sha256),
  }))
}

export async function appendAnalysis(client: RegistryClient, experimentId: string, analysis: AnalysisResult): Promise<void> {
  const { error } = await client.from('celestial_hypothesis_analyses').insert({
    analysis_sha256: analysis.analysisSha256,
    experiment_id: experimentId,
    plan_version: analysis.planVersion,
    status: analysis.status,
    classification: analysis.classification,
    observations: analysis.observations,
    result: analysis,
    computed_at: analysis.computedAtUtc,
  })
  if (error?.code === '23505') return
  if (error) throw new Error(`Analysis insert failed: ${error.message}`)

  if (analysis.status === 'complete') {
    const { error: statusError } = await client
      .from('celestial_hypothesis_experiments')
      .update({ status: 'analyzed' })
      .eq('experiment_id', experimentId)
      .eq('status', 'outcome-recorded')
    if (statusError) throw new Error(`Experiment status advance failed: ${statusError.message}`)
  }
}

export async function latestAnalysis(client: RegistryClient, experimentId: string): Promise<AnalysisResult | null> {
  const { data, error } = await client
    .from('celestial_hypothesis_analyses')
    .select('result')
    .eq('experiment_id', experimentId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Analysis read failed: ${error.message}`)
  return data ? (data.result as AnalysisResult) : null
}
