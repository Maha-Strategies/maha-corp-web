import assert from 'node:assert/strict'
import test from 'node:test'

import { contentDraftHash, contentDraftId, parseContentDraft, parseContentDraftAction } from '../lib/content-draft-composer.ts'

const draft = { candidateId: 'contentcand_1234567890abcdef1234567890abcdef', title: 'How to audit AI-assisted writing before publishing', summary: 'A structured pre-publication process for checking claim provenance in AI-assisted writing before readers must rely on it.', directAnswer: 'Treat every factual claim as a separate review unit. Run the passage through the Auditor, identify its provenance status, verify named sources, and then cite, reword, or remove claims that remain unsupported. The process records what was checked without pretending the tool establishes truth from text alone.', method: 'Start with the complete passage and preserve the original text. Review each tagged claim against its cited source or evidence record, then decide whether to retain it with a source, qualify it, reword it, or remove it. Keep the Auditor output with the editorial record so another reviewer can reproduce the provenance review.', artifactUrl: 'https://www.mahastrategies.com/audit', artifactLabel: 'MPS Auditor', limitations: 'The Auditor records provenance signals and review boundaries. It does not independently establish whether a claim is true, complete, current, or suitable for a particular reader.', editorialReviewer: 'Mayone Maha Rajan', idempotencyKey: 'compose-draft-001' }

test('parses an approved-candidate draft with optional evidence modules', () => {
  assert.equal(parseContentDraft(draft).artifactLabel, 'MPS Auditor')
  assert.match(contentDraftId(), /^contentdraft_[a-f0-9]{32}$/)
  assert.match(contentDraftHash('compose-draft-001'), /^sha256:[a-f0-9]{64}$/)
})

test('refuses a missing paired artifact and public publish action', () => {
  assert.throws(() => parseContentDraft({ ...draft, artifactLabel: '' }), /together/)
  assert.throws(() => parseContentDraftAction({ draftId: 'contentdraft_1234567890abcdef1234567890abcdef', action: 'publish', idempotencyKey: 'publish-draft-001' }), /action/)
})
