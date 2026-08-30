export const EVIDENCE_PREFLIGHT_SCHEMA_VERSION = 'maha-evidence-preflight/1.0' as const
export const EVIDENCE_PREFLIGHT_MAX_CLAIMS = 3
export const EVIDENCE_PREFLIGHT_DAILY_LIMIT = 5
export const EVIDENCE_PREFLIGHT_PRICE_USD = 250

export const SOURCE_KINDS = ['doi', 'url'] as const
export const LOCATOR_KINDS = ['page', 'section', 'paragraph', 'figure', 'table', 'equation', 'timestamp', 'other'] as const
export const RIGHTS_BASES = ['public-domain', 'open-license', 'permission-confirmed', 'limited-quotation-review', 'unknown'] as const
export const ACCESS_STATUSES = ['open', 'restricted', 'unknown'] as const

export type EvidencePreflightSourceKind = (typeof SOURCE_KINDS)[number]
export type EvidencePreflightLocatorKind = (typeof LOCATOR_KINDS)[number]
export type EvidencePreflightRightsBasis = (typeof RIGHTS_BASES)[number]
export type EvidencePreflightAccessStatus = (typeof ACCESS_STATUSES)[number]

export type EvidencePreflightClaimInput = {
  claim: string
  source: {
    kind: EvidencePreflightSourceKind
    identifier: string
    title?: string
    publisher?: string
    publicationDate?: string
  }
  excerpt?: string
  locator?: {
    kind: EvidencePreflightLocatorKind
    value: string
  }
  rights: {
    basis: EvidencePreflightRightsBasis
    accessStatus: EvidencePreflightAccessStatus
    licenseOrPermission?: string
  }
}

export type EvidencePreflightInput = {
  requestId: string
  submissionConfirmedNonConfidential: true
  claims: EvidencePreflightClaimInput[]
}

export type EvidencePreflightBlocker =
  | 'source-identifier-invalid'
  | 'source-metadata-only'
  | 'exact-locator-missing'
  | 'claim-scope-overbroad'
  | 'claim-excerpt-lexical-coverage-low'
  | 'unsupported-inference-risk'
  | 'rights-basis-unresolved'
  | 'open-license-not-identified'
  | 'source-access-restricted'

export type EvidencePreflightClaimAssessment = {
  claimId: string
  claim: string
  source: EvidencePreflightClaimInput['source'] & {
    normalizedIdentifier: string
    identityStatus: 'declared-format-valid' | 'declared-format-invalid'
    identityBoundary: string
  }
  excerpt: string | null
  locator: EvidencePreflightClaimInput['locator'] | null
  locatorStatus: 'exact-locator-declared' | 'locator-missing'
  evidenceStatus: 'metadata-only' | 'user-supplied-unlocated-excerpt' | 'user-supplied-located-excerpt'
  scopeAssessment: {
    status: 'bounded-language' | 'overbroad-language'
    signals: string[]
  }
  unsupportedInferenceAssessment: {
    status: 'no-lexical-risk-detected' | 'lexical-risk-detected'
    signals: string[]
  }
  lexicalCoverage: {
    status: 'not-assessed' | 'low' | 'moderate' | 'high'
    ratio: string | null
    boundary: string
  }
  rightsAssessment: {
    basis: EvidencePreflightRightsBasis
    accessStatus: EvidencePreflightAccessStatus
    licenseOrPermission: string | null
    status: 'declared-usable-with-review' | 'unresolved' | 'restricted'
    boundary: string
  }
  blockers: EvidencePreflightBlocker[]
  readiness: 'ready-for-source-inspection' | 'blocked-before-source-inspection'
}

export type EvidencePreflightResultBody = {
  schemaVersion: typeof EVIDENCE_PREFLIGHT_SCHEMA_VERSION
  requestId: string
  assessmentKind: 'automated-structural-preflight'
  independentSourceInspectionPerformed: false
  contentRetainedByMaha: false
  assessments: EvidencePreflightClaimAssessment[]
  summary: {
    claimCount: number
    readyForSourceInspection: number
    blockedBeforeSourceInspection: number
    metadataOnly: number
    locatedExcerptCount: number
  }
  privacy: {
    submissionRetention: 'none'
    telemetryRetention: 'metadata-only'
    telemetryFields: string[]
    confidentialSubmissionPermitted: false
  }
  limitations: string[]
  fullDossierOffer: {
    state: 'informational'
    purchaseEnabled: false
    proposedPriceUsd: typeof EVIDENCE_PREFLIGHT_PRICE_USD
    scope: string
  }
}

export type EvidencePreflightResult = EvidencePreflightResultBody & {
  resultSha256: string
}

export type EvidencePreflightApiResponse = {
  status: 'created' | 'idempotent'
  result: EvidencePreflightResult
}

