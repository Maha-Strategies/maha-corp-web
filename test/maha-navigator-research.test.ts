import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import {
  buildNavigatorQualityGate,
  evidenceFreshness,
  NAVIGATOR_CLAIM_TYPES,
  NAVIGATOR_RUBRIC_V1,
  parseNavigatorCandidate,
  type NavigatorDisposition,
} from '../lib/maha-navigator-research.ts'

const navigatorResearchSource = readFileSync(new URL('../lib/maha-navigator-research.ts', import.meta.url), 'utf8')

test('the browser-shared Navigator contract does not import Node crypto', () => {
  assert.doesNotMatch(navigatorResearchSource, /from ['"](?:node:)?crypto['"]/)
  assert.match(navigatorResearchSource, /crypto\.randomUUID\(\)/)
})

function candidate() {
  return {
    idempotencyKey: 'navigator-candidate:test-1',
    companyName: 'Example Agent Company',
    companyDomain: 'example.com',
    claims: NAVIGATOR_CLAIM_TYPES.map((type) => ({
      type,
      statement: `${type} claim supported by the linked public evidence.`,
      sourceUrl: `https://example.com/evidence/${type}#section`,
      sourcePublishedOn: '2026-07-01',
      observedOn: '2026-08-10',
      sourceQuality: 'primary',
      confidence: type === 'buying_trigger' ? 'high' : 'medium',
    })),
  }
}

test('Navigator candidate research keeps four evidence-backed claims separate', () => {
  const parsed = parseNavigatorCandidate(candidate())
  assert.equal(parsed.companyDomain, 'example.com')
  assert.equal(parsed.rubricVersion, 1)
  assert.deepEqual(parsed.claims.map((claim) => claim.type), NAVIGATOR_CLAIM_TYPES)
  assert.ok(parsed.claims.every((claim) => claim.sourceUrl === `https://example.com/evidence/${claim.type}#section`))
  assert.ok(parsed.claims.every((claim) => claim.freshness === 'current'))
  assert.equal(parsed.claims.find((claim) => claim.type === 'buying_trigger')?.confidence, 'high')
})

test('Navigator rejects duplicate claim types and non-HTTPS evidence', () => {
  const duplicate = candidate()
  duplicate.claims[3].type = 'account_fit'
  assert.throws(() => parseNavigatorCandidate(duplicate), /exactly one claim/)
  const insecure = candidate()
  insecure.claims[0].sourceUrl = 'http://example.com/evidence'
  assert.throws(() => parseNavigatorCandidate(insecure), /public HTTPS URL/)
})

test('evidence freshness remains distinct from confidence and source quality', () => {
  assert.equal(evidenceFreshness(null, '2026-08-10'), 'unknown')
  assert.equal(evidenceFreshness('2026-05-01', '2026-08-10'), 'aging')
  assert.equal(evidenceFreshness('2024-01-01', '2026-08-10'), 'stale')
  assert.throws(() => evidenceFreshness('2026-08-11', '2026-08-10'), /cannot be later/)
})

function rows(dispositions: NavigatorDisposition[]) {
  return dispositions.map((disposition, index) => ({ benchmarkPosition: index + 1, disposition }))
}

test('the quality gate cannot pass before all 20 accounts are reviewed', () => {
  const gate = buildNavigatorQualityGate(rows(Array.from({ length: 19 }, (_, index) => index < 15 ? 'pursue' : 'reject')))
  assert.equal(gate.state, 'collecting')
  assert.equal(gate.qualityGatePassed, false)
  assert.equal(gate.outreachAuthorized, false)
  assert.equal(gate.remaining, 1)
})

test('10 of the first 20 pursue decisions pass the conversation-worthy gate', () => {
  const gate = buildNavigatorQualityGate(rows([...Array<NavigatorDisposition>(10).fill('pursue'), ...Array<NavigatorDisposition>(5).fill('reject'), ...Array<NavigatorDisposition>(3).fill('insufficient_evidence'), ...Array<NavigatorDisposition>(2).fill('deferred')]))
  assert.equal(gate.state, 'passed')
  assert.equal(gate.conversationWorthyRate, 0.5)
  assert.equal(gate.qualityGatePassed, true)
  assert.equal(gate.outreachAuthorized, false)
  assert.equal(gate.counts.insufficient_evidence, 3)
})

test('uncertainty is not silently converted into a clean rejection label', () => {
  const gate = buildNavigatorQualityGate(rows([...Array<NavigatorDisposition>(9).fill('pursue'), ...Array<NavigatorDisposition>(6).fill('reject'), ...Array<NavigatorDisposition>(5).fill('insufficient_evidence')]))
  assert.equal(gate.state, 'failed')
  assert.equal(gate.counts.reject, 6)
  assert.equal(gate.counts.insufficient_evidence, 5)
  assert.equal(gate.qualityGatePassed, false)
})

test('the rubric defines fit, dated triggers, sponsor roles, and disqualifiers', () => {
  assert.equal(NAVIGATOR_RUBRIC_V1.qualityGate.reviewedAccounts, 20)
  assert.equal(NAVIGATOR_RUBRIC_V1.qualityGate.minimumPursue, 10)
  assert.ok(NAVIGATOR_RUBRIC_V1.idealAccountProfile.some((line) => line.includes('sponsor')))
  assert.ok(NAVIGATOR_RUBRIC_V1.buyingTriggers.some((line) => line.includes('launched')))
  assert.ok(NAVIGATOR_RUBRIC_V1.disqualifiers.some((line) => line.includes('asked not to be contacted')))
})
