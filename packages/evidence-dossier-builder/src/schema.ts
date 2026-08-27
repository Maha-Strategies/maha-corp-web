/**
 * The dossier schema is NOT redefined here.
 *
 * This package is an extraction of the operator surface, not a second
 * implementation: a forked schema would drift from the corpus that produces
 * real dossiers and would quietly invalidate every existing digest. Everything
 * below is the canonical definition, re-exported.
 */
export {
  CLAIM_TYPES,
  DOSSIER_EPISTEMIC_BASE,
  DOSSIER_REVIEW_STATES,
  DOSSIER_SCHEMA_VERSION,
  EPISTEMIC_STATUSES,
  EXTRACTION_METHODS,
  REPLICATED_EMPIRICAL,
  SOURCE_RELATIONS,
  SOURCE_VERIFICATION_STATES,
  isLegalReviewTransition,
} from '../../../lib/evidence-dossier/schema.ts'

export type {
  ClaimType,
  ComparisonAxis,
  DossierClaim,
  DossierPassage,
  DossierReviewState,
  DossierSource,
  EpistemicStatus,
  EvidenceDossier,
  ExtractionMethod,
  PriorRevision,
  ProvenanceBundle,
  ReviewerDecision,
  SourceComparison,
  SourceRelation,
  SourceVerificationState,
} from '../../../lib/evidence-dossier/schema.ts'

export { DOSSIER_OFFER_LIST_PRICE_USD, DOSSIER_PACKAGE_VERSION } from '../../../lib/evidence-dossier/package.ts'
export type { DossierEngagement, DossierPackage, DossierPackageFile, OfferReadinessDecision } from '../../../lib/evidence-dossier/package.ts'
