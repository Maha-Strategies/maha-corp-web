import assert from 'node:assert/strict'
import test from 'node:test'

import { contentHandoffHash, contentHandoffId, publicationHandoff } from '../lib/content-publication-handoff.ts'

const candidate = { public_id: 'contentcand_1234567890abcdef1234567890abcdef', proposed_path: '/mps/audit-ai-writing-before-publishing', quality_score: 90, evidence: [{}, {}, {}], policy_checks: { readerFirst: true, originalAnalysis: true, notDoorway: true, attributionComplete: true, sourceIndependenceReviewed: true, humanReviewRequired: true }, status: 'approved_for_draft' }
const draft = { public_id: 'contentdraft_1234567890abcdef1234567890abcdef', candidate_id: candidate.public_id, title: 'How to audit AI-assisted writing before publishing a factual claim', summary: 'A structured, evidence-led pre-publication workflow for research and editorial teams that need to check AI-assisted writing before readers rely on its factual claims.', direct_answer: 'Treat every factual claim as a separate review unit. Run the complete passage through the Auditor, identify the provenance status for each claim, verify named sources, and then cite, qualify, reword, or remove claims that remain unsupported. Keep the resulting record with the editorial file so another reviewer can reproduce the provenance review and understand what the tool did not establish.', method: 'Start with the original passage and retain it unchanged in the review record. Review each tagged claim against a named primary source, official source, or accepted evidence record. Decide whether it should be retained with attribution, qualified for uncertainty, rewritten, or removed. Preserve the Auditor output with the editorial decision trail so that the workflow can be repeated and its review boundary remains explicit to later editors.', artifact_url: 'https://www.mahastrategies.com/audit', artifact_label: 'MPS Auditor', limitations: 'The Auditor records provenance signals and editorial review boundaries. It does not establish that a claim is true, complete, current, lawful, clinically valid, or appropriate for a particular reader. A qualified human reviewer remains responsible for those judgments.', editorial_reviewer: 'Mayone Maha Rajan', status: 'editorial_ready' }

test('a complete, approved evidence package clears the human-publication threshold', () => {
  const result = publicationHandoff({ candidate, draft })
  assert.equal(result.score, 97)
  assert.equal(result.decision, 'ready_for_human_publish')
  assert.match(contentHandoffId(), /^contenthandoff_[a-f0-9]{32}$/)
  assert.match(contentHandoffHash('handoff-001'), /^sha256:[a-f0-9]{64}$/)
})

test('an incomplete draft is withheld below the 70 release threshold', () => {
  const result = publicationHandoff({ candidate, draft: { ...draft, direct_answer: 'Too short', method: 'Also too short', limitations: null, artifact_url: null, artifact_label: null } })
  assert.ok(result.score < 70)
  assert.equal(result.decision, 'withheld')
})

test('a score above 70 remains withheld when a required release module is absent', () => {
  const result = publicationHandoff({ candidate, draft: { ...draft, limitations: null } })
  assert.ok(result.score >= 70)
  assert.equal(result.decision, 'withheld')
})
