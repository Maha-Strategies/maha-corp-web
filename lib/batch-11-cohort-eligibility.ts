import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { alignmentFor, isAlignmentClear } from './frontier-source-alignment.ts'

/**
 * Who may enter a Batch 11 release cohort.
 *
 * The cohort that exists today is refused by the alignment gate, and the
 * obvious repair - swap the refused records for others - is what this module
 * exists to make impossible to do quietly. Eligibility is computed from the
 * corpus and the public registry, one requirement at a time, so "we found five
 * records" is a claim a reader can recompute rather than accept.
 *
 * Nothing here selects a cohort. It reports which records could be in one.
 */

export const COHORT_ELIGIBILITY_VERSION = 'maha-batch-11-cohort-eligibility/1.0' as const

/** One row of the public release registry, as observed over HTTPS. */
export interface RegistryRow {
  recordId: string
  releaseId: string
  status: string
  targetSha256: string
}

export type ReleaseKind = 'initial' | 'superseding'

/**
 * The requirements a candidate must satisfy, each independently checkable.
 *
 * Stated as data rather than as a chain of ifs so a refusal names the
 * requirement that failed instead of a line number.
 */
export const ELIGIBILITY_REQUIREMENTS = [
  'record-exists-in-graph',
  'source-content-inspected',
  'subject-alignment-clear',
  'exact-locator-present',
  'source-identity-verified',
  'version-relationship-verified',
  'rights-basis-acceptable',
  'bounded-claim-scope',
  'not-positional-legacy',
  'not-metadata-only-or-inaccessible',
  'lineage-state-supports-declared-kind',
  'revision-distinct-from-released-target',
] as const
export type EligibilityRequirement = (typeof ELIGIBILITY_REQUIREMENTS)[number]

export interface CandidateEvaluation {
  recordId: string
  declaredKind: ReleaseKind | null
  alignmentVerdict: string
  assignmentOrigin: string
  registryRows: number
  activeReleaseId: string | null
  releasedTargetSha256: string | null
  currentTargetSha256: string | null
  failures: readonly EligibilityRequirement[]
  eligible: boolean
}

/** Depths that establish nothing about whether a source supports a subject. */
const NON_EXPLANATORY_DEPTHS = ['not-inspected']
const NON_EXPLANATORY_VERDICTS = ['inaccessible-source', 'insufficient-evidence', 'mismatched', 'partially-supported']

/**
 * Evaluates one record against every requirement.
 *
 * `declaredKind` is supplied rather than inferred. Inferring it from the
 * registry would make the lineage requirement circular: a record with no rows
 * would "declare" itself initial and then pass the check that it has no rows.
 */
export function evaluateCandidate(
  recordId: string,
  declaredKind: ReleaseKind,
  registry: readonly RegistryRow[],
): CandidateEvaluation {
  const failures: EligibilityRequirement[] = []
  const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === recordId)
  const audit = alignmentFor(recordId)
  const rows = registry.filter((row) => row.recordId === recordId)
  const active = rows.filter((row) => row.status === 'active')

  if (!record) failures.push('record-exists-in-graph')
  if (!audit) {
    // Without an audit row nothing below can be evaluated, so every remaining
    // requirement fails rather than silently passing on absent data.
    for (const requirement of ELIGIBILITY_REQUIREMENTS) {
      if (requirement !== 'record-exists-in-graph' && !failures.includes(requirement)) failures.push(requirement)
    }
    return {
      recordId, declaredKind, alignmentVerdict: 'unaudited', assignmentOrigin: 'unknown',
      registryRows: rows.length, activeReleaseId: null, releasedTargetSha256: null,
      currentTargetSha256: null, failures, eligible: false,
    }
  }

  if (!audit.evidence.sourceContentInspected) failures.push('source-content-inspected')
  if (!isAlignmentClear(recordId)) failures.push('subject-alignment-clear')
  if ((audit.locator ?? '').trim().length < 10) failures.push('exact-locator-present')
  if (!audit.sourceTitle || !audit.evidence.metadataVerified) failures.push('source-identity-verified')
  if (!audit.evidence.versionRelationshipVerified) failures.push('version-relationship-verified')
  if (!audit.evidence.inspectedContentLocation) failures.push('rights-basis-acceptable')
  if (!record?.claims?.length || record.claims.some((claim) => !claim.boundary || !claim.scope)) {
    failures.push('bounded-claim-scope')
  }
  if (audit.assignmentOrigin === 'positional-legacy') failures.push('not-positional-legacy')
  if (
    NON_EXPLANATORY_DEPTHS.includes(audit.evidence.inspectionDepth)
    || NON_EXPLANATORY_VERDICTS.includes(audit.evidence.subjectAligned)
  ) {
    failures.push('not-metadata-only-or-inaccessible')
  }

  // Lineage. An initial release requires positive evidence of absence across
  // every status the registry can represent, not merely no active row.
  if (declaredKind === 'initial' && rows.length !== 0) failures.push('lineage-state-supports-declared-kind')
  if (declaredKind === 'superseding' && active.length !== 1) failures.push('lineage-state-supports-declared-kind')

  // A superseding release must bind something new. Superseding an active
  // release with the digest it already carries releases nothing.
  const current = record ? epistemicReviewTargetHash(record) : null
  if (declaredKind === 'superseding' && active.length === 1 && current === active[0].targetSha256) {
    failures.push('revision-distinct-from-released-target')
  }

  const unique = [...new Set(failures)]
  return {
    recordId,
    declaredKind,
    alignmentVerdict: audit.evidence.subjectAligned,
    assignmentOrigin: audit.assignmentOrigin,
    registryRows: rows.length,
    activeReleaseId: active[0]?.releaseId ?? null,
    releasedTargetSha256: active[0]?.targetSha256 ?? null,
    currentTargetSha256: current,
    failures: unique,
    eligible: unique.length === 0,
  }
}

/** Statuses the registry must be able to represent for absence to mean anything. */
export const REQUIRED_STATUS_VOCABULARY = ['active', 'superseded', 'withdrawn'] as const

export class RegistryUnusable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryUnusable'
  }
}

/**
 * Refuses a registry that cannot support an absence claim.
 *
 * An initial release rests on "this record has no lineage under any status".
 * That reading is only available when the query actually succeeded, returned a
 * populated registry, and covers every status a lineage could be filed under.
 * A failed probe and an empty registry both produce zero rows for every record,
 * and reading either as absence would license an initial release for the entire
 * corpus at once.
 */
export function assertRegistryUsable(
  registry: readonly RegistryRow[] | null,
  statusVocabularyEnumerated: readonly string[],
): void {
  if (registry === null) {
    throw new RegistryUnusable('The registry query did not return a usable response; absence of data is not evidence of absent lineage.')
  }
  if (registry.length === 0) {
    throw new RegistryUnusable('The registry returned zero rows for every record. That is a registry fault, not a corpus-wide absence of lineage.')
  }
  const missing = REQUIRED_STATUS_VOCABULARY.filter((status) => !statusVocabularyEnumerated.includes(status))
  if (missing.length > 0) {
    throw new RegistryUnusable(`The registry does not enumerate ${missing.join(', ')}, so a zero-row answer cannot be read as absent lineage.`)
  }
}

/** Every record that could serve as an initial or superseding candidate. */
export function eligiblePool(registry: readonly RegistryRow[]): {
  initial: readonly CandidateEvaluation[]
  superseding: readonly CandidateEvaluation[]
} {
  const initial: CandidateEvaluation[] = []
  const superseding: CandidateEvaluation[] = []
  for (const record of FRONTIER_DOMAIN_GRAPH_RECORDS) {
    const asInitial = evaluateCandidate(record.id, 'initial', registry)
    if (asInitial.eligible) initial.push(asInitial)
    const asSuperseding = evaluateCandidate(record.id, 'superseding', registry)
    if (asSuperseding.eligible) superseding.push(asSuperseding)
  }
  const byId = (a: CandidateEvaluation, b: CandidateEvaluation) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0)
  return { initial: initial.sort(byId), superseding: superseding.sort(byId) }
}

/** The shape a releasable Batch 11 cohort must have. */
export const REQUIRED_COHORT_SHAPE = { superseding: 2, initial: 3 } as const

export interface CohortFeasibility {
  requiredSuperseding: number
  requiredInitial: number
  availableSuperseding: number
  availableInitial: number
  feasible: boolean
  shortfall: readonly string[]
}

/**
 * Whether a compliant cohort can be assembled at all.
 *
 * Reported rather than forced. A cohort short of the required shape is a
 * finding about the corpus, and filling it from weaker candidates would answer
 * a question nobody asked.
 */
export function cohortFeasibility(registry: readonly RegistryRow[]): CohortFeasibility {
  const pool = eligiblePool(registry)
  const shortfall: string[] = []
  if (pool.superseding.length < REQUIRED_COHORT_SHAPE.superseding) {
    shortfall.push(`superseding: need ${REQUIRED_COHORT_SHAPE.superseding}, ${pool.superseding.length} eligible`)
  }
  if (pool.initial.length < REQUIRED_COHORT_SHAPE.initial) {
    shortfall.push(`initial: need ${REQUIRED_COHORT_SHAPE.initial}, ${pool.initial.length} eligible`)
  }
  return {
    requiredSuperseding: REQUIRED_COHORT_SHAPE.superseding,
    requiredInitial: REQUIRED_COHORT_SHAPE.initial,
    availableSuperseding: pool.superseding.length,
    availableInitial: pool.initial.length,
    feasible: shortfall.length === 0,
    shortfall,
  }
}

export function eligibilityDigest(registry: readonly RegistryRow[]): string {
  return `sha256:${createHash('sha256').update(canonicalJson(eligiblePool(registry)), 'utf8').digest('hex')}`
}
