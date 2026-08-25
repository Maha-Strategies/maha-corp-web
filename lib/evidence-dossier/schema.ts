/**
 * Evidence Dossier v0.1 — schema.
 *
 * A dossier records what was checked, what held, and what did not. It is
 * deliberately not a certificate: there is no VERIFIED state, no binary
 * verified/contested vocabulary, and no wording that implies regulatory
 * approval, patent defensibility, scientific truth, or external expert review.
 *
 * Compatible with maha-epistemic/1.0: the epistemic schema version is carried
 * unchanged and this adds a dossier layer above it.
 */

import { EPISTEMIC_SCHEMA_VERSION } from '../epistemic-schema.ts'

export const DOSSIER_SCHEMA_VERSION = 'maha-evidence-dossier/0.1' as const
export const DOSSIER_EPISTEMIC_BASE = EPISTEMIC_SCHEMA_VERSION

/**
 * Review states, in strictly increasing order of scrutiny. A dossier may only
 * advance one step at a time and may never skip internal audit.
 */
export const DOSSIER_REVIEW_STATES = [
  'illustrative-draft',
  'internally-audited',
  'externally-reviewed',
  'canonical',
] as const
export type DossierReviewState = (typeof DOSSIER_REVIEW_STATES)[number]

/**
 * Bounded epistemic states. There is no VERIFIED and no CONTESTED: each state
 * names exactly how far the checking got.
 */
export const EPISTEMIC_STATUSES = [
  'source-located',
  'source-metadata-verified',
  'passage-supports-bounded-claim',
  'secondary-report-only',
  'conflicting-sources',
  'replication-not-established',
  'unsupported',
  'blocked',
] as const
export type EpistemicStatus = (typeof EPISTEMIC_STATUSES)[number]

/**
 * Reserved for claims backed by at least two genuinely independent empirical
 * sources reporting materially equivalent results under comparable conditions.
 * It is not in EPISTEMIC_STATUSES because nothing in v0.1 qualifies, and the
 * validator refuses to award it without the required independent support.
 */
export const REPLICATED_EMPIRICAL = 'replicated-empirical' as const

export const CLAIM_TYPES = [
  'empirical-measurement',
  'modelled-result',
  'definition',
  'design-parameter',
  'author-stated-limitation',
] as const
export type ClaimType = (typeof CLAIM_TYPES)[number]

export const SOURCE_VERIFICATION_STATES = [
  'identifier-registered',
  'identifier-unregistered',
  'metadata-verified',
  'document-inspected',
  'unverifiable',
] as const
export type SourceVerificationState = (typeof SOURCE_VERIFICATION_STATES)[number]

export const EXTRACTION_METHODS = ['direct-pdf-read', 'publisher-html-read', 'not-extracted'] as const
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number]

export interface DossierSource {
  sourceId: string
  /** Exactly as submitted. Never edited. */
  submittedCitation: string
  /** Present only when the submitted citation was wrong. */
  correctedCitation: string | null
  identifier: string | null
  publisherUrl: string | null
  publicationType: string
  rightsBasis: string
  verificationState: SourceVerificationState
  verifiedAt: string | null
  /** Which index or document established the metadata. */
  metadataProvenance: string
}

export interface DossierPassage {
  passageId: string
  sourceId: string
  /** Exact locator. A dossier with a null locator fails validation. */
  locator: string | null
  /** Section, page, table, figure or equation the locator refers to. */
  locatorKind: 'section' | 'page' | 'table' | 'figure' | 'equation' | 'caption'
  /** Bounded excerpt or rights-compliant paraphrase. */
  excerpt: string
  isParaphrase: boolean
  extractionMethod: ExtractionMethod
  /** True only when the actual document was opened and read. */
  originalDocumentInspected: boolean
  passageHash: string
  sourceRevision: string
}

export interface ReviewerDecision {
  decision: string
  rationale: string
  decidedBy: 'internal-editorial'
  decidedAt: string
}

export interface DossierClaim {
  claimId: string
  /** Verbatim as submitted, including wording later found to be overstated. */
  submittedStatement: string
  /** The claim the evidence actually supports. */
  auditedStatement: string
  claimType: ClaimType
  sourceIds: readonly string[]
  passageIds: readonly string[]
  epistemicStatus: EpistemicStatus | typeof REPLICATED_EMPIRICAL
  /** What the check covered, and explicitly what it did not. */
  verificationScope: string
  uncertainty: string
  disagreements: readonly string[]
  /** Inferences a reader might draw that the evidence does not license. */
  unsupportedExtensions: readonly string[]
  reviewerDecisions: readonly ReviewerDecision[]
  provenanceDigest: string
}

/**
 * How a second inspected source stands relative to the first. Corroboration is
 * the strongest available relation here and is still weaker than replication:
 * it means two sources agree, not that an empirical result was reproduced.
 */
export const SOURCE_RELATIONS = [
  'corroborating',
  'contradictory',
  'materially-different-assumptions',
  'incomparable',
] as const
export type SourceRelation = (typeof SOURCE_RELATIONS)[number]

export interface ComparisonAxis {
  axis: string
  /** What each source does on this axis, keyed by sourceId. */
  values: Readonly<Record<string, string>>
  comparable: boolean
  note: string
}

export interface SourceComparison {
  comparisonId: string
  sourceIds: readonly string[]
  question: string
  relation: SourceRelation
  relationRationale: string
  axes: readonly ComparisonAxis[]
  /** Points on which the sources agree, stated no more strongly than they are. */
  agreements: readonly string[]
  /** Points on which one qualifies or disputes the other. */
  qualifications: readonly string[]
  comparabilityLimits: readonly string[]
  /** Why this comparison is not replication. */
  replicationAssessment: string
  provenanceDigest: string
}

/** An immutable record of a superseded dossier revision. */
export interface PriorRevision {
  version: string
  dossierDigest: string
  supersededAt: string
  summary: string
}

export interface ProvenanceBundle {
  corpusRevision: string
  digestAlgorithm: 'sha256'
  canonicalizationVersion: string
  sourceCount: number
  passageCount: number
  claimCount: number
  comparisonCount: number
  /** Digest of the whole dossier, excluding this field. */
  dossierDigest: string
}

export interface EvidenceDossier {
  schemaVersion: typeof DOSSIER_SCHEMA_VERSION
  epistemicBaseVersion: typeof DOSSIER_EPISTEMIC_BASE
  dossierId: string
  title: string
  inquiry: string
  domainId: string
  intendedUse: string
  prohibitedUses: readonly string[]
  methodology: string
  generatedAt: string
  corpusRevision: string
  reviewState: DossierReviewState
  sources: readonly DossierSource[]
  passages: readonly DossierPassage[]
  claims: readonly DossierClaim[]
  comparisons: readonly SourceComparison[]
  /** Superseded revisions, newest last. Never edited once written. */
  priorRevisions: readonly PriorRevision[]
  contradictions: readonly string[]
  unsupportedInferences: readonly string[]
  limitations: readonly string[]
  provenanceBundle: ProvenanceBundle
  disclaimer: string
}

/** A state may only advance one step, and canonical is unreachable from draft. */
export function isLegalReviewTransition(from: DossierReviewState, to: DossierReviewState): boolean {
  const fromIndex = DOSSIER_REVIEW_STATES.indexOf(from)
  const toIndex = DOSSIER_REVIEW_STATES.indexOf(to)
  if (fromIndex < 0 || toIndex < 0) return false
  return toIndex === fromIndex + 1
}
