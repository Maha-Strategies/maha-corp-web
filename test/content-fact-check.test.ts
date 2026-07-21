import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyClaim, buildAllowedSources, factCheckExtractionGuard, factCheckReadinessScore,
  publicationEligibility, reviewFactCheck, type FactCheckClaimInput,
} from '../lib/content-fact-check.ts'

const PRIMARY = 'https://primary.example.com/report'
const OFFICIAL = 'https://official.example.gov/data'
const VENDOR = 'https://vendor.example.com/seo-page'

const candidateEvidence = [
  { url: PRIMARY, sourceType: 'primary' },
  { url: OFFICIAL, sourceType: 'official' },
  { url: VENDOR, sourceType: 'vendor_seo' },
]
const allowed = buildAllowedSources(candidateEvidence, [])

function claim(over: Partial<FactCheckClaimInput> = {}): FactCheckClaimInput {
  return { claimText: 'The dataset covers 12 million records across three regions.', classification: 'supported', citedUrls: [PRIMARY], rationale: 'Cited primary dataset.', ...over }
}

// ---- Classification (never true/false) ----
test('supported requires a strong source; otherwise it becomes insufficient_evidence', () => {
  const strong = classifyClaim(0, claim({ classification: 'supported', citedUrls: [PRIMARY] }), allowed)
  assert.equal(strong.classification, 'supported')
  assert.equal(strong.risk, 'clear')
  assert.equal(strong.requiredAction, 'retain_with_attribution')

  // "supported" but only a weak (vendor SEO) source → downgraded, not rejected.
  const weak = classifyClaim(0, claim({ classification: 'supported', citedUrls: [VENDOR] }), allowed)
  assert.equal(weak.classification, 'insufficient_evidence')
  assert.equal(weak.weakEvidence, true)
  assert.equal(weak.risk, 'high')
})

test('no cited source is always insufficient_evidence (missing evidence = failure)', () => {
  const none = classifyClaim(0, claim({ classification: 'supported', citedUrls: [] }), allowed)
  assert.equal(none.classification, 'insufficient_evidence')
  assert.equal(none.risk, 'high')
  assert.equal(none.requiredAction, 'verify_manually')
})

test('contradicted is preserved and is high-risk', () => {
  const c = classifyClaim(0, claim({ classification: 'contradicted', citedUrls: [OFFICIAL], rationale: 'Official source states the opposite figure.' }), allowed)
  assert.equal(c.classification, 'contradicted')
  assert.equal(c.risk, 'high')
  assert.equal(c.requiredAction, 'revise')
})

test('time-sensitive is detected from text markers or the editor, and is manual-review', () => {
  const marker = classifyClaim(0, claim({ classification: 'supported', citedUrls: [PRIMARY], claimText: 'As of now the adoption rate is climbing quickly.' }), allowed)
  assert.equal(marker.classification, 'time_sensitive')
  assert.equal(marker.risk, 'manual')
  assert.equal(marker.requiredAction, 'verify_manually')

  const explicit = classifyClaim(0, claim({ classification: 'time_sensitive', citedUrls: [PRIMARY], claimText: 'The regional totals are evenly split.' }), allowed)
  assert.equal(explicit.classification, 'time_sensitive')
})

test('interpretation stays interpretation and is low-risk', () => {
  const i = classifyClaim(0, claim({ classification: 'interpretation', citedUrls: [PRIMARY], claimText: 'This pattern suggests a durable shift in buyer behavior.' }), allowed)
  assert.equal(i.classification, 'interpretation')
  assert.equal(i.risk, 'interpretation')
  assert.equal(i.requiredAction, 'retain_with_attribution')
})

// ---- Evidence boundaries ----
test('a citation outside the approved package or editor sources is rejected (no invented citations)', () => {
  assert.throws(() => classifyClaim(0, claim({ citedUrls: ['https://elsewhere.example.com/x'] }), allowed), /not in the approved evidence package/)
})
test('non-HTTPS citations are rejected', () => {
  assert.throws(() => classifyClaim(0, claim({ citedUrls: ['http://primary.example.com/report'] }), allowed), /HTTPS/)
})
test('editor sources extend the allowed pool', () => {
  const withEditor = buildAllowedSources(candidateEvidence, [{ url: 'https://added.example.org/study', title: 'Added study', sourceType: 'public_data', publishedOn: '2026-01-01', note: 'Editor-added primary dataset.' }])
  const c = classifyClaim(0, claim({ classification: 'supported', citedUrls: ['https://added.example.org/study'] }), withEditor)
  assert.equal(c.classification, 'supported')
})

// ---- Readiness score (separate from structural score) ----
test('factCheckReadinessScore penalizes by evidence discipline; empty review is 0', () => {
  assert.equal(factCheckReadinessScore([]), 0)
  const review = reviewFactCheck({
    candidateEvidence, editorSources: [],
    claims: [
      claim({ classification: 'contradicted', citedUrls: [OFFICIAL], rationale: 'Contradicted by official source.' }), // -25
      claim({ classification: 'supported', citedUrls: [] }), // insufficient -15
    ],
  })
  assert.equal(review.readinessScore, 60)
  assert.equal(review.counts.highRisk, 2)
  assert.equal(review.counts.contradicted, 1)
  assert.equal(review.counts.insufficientEvidence, 1)
})

test('reviewFactCheck requires 1..40 claims', () => {
  assert.throws(() => reviewFactCheck({ candidateEvidence, editorSources: [], claims: [] }), /between 1 and 40/)
})

// ---- Combined eligibility gate ----
test('publicationEligibility requires structural + fact-check + acknowledgement', () => {
  const ok = publicationEligibility({ structuralScore: 80, structuralHardBlockersClear: true, factCheckReviewed: true, highRiskOpen: 0, acknowledged: true })
  assert.deepEqual(ok, { eligible: true, reasons: [] })

  assert.deepEqual(publicationEligibility({ structuralScore: 69, structuralHardBlockersClear: true, factCheckReviewed: true, highRiskOpen: 0, acknowledged: true }).reasons, ['structural_score_below_70'])
  assert.deepEqual(publicationEligibility({ structuralScore: 80, structuralHardBlockersClear: false, factCheckReviewed: true, highRiskOpen: 0, acknowledged: true }).reasons, ['structural_hard_blockers_open'])
  assert.deepEqual(publicationEligibility({ structuralScore: 80, structuralHardBlockersClear: true, factCheckReviewed: false, highRiskOpen: 0, acknowledged: true }).reasons, ['fact_check_review_missing'])
  assert.deepEqual(publicationEligibility({ structuralScore: 80, structuralHardBlockersClear: true, factCheckReviewed: true, highRiskOpen: 2, acknowledged: true }).reasons, ['unresolved_contradicted_or_insufficient_claims'])
  assert.deepEqual(publicationEligibility({ structuralScore: 80, structuralHardBlockersClear: true, factCheckReviewed: true, highRiskOpen: 0, acknowledged: false }).reasons, ['reviewer_acknowledgement_missing'])
})

// ---- Model-assisted extraction fails closed ----
test('factCheckExtractionGuard fails closed unless explicitly enabled with a provider key', () => {
  assert.deepEqual(factCheckExtractionGuard({} as NodeJS.ProcessEnv), { enabled: false, reason: 'extraction_disabled' })
  assert.deepEqual(factCheckExtractionGuard({ EDITORIAL_FACTCHECK_EXTRACTION_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv), { enabled: false, reason: 'provider_unavailable' })
  assert.deepEqual(factCheckExtractionGuard({ EDITORIAL_FACTCHECK_EXTRACTION_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv), { enabled: true, reason: 'ok' })
})
