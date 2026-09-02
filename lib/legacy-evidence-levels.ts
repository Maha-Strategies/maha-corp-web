import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * What is actually known about a source, level by level.
 *
 * The first pass counted a URL as an inspected locator. It is not. A URL says
 * where something claims to live, and nothing about whether anyone opened it,
 * whether the thing at that address is what the citation names, or whether it
 * is about the record's subject. Those are four different facts and they were
 * being reported as one.
 *
 * Each level below is recorded separately and none implies the next. A level
 * is true only where something independent recorded it, so the honest default
 * for the legacy corpus is that only the first is satisfied.
 */

export const EVIDENCE_LEVELS = [
  'declared-locator',
  'content-inspected-locator',
  'source-identity-verified',
  'subject-aligned',
  'claim-supported-at-stated-scope',
  'release-revision-matched',
] as const
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number]

export type InspectionDepth =
  | 'not-inspected'
  | 'metadata-only'
  | 'abstract-only'
  | 'section-or-full-text'

/** Depths that can support an explanatory statement on a public page. */
export const EXPLANATORY_DEPTHS: ReadonlySet<InspectionDepth> = new Set(['section-or-full-text'])

/**
 * An independent record that a specific source was opened and read.
 *
 * It carries the passage that was actually seen. Without one, a source has a
 * declared locator and nothing more, however authoritative its publisher.
 */
export interface InspectionAttestation {
  sourceId: string
  /** The address that was actually fetched, which may differ from the citation. */
  retrievedFrom: string
  retrievedOn: string
  depth: InspectionDepth
  /** Where in the source the supporting content sits. */
  exactLocator: string
  /** What was read there, in the inspector's words, not the source's prose. */
  observedContent: string
  /** Whether the retrieved item is the work the citation names. */
  identityVerified: boolean
  identityBasis: string
  /** Whether the source is about the subject the page uses it for. */
  subjectAligned: boolean
  subjectBasis: string
  versionRelationship: string
  rightsBasis: string
}

export interface EvidenceProfile {
  sourceId: string
  levels: Readonly<Record<EvidenceLevel, boolean>>
  depth: InspectionDepth
  /** May this source be used to state a fact on a public page? */
  explanatory: boolean
  reason: string
}

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

export interface EvidenceInput {
  sourceId: string
  declaredUrl?: string
  establishes?: string
  boundary?: string
  attestation?: InspectionAttestation | null
  releaseMatched?: boolean
}

/**
 * Grades one source.
 *
 * Nothing here infers upward. A verified identity does not imply the source
 * was read; a read source does not imply it is about the subject. Only an
 * attestation that says so, explicitly, moves a level.
 */
export function gradeEvidence(input: EvidenceInput): EvidenceProfile {
  const attestation = input.attestation ?? null
  const depth: InspectionDepth = attestation?.depth ?? 'not-inspected'

  const levels: Record<EvidenceLevel, boolean> = {
    'declared-locator': typeof input.declaredUrl === 'string' && input.declaredUrl.length > 8,
    // Requires an attestation, never a URL.
    'content-inspected-locator': attestation !== null
      && EXPLANATORY_DEPTHS.has(attestation.depth)
      && attestation.exactLocator.trim().length > 0
      && attestation.observedContent.trim().length > 20,
    'source-identity-verified': attestation?.identityVerified === true,
    'subject-aligned': attestation?.subjectAligned === true,
    // A source may only support a claim at the scope it declares.
    'claim-supported-at-stated-scope': typeof input.establishes === 'string'
      && input.establishes.trim().length >= 12
      && typeof input.boundary === 'string'
      && input.boundary.trim().length >= 12,
    'release-revision-matched': input.releaseMatched !== false,
  }

  // Explanatory use needs the content actually read, the item confirmed, the
  // subject matched, and a declared scope. Four separate facts, all required.
  const explanatory = levels['content-inspected-locator']
    && levels['source-identity-verified']
    && levels['subject-aligned']
    && levels['claim-supported-at-stated-scope']
    && levels['release-revision-matched']

  const missing = EVIDENCE_LEVELS.filter((level) => !levels[level])
  return {
    sourceId: input.sourceId,
    levels,
    depth,
    explanatory,
    reason: explanatory
      ? 'inspected, identified, subject-aligned and scope-bounded'
      : `not explanatory: ${missing.join(', ')}`,
  }
}

/** Sources that may carry a stated fact. Everything else is reference only. */
export function explanatorySources(profiles: readonly EvidenceProfile[]): readonly EvidenceProfile[] {
  return profiles.filter((profile) => profile.explanatory)
}

export function attestationDigest(attestation: InspectionAttestation): string {
  return sha(attestation)
}

/**
 * Fields that must never be read as a statement of evidence boundary.
 *
 * Each was mapped to negative space once and taken back out. An assumption is
 * a precondition, a reproducibility control is a method, and a failure mode is
 * how a process breaks. None says what a page fails to establish.
 */
export const FORBIDDEN_BOUNDARY_SOURCES = [
  'assumptions', 'reproducibilityControls', 'failureModes',
  'interpretiveRisks', 'errorBounds', 'criticalParameters',
] as const

export function assertNotBoundarySubstitute(fieldName: string): void {
  if ((FORBIDDEN_BOUNDARY_SOURCES as readonly string[]).includes(fieldName)) {
    throw new Error(
      `${fieldName} describes preconditions, method or failure, not what a page does not establish. It may not be used as an evidence boundary.`,
    )
  }
}
