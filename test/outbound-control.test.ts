import assert from 'node:assert/strict'
import test from 'node:test'

import { draftSuggestion, parseDraftRevision, parseProviderSend, parseProspect, parseProspectAction, prospectFitScore } from '../lib/outbound-control.ts'

const prospect = {
  sourceKind: 'market_opportunity', sourceReference: 'mapopp_1234567890abcdef1234567890abcdef', companyName: 'Example Research LLC', companyWebsite: 'https://example.com', contactName: 'Jordan Example', contactEmail: 'jordan@example.com', contactRole: 'Research Lead', contactBasis: 'public_business_contact', offerId: 'mps-prepaid-audit-access', relevanceNote: 'The company publishes AI-assisted research and has publicly described a need for a claim-review workflow.', idempotencyKey: 'outbound-prospect-001',
}

test('prospects require a bounded business context and have a transparent readiness score', () => {
  const parsed = parseProspect(prospect)
  assert.equal(parsed.contactEmail, 'jordan@example.com')
  assert.equal(prospectFitScore(parsed), 90)
  assert.throws(() => parseProspect({ ...prospect, companyWebsite: 'http://example.com' }), /HTTPS/)
  assert.throws(() => parseProspect({ ...prospect, contactBasis: 'scraped_personal_data' }), /contactBasis/)
})

test('draft suggestion is editable and never claims to send outreach', () => {
  const draft = draftSuggestion(parseProspect(prospect))
  assert.match(draft.subject, /Example Research/)
  assert.match(draft.body, /no response is needed/)
  assert.doesNotMatch(draft.body, /send/i)
  assert.equal(parseProspectAction({ prospectId: 'prospect_1234567890abcdef1234567890abcdef', action: 'prepare_draft', idempotencyKey: 'prepare-draft-001' }).action, 'prepare_draft')
})

test('WSO2 drafts describe a bounded evaluation rather than an endorsement', () => {
  const draft = draftSuggestion(parseProspect({ ...prospect, offerId: 'wso2-context-compiler-pilot' }))
  assert.match(draft.body, /bounded WSO2 Context Compiler evaluation/)
  assert.doesNotMatch(draft.body, /endorsed|approved by WSO2/i)
})

test('draft revision is bounded and provider send requires the exact draft-specific phrase', () => {
  const draftId = 'outdraft_1234567890abcdef1234567890abcdef'
  assert.equal(parseDraftRevision({ action: 'revise_draft', draftId, subject: 'A bounded evaluation', body: 'This is a deliberately reviewable message body for one recipient.', idempotencyKey: 'revise-draft-001' }).subject, 'A bounded evaluation')
  assert.equal(parseProviderSend({ action: 'send_approved', draftId, confirmation: `SEND ${draftId}`, idempotencyKey: 'send-draft-001' }).draftId, draftId)
  assert.throws(() => parseProviderSend({ action: 'send_approved', draftId, confirmation: 'SEND outdraft_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', idempotencyKey: 'send-draft-002' }), /exactly match/)
})
