import { createAgentInquiryLedger } from '../agent-inquiry-ledger.ts'
import {
  publicObservatorySnapshot,
  type ObservatoryObservation,
  type ObservatoryResource,
  type PublicObservatoryEntry,
} from './observatory.ts'

type ObservationRow = {
  observation_id: string
  resource_id: string
  resource_url: string
  observed_at: string
  duration_ms: number
  challenge_reachable: ObservatoryObservation['challengeReachable']
  v2_compliant: ObservatoryObservation['v2Compliant']
  schema_valid: ObservatoryObservation['schemaValid']
  crawler_receives_402: ObservatoryObservation['crawlerReceives402']
  bazaar_state: ObservatoryObservation['bazaarState']
  digest_source: ObservatoryObservation['digestSource']
  settlement_state: ObservatoryObservation['settlementState']
  settlement_transaction: string | null
  finding_codes: string[]
}

function rowFromObservation(value: ObservatoryObservation): ObservationRow {
  return {
    observation_id: value.observationId,
    resource_id: value.resourceId,
    resource_url: value.resourceUrl,
    observed_at: value.observedAt,
    duration_ms: value.durationMs,
    challenge_reachable: value.challengeReachable,
    v2_compliant: value.v2Compliant,
    schema_valid: value.schemaValid,
    crawler_receives_402: value.crawlerReceives402,
    bazaar_state: value.bazaarState,
    digest_source: value.digestSource,
    settlement_state: value.settlementState,
    settlement_transaction: value.settlementTransaction ?? null,
    finding_codes: value.findingCodes,
  }
}

function observationFromRow(row: ObservationRow): ObservatoryObservation {
  return {
    schemaVersion: '1.0.0',
    observationId: row.observation_id,
    resourceId: row.resource_id,
    resourceUrl: row.resource_url,
    observedAt: row.observed_at,
    durationMs: row.duration_ms,
    challengeReachable: row.challenge_reachable,
    v2Compliant: row.v2_compliant,
    schemaValid: row.schema_valid,
    crawlerReceives402: row.crawler_receives_402,
    bazaarState: row.bazaar_state,
    digestSource: row.digest_source,
    settlementState: row.settlement_state,
    ...(row.settlement_transaction ? { settlementTransaction: row.settlement_transaction } : {}),
    findingCodes: Array.isArray(row.finding_codes) ? row.finding_codes : [],
  }
}

export async function appendObservatoryObservations(observations: ObservatoryObservation[]): Promise<void> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) throw new Error('observatory_store_unavailable')
  const { error } = await ledger.from('x402_observatory_observations').insert(observations.map(rowFromObservation))
  if (error) throw new Error('observatory_store_write_failed')
}

export async function getPublicObservatoryEntries(resources: ObservatoryResource[]): Promise<PublicObservatoryEntry[]> {
  const ledger = createAgentInquiryLedger()
  if (!ledger) return publicObservatorySnapshot(resources, [])
  const resourceIds = resources.map((resource) => resource.id)
  const { data, error } = await ledger
    .from('x402_observatory_observations')
    .select('observation_id,resource_id,resource_url,observed_at,duration_ms,challenge_reachable,v2_compliant,schema_valid,crawler_receives_402,bazaar_state,digest_source,settlement_state,settlement_transaction,finding_codes')
    .in('resource_id', resourceIds)
    .order('observed_at', { ascending: false })
    .limit(Math.min(resources.length * 32, 500))
  if (error || !data) return publicObservatorySnapshot(resources, [])
  return publicObservatorySnapshot(resources, (data as ObservationRow[]).map(observationFromRow))
}
