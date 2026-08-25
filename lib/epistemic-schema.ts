export const EPISTEMIC_SCHEMA_VERSION = 'maha-epistemic/1.0' as const
export const EPISTEMIC_POLICY_VERSION = 'mps/0.1' as const

export const CLAIM_KINDS = [
  'observation',
  'empirical-claim',
  'theoretical-model',
  'formal-proposition',
  'interpretation',
  'hypothesis',
] as const

export const EVIDENCE_MATURITIES = [
  'not-assessed',
  'not-applicable',
  'single-study',
  'multi-study',
  'independently-replicated',
  'contested',
  'historical-attestation',
  'formally-verified',
] as const

export const EXPERT_REVIEW_SCOPES = [
  'source-fidelity',
  'domain-fidelity',
  'boundary-adequacy',
  'rights-and-locator',
] as const

export const REVIEW_STATES = [
  'draft',
  'in-review',
  'published-canonical',
  'withdrawn',
] as const

export const RECORD_KINDS = [
  'concept',
  'mechanism',
  'method',
  'measurement',
  'comparison',
  'conflict',
  'bridge',
  'hypothesis',
] as const

export const BRIDGE_TYPES = [
  'mathematical-equivalence',
  'shared-instrumentation',
  'mechanistic-dependency',
  'statistical-association',
  'structural-analogy',
  'strategic-dependency',
] as const

export const RIGHTS_BASES = [
  'public-domain',
  'open-license',
  'licensed',
  'permission',
  'citation-with-paraphrase',
] as const

export const SOURCE_CHRONOLOGY_STATUSES = [
  'undated',
  'living-document',
] as const

export type ClaimKind = (typeof CLAIM_KINDS)[number]
export type EvidenceMaturity = (typeof EVIDENCE_MATURITIES)[number]
export type ReviewState = (typeof REVIEW_STATES)[number]
export type EpistemicRecordKind = (typeof RECORD_KINDS)[number]
export type BridgeType = (typeof BRIDGE_TYPES)[number]
export type RightsBasis = (typeof RIGHTS_BASES)[number]
export type ExpertReviewScope = (typeof EXPERT_REVIEW_SCOPES)[number]
export type SourceChronologyStatus = (typeof SOURCE_CHRONOLOGY_STATUSES)[number]

export interface SourceIdentifier {
  scheme: 'doi' | 'isbn' | 'url' | 'dataset' | 'standard' | 'accession'
  value: string
}

export interface SourceRights {
  basis: RightsBasis
  licenseName?: string
  licenseUrl?: string
  quotationUsed: boolean
  note: string
}

export interface SourceChronology {
  status: SourceChronologyStatus
  accessedAt: string
  sourceVersion?: string
}

export interface EpistemicSource {
  id: string
  title: string
  authors: string[]
  publisher: string
  publishedAt: string
  sourceChronology?: SourceChronology
  url: string
  identifiers: SourceIdentifier[]
  exactLocator: string
  rights: SourceRights
  establishes: string
  boundary: string
  conflictsOfInterest?: string
}

export interface UncertaintyAssessment {
  kind: 'quantitative' | 'qualitative' | 'not-reported' | 'not-applicable'
  statement: string
  interval?: string
  units?: string
}

export interface ReplicationAssessment {
  independentReplicationCount: number | null
  assessment: string
  asOfDate: string
}

export interface EpistemicClaim {
  id: string
  statement: string
  claimKind: ClaimKind
  evidenceMaturity: EvidenceMaturity
  sourceIds: string[]
  scope: string
  boundary: string
  uncertainty: UncertaintyAssessment
  replication: ReplicationAssessment
}

export interface ReviewEvent {
  reviewId?: string
  reviewerId: string
  reviewerProfileVersion?: number
  reviewerRole: string
  reviewerKind?: 'external-expert' | 'internal-editorial' | 'automated-verifier'
  reviewMethod?: string
  scope?: ExpertReviewScope
  targetSha256?: string
  reviewedAt: string
  verdict: 'approve' | 'request-changes' | 'reject' | 'abstain'
  rationale: string
  supersedesReviewId?: string | null
}

export interface PublicationControl {
  requestedPublicPromotion: boolean
  reviewState: ReviewState
  canonicalVersion: string
  publishedAt?: string
  lastReviewedAt: string
  requiredReviewScopes?: ExpertReviewScope[]
  reviewEvents: ReviewEvent[]
}

export interface MathematicalBridge {
  id: string
  sourceConceptId: string
  targetConceptId: string
  bridgeType: BridgeType
  statement: string
  formalAttachment?: string
  epistemicWarning?: string
}

export interface EpistemicSection {
  heading: string
  paragraphs: string[]
  claimIds: string[]
}

export interface EpistemicRecord {
  schemaVersion: typeof EPISTEMIC_SCHEMA_VERSION
  evidencePolicyVersion: typeof EPISTEMIC_POLICY_VERSION
  id: string
  domainSlug: string
  recordKind: EpistemicRecordKind
  slug: string
  title: string
  description: string
  summary: string
  claims: EpistemicClaim[]
  sources: EpistemicSource[]
  sections: EpistemicSection[]
  bridges: MathematicalBridge[]
  boundaries: string[]
  prohibitedInferences: string[]
  publication: PublicationControl
}

export interface EpistemicDomain {
  slug: string
  name: string
  description: string
  stressPoint: string
  accent: 'blue' | 'green' | 'violet' | 'amber'
}

export interface PublicationDecision {
  recordId: string
  publicEligible: boolean
  evaluatedAgainst: typeof EPISTEMIC_SCHEMA_VERSION
  reasons: string[]
}

export interface ProvenanceBundle {
  schemaVersion: typeof EPISTEMIC_SCHEMA_VERSION
  evidencePolicyVersion: typeof EPISTEMIC_POLICY_VERSION
  recordId: string
  canonicalPath: string
  contentHash: string
  generatedAt: string
  publicationDecision: PublicationDecision
  claims: EpistemicClaim[]
  sources: EpistemicSource[]
  reviewEvents: ReviewEvent[]
}

export const EPISTEMIC_SCHEMA_DESCRIPTOR = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://www.mahastrategies.com/knowledge/epistemic-system/schema',
  title: 'Maha Epistemic Record',
  version: EPISTEMIC_SCHEMA_VERSION,
  evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
  axes: {
    claimKind: CLAIM_KINDS,
    evidenceMaturity: EVIDENCE_MATURITIES,
    scopedReview: EXPERT_REVIEW_SCOPES,
    reviewState: REVIEW_STATES,
    recordKind: RECORD_KINDS,
    bridgeType: BRIDGE_TYPES,
    rightsBasis: RIGHTS_BASES,
    sourceChronologyStatus: SOURCE_CHRONOLOGY_STATUSES,
  },
  invariants: [
    'Claim kind, evidence maturity, and review state are independent axes.',
    'Every public claim resolves to a rights-cleared source with an exact locator.',
    'A source has either a real publication date or explicit undated/living-document chronology with an access date; access dates are never mislabeled as publication dates.',
    'Analogy and association bridges carry an explicit non-transfer warning.',
    'Only records passing the publication gateway generate crawlable pages.',
    'Scoped decisions bind a versioned reviewer identity, a declared review method, and an immutable content hash; review approval is not product approval or scientific validation.',
  ],
} as const
