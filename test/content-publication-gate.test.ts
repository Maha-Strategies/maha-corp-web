import assert from 'node:assert/strict'
import test from 'node:test'

import { contentCandidateHash, contentCandidateId, contentQualityScore, parseContentCandidate, parseContentCandidateAction } from '../lib/content-publication-gate.ts'

const candidate = {
  topicCluster: 'mps_claim_verification', proposedPath: '/mps/claim-verification-for-ai-content',
  readerQuestion: 'How can a research team verify factual claims in AI-generated content before publication?',
  readerOutcome: 'A research lead can choose a repeatable, evidence-tagged process for checking claims before publishing.',
  originalValue: 'Maha will compare its MPS audit workflow against a manual citation review and explain the decision criteria, limits, and evidence trail created by each approach.',
  authorAttribution: 'Mayone Maha Rajan',
  evidence: [
    { url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', title: 'People-first content guidance', sourceType: 'official' as const, publishedOn: '2026-01-10', note: 'Defines useful, attributable content expectations.' },
    { url: 'https://www.nist.gov/itl/ai-risk-management-framework', title: 'AI Risk Management Framework', sourceType: 'official' as const, publishedOn: '2025-02-01', note: 'Provides a public risk-management reference point.' },
    { url: 'https://arxiv.org/abs/2305.18248', title: 'Retrieval-Augmented Generation', sourceType: 'primary' as const, publishedOn: '2023-05-29', note: 'Describes evidence retrieval patterns relevant to claim support.' },
  ],
  policyChecks: { readerFirst: true, originalAnalysis: true, notDoorway: true, attributionComplete: true, humanReviewRequired: true },
  idempotencyKey: 'content-candidate-create-001',
}

test('accepts an evidence-backed, policy-complete content candidate', () => {
  const parsed = parseContentCandidate(candidate)
  assert.equal(parsed.qualityScore, 90)
  assert.match(contentCandidateId(), /^contentcand_[a-f0-9]{32}$/)
  assert.match(contentCandidateHash('content-candidate-create-001'), /^sha256:[a-f0-9]{64}$/)
})

test('refuses doorway-like paths, shallow evidence, and untrusted ready scores', () => {
  assert.throws(() => parseContentCandidate({ ...candidate, proposedPath: '/MPS/Claim' }), /proposedPath/)
  assert.throws(() => parseContentCandidate({ ...candidate, evidence: candidate.evidence.slice(0, 2) }), /between 3 and 5/)
  assert.throws(() => parseContentCandidate({ ...candidate, evidence: candidate.evidence.map((item) => ({ ...item, url: 'https://example.com/a' })) }), /independent source domains/)
  assert.equal(contentQualityScore({ evidence: candidate.evidence, policyChecks: { ...candidate.policyChecks, notDoorway: false }, originalValue: candidate.originalValue, readerOutcome: candidate.readerOutcome }, new Date('2026-07-21T00:00:00Z')), 80)
})

test('limits operations to human draft approval or withholding', () => {
  const id = 'contentcand_1234567890abcdef1234567890abcdef'
  assert.equal(parseContentCandidateAction({ candidateId: id, action: 'approve_draft', idempotencyKey: 'approve-content-001' }).action, 'approve_draft')
  assert.throws(() => parseContentCandidateAction({ candidateId: id, action: 'publish', idempotencyKey: 'publish-content-001' }), /action/)
})
