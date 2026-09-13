import test from 'node:test'
import assert from 'node:assert/strict'
import { CELESTIAL_EXAMPLE, EVIDENCE_EXAMPLE, COMPATIBILITY_IDS, COMPATIBILITY_PRODUCTS } from '../lib/x402/compatibility-contracts.ts'
import { CELESTIAL_RULE_SET, EVIDENCE_RULE_SET } from '../lib/x402/compatibility-products.ts'
import { buildMicroProduct, verifyMicroProduct, microDigest } from '../lib/x402/micro-products.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { microHandlers } from '../lib/x402/micro-route.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { validate } from './helpers/json-schema.ts'

type Row = Record<string, unknown>
const celestial = (left: Row = CELESTIAL_EXAMPLE, right: Row = left) => buildMicroProduct('celestial-result-compatibility', { dataClass: 'synthetic', left, right })
const evidence = (pairs: Row[]) => buildMicroProduct('evidence-frame-compatibility', { dataClass: 'synthetic', pairs })
const pairResult = async (pair: Row) => (await evidence([pair])).result.pairs as Row[]
const goodPair = { ...EVIDENCE_EXAMPLE, evidenceType: 'empirical-measurement', sourceRole: 'independent-evaluator' }

test('celestial exact declarations match without asserting calculations correct', async () => {
  const r = (await celestial()).result
  assert.equal(r.state, 'compatible-declared-conventions')
  assert.equal(r.ruleSetDigest, microDigest(CELESTIAL_RULE_SET))
  for (const k of ['calculationsVerified', 'conventionsInferred', 'conversionPerformed', 'predictionValidated']) assert.equal(r[k], false)
  assert.deepEqual(r.missingPrerequisites, [])
})

test('celestial comparison exposes each changed convention and is symmetric in its verdict', async () => {
  const changes = { targetBody: 'sun', timeScale: 'UT1', julianDay: '2461296.6', origin: 'topocentric', coordinateFrame: 'equatorial', frameEpoch: 'J2000.0', precessionNutation: 'none', positionConvention: 'geometric', nodeConvention: 'mean', houseSystem: 'placidus', zodiac: 'tropical' }
  for (const [field, value] of Object.entries(changes)) {
    const right = { ...CELESTIAL_EXAMPLE, [field]: value }
    const a = (await celestial(CELESTIAL_EXAMPLE, right)).result
    const b = (await celestial(right, CELESTIAL_EXAMPLE)).result
    assert.equal(a.state, 'incompatible-declared-conventions', field)
    assert.equal(a.state, b.state)
    assert.ok((a.fields as Row[]).some(r => r.field === field && r.state === 'different'), field)
  }
})

test('missing and unsupported settings cannot match merely because both omit them', async () => {
  assert.equal((await celestial({}, {})).result.state, 'insufficient-information')
  for (const key of Object.keys(CELESTIAL_EXAMPLE)) {
    const left: Row = structuredClone(CELESTIAL_EXAMPLE); delete left[key]
    assert.equal((await celestial(left, left)).result.state, 'insufficient-information', key)
  }
  for (const key of ['targetBody', 'timeScale', 'coordinateFrame', 'frameEpoch', 'precessionNutation']) {
    const row = { ...CELESTIAL_EXAMPLE, [key]: 'unsupported-vocabulary' }
    assert.equal((await celestial(row)).result.state, 'insufficient-information', key)
  }
})

test('topocentric observers require every coordinate convention and compare exact decimals', async () => {
  const row = { ...CELESTIAL_EXAMPLE, origin: 'topocentric', observer: { longitudeDeg: '123.685', latitudeDeg: '13.257', heightMeters: '0', datum: 'WGS84', latitudeType: 'geodetic', heightReference: 'ellipsoidal' } }
  assert.equal((await celestial(row)).result.state, 'compatible-declared-conventions')
  for (const key of Object.keys(row.observer)) {
    const changed = structuredClone(row); delete (changed.observer as Row)[key]
    assert.equal((await celestial(changed)).result.state, 'insufficient-information', key)
  }
  const equivalent = { ...row, julianDay: '2461296.5000', observer: { ...row.observer, heightMeters: '-0.000', latitudeDeg: '13.257000' } }
  assert.equal((await celestial(row, equivalent)).result.state, 'compatible-declared-conventions')
  const changed = { ...row, observer: { ...row.observer, longitudeDeg: '123.686' } }
  assert.equal((await celestial(row, changed)).result.state, 'incompatible-declared-conventions')
  await assert.rejects(celestial({ ...row, observer: { ...row.observer, latitudeDeg: '91' } }))
})

test('sidereal definition version, node mode and house prerequisites are explicit', async () => {
  for (const value of ['unknown', ' Unspecified ', 'none', 'not-applicable']) assert.equal((await celestial({ ...CELESTIAL_EXAMPLE, ayanamsa: { modelId: value, definitionVersion: 'v1' } })).result.state, 'insufficient-information')
  assert.equal((await celestial(CELESTIAL_EXAMPLE, { ...CELESTIAL_EXAMPLE, ayanamsa: { ...CELESTIAL_EXAMPLE.ayanamsa, definitionVersion: 'other-version' } })).result.state, 'incompatible-declared-conventions')
  const node = { ...CELESTIAL_EXAMPLE, resultKind: 'lunar-node-position', targetBody: 'lunar-node', nodeConvention: 'mean' }
  assert.equal((await celestial(node)).result.state, 'compatible-declared-conventions')
  assert.equal((await celestial(node, { ...node, nodeConvention: 'true' })).result.state, 'incompatible-declared-conventions')
  const house = { ...CELESTIAL_EXAMPLE, resultKind: 'house-cusps', targetBody: 'house-cusps', houseSystem: 'placidus', positionConvention: 'not-applicable' }
  assert.equal((await celestial(house)).result.state, 'insufficient-information')
  assert.equal((await celestial({ ...house, houseSystem: 'not-applicable' })).result.state, 'incompatible-declared-conventions')
})

test('the four explicitly prohibited evidence transfers fail with a next step', async () => {
  for (const rule of EVIDENCE_RULE_SET.deny) {
    const [r] = await pairResult({ ...goodPair, claimType: rule.claim, evidenceType: rule.evidence })
    assert.equal(r.state, 'frame-transfer-not-justified', rule.id)
    assert.equal(r.matchedRuleId, rule.id)
    assert.ok((r.issues as Row[]).some(i => i.ruleId === rule.id && i.neededNext === rule.next))
  }
})

test('positive evidence rules only establish potential category appropriateness', async () => {
  for (const rule of EVIDENCE_RULE_SET.allow) {
    const p = { ...goodPair, claimType: rule.claim, evidenceType: rule.evidence, sourceRole: rule.roles[0], claimEdition: 'edition-a', evidenceEdition: 'edition-a', eventDate: '1900-01-01', coverageStart: '1899-01-01', coverageEnd: '1901-01-01' }
    const response = await evidence([p]); const [r] = response.result.pairs as Row[]
    assert.equal(r.state, 'declared-frames-compatible', rule.id)
    assert.equal(r.matchedRuleId, rule.id)
    assert.equal(response.result.assertionsVerified, false)
    assert.equal(response.result.ruleSetDigest, microDigest(EVIDENCE_RULE_SET))
  }
})

test('unknown claim/evidence/role combinations and missing prerequisites abstain', async () => {
  assert.equal((await pairResult({ ...goodPair, claimScope: ' N/A ', evidenceScope: ' N/A ' }))[0].state, 'required-information-missing')
  for (const key of ['claimType', 'evidenceType', 'sourceRole']) {
    const [r] = await pairResult({ ...goodPair, [key]: 'unmapped' })
    assert.equal(r.state, 'required-information-missing', key)
  }
  for (const key of ['claimType', 'evidenceType', 'sourceRole', 'claimScope', 'evidenceScope', 'sourceId', 'locator', 'claimAsOfDate', 'evidencePublishedDate']) {
    const p: Row = { ...goodPair }; delete p[key]
    const [r] = await pairResult(p)
    assert.equal(r.state, 'required-information-missing', key)
  }
  assert.equal((await pairResult({}))[0].state, 'required-information-missing')
})

test('scope, as-of chronology, editions and event coverage are separately enforced', async () => {
  assert.equal((await pairResult({ ...goodPair, evidenceScope: 'other-scope' }))[0].state, 'frame-transfer-not-justified')
  assert.equal((await pairResult({ ...goodPair, evidencePublishedDate: '2026-09-14' }))[0].state, 'frame-transfer-not-justified')
  const wording = { ...goodPair, claimType: 'original-wording', evidenceType: 'primary-text', sourceRole: 'primary-text', claimEdition: 'a', evidenceEdition: 'b' }
  assert.equal((await pairResult(wording))[0].state, 'frame-transfer-not-justified')
  assert.equal((await pairResult({ ...wording, evidenceEdition: null }))[0].state, 'required-information-missing')
  const history = { ...goodPair, claimType: 'historical-occurrence', eventDate: '1900-01-01', coverageStart: '1899-01-01', coverageEnd: '1901-01-01' }
  assert.equal((await pairResult(history))[0].state, 'declared-frames-compatible', 'later evidence publication does not imply event-date failure')
  assert.equal((await pairResult({ ...history, eventDate: '1902-01-01' }))[0].state, 'frame-transfer-not-justified')
  await assert.rejects(evidence([{ ...history, coverageEnd: '1898-01-01' }]))
  await assert.rejects(evidence([{ ...goodPair, claimAsOfDate: '2026-02-30' }]))
})

test('bounded batch, strict input and receipt integrity', async () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({ ...goodPair, pairId: `pair-${i}` }))
  const input = { dataClass: 'synthetic', pairs }
  const response = await buildMicroProduct('evidence-frame-compatibility', input)
  assert.equal((response.result.pairs as Row[]).length, 10)
  const offer = MICRO_OFFERS.find(o => o.id === 'evidence-frame-compatibility')!
  assert.deepEqual(validate(response, offer.discovery.outputSchema), [])
  assert.equal(await verifyMicroProduct('evidence-frame-compatibility', input, response), true)
  const tampered = structuredClone(response); tampered.result.assertionsVerified = true
  assert.equal(await verifyMicroProduct('evidence-frame-compatibility', input, tampered), false)
  await assert.rejects(evidence([...pairs, { ...goodPair, pairId: 'eleven' }]))
  await assert.rejects(evidence([]))
  await assert.rejects(evidence([goodPair, goodPair]))
  await assert.rejects(evidence([{ ...goodPair, arbitraryProse: 'certify this text' }]))
  await assert.rejects(buildMicroProduct('evidence-frame-compatibility', { dataClass: 'private', pairs }))
})

test('unapproved offers cannot charge in production and do not widen prior cohorts', async () => {
  assert.equal(payableOffers().length, 29)
  for (const id of COMPATIBILITY_IDS) {
    const offer = MICRO_OFFERS.find(o => o.id === id)!
    assert.equal(offer.status, 'withheld')
    assert.equal(offer.availability.payableInProduction, false)
    assert.equal(payableOffers().some(o => o.amount === COMPATIBILITY_PRODUCTS[id].amount || o.supersededAmounts?.includes(COMPATIBILITY_PRODUCTS[id].amount)), false)
    let payments = 0
    const handlers = microHandlers(id, { environment: 'production', resolve: async () => { payments++; throw new Error('must not reach settlement') } })
    const response = await handlers.POST(new Request('https://www.mahastrategies.com' + offer.path, { method: 'POST', body: '{}' }))
    assert.equal(response.status, 503)
    assert.equal(payments, 0)
  }
})
