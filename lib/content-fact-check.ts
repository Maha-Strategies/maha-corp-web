// Policy-safe editorial fact-check assistant (pure, deterministic).
//
// It improves EVIDENCE QUALITY; it never asserts a claim is true or false. Each
// claim is classified only by the sufficiency and posture of the evidence the
// EDITOR supplied — the model's own knowledge is never used as evidence, no
// citation is invented, and nothing is browsed. Source quality, factual truth,
// recency, and appropriateness remain human judgments; this module only flags
// what a human must still check and blocks nothing on its own without a human.

import { createHash, randomUUID } from 'node:crypto'

export const FACT_CHECK_CLASSIFICATIONS = ['supported', 'insufficient_evidence', 'contradicted', 'interpretation', 'time_sensitive'] as const
export type FactCheckClassification = (typeof FACT_CHECK_CLASSIFICATIONS)[number]

export const FACT_CHECK_ACTIONS = ['retain_with_attribution', 'qualify', 'revise', 'remove', 'verify_manually'] as const
export type FactCheckAction = (typeof FACT_CHECK_ACTIONS)[number]

// Editor evidence source types. Strong evidence is primary/official/public_data;
// vendor SEO and editorial commentary are WEAK (penalized, never auto-rejected).
export const FACT_CHECK_SOURCE_TYPES = ['primary', 'official', 'public_data', 'internal', 'industry', 'vendor_seo', 'editorial_commentary'] as const
export type FactCheckSourceType = (typeof FACT_CHECK_SOURCE_TYPES)[number]
const STRONG_SOURCES = new Set<FactCheckSourceType>(['primary', 'official', 'public_data'])
const WEAK_SOURCES = new Set<FactCheckSourceType>(['vendor_seo', 'editorial_commentary'])

// Text markers that make a claim time-sensitive (must be human-re-checked for recency).
const TIME_MARKERS = /\b(today|yesterday|tomorrow|currently|current|now|as of|latest|recent(?:ly)?|this (?:year|month|week|quarter)|year-to-date|ytd|upcoming|so far)\b/i

export type FactCheckSource = { url: string; title: string; sourceType: FactCheckSourceType; publishedOn: string; note: string }
export type FactCheckClaimInput = { claimText: unknown; classification: unknown; citedUrls: unknown; rationale: unknown }
export type ClaimRisk = 'high' | 'manual' | 'interpretation' | 'clear'

export type ClassifiedClaim = {
  index: number
  claimText: string
  classification: FactCheckClassification
  citedUrls: string[]
  rationale: string
  requiredAction: FactCheckAction
  risk: ClaimRisk
  weakEvidence: boolean
}

export type FactCheckCounts = {
  total: number
  supported: number
  insufficientEvidence: number
  contradicted: number
  interpretation: number
  timeSensitive: number
  weakEvidence: number
  highRisk: number
}

export function contentFactCheckId(): string { return `contentfc_${randomUUID().replaceAll('-', '')}` }
export function contentFactCheckHash(value: string): string { return `sha256:${createHash('sha256').update(value).digest('hex')}` }

function text(value: unknown, field: string, min: number, max: number, singleLine = true): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const parsed = singleLine ? value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : value.trim()
  if (parsed.length < min || parsed.length > max) throw new Error(`${field} must contain between ${min} and ${max} characters.`)
  return parsed
}
function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) throw new Error(`${field} must be an ISO date (YYYY-MM-DD).`)
  return value
}
function httpsUrl(value: unknown, field: string): string {
  const raw = text(value, field, 8, 2_000)
  let url: URL
  try { url = new URL(raw) } catch { throw new Error(`${field} must be an absolute HTTPS URL.`) }
  if (url.protocol !== 'https:') throw new Error(`${field} must be an absolute HTTPS URL.`)
  return url.toString()
}

// Editor-added evidence sources (beyond the approved package). HTTPS + full metadata.
export function parseEditorSources(value: unknown): FactCheckSource[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 20) throw new Error('editorSources must be an array of up to 20 sources.')
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`editorSources[${index}] must be an object.`)
    const record = item as Record<string, unknown>
    if (typeof record.sourceType !== 'string' || !(FACT_CHECK_SOURCE_TYPES as readonly string[]).includes(record.sourceType)) throw new Error(`editorSources[${index}].sourceType is not supported.`)
    return {
      url: httpsUrl(record.url, `editorSources[${index}].url`),
      title: text(record.title, `editorSources[${index}].title`, 3, 240),
      sourceType: record.sourceType as FactCheckSourceType,
      publishedOn: isoDate(record.publishedOn, `editorSources[${index}].publishedOn`),
      note: text(record.note, `editorSources[${index}].note`, 3, 750),
    }
  })
}

// Build the ALLOWED evidence pool: the draft's approved package plus editor sources.
// A claim may cite nothing outside this pool (prevents invented citations).
export function buildAllowedSources(
  candidateEvidence: { url: string; sourceType: string }[],
  editorSources: FactCheckSource[],
): Map<string, FactCheckSourceType> {
  const allowed = new Map<string, FactCheckSourceType>()
  for (const item of candidateEvidence) {
    let normalized: string
    try { normalized = new URL(item.url).toString() } catch { continue }
    if (new URL(normalized).protocol !== 'https:') continue
    allowed.set(normalized, (FACT_CHECK_SOURCE_TYPES as readonly string[]).includes(item.sourceType) ? item.sourceType as FactCheckSourceType : 'internal')
  }
  for (const source of editorSources) allowed.set(source.url, source.sourceType)
  return allowed
}

function derivedAction(classification: FactCheckClassification): FactCheckAction {
  switch (classification) {
    case 'contradicted': return 'revise'
    case 'insufficient_evidence': return 'verify_manually'
    case 'time_sensitive': return 'verify_manually'
    case 'interpretation': return 'retain_with_attribution'
    case 'supported': return 'retain_with_attribution'
  }
}

// Classify ONE claim from the editor's proposal + cited sources, correcting the
// classification to enforce evidence discipline. The tool may only make a claim
// LOOK BETTER-EVIDENCED downgrade, never upgrade: a "supported" claim with no
// strong (primary/official/public_data) source becomes insufficient_evidence.
export function classifyClaim(index: number, input: FactCheckClaimInput, allowed: Map<string, FactCheckSourceType>): ClassifiedClaim {
  const claimText = text(input.claimText, `claims[${index}].claimText`, 8, 600)
  const rationale = text(input.rationale, `claims[${index}].rationale`, 3, 1_000)
  if (typeof input.classification !== 'string' || !(FACT_CHECK_CLASSIFICATIONS as readonly string[]).includes(input.classification)) {
    throw new Error(`claims[${index}].classification is not supported.`)
  }
  const proposed = input.classification as FactCheckClassification

  if (!Array.isArray(input.citedUrls)) throw new Error(`claims[${index}].citedUrls must be an array.`)
  const citedUrls: string[] = []
  for (const raw of input.citedUrls) {
    const url = httpsUrl(raw, `claims[${index}].citedUrls`)
    if (!allowed.has(url)) throw new Error(`claims[${index}] cites a URL that is not in the approved evidence package or editor sources.`)
    if (!citedUrls.includes(url)) citedUrls.push(url)
  }

  const citedTypes = citedUrls.map((url) => allowed.get(url)!)
  const hasAny = citedUrls.length > 0
  const hasStrong = citedTypes.some((type) => STRONG_SOURCES.has(type))
  const weakEvidence = hasAny && citedTypes.every((type) => WEAK_SOURCES.has(type))
  const timeSensitive = proposed === 'time_sensitive' || TIME_MARKERS.test(claimText)

  let classification: FactCheckClassification
  if (proposed === 'contradicted') classification = 'contradicted'
  else if (!hasAny) classification = 'insufficient_evidence' // missing evidence → failure
  else if (timeSensitive) classification = 'time_sensitive' // must be re-checked for recency
  else if (proposed === 'interpretation') classification = 'interpretation'
  else if (proposed === 'supported') classification = hasStrong ? 'supported' : 'insufficient_evidence' // missing primary → failure
  else classification = 'insufficient_evidence'

  const risk: ClaimRisk = classification === 'contradicted' || classification === 'insufficient_evidence'
    ? 'high'
    : classification === 'time_sensitive' ? 'manual' : classification === 'interpretation' ? 'interpretation' : 'clear'

  return { index, claimText, classification, citedUrls, rationale, requiredAction: derivedAction(classification), risk, weakEvidence }
}

export function factCheckCounts(claims: ClassifiedClaim[]): FactCheckCounts {
  const counts: FactCheckCounts = { total: claims.length, supported: 0, insufficientEvidence: 0, contradicted: 0, interpretation: 0, timeSensitive: 0, weakEvidence: 0, highRisk: 0 }
  for (const claim of claims) {
    if (claim.classification === 'supported') counts.supported += 1
    if (claim.classification === 'insufficient_evidence') counts.insufficientEvidence += 1
    if (claim.classification === 'contradicted') counts.contradicted += 1
    if (claim.classification === 'interpretation') counts.interpretation += 1
    if (claim.classification === 'time_sensitive') counts.timeSensitive += 1
    if (claim.weakEvidence) counts.weakEvidence += 1
    if (claim.risk === 'high') counts.highRisk += 1
  }
  return counts
}

// Deterministic claim-verification READINESS score (separate from the structural
// publication score). 100 minus evidence-discipline penalties; a review with no
// claims is not ready (0).
export function factCheckReadinessScore(claims: ClassifiedClaim[]): number {
  if (claims.length === 0) return 0
  const counts = factCheckCounts(claims)
  const penalty = counts.contradicted * 25 + counts.insufficientEvidence * 15 + counts.timeSensitive * 8 + counts.weakEvidence * 5
  return Math.max(0, Math.min(100, 100 - penalty))
}

export type FactCheckReview = { claims: ClassifiedClaim[]; readinessScore: number; counts: FactCheckCounts }

export function reviewFactCheck(input: {
  candidateEvidence: { url: string; sourceType: string }[]
  editorSources: FactCheckSource[]
  claims: FactCheckClaimInput[]
}): FactCheckReview {
  if (!Array.isArray(input.claims) || input.claims.length < 1 || input.claims.length > 40) throw new Error('claims must contain between 1 and 40 items.')
  const allowed = buildAllowedSources(input.candidateEvidence, input.editorSources)
  const claims = input.claims.map((claim, index) => classifyClaim(index, claim, allowed))
  return { claims, readinessScore: factCheckReadinessScore(claims), counts: factCheckCounts(claims) }
}

// The combined publication-eligibility gate. Requires the EXISTING structural
// gate AND the fact-check gate AND a human acknowledgement. Returns machine
// reasons for every failing condition; never decides truth.
export type PublicationEligibility = { eligible: boolean; reasons: string[] }
export function publicationEligibility(input: {
  structuralScore: number
  structuralHardBlockersClear: boolean
  factCheckReviewed: boolean
  highRiskOpen: number
  acknowledged: boolean
}): PublicationEligibility {
  const reasons: string[] = []
  if (input.structuralScore < 70) reasons.push('structural_score_below_70')
  if (!input.structuralHardBlockersClear) reasons.push('structural_hard_blockers_open')
  if (!input.factCheckReviewed) reasons.push('fact_check_review_missing')
  if (input.highRiskOpen > 0) reasons.push('unresolved_contradicted_or_insufficient_claims')
  if (!input.acknowledged) reasons.push('reviewer_acknowledgement_missing')
  return { eligible: reasons.length === 0, reasons }
}

// Fail-closed guard for the OPTIONAL model-assisted claim extraction. Extraction
// must be explicitly enabled AND have a provider key; otherwise it is unavailable
// (no Anthropic call, no customer credits). Truth is still never asserted.
export function factCheckExtractionGuard(env: NodeJS.ProcessEnv): { enabled: boolean; reason: string } {
  if (env.EDITORIAL_FACTCHECK_EXTRACTION_ENABLED !== 'true') return { enabled: false, reason: 'extraction_disabled' }
  if (!env.ANTHROPIC_API_KEY) return { enabled: false, reason: 'provider_unavailable' }
  return { enabled: true, reason: 'ok' }
}
