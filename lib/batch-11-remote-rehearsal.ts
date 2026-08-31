import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  BATCH_11_LINEAGE_DECLARATIONS,
  reconcileLineage,
  type LineageManifest,
  type RegistryObservation,
  type ReleaseKind,
} from './batch-11-mixed-lineage-release.ts'
import { BATCH_11_REVISION_AUDITS, BATCH_11_SCOPED_DECISIONS } from './batch-11-revision-canary.ts'
import { BATCH_11_DECISIONS } from './frontier-alignment-batch-11-review.ts'
import { alignmentFor, isAlignmentClear } from './frontier-source-alignment.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'

/**
 * Remote Preview rehearsal for the Batch 11 mixed-lineage cohort.
 *
 * Two records supersede an existing canonical release; three do not. The
 * dangerous move is to let those two cases blur, so this module keeps every way
 * of "finding nothing" apart from every other way.
 *
 * A lookup that fails, a registry that came back empty, a record id that does
 * not exist, and a record that genuinely has no release all look identical if
 * you only ask "did the query return rows?". Only the last of them licenses an
 * initial release. The first three are faults.
 */

export const BATCH_11_REMOTE_REHEARSAL_VERSION = 'maha-batch-11-remote-rehearsal/1.0' as const

/**
 * The distinguishable outcomes of asking about a record's release lineage.
 *
 * `lineage-absent` is the only state that licenses an initial release, and it
 * requires positive evidence: the probe succeeded, the registry was populated,
 * the record id is real, and the record has no row under ANY status.
 */
export type LineageProbeState =
  | 'probe-failed'
  | 'registry-empty'
  | 'record-unknown'
  | 'lineage-absent'
  | 'lineage-present'

export interface LineageProbe {
  recordId: string
  state: LineageProbeState
  /** Rows found across every status, not only active. */
  rowsAcrossAllStatuses: number
  activeRows: number
  nonActiveRows: number
  /** Statuses the registry itself declares it can represent. */
  statusVocabularyObserved: readonly string[]
  detail: string
}

/**
 * The statuses the public registry projection is known to represent.
 *
 * Recorded because "zero rows" only means "no lineage" if the projection would
 * have shown a row had one existed. A status outside this vocabulary is a state
 * this probe cannot see, and the rehearsal must confirm against Production
 * before an initial release proceeds.
 */
export const KNOWN_RELEASE_STATUSES = ['active', 'superseded', 'withdrawn'] as const

export interface RegistryProbeInput {
  /** Null when the query itself failed. Distinct from an empty registry. */
  observation: RegistryObservation | null
  /** Total rows the registry reported across every record, not just ours. */
  totalRegistryRows: number | null
  /** Statuses actually present or enumerated by the registry's own counts. */
  statusVocabulary: readonly string[]
}

/**
 * Probes one record's lineage without collapsing the failure modes.
 *
 * The order of checks matters: a failed probe must never be reported as absent
 * lineage, and an unknown record id must never be reported as a record that
 * simply has not been released.
 */
export function probeLineage(recordId: string, input: RegistryProbeInput): LineageProbe {
  const base = {
    recordId,
    rowsAcrossAllStatuses: 0,
    activeRows: 0,
    nonActiveRows: 0,
    statusVocabularyObserved: input.statusVocabulary,
  }

  if (input.observation === null || input.totalRegistryRows === null) {
    return { ...base, state: 'probe-failed', detail: 'The registry query did not return a usable response. Absence of data is not evidence of absent lineage.' }
  }
  if (input.totalRegistryRows === 0) {
    return { ...base, state: 'registry-empty', detail: 'The registry returned zero rows for every record. That is a registry fault, not a statement about this record.' }
  }
  // A record id that is not in the graph is a typo or a stale reference. It is
  // not a record awaiting its first release.
  if (!FRONTIER_DOMAIN_GRAPH_RECORDS.some((record) => record.id === recordId)) {
    return { ...base, state: 'record-unknown', detail: 'No such record exists in the domain graph. This is an identifier fault, not absent lineage.' }
  }

  const row = input.observation.records.find((entry) => entry.recordId === recordId)
  if (!row) {
    return { ...base, state: 'probe-failed', detail: 'The record was not included in the observation, so its lineage was never actually queried.' }
  }

  const active = row.activeReleases
  const total = row.totalReleases
  const nonActive = total - active
  if (total > 0) {
    return { ...base, state: 'lineage-present', rowsAcrossAllStatuses: total, activeRows: active, nonActiveRows: nonActive, detail: `${total} release row(s) exist across all statuses.` }
  }
  return {
    ...base,
    state: 'lineage-absent',
    detail:
      'The probe succeeded, the registry is populated, the record exists, and it has no release row under any represented status. This is positive evidence of absent lineage rather than a failed lookup.',
  }
}

export type RehearsalFailureCode =
  | 'lineage-probe-failed'
  | 'registry-empty'
  | 'record-unknown'
  | 'initial-requires-absent-lineage'
  | 'superseding-requires-present-lineage'
  | 'status-vocabulary-incomplete'
  | 'proposed-revision-mismatch'
  | 'decision-scope-missing'
  | 'decision-stale'
  | 'decision-held'
  | 'duplicate-release-attempt'
  | 'order-dependency-detected'
  | 'source-alignment-not-clear'

/** Per-record readiness for the remote rehearsal, computed from probes. */
export interface RehearsalGate {
  recordId: string
  /** The record's corpus alignment verdict, carried so a refusal can name it. */
  alignmentVerdict: string
  declaredKind: ReleaseKind
  probeState: LineageProbeState
  proposedTargetSha256: string
  scopedDecisionCount: number
  failures: readonly RehearsalFailureCode[]
  ready: boolean
}

/**
 * Gates one record for the rehearsal.
 *
 * The two kind-specific rules are asymmetric on purpose. A superseding record
 * needs `lineage-present`; anything else, including a failed probe, blocks it.
 * An initial record needs `lineage-absent` specifically - not merely "not
 * present" - so a probe failure cannot manufacture an initial release.
 */
export function gateRecord(probe: LineageProbe, declaredKind: ReleaseKind): RehearsalGate {
  const failures: RehearsalFailureCode[] = []

  // Evidentiary support is a precondition for release, not a parallel opinion.
  //
  // This gate reads the lineage probe and the internal review decisions. Neither
  // asks whether the record's declared source was ever shown to support its
  // claim. Without this check a record with four scoped approvals releases on a
  // source that was never read - and one record in the current cohort is
  // exactly that: an initial-release candidate whose source is still marked
  // inaccessible. Internal review records that a human looked; it cannot supply
  // the support that looking failed to find.
  if (!isAlignmentClear(probe.recordId)) failures.push('source-alignment-not-clear')

  if (probe.state === 'probe-failed') failures.push('lineage-probe-failed')
  if (probe.state === 'registry-empty') failures.push('registry-empty')
  if (probe.state === 'record-unknown') failures.push('record-unknown')

  if (declaredKind === 'initial' && probe.state !== 'lineage-absent') {
    failures.push('initial-requires-absent-lineage')
  }
  if (declaredKind === 'superseding' && probe.state !== 'lineage-present') {
    failures.push('superseding-requires-present-lineage')
  }

  // If the registry cannot represent every status we know about, a zero-row
  // answer is not conclusive and an initial release must not proceed on it.
  const missing = KNOWN_RELEASE_STATUSES.filter((status) => !probe.statusVocabularyObserved.includes(status))
  if (declaredKind === 'initial' && missing.length > 0) failures.push('status-vocabulary-incomplete')

  const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === probe.recordId)
  const decision = BATCH_11_DECISIONS.find((entry) => entry.recordId === probe.recordId)
  const scoped = BATCH_11_SCOPED_DECISIONS.filter((entry) => entry.recordId === probe.recordId)

  if (decision?.disposition === 'reject-or-hold') failures.push('decision-held')
  if (scoped.length !== 4) failures.push('decision-scope-missing')
  if (audit && scoped.some((entry) => entry.targetSha256 !== audit.revisedRecordRevisionSha256)) {
    failures.push('decision-stale')
  }
  if (!audit) failures.push('proposed-revision-mismatch')

  const unique = [...new Set(failures)]
  return {
    recordId: probe.recordId,
    declaredKind,
    probeState: probe.state,
    alignmentVerdict: alignmentFor(probe.recordId)?.evidence.subjectAligned ?? 'unaudited',
    proposedTargetSha256: audit?.revisedRecordRevisionSha256 ?? '',
    scopedDecisionCount: scoped.length,
    failures: unique,
    ready: unique.length === 0,
  }
}

/** One record's outcome in a simulated lifecycle run. */
export interface RecordOutcome {
  recordId: string
  releaseKind: ReleaseKind
  activeTargetSha256: string
  supersededPriorReleaseId: string | null
  supersedesNothing: boolean
}

/**
 * Simulates the lifecycle over a given execution order.
 *
 * Deliberately pure and order-parameterised so that order independence can be
 * tested rather than assumed. Each record's outcome is computed from its own
 * declaration and gate alone; nothing reads the accumulated state of earlier
 * records. If that ever stops being true, the permutation test fails.
 */
export function simulateLifecycle(order: readonly string[], gates: readonly RehearsalGate[]): RecordOutcome[] {
  const seen = new Set<string>()
  const outcomes: RecordOutcome[] = []
  for (const recordId of order) {
    if (seen.has(recordId)) throw new Error(`duplicate-release-attempt: ${recordId} appears twice in the execution order.`)
    seen.add(recordId)
    const gate = gates.find((entry) => entry.recordId === recordId)
    if (!gate) throw new Error(`${recordId}: no gate; refusing to simulate a record that was never gated.`)
    if (!gate.ready) throw new Error(`${recordId}: gate is not ready (${gate.failures.join(', ')}).`)
    const declared = BATCH_11_LINEAGE_DECLARATIONS.find((entry) => entry.recordId === recordId)!
    outcomes.push({
      recordId,
      releaseKind: declared.declaredReleaseKind,
      activeTargetSha256: gate.proposedTargetSha256,
      supersededPriorReleaseId: declared.declaredPriorReleaseId,
      supersedesNothing: declared.declaredPriorReleaseId === null,
    })
  }
  // Sorted so two orders can be compared as sets of final states.
  return outcomes.sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
}

/** Digest of the final per-record state, independent of execution order. */
export function finalStateDigest(outcomes: readonly RecordOutcome[]): string {
  return `sha256:${createHash('sha256').update(canonicalJson(outcomes), 'utf8').digest('hex')}`
}

export interface OrderIndependenceResult {
  ordersTested: number
  finalStateDigests: readonly string[]
  independent: boolean
  detail: string
}

/**
 * Proves that final state does not depend on execution order.
 *
 * Runs every permutation of the cohort and compares final-state digests. If the
 * lifecycle ever acquires an order dependency, the digests diverge and this
 * reports it rather than quietly picking whichever order happened to work.
 */
export function proveOrderIndependence(recordIds: readonly string[], gates: readonly RehearsalGate[]): OrderIndependenceResult {
  const permutations: string[][] = []
  const permute = (rest: readonly string[], acc: readonly string[]) => {
    if (rest.length === 0) { permutations.push([...acc]); return }
    for (let index = 0; index < rest.length; index += 1) {
      permute([...rest.slice(0, index), ...rest.slice(index + 1)], [...acc, rest[index]])
    }
  }
  permute(recordIds, [])

  const digests = permutations.map((order) => finalStateDigest(simulateLifecycle(order, gates)))
  const unique = [...new Set(digests)]
  return {
    ordersTested: permutations.length,
    finalStateDigests: unique,
    independent: unique.length === 1,
    detail:
      unique.length === 1
        ? `All ${permutations.length} execution orders produce one identical final state, so no ordering is privileged and none needs to be chosen.`
        : `Execution order changes the final state across ${unique.length} distinct outcomes. This is an order dependency and must be resolved, not worked around by choosing a convenient order.`,
  }
}

/** The invariants a future authorized run must satisfy, stated as data. */
export const REQUIRED_PREVIEW_INVARIANTS = [
  'exactly five new releases exist',
  'two are superseding and three are initial',
  'each release binds its exact proposed revision digest',
  'the two prior releases become superseded and remain present in append-only history',
  'each initial release supersedes nothing',
  'no release outside the cohort changes',
  'all twenty decisions are exact-revision internal-review decisions',
  'no held or stale decision is accepted',
  'the active canonical projection matches all five new revisions',
  'stale and unreleased revisions remain excluded from the projection',
  'eligible public Preview routes render successfully',
  'sitemap and llms.txt include only exact active eligible revisions',
  'no audit corpus, review packet, credential or private evidence enters a served bundle',
] as const

export function rehearsalPlanDigest(manifest: LineageManifest, gates: readonly RehearsalGate[]): string {
  return `sha256:${createHash('sha256').update(canonicalJson({ manifest, gates }), 'utf8').digest('hex')}`
}

export { reconcileLineage }
