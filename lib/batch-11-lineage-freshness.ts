import { BATCH_11_LINEAGE_DECLARATIONS } from './batch-11-mixed-lineage-release.ts'
import { BATCH_11_REVISION_AUDITS } from './batch-11-revision-canary.ts'

/**
 * Re-checks lineage against the live registry immediately before releasing.
 *
 * Planning happens against a committed snapshot, and the world keeps moving
 * after it. Between the plan and the release, an initial record can acquire a
 * lineage, a predecessor can be superseded or withdrawn by someone else, or a
 * second predecessor can appear. Each of those makes the planned release wrong
 * in a way the snapshot cannot show, so the check is repeated against a fresh
 * read and the run refuses rather than proceeding on a stale premise.
 *
 * Read-only and credential-free by construction: this module takes an already
 * fetched public payload and never performs the request itself.
 */

export const LINEAGE_FRESHNESS_VERSION = 'maha-batch-11-lineage-freshness/1.0' as const

/** Statuses a lineage could be filed under. Absence must cover all of them. */
export const COMPLETE_STATUS_VOCABULARY = ['active', 'superseded', 'withdrawn'] as const

export type FreshnessRefusal =
  | 'registry-request-failed'
  | 'registry-malformed'
  | 'status-vocabulary-narrowed'
  | 'initial-lineage-appeared'
  | 'predecessor-absent'
  | 'predecessor-not-active'
  | 'predecessor-changed'
  | 'duplicate-predecessor'
  | 'conflicting-lineage'

export class LineageNotFresh extends Error {
  code: FreshnessRefusal
  recordId: string | null

  constructor(code: FreshnessRefusal, recordId: string | null, message: string) {
    super(message)
    this.name = 'LineageNotFresh'
    this.code = code
    this.recordId = recordId
  }
}

export interface RegistryRow {
  recordId: string
  releaseId: string
  status: string
  targetSha256: string
}

/** A live registry read, as handed in by the caller. */
export interface LiveRegistryRead {
  ok: boolean
  status: number
  /** The parsed body, or null when the request failed. */
  body: unknown
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export interface FreshnessResult {
  version: typeof LINEAGE_FRESHNESS_VERSION
  checkedRecords: number
  initialRecordsConfirmedAbsent: number
  supersedingPredecessorsConfirmed: number
  statusVocabularyObserved: readonly string[]
}

/**
 * Refuses unless the live registry still supports every planned release.
 *
 * Throws on the first problem: this runs immediately before mutation, and there
 * is nothing useful to collect once the answer is "do not release".
 */
export function assertLineageFresh(read: LiveRegistryRead): FreshnessResult {
  if (!read.ok) {
    throw new LineageNotFresh('registry-request-failed', null,
      `The pre-release registry read returned ${read.status}. A read that failed is not evidence that lineage is unchanged.`)
  }
  if (!isObject(read.body) || !Array.isArray(read.body.releases)) {
    throw new LineageNotFresh('registry-malformed', null, 'The pre-release registry response has no releases array.')
  }

  const rows = read.body.releases.filter(isObject) as unknown as RegistryRow[]
  // The vocabulary the registry itself declares it can represent. If it cannot
  // represent every status, a zero-row answer is silence rather than absence.
  const counts = isObject(read.body.counts) ? read.body.counts : {}
  const enumerated = Object.keys(counts).filter((key) => key !== 'totalReleases')
  const narrowed = COMPLETE_STATUS_VOCABULARY.filter((status) => !enumerated.includes(status))
  if (narrowed.length > 0) {
    throw new LineageNotFresh('status-vocabulary-narrowed', null,
      `The registry no longer enumerates ${narrowed.join(', ')}, so an absent lineage cannot be established.`)
  }

  let initialConfirmed = 0
  let predecessorsConfirmed = 0

  for (const declaration of BATCH_11_LINEAGE_DECLARATIONS) {
    const forRecord = rows.filter((row) => row.recordId === declaration.recordId)

    if (declaration.declaredReleaseKind === 'initial') {
      if (forRecord.length > 0) {
        throw new LineageNotFresh('initial-lineage-appeared', declaration.recordId,
          `${declaration.recordId} acquired ${forRecord.length} release row(s) after planning; an initial release would no longer be initial.`)
      }
      initialConfirmed += 1
      continue
    }

    const active = forRecord.filter((row) => row.status === 'active')
    if (active.length === 0) {
      throw new LineageNotFresh('predecessor-absent', declaration.recordId,
        `${declaration.recordId} no longer has an active predecessor to supersede.`)
    }
    if (active.length > 1) {
      throw new LineageNotFresh('duplicate-predecessor', declaration.recordId,
        `${declaration.recordId} now has ${active.length} active releases; which one is superseded is ambiguous.`)
    }
    const predecessor = active[0]
    if (predecessor.releaseId !== declaration.declaredPriorReleaseId) {
      throw new LineageNotFresh('predecessor-changed', declaration.recordId,
        `${declaration.recordId}: the active release is ${predecessor.releaseId}, not the declared predecessor ${declaration.declaredPriorReleaseId}.`)
    }
    if (predecessor.targetSha256 !== declaration.declaredPriorTargetSha256) {
      throw new LineageNotFresh('predecessor-changed', declaration.recordId,
        `${declaration.recordId}: the predecessor now binds a different revision than the declaration records.`)
    }
    // The predecessor must not already carry the revision we are about to
    // release, which would mean there is nothing to supersede it with.
    const audit = BATCH_11_REVISION_AUDITS.find((entry) => entry.recordId === declaration.recordId)
    if (audit && predecessor.targetSha256 === audit.revisedRecordRevisionSha256) {
      throw new LineageNotFresh('conflicting-lineage', declaration.recordId,
        `${declaration.recordId}: the active release already binds the proposed revision; superseding it would release nothing.`)
    }
    predecessorsConfirmed += 1
  }

  // A record filed under a status outside the known vocabulary is a lineage we
  // cannot reason about, even when the counts block looked complete.
  const observed = [...new Set(rows.map((row) => row.status))].sort()
  const unknownStatuses = observed.filter((status) => !COMPLETE_STATUS_VOCABULARY.includes(status as never))
  if (unknownStatuses.length > 0) {
    throw new LineageNotFresh('conflicting-lineage', null,
      `The registry contains releases filed under unrecognised statuses: ${unknownStatuses.join(', ')}.`)
  }

  return {
    version: LINEAGE_FRESHNESS_VERSION,
    checkedRecords: BATCH_11_LINEAGE_DECLARATIONS.length,
    initialRecordsConfirmedAbsent: initialConfirmed,
    supersedingPredecessorsConfirmed: predecessorsConfirmed,
    statusVocabularyObserved: observed,
  }
}
