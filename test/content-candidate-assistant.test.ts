import assert from 'node:assert/strict'
import test from 'node:test'

import { parseContentCandidateSuggestion, selectIndependentSources } from '../lib/content-candidate-assistant.ts'

const sources = selectIndependentSources([
  { url: 'https://www.nist.gov/example', title: 'NIST guidance for claim review', snippet: 'Official guidance describing how to document evidence and review boundaries for a claim.', publishedOn: '2026-01-05' },
  { url: 'https://www.nature.com/example', title: 'Research on generated citations', snippet: 'Primary research examining reliability limitations in generated citation workflows.', publishedOn: '2025-03-01' },
  { url: 'https://data.example.org/report', title: 'Public data on editorial review', snippet: 'A public report providing evidence about review practices and citation traceability.', publishedOn: '2025-08-11' },
])

test('retrieval keeps only independent, dated HTTPS sources', () => {
  assert.equal(sources.length, 3)
  assert.equal(sources[0].publishedOn, '2026-01-05')
})

test('candidate suggestions preserve retrieved sources and require one note per source', () => {
  const result = parseContentCandidateSuggestion({ proposedPath: '/mps/claim-review-for-ai-writing', readerQuestion: 'How can an editorial team review AI-assisted claims before readers rely on them?', readerOutcome: 'Readers receive a repeatable process for identifying claims, connecting them to sources, and documenting unresolved uncertainty before publication.', originalValue: 'Maha adds a claim-level MPS workflow that records review status and required editorial action rather than treating a fluent draft or a bare citation list as evidence of factual reliability.', sourceNotes: ['Explains the official review boundary and the expected documentation for evidence decisions.', 'Provides research context for citation reliability risks in generated or AI-assisted material.', 'Shows how public review records can improve traceability for editorial decisions.'] }, { topicCluster: 'mps_claim_verification', sources })
  assert.equal(result.evidence[0].title, 'NIST guidance for claim review')
  assert.equal(result.policyChecks.sourceIndependenceReviewed, false)
})
