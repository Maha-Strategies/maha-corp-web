import test from 'node:test'
import assert from 'node:assert/strict'
import { payableOffers } from '../lib/x402/offers.ts'
import { BAZAAR_LAUNCH_IDS, BAZAAR_PREVIOUS_AMOUNTS } from '../lib/x402/bazaar-launch.ts'
import { selected, COMPLETED_LAUNCH_PAYMENT, refreshRequest } from '../scripts/run-bazaar-listing-refresh.ts'
import { createHash } from 'node:crypto'
import { readAdmissionClaim } from '../lib/x402/admission.ts'
import { validateAdmissionBody } from '../lib/x402/admission-body.ts'

test('final two exclude all21 paid offers and supply server-valid MPS admission headers', async () => {
  const final = selected('launch-final-two')
  assert.deepEqual(final.map(o => o.id), ['mps-autonomous-audit', 'governed-context-verification-pack'])
  assert.equal(final.reduce((n, o) => n + BigInt(o.amount), BigInt(0)), BigInt(750000))
  const offer = final[0]
  const prepared = refreshRequest(offer)
  const request = new Request('https://www.mahastrategies.com' + offer.path, { method: 'POST', headers: prepared.headers, body: JSON.stringify(prepared.body) })
  const claim = readAdmissionClaim(request.headers, offer, request.url)
  assert.ok(claim.ok)
  assert.deepEqual(await validateAdmissionBody(request, offer, claim.claim), { ok: true })
  assert.equal(prepared.headers['x-maha-idempotency-key'], prepared.body.clientRequestId)
  assert.notEqual(prepared.headers['x-maha-input-hash'], `sha256:${createHash('sha256').update(JSON.stringify(prepared.body)).digest('hex')}`)
  const wrong = { ...claim.claim, inputHash: 'sha256:' + '0'.repeat(64) }
  assert.equal((await validateAdmissionBody(request, offer, wrong)).ok, false)
  assert.equal(refreshRequest(final[1]).headers['x-maha-input-hash'], undefined)
})

test('reconciled continuation excludes the settled purchase and caps the remaining spend', () => {
  const remaining = selected('launch-remaining')
  assert.equal(remaining.length, 22)
  assert.ok(remaining.every(o => o.id !== COMPLETED_LAUNCH_PAYMENT.offerId))
  assert.equal(remaining.reduce((s, o) => s + BigInt(o.amount), BigInt(0)), BigInt(1_274_000))
  assert.equal(BigInt(COMPLETED_LAUNCH_PAYMENT.amount) + BigInt(1_274_000), BigInt(1_280_000))
})

test('approved launch is exactly 23 offers, all below one dollar, total 1.28 USDC', () => {
  const cohort = selected('launch')
  assert.equal(cohort.length, 23)
  assert.deepEqual(cohort.map(o => o.id).sort(), [...BAZAAR_LAUNCH_IDS].sort())
  assert.equal(cohort.reduce((s, o) => s + BigInt(o.amount), BigInt(0)), BigInt(1_280_000))
  for (const o of cohort) {
    assert.ok(BigInt(o.amount) < BigInt(1_000_000))
    assert.ok(Buffer.byteLength(o.description) <= 480)
    assert.ok(o.discovery.input && o.discovery.output && o.discovery.inputSchema && o.discovery.outputSchema)
  }
})

test('old seven prices remain attributable and cannot collide with another current or old price', () => {
  const owners = new Map<string, string>()
  for (const o of payableOffers()) for (const amount of [o.amount, ...(o.supersededAmounts ?? [])]) {
    assert.ok(!owners.has(amount) || owners.get(amount) === o.id, amount)
    owners.set(amount, o.id)
  }
  for (const [id, old] of Object.entries(BAZAAR_PREVIOUS_AMOUNTS)) {
    for (const amount of old) assert.equal(owners.get(amount), id)
  }
})
