/** Append-only persistence adapters for empirical-validation artifacts. */

import type { SupabaseClient } from '@supabase/supabase-js'

import { forecastDigest, scoreForecast, type BinaryForecast } from '../celestial-forecasting.ts'
import { digestOf, isExplicitUtcInstant } from '../celestial-hypotheses/canonical.ts'
import {
  validateBenchmarkProtocol,
  validateBenchmarkSubmission,
  type BenchmarkAssignment,
  type BenchmarkParticipant,
  type BenchmarkProtocol,
  type BenchmarkSubmission,
  type BenchmarkTaskOutcome,
  type BlindedBenchmarkTask,
  type PairedBenchmarkComparison,
} from '../celestial-hypotheses/benchmark.ts'
import type { ExternalOutcomeDataset, FittedCelestialModel, PredictiveSkillAssessment, PredictiveSkillPolicy } from './engine.ts'

export async function persistExternalDataset(client: SupabaseClient, dataset: ExternalOutcomeDataset): Promise<void> {
  const { error } = await client.from('celestial_external_datasets').insert({
    dataset_sha256: dataset.datasetSha256, dataset_id: dataset.datasetId, version: dataset.version, title: dataset.title,
    outcome_definition: dataset.outcomeDefinition, data_source_id: dataset.dataSourceId,
    source_manifest_sha256: dataset.sourceManifestSha256, retrieved_at: dataset.retrievedAtUtc,
    row_count: dataset.rows.length, manifest: { ...dataset, rows: undefined },
  })
  if (error?.code !== '23505' && error) throw new Error(`Dataset persistence failed: ${error.message}`)
  const { error: rowsError } = await client.from('celestial_external_outcomes').insert(dataset.rows.map((row) => ({
    dataset_sha256: dataset.datasetSha256, event_id: row.eventId, occurred_at: row.occurredAtUtc,
    available_at: row.availableAtUtc, outcome: row.outcome, source_record_id: row.sourceRecordId,
    source_record_sha256: row.sourceRecordSha256,
  })))
  if (rowsError?.code !== '23505' && rowsError) throw new Error(`Dataset row persistence failed: ${rowsError.message}`)
}

export async function persistFittedModel(client: SupabaseClient, model: FittedCelestialModel): Promise<void> {
  const { error } = await client.from('celestial_fitted_models').insert({
    artifact_sha256: model.artifactSha256, model_id: model.modelId, dataset_sha256: model.datasetSha256,
    frame: model.frame.zodiac === 'tropical' ? 'tropical' : 'sidereal-lahiri', trained_through: model.trainedThroughUtc, artifact: model,
  })
  if (error?.code !== '23505' && error) throw new Error(`Model persistence failed: ${error.message}`)
}

export async function persistProspectiveForecast(client: SupabaseClient, forecast: BinaryForecast): Promise<string> {
  const forecastSha256 = forecastDigest(forecast)
  const { error } = await client.from('celestial_prospective_forecasts').insert({
    forecast_sha256: forecastSha256, forecast_id: forecast.forecastId, subject_pseudonym: forecast.subjectPseudonym,
    issued_at: forecast.issuedAtUtc, outcome_window_start: forecast.outcomeWindowStartUtc,
    outcome_window_end: forecast.outcomeWindowEndUtc, forecast,
  })
  if (error?.code === '23505') throw new Error('Forecast identity or digest has already been persisted; prospective forecasts are immutable.')
  if (error) throw new Error(`Forecast persistence failed: ${error.message}`)
  return forecastSha256
}

export async function persistForecastOutcome(client: SupabaseClient, input: {
  forecast: BinaryForecast
  outcome: 0 | 1
  outcomeAvailableAtUtc: string
  retrievedAtUtc: string
  sourceRecordSha256: string
}): Promise<string> {
  if (!isExplicitUtcInstant(input.outcomeAvailableAtUtc) || !isExplicitUtcInstant(input.retrievedAtUtc) || new Date(input.retrievedAtUtc) < new Date(input.outcomeAvailableAtUtc)) throw new Error('Forecast outcome chronology is invalid.')
  if (new Date(input.outcomeAvailableAtUtc) < new Date(input.forecast.outcomeWindowEndUtc)) throw new Error('A forecast cannot be resolved before its declared outcome window closes.')
  if (!/^sha256:[a-f0-9]{64}$/.test(input.sourceRecordSha256)) throw new Error('Forecast outcome must bind a source record digest.')
  const score = scoreForecast(input.forecast, input.outcome)
  const core = { forecastId: input.forecast.forecastId, outcome: input.outcome, outcomeAvailableAtUtc: input.outcomeAvailableAtUtc, retrievedAtUtc: input.retrievedAtUtc, sourceRecordSha256: input.sourceRecordSha256, score }
  const outcomeSha256 = digestOf(core)
  const { error } = await client.from('celestial_forecast_outcomes').insert({
    outcome_sha256: outcomeSha256, forecast_id: input.forecast.forecastId, outcome: input.outcome,
    outcome_available_at: input.outcomeAvailableAtUtc, retrieved_at: input.retrievedAtUtc,
    source_record_sha256: input.sourceRecordSha256, score,
  })
  if (error?.code === '23505') throw new Error('This prospective forecast already has an immutable outcome.')
  if (error) throw new Error(`Forecast outcome persistence failed: ${error.message}`)
  return outcomeSha256
}

export async function persistPredictiveSkillPolicy(client: SupabaseClient, policy: PredictiveSkillPolicy): Promise<void> {
  const { policySha256, ...core } = policy
  if (digestOf(core) !== policySha256) throw new Error('Predictive skill policy digest does not verify.')
  const { error } = await client.from('celestial_skill_policies').insert({ policy_sha256: policySha256, policy_id: policy.policyId, locked_at: policy.lockedAtUtc, policy })
  if (error) throw new Error(`Predictive skill policy persistence failed: ${error.message}`)
}

export async function persistPredictiveSkillAssessment(client: SupabaseClient, assessment: PredictiveSkillAssessment, computedAtUtc: string): Promise<string> {
  if (!isExplicitUtcInstant(computedAtUtc)) throw new Error('Predictive skill assessment requires an explicit computation instant.')
  const core = { assessment, computedAtUtc }
  const assessmentSha256 = digestOf(core)
  const { error } = await client.from('celestial_skill_assessments').insert({ assessment_sha256: assessmentSha256, policy_sha256: assessment.policySha256, assessment, computed_at: computedAtUtc })
  if (error) throw new Error(`Predictive skill assessment persistence failed: ${error.message}`)
  return assessmentSha256
}

export async function persistAstroBenchProtocol(client: SupabaseClient, protocol: BenchmarkProtocol): Promise<void> {
  const issues = validateBenchmarkProtocol(protocol)
  if (issues.length) throw new Error(`Invalid AstroBench protocol: ${issues.join(' ')}`)
  const { error } = await client.from('astrobench_protocols').insert({ protocol_sha256: protocol.protocolSha256, protocol_id: protocol.protocolId, protocol })
  if (error) throw new Error(`AstroBench protocol persistence failed: ${error.message}`)
}

export async function persistAstroBenchParticipants(client: SupabaseClient, participants: BenchmarkParticipant[]): Promise<void> {
  const { error } = await client.from('astrobench_participants').insert(participants.map((participant) => ({
    participant_sha256: participant.participantSha256, protocol_id: participant.protocolId,
    participant_pseudonym: participant.participantPseudonym, participant_kind: participant.participantKind, recruitment: participant,
  })))
  if (error) throw new Error(`AstroBench participant persistence failed: ${error.message}`)
}

export async function persistAstroBenchTasks(client: SupabaseClient, tasks: BlindedBenchmarkTask[]): Promise<void> {
  const { error } = await client.from('astrobench_tasks').insert(tasks.map((task) => ({
    task_sha256: task.taskSha256, protocol_id: task.protocolId, blinded_task_id: task.blindedTaskId,
    submission_deadline: task.submissionDeadlineUtc, outcome_available_at: task.outcomeAvailableAtUtc, task,
  })))
  if (error) throw new Error(`AstroBench task persistence failed: ${error.message}`)
}

export async function persistAstroBenchAssignments(client: SupabaseClient, assignments: BenchmarkAssignment[]): Promise<void> {
  const { error } = await client.from('astrobench_assignments').insert(assignments.map((assignment) => ({
    assignment_sha256: assignment.assignmentSha256, protocol_id: assignment.protocolId,
    blinded_task_id: assignment.blindedTaskId, participant_pseudonym: assignment.participantPseudonym, assigned_at: assignment.assignedAtUtc,
  })))
  if (error) throw new Error(`AstroBench assignment persistence failed: ${error.message}`)
}

export async function persistAstroBenchSubmission(client: SupabaseClient, submission: BenchmarkSubmission): Promise<void> {
  const issues = validateBenchmarkSubmission(submission)
  if (issues.length) throw new Error(`Invalid AstroBench submission: ${issues.join(' ')}`)
  const { error } = await client.from('astrobench_submissions').insert({
    submission_sha256: submission.submissionSha256, protocol_id: submission.protocolId,
    blinded_task_id: submission.blindedTaskId, participant_pseudonym: submission.participantPseudonym,
    submitted_at: submission.submittedAtUtc, submission,
  })
  if (error?.code === '23505') throw new Error('This participant already submitted an immutable answer for this task.')
  if (error) throw new Error(`AstroBench submission persistence failed: ${error.message}`)
}

export async function persistAstroBenchOutcome(client: SupabaseClient, protocolId: string, outcome: BenchmarkTaskOutcome): Promise<string> {
  const core = { protocolId, ...outcome }
  const outcomeSha256 = digestOf(core)
  const { error } = await client.from('astrobench_task_outcomes').insert({
    outcome_sha256: outcomeSha256, protocol_id: protocolId, blinded_task_id: outcome.blindedTaskId,
    outcome_available_at: outcome.outcomeAvailableAtUtc, outcome,
  })
  if (error?.code === '23505') throw new Error('This blinded task already has an immutable outcome.')
  if (error) throw new Error(`AstroBench outcome persistence failed: ${error.message}`)
  return outcomeSha256
}

export async function persistAstroBenchAnalysis(client: SupabaseClient, protocolId: string, comparisons: PairedBenchmarkComparison[], computedAtUtc: string): Promise<string> {
  if (!isExplicitUtcInstant(computedAtUtc) || comparisons.some((comparison) => comparison.multiplicityAdjustedPValue === null)) throw new Error('AstroBench analysis requires an explicit computation instant and completed multiplicity adjustment.')
  const analysis = { protocolId, comparisons, computedAtUtc }
  const analysisSha256 = digestOf(analysis)
  const { error } = await client.from('astrobench_analyses').insert({ analysis_sha256: analysisSha256, protocol_id: protocolId, analysis, computed_at: computedAtUtc })
  if (error) throw new Error(`AstroBench analysis persistence failed: ${error.message}`)
  return analysisSha256
}
