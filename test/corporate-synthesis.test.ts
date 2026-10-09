import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { digestOf } from '../lib/celestial-hypotheses/canonical.ts'
import { buildCorporateReport, type CorporateReportInput } from '../lib/corporate-report.ts'
import { compileCorporateLayers, corporateEventDigest, corporateRuleDigest, CORPORATE_RULES, type CorporateReview, type EventReview, type CorporateTrust } from '../lib/corporate-synthesis.ts'
import { assessFactor, evaluatePredicate, meanNodeSignEnclosure, type Predicate } from '../lib/corporate-factors.ts'
import { computeNatalChart, meanNodeLongitude } from '../lib/natal-chart.ts'
import { lahiriAyanamsa } from '../lib/panchanga.ts'
import { compileReport, CompilerRefusal } from '../lib/interpretation-compiler.ts'
import { buildLocalFactBundle } from '../lib/local-fact-bundle.ts'

const input: CorporateReportInput = { organizationName: 'Synthetic review-fixture organization', eventType: 'certificate-issued', date: '2025-12-17', time: '07:43', timeZone: 'America/Denver', timeConfidence: 'recorded-instant', uncertaintyMinutes: 0, latitudeDegrees: 41.14, longitudeDegrees: -104.8197, locationBasis: 'authority-location', jurisdictionCountryCode: 'US', registrationAuthority: 'Synthetic registry; not an actual attestation', evidenceKind: 'government-record', evidenceReference: 'Synthetic record for tests only', evidenceAttachment: { filename: 'synthetic.txt', byteLength: 1, mediaType: 'text/plain', sha256: `sha256:${'a'.repeat(64)}` } }
const instant = new Date('2025-12-17T14:43:00Z')
const chart = computeNatalChart({ instant, latitudeDegrees: input.latitudeDegrees, longitudeDegrees: input.longitudeDegrees })
function seal<T extends object>(body: T) { return { ...body, recordDigest: digestOf(body) } }
function unseal<T extends { recordDigest: string }>(record: T) { const { recordDigest, ...body } = record; assert.ok(recordDigest); return body }
function trusted(): CorporateTrust {
  return { eventReviews: [seal({ reviewId: 'synthetic-event-review', eventDigest: corporateEventDigest(input), documentDigest: input.evidenceAttachment!.sha256, decision: 'inspected-record' as const, reviewedAt: '2026-09-19T00:00:00Z' })], ruleReviews: CORPORATE_RULES.map(rule => seal({ reviewId: `synthetic-${rule.id}`, ruleId: rule.id, targetDigest: corporateRuleDigest(rule), layer: rule.layer, scope: rule.layer === 'traditional' ? 'source-and-rule' as const : 'maha-analogy-approval' as const, decision: 'accepted' as const, reviewedAt: '2026-09-19T00:00:00Z' })) }
}
const decisions = (r: ReturnType<typeof compileCorporateLayers>) => [...r.traditional.modules, ...r.traditional.exclusions, ...r.mahaReflective.modules, ...r.mahaReflective.exclusions]

test('valid inputs always produce a readable calculation layer without invented approval', () => {
  const r = buildCorporateReport(input)
  assert.equal(r.layers.status, 'report-available')
  assert.equal(r.interpretation.status, 'partial')
  assert.equal(r.layers.calculated.facts.length, 9)
  assert.ok(r.layers.calculated.facts.every(f => f.explanation.length > 50))
  assert.ok(r.interpretation.exclusions.every(e => e.reasons.includes('missing-review')))
})
test('synthetic trusted exact reviews admit only applicable modules with complete traceability', () => {
  const r = buildCorporateReport(input, trusted())
  assert.equal(r.interpretation.status, 'compiled')
  assert.ok(r.layers.traditional.modules.some(m => m.ruleId === 'corporate-mridu-classification'))
  assert.ok(r.layers.mahaReflective.modules.some(m => m.ruleId === 'corp-sun-first'))
  for (const m of r.interpretation.modules) {
    assert.ok(m.ruleDigest && m.factors.length && m.sources.length && m.reviews.length)
    assert.ok(m.disagreements.length && m.passageIds.length)
    assert.ok(m.factors.every(f => f.satisfied && f.state === 'point-in-time'))
    assert.ok(m.sources.every(s => s.locator && s.boundary))
  }
  assert.notEqual(r.reportId, buildCorporateReport(input).reportId, 'Review status participates in report identity')
})
test('house and sign prerequisites are not mere planet-presence checks', () => {
  const altered = structuredClone(chart)
  altered.placements.find(p => p.name === 'Sun')!.wholeSignHouse = 2
  altered.ascendant.sidereal.sign = 'Capricorn'
  const r = compileCorporateLayers(input, altered, instant, instant, trusted())
  for (const id of ['corp-sun-first', 'corp-dhanu']) assert.ok(decisions(r).find(m => m.ruleId === id)!.reasons.includes('condition-unsatisfied'))
  assert.equal(evaluatePredicate(chart, { kind: 'house', chart: 'D1', point: 'Sun', house: 1 }).satisfied, true)
})
test('conjunction, aspect and own-sign predicates test exact declared conventions', () => {
  const c = structuredClone(chart), sun = c.placements.find(p => p.name === 'Sun')!, mercury = c.placements.find(p => p.name === 'Mercury')!
  sun.sidereal.longitude = 359; mercury.sidereal.longitude = 1
  const conjunction: Predicate = { kind: 'conjunction', chart: 'D1', first: 'Sun', second: 'Mercury', angle: 0, orb: 3, convention: 'geometric-degrees-not-graha-drishti' }
  assert.equal(evaluatePredicate(c, conjunction).satisfied, true)
  mercury.sidereal.longitude = 20; assert.equal(evaluatePredicate(c, conjunction).satisfied, false)
  mercury.sidereal.longitude = 179
  assert.equal(evaluatePredicate(c, { ...conjunction, kind: 'aspect', angle: 180 }).satisfied, true)
  mercury.sidereal.sign = 'Gemini'
  assert.equal(evaluatePredicate(c, { kind: 'own-sign', chart: 'D1', point: 'Mercury' }).satisfied, true)
  mercury.sidereal.sign = 'Pisces'
  assert.equal(evaluatePredicate(c, { kind: 'own-sign', chart: 'D1', point: 'Mercury' }).satisfied, false)
  assert.throws(() => evaluatePredicate(c, { ...conjunction, chart: 'D9' } as unknown as Predicate), /unsupported-chart/)
})
test('wrong chart, event, unverified document and irrelevant citation produce explicit exclusions', () => {
  assert.ok(decisions(compileCorporateLayers(input, chart, instant, instant, trusted(), CORPORATE_RULES, 'natal')).every(m => m.reasons.includes('chart-type-mismatch')))
  assert.ok(decisions(compileCorporateLayers({ ...input, eventType: 'public-launch' }, chart, instant, instant, trusted())).every(m => m.reasons.includes('event-scope')))
  assert.ok(decisions(compileCorporateLayers({ ...input, evidenceReference: 'different document' }, chart, instant, instant, trusted())).every(m => m.reasons.includes('unverified-event')))
  const rule = { ...CORPORATE_RULES[1], passageIds: ['bj-10-1-planets-tenth-house'] }
  const r = compileCorporateLayers(input, chart, instant, instant, trusted(), [rule])
  assert.ok(decisions(r)[0].reasons.includes('irrelevant-citation'))
  assert.ok(decisions(r)[0].reasons.includes('stale-review'))
})
test('changed rule, source reference, review scope and tampered review never inherit approval', () => {
  for (const rule of [{ ...CORPORATE_RULES[1], text: 'Different claim' }, { ...CORPORATE_RULES[1], passageIds: ['missing-passage'] }]) {
    const d = decisions(compileCorporateLayers(input, chart, instant, instant, trusted(), [rule]))[0]
    assert.equal(d.state, 'excluded')
    assert.ok(d.reasons.includes('rule-revision-unadmitted'))
  }
  const t = trusted(); t.ruleReviews = t.ruleReviews!.map(r => ({ ...r, targetDigest: 'tampered' }))
  assert.equal(buildCorporateReport(input, t).interpretation.modules.length, 0)
  const wrongScope = trusted(); wrongScope.ruleReviews = wrongScope.ruleReviews!.map(r => seal({ ...unseal(r), scope: 'source-and-rule' })) as CorporateReview[]
  assert.equal(buildCorporateReport(input, wrongScope).layers.mahaReflective.modules.length, 0)
})
test('review revocation removes modules and changes receipts', () => {
  const t = trusted(), accepted = buildCorporateReport(input, t)
  t.ruleReviews = [...t.ruleReviews!, ...t.ruleReviews!.map(r => seal({ ...unseal(r), reviewId: `revoke-${r.reviewId}`, decision: 'revise' as const, reviewedAt: '2026-09-20T00:00:00Z' }))]
  assert.equal(buildCorporateReport(input, t).interpretation.modules.length, 0)
  assert.notEqual(buildCorporateReport(input, t).reportId, accepted.reportId)
  const revoked = trusted(), e = revoked.eventReviews![0]; const body = unseal(e)
  revoked.eventReviews = [...revoked.eventReviews!, seal({ ...body, decision: 'revise' as const })] as EventReview[]
  assert.equal(buildCorporateReport(input, revoked).layers.eventReview.status, 'unverified')
})
test('review order, conflicting timestamps and damaged revocations cannot resurrect approval', () => {
  const t = trusted(), older = t.ruleReviews!
  const revocations = older.map(r => seal({ ...unseal(r), reviewId: `revoked-${r.reviewId}`, decision: 'revise' as const, reviewedAt: '2026-09-20T00:00:00Z' }))
  for (const newer of [revocations, revocations.map(r => ({ ...r, recordDigest: 'damaged' }))]) {
    t.ruleReviews = [...newer, ...older]
    assert.equal(buildCorporateReport(input, t).interpretation.modules.length, 0)
  }
  t.ruleReviews = [...older, ...older.map(r => seal({ ...unseal(r), decision: 'revise' as const }))]
  assert.equal(buildCorporateReport(input, t).interpretation.modules.length, 0)
})
test('time uncertainty is factor-specific: polynomial enclosures survive, agreeing samples do not prove houses', () => {
  const r = buildCorporateReport({ ...input, timeConfidence: 'recorded-minute', uncertaintyMinutes: 1 })
  assert.equal(r.layers.calculated.facts.find(f => f.point === 'Rahu')!.sign.state, 'proven-stable')
  assert.equal(r.layers.calculated.facts.find(f => f.point === 'Sun')!.house.state, 'interval-unproven')
  assert.ok(r.interpretation.exclusions.some(e => e.reasons.includes('factor-uncertain')))
  assert.equal(r.layers.status, 'report-available')
  const changed = structuredClone(chart); changed.placements.find(p => p.name === 'Sun')!.wholeSignHouse = 2
  assert.equal(assessFactor({ kind: 'house', chart: 'D1', point: 'Sun', house: 1 }, [chart, chart, changed], new Date(instant.getTime() - 60000), new Date(instant.getTime() + 60000)).state, 'alternatives-observed')
})
test('interval enclosures contain dense calculation checks, reject broad/boundary and unsupported years', () => {
  for (const year of [1700, 1900, 2025, 2090]) {
    const start = new Date(`${year}-06-01T00:00:00Z`), end = new Date(start.getTime() + 86400000)
    const e = meanNodeSignEnclosure(start, end)!
    for (let i = 0; i <= 100; i++) {
      const at = new Date(start.getTime() + i * 864000)
      const longitude = ((meanNodeLongitude(at) - lahiriAyanamsa(at)) % 360 + 360) % 360
      const middle = (e.bounds[0] + e.bounds[1]) / 2
      const unwrapped = longitude + 360 * Math.round((middle - longitude) / 360)
      assert.ok(unwrapped >= e.bounds[0] && unwrapped <= e.bounds[1])
    }
  }
  assert.equal(meanNodeSignEnclosure(new Date('2020-01-01'), new Date('2027-01-01'))!.sign, null)
  assert.equal(meanNodeSignEnclosure(new Date('1500-01-01'), new Date('1501-01-01')), null)
})
test('legacy compiler cannot bypass corporate review by omitting a gate', () => {
  assert.throws(() => compileReport({ factBundle: buildLocalFactBundle({ instant, latitudeDegrees: 41.14, longitudeDegrees: -104.8197 }), traditionId: 'vedic-jyotisha', chartType: 'corporate' }), CompilerRefusal)
})
test('private demonstration is absent and requests cannot supply the trust context', () => {
  assert.equal(fs.existsSync('test/fixtures/private-corporate-formation.ts'), false)
  const runtime = fs.readFileSync('lib/corporate-mundane-references.ts', 'utf8')
  assert.doesNotMatch(runtime, /MAHA_STRATEGIES_WYOMING_FORMATION|2025-001843603/)
  const action = fs.readFileSync('app/knowledge/corporate/actions.ts', 'utf8')
  assert.doesNotMatch(action, /formData\.get\(['"](?:ruleReviews|eventReviews|trust)['"]\)|private-corporate-formation/)
  assert.match(action, /await readCorporateTrust/)
  assert.equal(digestOf(buildCorporateReport(input)), digestOf(buildCorporateReport(input)))
})
