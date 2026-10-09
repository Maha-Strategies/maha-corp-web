import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TARGETS, CONFIRMATION, assertCanaryRequirement, assertBookEvidenceChallenge } from '../scripts/run-book-evidence-five-indexing-canaries.ts'
import { offerById } from '../lib/x402/offers.ts'
import { BASE_NETWORK, BASE_USDC, MAHA_PAYEE } from '../lib/x402/discovery-payment-recipe.ts'
test('one exact five-product cohort totals the approved 0.255 USDC', () => {
  assert.equal(TARGETS.length, 5)
  assert.equal(TARGETS.reduce((sum, t) => sum + BigInt(t.amount), BigInt(0)), BigInt(255000))
  assert.equal(CONFIRMATION, 'PUBLISHER_FUNDED_BOOK_EVIDENCE_FIVE_ONCE_MAX_0_255_USDC')
  for (const t of TARGETS) {
    const o = offerById(t.id)!
    assert.equal(o.path, t.path); assert.equal(o.amount, t.amount); assert.equal(o.availability.payableInProduction, true)
    const resource = 'https://www.mahastrategies.com' + t.path
    const requirement = { scheme: 'exact', network: BASE_NETWORK, asset: BASE_USDC, payTo: MAHA_PAYEE, amount: t.amount, maxTimeoutSeconds: 60, extra: { name: 'USD Coin', version: '2' } }
    assert.doesNotThrow(() => assertCanaryRequirement(requirement, t, resource))
    const challenge = { x402Version: 2, accepts: [requirement], resource: { url: resource, description: o.description, mimeType: 'application/json' } }
    assert.doesNotThrow(() => assertBookEvidenceChallenge(challenge, t))
    for (const [field, value] of [['amount', '10000000'], ['network', 'eip155:1'], ['asset', '0x'+'0'.repeat(40)], ['payTo', '0x'+'0'.repeat(40)], ['scheme', 'upto']]) {
      assert.throws(() => assertCanaryRequirement({ ...requirement, [field]: value }, t, resource))
    }
    assert.throws(() => assertCanaryRequirement(requirement, t, resource + '/other'))
    assert.throws(() => assertBookEvidenceChallenge({ ...challenge, accepts: [requirement, requirement] }, t))
  }
})
test('spending requires first attempt, explicit confirmation and evidence; index lag never repays', () => {
  const source = readFileSync('scripts/run-book-evidence-five-indexing-canaries.ts', 'utf8')
  for (const gate of ['BOOK_EVIDENCE_CANARY_CONFIRMATION', "GITHUB_RUN_ATTEMPT !== '1'", 'second_signature_refused', 'second_challenge_refused', 'stopped_do_not_repay_without_reconciliation', 'exact_settlement_unconfirmed', 'payload_integrity_failed']) assert.ok(source.includes(gate), gate)
  assert.match(source, /if \(!args.includes\('--pay'\)\)/)
  assert.match(source, /classification: 'publisher-funded-indexing-canary'/)
  const workflow = readFileSync('.github/workflows/book-evidence-five-indexing-canaries.yml', 'utf8')
  assert.match(workflow, /workflow_dispatch:/); assert.doesNotMatch(workflow, /schedule:|push:/)
  assert.match(workflow, /github.run_attempt == 1/)
})
