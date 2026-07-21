import assert from 'node:assert/strict'
import test from 'node:test'

import { parseContentDraftSuggestion } from '../lib/content-draft-assistant.ts'
import { sourceMetadataWarnings } from '../lib/content-source-quality.ts'

const suggestion = {
  title: 'How editorial teams can review AI-assisted claims before publication',
  summary: 'A structured claim-level workflow for editorial teams that need to distinguish citation, attribution, and factual verification before relying on AI-assisted writing in a public document.',
  directAnswer: 'Review the draft one claim at a time rather than treating fluent prose as evidence. For every fact, number, quotation, attribution, or causal statement a reader could rely on, record the supporting source and the review status. Keep what is sourced, qualify what remains uncertain, and remove claims that cannot be supported by the evidence package before the editorial decision is made.',
  method: 'Begin with the original draft and preserve it as the review baseline. Identify each substantive claim, connect it to a named source in the evidence package, and record whether the claim is sourced, verified by the reviewer, bounded by uncertainty, or unsupported. Retain the claim-level record with the draft, resolve ambiguous language, and make the publication decision only after a human editor has reviewed the remaining limitations and the source trail.',
  limitations: 'This workflow records the evidence and review performed for a claim. It does not independently certify truth, completeness, legal compliance, currentness, or suitability for a particular audience. A qualified human editor remains responsible for the final judgment and publication decision.',
}

test('a complete assistant response is accepted as a private draft suggestion', () => {
  assert.equal(parseContentDraftSuggestion(suggestion).title, suggestion.title)
})

test('placeholder citations are surfaced rather than treated as publication-ready metadata', () => {
  assert.equal(sourceMetadataWarnings([{ url: 'https://example.com', title: 'Source one', note: 'What this source establishes for the reader.' }]).length, 2)
})
