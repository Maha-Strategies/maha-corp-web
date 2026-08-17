import type { SupabaseClient } from '@supabase/supabase-js'

import { createHypothesisRegistryClient } from '../celestial-hypotheses/store.ts'
import type { CorpusDefinition, CorpusObservationRecord, StoredCorpus } from './types.ts'
import { CELESTIAL_EVENT_CORPUS_VERSION, corpusDefinitionDigest } from './types.ts'

export type CorpusClient = SupabaseClient

export function createCorpusClient(): CorpusClient | null {
  return createHypothesisRegistryClient()
}

const CORPUS_COLUMNS = 'corpus_id, status, definition, definition_sha256, locked_at, created_at'

function toCorpus(row: Record<string, unknown>): StoredCorpus {
  return {
    corpusId: String(row.corpus_id),
    status: row.status as StoredCorpus['status'],
    definition: row.definition as CorpusDefinition,
    definitionSha256: String(row.definition_sha256),
    lockedAtUtc: row.locked_at ? new Date(String(row.locked_at)).toISOString() : null,
    createdAtUtc: new Date(String(row.created_at)).toISOString(),
  }
}

export async function getCorpus(client: CorpusClient, corpusId: string): Promise<StoredCorpus | null> {
  const { data, error } = await client.from('celestial_event_corpora').select(CORPUS_COLUMNS).eq('corpus_id', corpusId).maybeSingle()
  if (error) throw new Error(`Corpus read failed: ${error.message}`)
  return data ? toCorpus(data as Record<string, unknown>) : null
}

export async function insertCorpusDraft(client: CorpusClient, definition: CorpusDefinition): Promise<StoredCorpus> {
  const { data, error } = await client.from('celestial_event_corpora').insert({
    corpus_id: definition.corpusId,
    participant_pseudonym: definition.participantPseudonym,
    status: 'draft',
    corpus_version: CELESTIAL_EVENT_CORPUS_VERSION,
    natal_profile_sha256: definition.natalProfileSha256,
    definition,
    definition_sha256: corpusDefinitionDigest(definition),
  }).select(CORPUS_COLUMNS).single()
  if (error) throw new Error(`Corpus insert failed: ${error.message}`)
  return toCorpus(data as Record<string, unknown>)
}

export async function updateCorpusDraft(client: CorpusClient, definition: CorpusDefinition): Promise<StoredCorpus> {
  const { data, error } = await client.from('celestial_event_corpora').update({
    participant_pseudonym: definition.participantPseudonym,
    natal_profile_sha256: definition.natalProfileSha256,
    definition,
    definition_sha256: corpusDefinitionDigest(definition),
  }).eq('corpus_id', definition.corpusId).eq('status', 'draft').select(CORPUS_COLUMNS).single()
  if (error) throw new Error(`Corpus draft update failed: ${error.message}`)
  return toCorpus(data as Record<string, unknown>)
}

export async function lockCorpus(client: CorpusClient, corpusId: string, definitionSha256: string, lockedAt: Date): Promise<StoredCorpus> {
  const { data, error } = await client.from('celestial_event_corpora').update({ status: 'locked', locked_at: lockedAt.toISOString() })
    .eq('corpus_id', corpusId).eq('status', 'draft').eq('definition_sha256', definitionSha256).select(CORPUS_COLUMNS).single()
  if (error) throw new Error(`Corpus lock failed: ${error.message}`)
  return toCorpus(data as Record<string, unknown>)
}

export class DuplicateCorpusObservation extends Error {}

export async function appendCorpusObservations(client: CorpusClient, records: CorpusObservationRecord[]): Promise<void> {
  if (!records.length) return
  const { error } = await client.from('celestial_event_observations').insert(records.map((record) => ({
    observation_sha256: record.observationSha256,
    observation_id: record.observationId,
    corpus_id: record.corpusId,
    definition_sha256: record.definitionSha256,
    observation_kind: record.kind,
    interval_start: record.intervalStartUtc,
    interval_end: record.intervalEndUtc,
    selection_method: record.selectionMethod,
    source_kind: record.sourceKind,
    data_source_id: record.dataSourceId,
    evidence_sha256: record.evidenceSha256,
    metric: record.metric,
    celestial_state: record.celestialState,
    state_vector_sha256: record.celestialState.stateVectorSha256,
  })))
  if (error?.code === '23505') throw new DuplicateCorpusObservation('One or more observation identifiers or digests already exist.')
  if (error) throw new Error(`Observation append failed: ${error.message}`)
}

export async function listCorpusObservations(client: CorpusClient, corpusId: string): Promise<CorpusObservationRecord[]> {
  const { data, error } = await client.from('celestial_event_observations')
    .select('observation_sha256, observation_id, corpus_id, definition_sha256, observation_kind, interval_start, interval_end, selection_method, source_kind, data_source_id, evidence_sha256, metric, celestial_state')
    .eq('corpus_id', corpusId).order('interval_start', { ascending: true })
  if (error) throw new Error(`Observation read failed: ${error.message}`)
  return (data ?? []).map((row) => ({
    observationSha256: String(row.observation_sha256),
    observationId: String(row.observation_id),
    corpusId: String(row.corpus_id),
    definitionSha256: String(row.definition_sha256),
    kind: row.observation_kind as CorpusObservationRecord['kind'],
    intervalStartUtc: new Date(String(row.interval_start)).toISOString(),
    intervalEndUtc: new Date(String(row.interval_end)).toISOString(),
    selectionMethod: row.selection_method as CorpusObservationRecord['selectionMethod'],
    sourceKind: String(row.source_kind),
    dataSourceId: String(row.data_source_id),
    evidenceSha256: String(row.evidence_sha256),
    metric: (row.metric as CorpusObservationRecord['metric']) ?? null,
    celestialState: row.celestial_state as CorpusObservationRecord['celestialState'],
  }))
}

