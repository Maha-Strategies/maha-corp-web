import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { contactService, OFFER_BY_SERVICE, SERVICE_OPTIONS } from '../lib/contact-services.ts'
import { parseInboundSubmission, routeInboundSubmission } from '../lib/inbound-gatekeeper.ts'
import { REVENUE_OFFERS, routeRevenueSignal } from '../lib/revenue-control-plane.ts'

test('query selection preserves supported services and safely defaults unknown values', () => {
  for (const option of SERVICE_OPTIONS) assert.equal(contactService(option.value), option.value)
  for (const value of [null, '', 'unknown', 'toString', '__proto__']) assert.equal(contactService(value), 'verified_research')
})

test('partnership selection survives validation and both human-review routing stages', () => {
  const offerId = OFFER_BY_SERVICE[contactService('partnership_assessment')]
  assert.equal(offerId, 'partnership-assessment')
  const submission = parseInboundSubmission({ idempotencyKey: 'synthetic-partnership-001', offerId,
    requester: { name: 'Test Person', email: 'test@example.com', organization: 'Test Project' },
    decision: 'Evaluate our document review workflow.', question: 'Can we assess the evidence layer for our document workflow?', requesterAuthorized: true })
  assert.equal(submission.offerId, offerId)
  assert.equal(routeInboundSubmission(submission).route, 'human_scope_review')
  const routing = routeRevenueSignal({ sourceType: 'website_contact', sourceReference: 'synthetic-test', offerId })
  assert.equal(routing.route, 'human_scope_review')
  assert.equal(routing.offer.name, REVENUE_OFFERS[offerId].name)
  const schema = JSON.parse(readFileSync(new URL('../public/inbound-submission-schema.json', import.meta.url), 'utf8'))
  assert.ok(schema.properties.offerId.enum.includes(offerId))
})

test('partnership migration preserves existing ledger offer allowlists', () => {
  const previous = readFileSync(new URL('../supabase/migrations/20260831164500_allow_evidence_audit_inbound_offer.sql', import.meta.url), 'utf8')
  const migration = readFileSync(new URL('../supabase/migrations/20261001090000_allow_partnership_assessment_inbound_offer.sql', import.meta.url), 'utf8')
  for (const table of ['inbound_submissions', 'revenue_opportunities']) {
    const constraint = `${table}_offer_id_check check (offer_id in (`
    const values = (sql: string) => sql.split(constraint)[1].split('));')[0].match(/'[^']+'/g) ?? []
    assert.deepEqual(values(migration).filter(value => value !== "'partnership-assessment'"), values(previous))
    assert.ok(values(migration).includes("'partnership-assessment'"))
  }
})
