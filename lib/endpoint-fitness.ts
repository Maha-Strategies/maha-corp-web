import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicReviewTargetHash } from './epistemic-publication.ts'
import {
  alignmentBlockers,
  alignmentFor,
  isAlignmentClear,
} from './frontier-source-alignment.ts'
import {
  isPilotAlignmentClear,
  pilotAlignmentBlockers,
  pilotAlignmentFor,
} from './pilot-source-alignment.ts'
import {
  isResolvedOutcome,
  resolveEpistemicReference,
  type ResolutionResult,
} from './epistemic-reference-resolver.ts'

/**
 * Alignment-aware endpoint usability.
 *
 * The resolver answers one question: does a submitted reference name a
 * canonical record. That is a structural fact and it is genuinely useful, so
 * nothing here changes it. What it cannot answer is whether the named record is
 * fit to carry a bridge, and the two were being reported as if they were the
 * same thing.
 *
 * Batch 5 made the gap concrete. The declared alias for Q-BR-006B resolves to
 * `fusion-plasma-systems-rebco-high-field-magnets`, and the resolver was right
 * that the record exists. But the record's bound source is Boozer's stellarator
 * review, whose full text contains no occurrence of "superconduct" in any form.
 * The endpoint resolved structurally while resting on a source that cannot
 * support it, and the gap report said 2/24 resolved with no qualification.
 *
 * Three axes are therefore reported separately and never collapsed:
 *
 *   structure  where the reference lands in the namespace
 *   fitness    what the alignment audit says about that record's source
 *   usability  the conjunction, which is what a bridge may actually rely on
 *
 * Everything fails closed. A record with no alignment audit is not usable.
 *
 * Two audits feed this: the 240-record frontier audit and the 50-record pilot
 * audit covering quantum-systems and synthetic-biology. They are consulted in
 * that order and are disjoint by construction. A record covered by neither is
 * still `audit-missing` and still unusable; adding coverage narrows that set
 * rather than weakening the rule.
 */

export const ENDPOINT_FITNESS_VERSION = 'maha-endpoint-fitness/1.0' as const

/** What the alignment audit says about a structurally resolved record. */
export const ENDPOINT_FITNESS_STATES = [
  'alignment-clear',
  'partially-supported',
  'source-mismatched',
  'source-inaccessible',
  'insufficient-evidence',
  'positional-legacy',
  'audit-missing',
] as const
export type EndpointFitnessState = (typeof ENDPOINT_FITNESS_STATES)[number]

/** What a bridge may do with the endpoint. */
export const ENDPOINT_USABILITY = [
  'usable',
  'structurally-resolved-but-epistemically-blocked',
  'unresolved',
] as const
export type EndpointUsability = (typeof ENDPOINT_USABILITY)[number]

export const ENDPOINT_FITNESS_BLOCKERS = [
  'endpoint-source-alignment-mismatched',
  'endpoint-source-alignment-partial',
  'endpoint-source-inaccessible',
  'endpoint-source-insufficient-evidence',
  'endpoint-source-positional-legacy',
  'endpoint-alignment-audit-missing',
] as const
export type EndpointFitnessBlocker = (typeof ENDPOINT_FITNESS_BLOCKERS)[number]

const FITNESS_BLOCKER: Readonly<Record<EndpointFitnessState, EndpointFitnessBlocker | null>> = {
  'alignment-clear': null,
  'partially-supported': 'endpoint-source-alignment-partial',
  'source-mismatched': 'endpoint-source-alignment-mismatched',
  'source-inaccessible': 'endpoint-source-inaccessible',
  'insufficient-evidence': 'endpoint-source-insufficient-evidence',
  'positional-legacy': 'endpoint-source-positional-legacy',
  'audit-missing': 'endpoint-alignment-audit-missing',
}

export interface EndpointFitness {
  recordId: string
  state: EndpointFitnessState
  /**
   * The record revision the verdict was computed against. Fitness is a claim
   * about a specific revision, so a changed record invalidates it.
   */
  recordRevisionSha256: string
  /** Which audit entry produced this, for blocker provenance. */
  auditProvenance: {
    audited: boolean
    subjectAligned: string | null
    assignmentOrigin: string | null
    alignmentBlockers: readonly string[]
  }
  blocker: EndpointFitnessBlocker | null
  reason: string
}

export interface UsableEndpointResult {
  /** Exactly as submitted. Never rewritten by this layer. */
  submittedReference: string
  /** The resolver's own result, passed through unchanged. */
  structure: ResolutionResult
  /** Null when the reference did not resolve, so there is no record to judge. */
  fitness: EndpointFitness | null
  usability: EndpointUsability
  blockers: readonly EndpointFitnessBlocker[]
}

/* ----------------------------------------------------------- structure --- */

/**
 * The structural axis, unchanged. This is a thin pass-through so callers can
 * name which axis they are asking about, and so the resolver stays the single
 * definition of what resolution means.
 */
export function resolveEndpointStructure(submittedReference: string): ResolutionResult {
  return resolveEpistemicReference(submittedReference)
}

/* ------------------------------------------------------------ fitness ---- */

/**
 * Cached per record id AND revision. A record whose revision changes has not
 * been re-audited, so its cached fitness is discarded rather than reused.
 */
const fitnessCache = new Map<string, EndpointFitness>()

function recordRevision(recordId: string): string | null {
  const record = EPISTEMIC_RECORDS.find((entry) => entry.id === recordId)
  return record ? epistemicReviewTargetHash(record) : null
}

/**
 * Fitness for a structurally resolved record.
 *
 * Takes a record id, never a caller-supplied audit object: the verdict is
 * looked up from the canonical audit every time, so a forged `alignment-clear`
 * field on some passed-in structure cannot reach this decision.
 */
export function evaluateResolvedEndpointFitness(recordId: string): EndpointFitness {
  const revision = recordRevision(recordId)
  const cached = fitnessCache.get(recordId)
  if (cached && revision !== null && cached.recordRevisionSha256 === revision) return cached

  // Two disjoint audits. Frontier first, then the pilot domains.
  const frontier = alignmentFor(recordId)
  const pilot = frontier ? null : pilotAlignmentFor(recordId)
  const audit = frontier
    ? {
        subjectAligned: frontier.evidence.subjectAligned as string,
        assignmentOrigin: frontier.assignmentOrigin as string,
        reason: frontier.reason,
      }
    : pilot
      ? {
          subjectAligned: pilot.verdict as string,
          assignmentOrigin: 'independently-curated',
          reason: pilot.reason,
        }
      : null
  const blockers = frontier ? alignmentBlockers(recordId) : pilot ? pilotAlignmentBlockers(recordId) : []
  const clear = frontier ? isAlignmentClear(recordId) : pilot ? isPilotAlignmentClear(recordId) : false

  let state: EndpointFitnessState
  let reason: string
  if (!audit) {
    state = 'audit-missing'
    reason =
      'No alignment audit covers this record. Neither the frontier cohort nor the pilot domains include it, so nothing is established about whether its source supports the subject. This fails closed.'
  } else if (clear) {
    state = 'alignment-clear'
    reason =
      'The alignment audit reports an inspected, subject-aligned source with verified metadata and an exact locator, and raises no blocker.'
  } else {
    switch (audit.subjectAligned) {
      case 'mismatched':
        state = 'source-mismatched'
        reason = `The bound source does not treat this record's subject. ${audit.reason}`
        break
      case 'inaccessible-source':
        state = 'source-inaccessible'
        reason = `The bound source could not be retrieved, so nothing about its fitness is established. ${audit.reason}`
        break
      case 'partially-supported':
        state = 'partially-supported'
        reason = `Only part of this record is supported by the bound source, which is not enough to carry a bridge endpoint. ${audit.reason}`
        break
      case 'insufficient-evidence':
        state = 'insufficient-evidence'
        reason = `The bound source has not been shown to support this record. ${audit.reason}`
        break
      default:
        // Verdict is `supported` but a blocker remains, most often a positional
        // assignment or unverified metadata. Report the specific reason.
        state = audit.assignmentOrigin === 'positional-legacy' ? 'positional-legacy' : 'insufficient-evidence'
        reason = `The audit records ${audit.subjectAligned} but the endpoint is still blocked by: ${blockers.join(', ')}.`
        break
    }
  }

  const fitness: EndpointFitness = {
    recordId,
    state,
    recordRevisionSha256: revision ?? 'sha256:unknown-record',
    auditProvenance: {
      audited: Boolean(audit),
      subjectAligned: audit?.subjectAligned ?? null,
      assignmentOrigin: audit?.assignmentOrigin ?? null,
      alignmentBlockers: blockers,
    },
    blocker: FITNESS_BLOCKER[state],
    reason,
  }
  if (revision !== null) fitnessCache.set(recordId, fitness)
  return fitness
}

/* ---------------------------------------------------------- usability ---- */

/**
 * The conjunction. `usable` requires BOTH a structural resolution and an
 * alignment-clear audit; an alias never becomes usable merely because its
 * target exists.
 */
export function resolveUsableEndpoint(submittedReference: string): UsableEndpointResult {
  const structure = resolveEndpointStructure(submittedReference)
  if (!isResolvedOutcome(structure.outcome)) {
    return { submittedReference, structure, fitness: null, usability: 'unresolved', blockers: [] }
  }
  const recordId = (structure.outcome as { recordId: string }).recordId
  const fitness = evaluateResolvedEndpointFitness(recordId)
  const usable = fitness.state === 'alignment-clear'
  return {
    submittedReference,
    structure,
    fitness,
    usability: usable ? 'usable' : 'structurally-resolved-but-epistemically-blocked',
    blockers: fitness.blocker ? [fitness.blocker] : [],
  }
}

/** True only when a bridge may actually rely on this endpoint. */
export function isUsableEndpoint(submittedReference: string): boolean {
  return resolveUsableEndpoint(submittedReference).usability === 'usable'
}

/* -------------------------------------------------------------- totals --- */

export interface EndpointUsabilityTotals {
  structurallyResolved: number
  usable: number
  structurallyResolvedButBlocked: number
  unresolved: number
}

/**
 * Totals across any set of submitted references. Generic on purpose: the same
 * call answers for Q-BR today and for the next bridge family unchanged.
 */
export function endpointUsabilityTotals(submittedReferences: readonly string[]): EndpointUsabilityTotals {
  const totals: EndpointUsabilityTotals = {
    structurallyResolved: 0,
    usable: 0,
    structurallyResolvedButBlocked: 0,
    unresolved: 0,
  }
  for (const reference of submittedReferences) {
    const result = resolveUsableEndpoint(reference)
    if (isResolvedOutcome(result.structure.outcome)) totals.structurallyResolved += 1
    if (result.usability === 'usable') totals.usable += 1
    else if (result.usability === 'structurally-resolved-but-epistemically-blocked') {
      totals.structurallyResolvedButBlocked += 1
    } else totals.unresolved += 1
  }
  return totals
}

/** Test seam: drop cached fitness so a revision change can be observed. */
export function clearEndpointFitnessCache(): void {
  fitnessCache.clear()
}
