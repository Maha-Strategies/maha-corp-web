import { provenanceDigest } from './evidence-dossier/digest.ts'
import {
  ACCESS_STATUSES,
  EVIDENCE_PREFLIGHT_MAX_CLAIMS,
  EVIDENCE_PREFLIGHT_PRICE_USD,
  EVIDENCE_PREFLIGHT_SCHEMA_VERSION,
  LOCATOR_KINDS,
  RIGHTS_BASES,
  SOURCE_KINDS,
  type EvidencePreflightBlocker,
  type EvidencePreflightClaimAssessment,
  type EvidencePreflightClaimInput,
  type EvidencePreflightInput,
  type EvidencePreflightResult,
  type EvidencePreflightResultBody,
} from './evidence-preflight-contract.ts'

const REQUEST_ID = /^epf_[a-z0-9-]{16,80}$/
const DOI = /^10\.\d{4,9}\/[!#$&'()*+,\-./0-9:;=?@A-Z[\]_a-z{}~]+$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const GENERIC_LOCATORS = new Set(['n/a', 'na', 'none', 'unknown', 'entire document', 'whole document', 'the paper', 'paper', 'source'])
const STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'were', 'with'])

const SCOPE_SIGNALS: Array<[RegExp, string]> = [
  [/\b(?:all|always|never|every|entirely|universally|without exception)\b/i, 'absolute-or-universal-language'],
  [/\b(?:guarantees?|certainly|conclusively|definitively)\b/i, 'certainty-language'],
  [/\b(?:proves?|certifies?|validated as|scientifically valid)\b/i, 'proof-or-certification-language'],
]

const INFERENCE_SIGNALS: Array<[RegExp, string]> = [
  [/\b(?:causes?|caused|leads? to|results? in|eliminates?|prevents?)\b/i, 'causal-language'],
  [/\b(?:will|shall|is certain to|predicts?)\b/i, 'predictive-language'],
  [/\b(?:safe|compliant|approved|effective|superior)\b/i, 'fitness-or-compliance-language'],
]

function object(value: unknown, field: string, allowedKeys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object.`)
  const input = value as Record<string, unknown>
  for (const key of Object.keys(input)) if (FORBIDDEN_KEYS.has(key)) throw new Error(`${field} contains a forbidden key.`)
  if (allowedKeys) {
    const unexpected = Object.keys(input).filter((key) => !allowedKeys.includes(key))
    if (unexpected.length) throw new Error(`${field} contains unsupported fields: ${unexpected.sort().join(', ')}.`)
  }
  return input
}

function string(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const clean = value.trim().normalize('NFC')
  if (clean.length < minimum || clean.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) {
    throw new Error(`${field} must contain ${minimum}-${maximum} safe characters.`)
  }
  return clean
}

function optionalString(value: unknown, field: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return string(value, field, 1, maximum)
}

function enumValue<T extends readonly string[]>(value: unknown, field: string, values: T): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`${field} is invalid.`)
  return value as T[number]
}

function parseClaim(value: unknown, index: number): EvidencePreflightClaimInput {
  const claim = object(value, `claims[${index}]`, ['claim', 'source', 'excerpt', 'locator', 'rights'])
  const source = object(claim.source, `claims[${index}].source`, ['kind', 'identifier', 'title', 'publisher', 'publicationDate'])
  const rights = object(claim.rights, `claims[${index}].rights`, ['basis', 'accessStatus', 'licenseOrPermission'])
  const locator = claim.locator === undefined || claim.locator === null
    ? undefined
    : object(claim.locator, `claims[${index}].locator`, ['kind', 'value'])
  const publicationDate = optionalString(source.publicationDate, `claims[${index}].source.publicationDate`, 10)
  const parsedDate = publicationDate ? new Date(`${publicationDate}T00:00:00Z`) : null
  if (publicationDate && (!ISO_DATE.test(publicationDate) || Number.isNaN(parsedDate?.getTime()) || parsedDate?.toISOString().slice(0, 10) !== publicationDate)) {
    throw new Error(`claims[${index}].source.publicationDate must be an ISO date.`)
  }
  return {
    claim: string(claim.claim, `claims[${index}].claim`, 8, 1_000),
    source: {
      kind: enumValue(source.kind, `claims[${index}].source.kind`, SOURCE_KINDS),
      identifier: string(source.identifier, `claims[${index}].source.identifier`, 4, 500),
      title: optionalString(source.title, `claims[${index}].source.title`, 300),
      publisher: optionalString(source.publisher, `claims[${index}].source.publisher`, 200),
      publicationDate,
    },
    excerpt: optionalString(claim.excerpt, `claims[${index}].excerpt`, 1_500),
    locator: locator ? {
      kind: enumValue(locator.kind, `claims[${index}].locator.kind`, LOCATOR_KINDS),
      value: string(locator.value, `claims[${index}].locator.value`, 1, 160),
    } : undefined,
    rights: {
      basis: enumValue(rights.basis, `claims[${index}].rights.basis`, RIGHTS_BASES),
      accessStatus: enumValue(rights.accessStatus, `claims[${index}].rights.accessStatus`, ACCESS_STATUSES),
      licenseOrPermission: optionalString(rights.licenseOrPermission, `claims[${index}].rights.licenseOrPermission`, 240),
    },
  }
}

export function parseEvidencePreflightInput(value: unknown): EvidencePreflightInput {
  const input = object(value, 'request body', ['requestId', 'submissionConfirmedNonConfidential', 'claims'])
  if (typeof input.requestId !== 'string') throw new Error('requestId is invalid.')
  const requestId = input.requestId.trim().normalize('NFC')
  if (!REQUEST_ID.test(requestId)) throw new Error('requestId is invalid.')
  if (input.submissionConfirmedNonConfidential !== true) {
    throw new Error('Confirm that the submission contains no confidential, personal, privileged, export-controlled, or unpublished restricted material.')
  }
  if (!Array.isArray(input.claims) || input.claims.length < 1 || input.claims.length > EVIDENCE_PREFLIGHT_MAX_CLAIMS) {
    throw new Error(`claims must contain 1-${EVIDENCE_PREFLIGHT_MAX_CLAIMS} entries.`)
  }
  return { requestId, submissionConfirmedNonConfidential: true, claims: input.claims.map(parseClaim) }
}

function normalizeDoi(value: string): string {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').toLowerCase()
}

function publicHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || !host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null
    if (/^(?:10|127|169\.254|192\.168)\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || host === '::1') return null
    if (/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || /^(?:0|22[4-9]|23\d|24\d|25[0-5])\./.test(host)) return null
    const ipv6 = host.replace(/^\[|\]$/g, '')
    if (ipv6 === '::1' || /^(?:fc|fd|fe[89ab])/i.test(ipv6) || /^::ffff:(?:10|127|169\.254|192\.168)\./i.test(ipv6)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function sourceIdentity(source: EvidencePreflightClaimInput['source']) {
  if (source.kind === 'doi') {
    const normalizedIdentifier = normalizeDoi(source.identifier)
    return { normalizedIdentifier, valid: DOI.test(normalizedIdentifier) }
  }
  const normalizedIdentifier = publicHttpsUrl(source.identifier)
  return { normalizedIdentifier: normalizedIdentifier ?? source.identifier, valid: normalizedIdentifier !== null }
}

function signals(text: string, patterns: Array<[RegExp, string]>): string[] {
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)
}

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => token.length > 2 && !STOPWORDS.has(token)))
}

function lexicalCoverage(claim: string, excerpt: string | undefined) {
  if (!excerpt) return { status: 'not-assessed' as const, ratio: null, boundary: 'No excerpt was supplied, so lexical coverage was not assessed.' }
  const claimTokens = tokens(claim)
  if (!claimTokens.size) return { status: 'not-assessed' as const, ratio: null, boundary: 'The claim contained no significant tokens for a lexical comparison.' }
  const excerptTokens = tokens(excerpt)
  const overlap = [...claimTokens].filter((token) => excerptTokens.has(token)).length
  const ratio = overlap / claimTokens.size
  return {
    status: ratio < 0.25 ? 'low' as const : ratio < 0.6 ? 'moderate' as const : 'high' as const,
    ratio: ratio.toFixed(3),
    boundary: 'Token overlap is a routing signal only. It does not establish semantic entailment or source support.',
  }
}

function rightsAssessment(input: EvidencePreflightClaimInput['rights']) {
  const missingOpenLicense = input.basis === 'open-license' && !input.licenseOrPermission
  const unresolved = input.basis === 'unknown' || missingOpenLicense
  const restricted = input.accessStatus === 'restricted'
  return {
    basis: input.basis,
    accessStatus: input.accessStatus,
    licenseOrPermission: input.licenseOrPermission ?? null,
    status: restricted ? 'restricted' as const : unresolved ? 'unresolved' as const : 'declared-usable-with-review' as const,
    boundary: 'Rights and access are caller-declared and have not been legally or independently verified by this preflight.',
  }
}

function assessClaim(input: EvidencePreflightClaimInput, index: number): EvidencePreflightClaimAssessment {
  const identity = sourceIdentity(input.source)
  const exactLocator = input.locator && !GENERIC_LOCATORS.has(input.locator.value.toLowerCase()) ? input.locator : null
  const scopeSignals = signals(input.claim, SCOPE_SIGNALS)
  const inferenceSignals = signals(input.claim, INFERENCE_SIGNALS)
  const excerptInferenceSignals = input.excerpt ? signals(input.excerpt, INFERENCE_SIGNALS) : []
  const unsupportedSignals = inferenceSignals.filter((signal) => !excerptInferenceSignals.includes(signal))
  const coverage = lexicalCoverage(input.claim, input.excerpt)
  const rights = rightsAssessment(input.rights)
  const blockers = new Set<EvidencePreflightBlocker>()
  if (!identity.valid) blockers.add('source-identifier-invalid')
  if (!input.excerpt) blockers.add('source-metadata-only')
  if (!exactLocator) blockers.add('exact-locator-missing')
  if (scopeSignals.length) blockers.add('claim-scope-overbroad')
  if (coverage.status === 'low') blockers.add('claim-excerpt-lexical-coverage-low')
  if (unsupportedSignals.length) blockers.add('unsupported-inference-risk')
  if (input.rights.basis === 'unknown') blockers.add('rights-basis-unresolved')
  if (input.rights.basis === 'open-license' && !input.rights.licenseOrPermission) blockers.add('open-license-not-identified')
  if (input.rights.accessStatus === 'restricted') blockers.add('source-access-restricted')
  const orderedBlockers = [...blockers].sort()
  return {
    claimId: `claim-${String(index + 1).padStart(3, '0')}`,
    claim: input.claim,
    source: {
      ...input.source,
      normalizedIdentifier: identity.normalizedIdentifier,
      identityStatus: identity.valid ? 'declared-format-valid' : 'declared-format-invalid',
      identityBoundary: 'Identifier syntax was normalized and checked locally. Registration, document identity, version relationship, authorship, and content were not independently verified.',
    },
    excerpt: input.excerpt ?? null,
    locator: exactLocator,
    locatorStatus: exactLocator ? 'exact-locator-declared' : 'locator-missing',
    evidenceStatus: !input.excerpt ? 'metadata-only' : exactLocator ? 'user-supplied-located-excerpt' : 'user-supplied-unlocated-excerpt',
    scopeAssessment: { status: scopeSignals.length ? 'overbroad-language' : 'bounded-language', signals: scopeSignals },
    unsupportedInferenceAssessment: { status: unsupportedSignals.length ? 'lexical-risk-detected' : 'no-lexical-risk-detected', signals: unsupportedSignals },
    lexicalCoverage: coverage,
    rightsAssessment: rights,
    blockers: orderedBlockers,
    readiness: orderedBlockers.length ? 'blocked-before-source-inspection' : 'ready-for-source-inspection',
  }
}

export function compileEvidencePreflight(input: EvidencePreflightInput): EvidencePreflightResult {
  const assessments = input.claims.map(assessClaim)
  const body: EvidencePreflightResultBody = {
    schemaVersion: EVIDENCE_PREFLIGHT_SCHEMA_VERSION,
    requestId: input.requestId,
    assessmentKind: 'automated-structural-preflight',
    independentSourceInspectionPerformed: false,
    contentRetainedByMaha: false,
    assessments,
    summary: {
      claimCount: assessments.length,
      readyForSourceInspection: assessments.filter((entry) => entry.readiness === 'ready-for-source-inspection').length,
      blockedBeforeSourceInspection: assessments.filter((entry) => entry.readiness === 'blocked-before-source-inspection').length,
      metadataOnly: assessments.filter((entry) => entry.evidenceStatus === 'metadata-only').length,
      locatedExcerptCount: assessments.filter((entry) => entry.evidenceStatus === 'user-supplied-located-excerpt').length,
    },
    privacy: {
      submissionRetention: 'none',
      telemetryRetention: 'metadata-only',
      telemetryFields: ['keyed visitor pseudonym', 'keyed request pseudonym', 'claim count', 'character count', 'source-kind counts', 'ready/blocked counts', 'request time'],
      confidentialSubmissionPermitted: false,
    },
    limitations: [
      'This is deterministic structural triage, not a verified Evidence Dossier, literature review, factual certification, legal opinion, patent clearance, or scientific validation.',
      'No source was fetched, opened, read, compared against another source, or checked for retraction or correction.',
      'A well-formed DOI or URL proves only that the submitted identifier has an acceptable format; it does not prove that the work exists or supports the claim.',
      'A user-supplied excerpt and locator remain unverified until an authorized reviewer inspects the identified source and version.',
      'Lexical signals can identify review risk but cannot establish semantic support, causation, safety, effectiveness, compliance, or truth.',
    ],
    fullDossierOffer: {
      state: 'informational',
      purchaseEnabled: false,
      proposedPriceUsd: EVIDENCE_PREFLIGHT_PRICE_USD,
      scope: 'Proposed future offer: up to 10 bounded claims in a digest-bound JSON-LD and PDF evidence package. Checkout and purchase are disabled in this sprint.',
    },
  }
  return { ...body, resultSha256: provenanceDigest(body) }
}

export function verifyEvidencePreflightResult(result: EvidencePreflightResult): string[] {
  const { resultSha256, ...body } = result
  const findings: string[] = []
  if (result.schemaVersion !== EVIDENCE_PREFLIGHT_SCHEMA_VERSION) findings.push('schema-version-mismatch')
  if (result.independentSourceInspectionPerformed !== false) findings.push('source-inspection-claim-forbidden')
  if (result.contentRetainedByMaha !== false) findings.push('content-retention-claim-forbidden')
  if (provenanceDigest(body) !== resultSha256) findings.push('result-digest-mismatch')
  if (result.assessments.some((entry) => !['metadata-only', 'user-supplied-unlocated-excerpt', 'user-supplied-located-excerpt'].includes(entry.evidenceStatus))) findings.push('evidence-status-invalid')
  return findings
}
