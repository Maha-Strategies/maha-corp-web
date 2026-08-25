import { DOSSIER_SCHEMA_VERSION, type EvidenceDossier, type DossierReviewState } from './schema.ts'

/**
 * Storage-neutral dossier package.
 *
 * A package is one immutable revision. Revisions are never edited: a change to
 * evidence produces a new revision whose parentDigest points at the one it
 * supersedes, so lineage is reconstructible without trusting any store.
 *
 * The four material layers are kept apart deliberately:
 *   submitted    what an operator handed in, preserved verbatim
 *   extracted    what was read out of a source, with locators
 *   audited      what the evidence actually supports, after review
 *   presentation rendering choices that carry no evidentiary weight
 *
 * Only the first three enter the payload digest. Presentation changes must not
 * move it, which is what makes "we restyled the report" distinguishable from
 * "we changed what the dossier claims".
 */

export const DOSSIER_PACKAGE_VERSION = 'maha-dossier-package/0.1' as const

export interface OperatorAttribution {
  /** Stable, non-secret operator handle. Never an email, token or key. */
  operatorHandle: string
  role: 'internal-editorial'
}

export interface PackageTimestamps {
  submittedAt: string
  validatedAt: string | null
  revisedAt: string | null
}

/** Presentation-only settings. Deliberately excluded from the payload digest. */
export interface PresentationOptions {
  showComparisonMatrix: boolean
  showPriorRevisions: boolean
  printLayout: 'compact' | 'full'
}

export interface DossierPackage {
  packageVersion: typeof DOSSIER_PACKAGE_VERSION
  schemaVersion: typeof DOSSIER_SCHEMA_VERSION
  /** Immutable identity of the package lineage. */
  packageId: string
  dossierId: string
  /** Immutable identity of this revision within the lineage. */
  revisionId: string
  /** Digest of the revision this supersedes. Null only for the first revision. */
  parentDigest: string | null
  reviewState: DossierReviewState
  submitted: {
    inquiry: string
    intendedUse: string
    prohibitedUses: readonly string[]
  }
  /** The dossier body: sources, passages, claims, comparisons and framing. */
  dossier: EvidenceDossier
  attribution: OperatorAttribution
  timestamps: PackageTimestamps
  presentation: PresentationOptions
  /** Digest over submitted, extracted and audited material only. */
  canonicalPayloadDigest: string
}

export const PACKAGE_TOP_LEVEL_FIELDS = [
  'packageVersion',
  'schemaVersion',
  'packageId',
  'dossierId',
  'revisionId',
  'parentDigest',
  'reviewState',
  'submitted',
  'dossier',
  'attribution',
  'timestamps',
  'presentation',
  'canonicalPayloadDigest',
] as const

/**
 * Fields carrying evidentiary weight. Anything outside this projection may
 * change without moving the payload digest.
 */
export function evidentiaryProjection(pkg: DossierPackage) {
  const { dossier } = pkg
  return {
    packageId: pkg.packageId,
    dossierId: pkg.dossierId,
    revisionId: pkg.revisionId,
    parentDigest: pkg.parentDigest,
    schemaVersion: pkg.schemaVersion,
    reviewState: pkg.reviewState,
    submitted: pkg.submitted,
    sources: dossier.sources,
    passages: dossier.passages,
    claims: dossier.claims,
    comparisons: dossier.comparisons,
    contradictions: dossier.contradictions,
    unsupportedInferences: dossier.unsupportedInferences,
    limitations: dossier.limitations,
    priorRevisions: dossier.priorRevisions,
    methodology: dossier.methodology,
    disclaimer: dossier.disclaimer,
  }
}
