import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildNavigatorCommercialFunnel,
  parseNavigatorCommercialOperation,
  type NavigatorCommercialEventRow,
  type NavigatorCommercialStage,
} from '../lib/navigator-commercial-loop.ts'

const candidateId = 'navacct_0123456789abcdef0123456789abcdef'

test('commercial operations retain categorical attribution but no message or payment identifier', () => {
  const parsed = parseNavigatorCommercialOperation({
    candidateId,
    stage: 'payment_confirmed',
    offerId: 'agent-infrastructure-compatibility-pack',
    referenceId: '0x0123456789abcdef',
    idempotencyKey: 'navigator-payment:test-1',
  })
  assert.equal(parsed.stage, 'payment_confirmed')
  assert.equal(parsed.offerId, 'agent-infrastructure-compatibility-pack')
  assert.equal(parsed.referenceId, '0x0123456789abcdef')
  assert.equal('messageBody' in parsed, false)
  assert.equal('email' in parsed, false)
  assert.equal('wallet' in parsed, false)
})

test('communication, offer, and settlement evidence have explicit requirements', () => {
  assert.throws(() => parseNavigatorCommercialOperation({ candidateId, stage: 'message_sent', idempotencyKey: 'navigator:test-1' }), /requires channel/)
  assert.throws(() => parseNavigatorCommercialOperation({ candidateId, stage: 'offer_inspected', idempotencyKey: 'navigator:test-2' }), /requires offerId/)
  assert.throws(() => parseNavigatorCommercialOperation({ candidateId, stage: 'delivery_succeeded', offerId: 'offer-1', idempotencyKey: 'navigator:test-3' }), /requires referenceId/)
  assert.throws(() => parseNavigatorCommercialOperation({ candidateId, stage: 'repeat_purchase', idempotencyKey: 'navigator:test-4' }), /not an operator-recordable/)
})

function event(candidate: string, stage: NavigatorCommercialStage, reference: string | null = null): NavigatorCommercialEventRow {
  return { candidate_id: candidate, stage, offer_id: null, channel: null, reference_hash: reference, created_at: '2026-08-11T00:00:00Z' }
}

test('the commercial loop counts distinct prospects and separately counts payments', () => {
  const second = 'navacct_abcdef0123456789abcdef0123456789'
  const report = buildNavigatorCommercialFunnel([
    event(candidateId, 'discovered'), event(candidateId, 'recommendation_approved'), event(candidateId, 'message_sent'),
    event(candidateId, 'reply_received'), event(candidateId, 'offer_inspected'), event(candidateId, 'payment_confirmed', 'sha256:' + '1'.repeat(64)),
    event(candidateId, 'payment_confirmed', 'sha256:' + '2'.repeat(64)), event(candidateId, 'delivery_succeeded'), event(candidateId, 'repeat_purchase'),
    event(second, 'discovered'), event(second, 'recommendation_approved'), event(second, 'message_sent'),
  ])
  assert.equal(report.stages.discovered, 2)
  assert.equal(report.stages.message_sent, 2)
  assert.equal(report.stages.payment_confirmed, 1)
  assert.equal(report.stages.repeat_purchase, 1)
  assert.equal(report.confirmedPayments, 2)
  assert.equal(report.conversions.discoveredToRecommendationApproved, 1)
  assert.equal(report.conversions.messageSentToReplyReceived, 0.5)
})

test('zero denominators produce unknown conversion rather than a false zero', () => {
  const report = buildNavigatorCommercialFunnel([])
  assert.equal(report.stages.discovered, 0)
  assert.equal(report.conversions.discoveredToRecommendationApproved, null)
})

test('the SQL ledger is append-only, auto-captures research stages, and derives repeat from two payments', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260811000100_navigator_commercial_loop.sql', import.meta.url), 'utf8')
  assert.match(sql, /revoke insert, update, delete, truncate[^;]+from service_role/i)
  assert.match(sql, /after insert on public\.navigator_research_candidates/i)
  assert.match(sql, /after update of disposition/i)
  assert.match(sql, /new\.disposition='pursue'/i)
  assert.match(sql, /count\(distinct reference_hash\)/i)
  assert.match(sql, /v_payment_count >= 2/i)
  assert.match(sql, /stage='delivery_succeeded'/i)
  assert.match(sql, /raw external identifier is not retained/i)
  assert.doesNotMatch(sql, /message_body|reply_text|email_address|wallet_address/i)
})
