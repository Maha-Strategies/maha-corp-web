import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildCorporateReport } from '../lib/corporate-report.ts'
import { CORPORATE_RULES, corporateRuleDigest, corporateEventDigest } from '../lib/corporate-synthesis.ts'
import { handleCorporateReview, readCorporateTrust, type CorporateReviewStore, type ReviewRow } from '../lib/corporate-review-service.ts'
import { dignity, classicalFullAspect } from '../lib/corporate-classical.ts'
import { assessFactor, evaluatePredicate, meanNodeSignEnclosure } from '../lib/corporate-factors.ts'
import { computeNatalChart, ZODIAC_SIGNS } from '../lib/natal-chart.ts'
import { navamsaPosition } from '../lib/natal-foundation.ts'
import { SYNTHETIC_MINUTE_FORMATION } from './fixtures/synthetic-corporate-formation.ts'
import { isPrivateReadingTelemetry } from '../lib/jyotisha-telemetry.ts'
import { synthesizeCorporateEvidence } from '../lib/corporate-conflicts.ts'

const input = { ...SYNTHETIC_MINUTE_FORMATION, timeConfidence: 'recorded-instant' as const, uncertaintyMinutes: 0, evidenceAttachment: { filename: 'synthetic.txt', mediaType: 'text/plain', byteLength: 4, sha256: `sha256:${createHash('sha256').update('test').digest('hex')}` } }
const now = new Date('2026-09-19T00:00:00Z')
const chart = computeNatalChart({ instant: new Date('2025-12-17T14:43:00Z'), latitudeDegrees: 41.14, longitudeDegrees: -104.8197 })
class MemoryStore implements CorporateReviewStore {
  rows: ReviewRow[] = []; keys = new Set<string>()
  async append(row: ReviewRow, key: string) { if (this.keys.has(key)) throw new Error('duplicate'); this.keys.add(key); this.rows.push(row) }
  async rules() { return this.rows.filter(r => r.kind === 'rule') }
  async events(target: string, grantHash: string) { return this.rows.filter(r => r.kind === 'event' && r.target === target && r.grantHash === grantHash) }
}
const request = (body: unknown, token: string, key = 'synthetic-review-00001') => new Request('http://localhost/api/admin/corporate-reviews', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body) })
test('authenticated private review lifecycle, role separation, duplicate refusal and no document retention', async () => {
  const names = ['PRACTITIONER_REVIEW_TOKEN', 'MAHA_ANALOGY_APPROVAL_TOKEN', 'CORPORATE_EVENT_REVIEW_TOKEN'] as const
  const previous = names.map(n => process.env[n]); const tokens = ['p'.repeat(40), 'm'.repeat(40), 'e'.repeat(40)]
  names.forEach((n, i) => { process.env[n] = tokens[i] })
  try {
    const store = new MemoryStore(), factory = () => store
    assert.equal((await handleCorporateReview(request({}, 'wrong'), factory, now)).status, 401)
    const rule = CORPORATE_RULES.find(r => r.id === 'corp-sun-first')!
    const body = { kind: 'rule', ruleId: rule.id, targetDigest: corporateRuleDigest(rule), decision: 'accepted', sourceRead: true, prerequisitesChecked: true, boundariesChecked: true, qualifiedForScope: true }
    assert.equal((await handleCorporateReview(request(body, tokens[0]), factory, now)).status, 403)
    assert.equal((await handleCorporateReview(request({ ...body, sourceRead: false }, tokens[1]), factory, now)).status, 400)
    assert.equal((await handleCorporateReview(request(body, tokens[1]), factory, now)).status, 201)
    assert.equal((await handleCorporateReview(request(body, tokens[1]), factory, now)).status, 409)
    const event = { kind: 'event', input, documentBase64: Buffer.from('test').toString('base64'), consentToRetainFingerprints: true, decision: 'inspected-record', recordRead: true, eventTypeChecked: true, timePrecisionChecked: true, locationBasisChecked: true }
    assert.equal((await handleCorporateReview(request(event, tokens[1], 'synthetic-event-00001'), factory, now)).status, 403)
    assert.equal((await handleCorporateReview(request({ ...event, documentBase64: Buffer.from('nope').toString('base64') }, tokens[2], 'synthetic-event-00001'), factory, now)).status, 400)
    const response = await handleCorporateReview(request(event, tokens[2], 'synthetic-event-00001'), factory, now)
    assert.equal(response.status, 201); assert.match(response.headers.get('cache-control')!, /no-store/)
    const { privateGrant } = await response.json()
    const trust = await readCorporateTrust(input, privateGrant, store, now)
    const report = buildCorporateReport(input, trust)
    assert.ok(report.layers.mahaReflective.modules.some(m => m.ruleId === rule.id))
    assert.equal(report.layers.eventReview.status, 'inspected-record')
    const saved = JSON.stringify(store.rows)
    for (const privateValue of [input.organizationName, input.evidenceReference, privateGrant, 'documentBase64', 'synthetic.txt']) assert.ok(!saved.includes(privateValue))
    assert.equal((await readCorporateTrust(input, '', store, now)).eventReviews!.length, 0)
    await assert.rejects(readCorporateTrust({ ...input, time: '07:44' }, privateGrant, store, now))
    assert.equal((await readCorporateTrust(input, privateGrant, store, new Date('2026-11-01'))).eventReviews!.length, 0)
    const revoke = await handleCorporateReview(request({ ...event, privateGrant, decision: 'revise' }, tokens[2], 'synthetic-revoke-0001'), factory, new Date(now.getTime() + 1000))
    assert.equal(revoke.status, 201)
    assert.equal(buildCorporateReport(input, await readCorporateTrust(input, privateGrant, store, now)).layers.eventReview.status, 'unverified')
    assert.equal(corporateEventDigest(input), corporateEventDigest({ ...input, timingReferenceUtc: '2028-01-01T12:00:00Z' }))
  } finally { names.forEach((n, i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i] }) }
})
test('D9 prerequisites use D9, dignity is categorical and nodes have no invented dignity', () => {
  const c = structuredClone(chart); c.placements.find(p => p.name === 'Mercury')!.sidereal.longitude = 7
  assert.equal(evaluatePredicate(c, { kind: 'own-sign', chart: 'D9', point: 'Mercury' }).satisfied, true) // D9 Gemini
  c.placements.find(p => p.name === 'Mercury')!.sidereal.longitude = 11
  assert.equal(evaluatePredicate(c, { kind: 'own-sign', chart: 'D9', point: 'Mercury' }).satisfied, false)
  assert.equal(dignity('Mars', 'Capricorn').exalted, true)
  assert.equal(dignity('Mars', 'Cancer').debilitated, true)
  assert.equal(dignity('Mercury', 'Virgo').ownSign, true)
  assert.equal(dignity('Mercury', 'Virgo').exalted, true) // categories coexist
  assert.equal(dignity('Rahu', 'Taurus').supported, false)
})
test('classical aspects are directed, school-bound, and not geometric shortest-arc substitutes', () => {
  assert.deepEqual(classicalFullAspect('Mars', 0, 90).matchedTargets, [90])
  assert.deepEqual(classicalFullAspect('Mars', 90, 0).matchedTargets, [])
  assert.deepEqual(classicalFullAspect('Saturn', 0, 270).matchedTargets, [270])
  assert.deepEqual(classicalFullAspect('Saturn', 0, 90).matchedTargets, [])
  assert.deepEqual(classicalFullAspect('Jupiter', 0, 120).matchedTargets, [120])
  assert.equal(classicalFullAspect('Rahu', 0, 180).supported, false)
  assert.deepEqual(classicalFullAspect('Sun', 0, 195.001).matchedTargets, [])
  assert.throws(() => classicalFullAspect('Sun', NaN, 0))
})
test('continuous mean-node D9 enclosures cover interior instants without inferring other stability', () => {
  const start = new Date('2025-12-17T14:42:00Z'), end = new Date('2025-12-17T14:44:00Z')
  for (const ketu of [false, true]) {
    const bound = meanNodeSignEnclosure(start, end, ketu, 9)!
    for (let i = 0; i <= 20; i++) {
      const c = computeNatalChart({ instant: new Date(+start + (+end - +start) * i / 20), latitudeDegrees: 41.14, longitudeDegrees: -104.8197 })
      const p = c.placements.find(p => p.name === (ketu ? 'Ketu' : 'Rahu'))!
      assert.equal(navamsaPosition(p.sidereal.longitude).sign, bound.sign)
    }
  }
  const f = assessFactor({ kind: 'sign', chart: 'D9', point: 'Rahu', sign: meanNodeSignEnclosure(start, end, false, 9)!.sign! }, [chart], start, end)
  assert.equal(f.state, 'proven-stable')
  assert.equal(assessFactor({ kind: 'sign', chart: 'D9', point: 'Sun', sign: ZODIAC_SIGNS[0] }, [chart], start, end).state, 'interval-unproven')
})
test('periods and contacts are optional, deterministic and explicitly not exhaustive predictions', () => {
  const r = buildCorporateReport({ ...input, timingReferenceUtc: '2028-01-01T12:00:00Z' })
  assert.equal(r.layers.timing.status, 'calculation-only')
  assert.equal(r.layers.timing.snapshots.length, 3)
  assert.equal(r.layers.timing.alternatives.length, 1)
  assert.match(r.layers.timing.explanation, /not an exhaustive/)
  assert.deepEqual(buildCorporateReport({ ...input, timingReferenceUtc: '2028-01-01T12:00:00Z' }), r)
  assert.throws(() => buildCorporateReport({ ...input, timingReferenceUtc: '2024-01-01T12:00:00Z' }))
  assert.equal(buildCorporateReport(input).layers.timing.status, 'not-requested')
  assert.ok(r.layers.synthesis.groups.every(g => g.includedRuleIds.length === 0))
})
test('corporate reports and private verification are dropped from telemetry', () => {
  for (const path of ['/knowledge/corporate', '/api/admin/corporate-reviews']) assert.equal(isPrivateReadingTelemetry({ request: { url: `https://example.test${path}?private=secret` } }), true)
})
test('conflict-aware synthesis preserves opposing admitted rules without importing excluded material', () => {
  const a = { ruleId: 'a', layer: 'traditional', state: 'included' as const, paragraph: 'Synthetic interpretation A', disagreements: ['Synthetic unresolved conflict'], conflictsWith: ['b'] }
  const b = { ...a, ruleId: 'b', conflictsWith: ['a'], paragraph: 'Synthetic interpretation B' }
  assert.equal(synthesizeCorporateEvidence([a, b]).conflicts.length, 1)
  const excluded = synthesizeCorporateEvidence([a, { ...b, state: 'excluded', paragraph: null }])
  assert.equal(excluded.conflicts.length, 0)
  assert.deepEqual(excluded.groups[0].includedRuleIds, ['a'])
})
