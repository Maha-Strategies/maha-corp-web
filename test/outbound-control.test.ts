import assert from 'node:assert/strict'
import test from 'node:test'

import { draftSuggestion, parseProspect, parseProspectAction, prospectFitScore } from '../lib/outbound-control.ts'

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
