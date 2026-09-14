import assert from 'node:assert/strict'
import test from 'node:test'
import { assessMusalaVariants, buildJyotishaReading, JYOTISHA_READING_PROFILE, verifyJyotishaReading } from '../lib/jyotisha-reading.ts'
import { handleJyotishaReading } from '../lib/jyotisha-reading-api.ts'
import { computeNatalChart } from '../lib/natal-chart.ts'
import { calculationDigest, SYNTHETIC_CALCULATION_INPUTS } from '../lib/x402/celestial-products.ts'

const input = { profile: JYOTISHA_READING_PROFILE, birthTimeUncertaintyMinutes: 0,
  calculation: SYNTHETIC_CALCULATION_INPUTS['celestial-chart-evidence'] }
test('reading is reproducible and verified against its exact request and content', () => {
  const result = buildJyotishaReading(input)
  assert.deepEqual(result, buildJyotishaReading(input))
  assert.equal(verifyJyotishaReading(input, result), true)
  const altered = { ...result, readableReport: 'A fabricated prediction' }
  const { receiptDigest: _receipt, ...payload } = altered
  assert.equal(_receipt, result.receiptDigest)
  assert.equal(verifyJyotishaReading(input, { ...payload, receiptDigest: calculationDigest(payload) }), false)
  assert.ok(result.modules.length > 0)
  assert.ok(result.modules.every(m => m.sources.every(s => s.locator && s.passageDigest)))
  assert.equal(result.pendingRuleAssessment.status, 'practitioner-review-required')
  assert.equal(result.timing.interpretationStatus, 'unavailable')
})
test('uncertainty withholds readings even when endpoint samples agree', () => {
  const result = buildJyotishaReading({ ...input, birthTimeUncertaintyMinutes: 0.001 })
  assert.equal(result.birthTimeSensitivity.samples.length, 3)
  assert.equal(result.birthTimeSensitivity.intervalStabilityProven, false)
  assert.deepEqual(result.modules, [])
  assert.equal(result.status, 'uncertainty-withheld')
})
test('Musala source variants disagree when only one fixed sign is occupied', () => {
  const chart = computeNatalChart({ instant: new Date(input.calculation.instantUtc), latitudeDegrees: 0, longitudeDegrees: 0 })
  for (const point of chart.placements) point.sidereal.sign = 'Taurus'
  const result = assessMusalaVariants(chart)
  assert.deepEqual(result.variants.map(v => v.matches), [true, false])
  assert.equal(result.disagreementChangesClassification, true)
  chart.placements[0].sidereal.sign = 'Aries'
  assert.deepEqual(assessMusalaVariants(chart).variants.map(v => v.matches), [false, false])
})
test('unknown schools, caller approvals, private inputs and invalid uncertainty refuse', () => {
  for (const value of [
    { ...input, profile: 'mixed-schools' }, { ...input, practitionerReviews: [] },
    { ...input, calculation: { ...input.calculation, dataClass: 'private' } },
    ...[-1, 121, NaN].map(birthTimeUncertaintyMinutes => ({ ...input, birthTimeUncertaintyMinutes })),
  ]) assert.throws(() => buildJyotishaReading(value))
})
test('API defaults off, authenticates, bounds the real body, and returns no-store reports', async () => {
  const token = 'synthetic-test-token-only-1234567890'
  const request = (body: string, authorization = `Bearer ${token}`) => new Request('http://localhost/api/v1/interpretations/jyotisha', {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body,
  })
  assert.equal((await handleJyotishaReading(request(JSON.stringify(input)), undefined)).status, 404)
  assert.equal((await handleJyotishaReading(request(JSON.stringify(input), 'Bearer wrong'), token)).status, 401)
  assert.equal((await handleJyotishaReading(request('x'.repeat(2049)), token)).status, 413)
  const response = await handleJyotishaReading(request(JSON.stringify(input)), token)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(verifyJyotishaReading(input, await response.json()), true)
})
