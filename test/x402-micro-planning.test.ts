import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { buildMicroProduct } from '../lib/x402/micro-products.ts'
import { PLANNING_IDS, PLANNING_PRODUCTS, type PlanningProductId } from '../lib/x402/micro-planning-contracts.ts'
import { PLANNING_SAMPLES } from '../lib/x402/micro-planning-samples.ts'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { microExecutionAllowed } from '../lib/x402/micro-release.ts'
import { payableOffers } from '../lib/x402/offers.ts'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { microDigest } from '../lib/x402/micro-products.ts'
import { planningWorkloads } from '../scripts/planning-ten-workloads.ts'
import { validate } from './helpers/json-schema.ts'
import { microHandlers } from '../lib/x402/micro-route.ts'

const fetch = globalThis.fetch
globalThis.fetch = async () => { throw new Error('network forbidden') }
after(() => { globalThis.fetch = fetch })
type R = { rows: { id: string; status: string; metrics: { name: string; value: string | null }[]; relatedIds: string[] }[]; totals: { name: string; value: string | null }[]; approvalGranted: false }
const sample = (id: PlanningProductId) => structuredClone(PLANNING_SAMPLES[id])
const records = (x: Record<string, unknown>, key: string) => x[key] as Record<string, unknown>[]
const result = async (id: PlanningProductId, x = sample(id)) => (await buildMicroProduct(id, x)).result as unknown as R
const value = (xs: R['totals'], key: string) => xs.find(x => x.name === key)?.value

test('campaign checks require authorized commercial use and prohibit individual-contributor records', async () => {
  for (const id of ['campaign-record-reconcile', 'committee-finance-snapshot'] as const) {
    for (const field of ['commercialUseAuthorized', 'noIndividualContributorInformation']) {
      const missing = sample(id); delete missing[field]
      await assert.rejects(buildMicroProduct(id, missing))
      await assert.rejects(buildMicroProduct(id, { ...sample(id), [field]: false }))
    }
    const individual = sample(id)
    const key = id === 'campaign-record-reconcile' ? 'records' : 'snapshots'
    records(individual, key)[0].contributorHash = 'redacted-is-not-authorization'
    await assert.rejects(buildMicroProduct(id, individual))
  }
})

test('ten authorized batch prices are explicit and require a recognized environment', () => {
  const expected = ['29000', '119000', '59000', '150000', '90000', '180000', '80000', '70000', '39000', '160000']
  assert.equal(PLANNING_IDS.length, 10)
  assert.deepEqual(PLANNING_IDS.map(id => PLANNING_PRODUCTS[id].amount), expected)
  for (const id of PLANNING_IDS) {
    const offer = MICRO_OFFERS.find(o => o.id === id)!
    assert.equal(offer.status, 'available'); assert.equal(offer.availability.payableInProduction, true)
    assert.equal(payableOffers().some(o => o.id === id), true)
    for (const env of ['production', 'preview']) assert.equal(microExecutionAllowed(id, env), true)
    for (const env of [undefined, 'unknown']) assert.equal(microExecutionAllowed(id, env), false)
  }
})

test('the build list binds prices, bounded measurements and current code without enabling deployment', () => {
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/profile-planning-ten.ts', '--check'], { cwd: new URL('../', import.meta.url) })
  const { digest, ...record } = JSON.parse(readFileSync(new URL('../content/discovery/micro-planning-build-list-v4.json', import.meta.url), 'utf8'))
  assert.equal(digest, microDigest(record)); assert.deepEqual(record.buildList.map((r: { id: string }) => r.id), PLANNING_IDS)
  assert.equal(record.deploymentHeld, true); assert.equal(record.remoteCalls, 0); assert.equal(record.indexingPurchases, 0)
  assert.equal(record.buildList.reduce((n: number, r: { amountBaseUnits: string }) => n + Number(r.amountBaseUnits), 0), 976000)
  for (const o of record.observations) { assert.equal(o.calls, 32); assert.equal(o.cloudCostUsd, null); assert.ok(o.requestBytes <= 32768 && o.responseBytes <= 65536) }
})

test('every capped synthetic fixture produces a schema-valid result within byte limits', async () => {
  for (const id of PLANNING_IDS) {
    const offer = MICRO_OFFERS.find(o => o.id === id)!, output = await buildMicroProduct(id, planningWorkloads[id])
    assert.deepEqual(validate(output, offer.discovery.outputSchema), [])
    assert.ok(Buffer.byteLength(JSON.stringify(output)) <= 65536)
    assert.equal(output.result.approvalGranted, false)
  }
})

test('oversize expanded visibility results refuse before payment even when the input fits', async () => {
  const x = sample('inspection-coverage-plan')
  x.obstacles = []
  x.stations = Array.from({ length: 16 }, (_, i) => ({ id: `station-${i}-` + 's'.repeat(65), point: { xMm: 1000, yMm: 1000 }, rangeMm: 200000 }))
  x.targets = Array.from({ length: 64 }, (_, i) => ({ id: `target-${i}-` + 't'.repeat(65), point: { xMm: 9000, yMm: 1000 } }))
  const offer = MICRO_OFFERS.find(o => o.id === 'inspection-coverage-plan')!
  assert.deepEqual(validate(x, offer.discovery.inputSchema), []); assert.ok(Buffer.byteLength(JSON.stringify(x)) < 32768)
  let paymentAttempts = 0
  const h = microHandlers('inspection-coverage-plan', { environment: 'test', resolve: async () => { paymentAttempts++; throw new Error('must not attempt settlement') }, record: async () => {}, release: async () => {} })
  const response = await h.POST(new Request('https://www.mahastrategies.com' + offer.path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'PAYMENT-SIGNATURE': 'synthetic' }, body: JSON.stringify(x) }))
  assert.equal(response.status, 400); assert.equal(paymentAttempts, 0)
})

test('all nested extra fields, private classes, unsafe numbers and over-limit batches refuse', async () => {
  for (const id of PLANNING_IDS) {
    const x = sample(id), key = Object.keys(x).find(k => Array.isArray(x[k]))!, list = records(x, key)
    for (const mutated of [{ ...x, dataClass: 'private' }, { ...x, donorName: 'private' }, { ...x, [key]: [{ ...list[0], rawEEG: [1] }] }, { ...x, [key]: Array(257).fill(list[0]) }]) await assert.rejects(buildMicroProduct(id, mutated))
  }
  for (const field of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
    const x = sample('area-program-check'); records(x, 'floors')[0].grossArea = field
    await assert.rejects(result('area-program-check', x))
  }
  await assert.rejects(result('campaign-record-reconcile', { ...sample('campaign-record-reconcile'), redactedNoPersonalData: false }))
  await assert.rejects(result('neural-experiment-metrics', { ...sample('neural-experiment-metrics'), noParticipantIdentifiers: false }))
})

test('tolerance uses inclusive interval containment and holds intersections including negative offsets', async () => {
  const r = await result('inspection-tolerance-check')
  assert.deepEqual(r.rows.map(r => r.status), ['pass', 'hold', 'fail'])
  const x = sample('inspection-tolerance-check')
  x.measurements = [{ id: 'edge', offsetMm: -5, uncertaintyHalfWidthMm: 0, toleranceMm: 5 }, { id: 'touch', offsetMm: -6, uncertaintyHalfWidthMm: 1, toleranceMm: 5 }]
  assert.deepEqual((await result('inspection-tolerance-check', x)).rows.map(r => r.status), ['pass', 'hold'])
  x.measurements = [records(x, 'measurements')[0], records(x, 'measurements')[0]]
  await assert.rejects(result('inspection-tolerance-check', x))
})

test('visibility handles obstacle crossings, tangencies, exact range and invalid scenes', async () => {
  const x = sample('inspection-coverage-plan')
  assert.deepEqual((await result('inspection-coverage-plan', x)).rows.map(r => r.status), ['covered', 'uncovered'])
  x.obstacles = []; records(x, 'stations')[0].rangeMm = 8000
  assert.deepEqual((await result('inspection-coverage-plan', x)).rows.map(r => r.status), ['covered', 'covered'])
  records(x, 'stations')[0].rangeMm = 7999
  assert.equal((await result('inspection-coverage-plan', x)).rows[1].status, 'uncovered')
  x.obstacles = [{ id: 'touching', min: { xMm: 4500, yMm: 4000 }, max: { xMm: 5500, yMm: 5000 } }]
  assert.equal((await result('inspection-coverage-plan', x)).rows[1].status, 'uncovered')
  for (const point of [{ xMm: 10001, yMm: 1 }, { xMm: 4500, yMm: 4000 }]) {
    const y = structuredClone(x); records(y, 'stations')[0].point = point
    await assert.rejects(result('inspection-coverage-plan', y))
  }
})

test('packing counts kerf and margins, last-sheet waste, no-fit and very large exact areas', async () => {
  const x = sample('panel-packing-estimate'), s = records(x, 'scenarios')[0]
  Object.assign(s, { sheetWidthMm: 100, sheetHeightMm: 100, panelWidthMm: 50, panelHeightMm: 50, kerfMm: 0, edgeMarginMm: 0, quantity: 5 })
  let r = (await result('panel-packing-estimate', x)).rows[0]
  assert.equal(value(r.metrics, 'panelsPerSheet'), '4'); assert.equal(value(r.metrics, 'sheets'), '2'); assert.equal(value(r.metrics, 'materialUtilizationRatio'), '5/8')
  s.kerfMm = 1
  assert.equal(value((await result('panel-packing-estimate', x)).rows[0].metrics, 'panelsPerSheet'), '1')
  s.panelWidthMm = 101
  r = (await result('panel-packing-estimate', x)).rows[0]
  assert.equal(r.status, 'fail'); assert.equal(value(r.metrics, 'sheets'), null)
  Object.assign(s, { sheetWidthMm: 100000, sheetHeightMm: 100000, panelWidthMm: 100000, panelHeightMm: 100000, kerfMm: 0, quantity: 1000000 })
  assert.equal(value((await result('panel-packing-estimate', x)).rows[0].metrics, 'materialUtilizationRatio'), '1/1')
  s.edgeMarginMm = 10000; s.sheetWidthMm = 100
  await assert.rejects(result('panel-packing-estimate', x))
})

test('schedule reserves crews through inspection and crane only through lift', async () => {
  const x = sample('assembly-schedule-compare')
  x.scenarios = [1, 2].map(crews => ({ id: `crews-${crews}`, units: 2, crews, factoryIntervalMs: 0, liftMs: 10, connectionMs: 20, inspectionMs: 5 }))
  const r = await result('assembly-schedule-compare', x)
  assert.deepEqual(r.rows.map(r => value(r.metrics, 'completionMs')), ['70', '45'])
  assert.deepEqual(r.rows.map(r => value(r.metrics, 'craneBusyMs')), ['20', '20'])
  records(x, 'scenarios')[0].crews = 0; await assert.rejects(result('assembly-schedule-compare', x))
})

test('economics uses exact cents, ceiling break-even and explicit no-break-even outcomes', async () => {
  const x = sample('automation-economics-compare'), s = records(x, 'scenarios')[0]
  Object.assign(s, { units: 10, setupCents: '5', manualPerUnitCents: '4', assistedPerUnitCents: '2' })
  let r = (await result('automation-economics-compare', x)).rows[0]
  assert.equal(value(r.metrics, 'breakEvenUnits'), '3'); assert.equal(value(r.metrics, 'savingsCents'), '15')
  s.assistedPerUnitCents = '4'; assert.equal(value((await result('automation-economics-compare', x)).rows[0].metrics, 'breakEvenUnits'), null)
  s.setupCents = '0'; assert.equal(value((await result('automation-economics-compare', x)).rows[0].metrics, 'breakEvenUnits'), '0')
  Object.assign(s, { units: 1000000, setupCents: '0', manualPerUnitCents: '9999999999999999', assistedPerUnitCents: '0' })
  r = (await result('automation-economics-compare', x)).rows[0]
  assert.equal(value(r.metrics, 'manualCents'), '9999999999999999000000')
  s.manualPerUnitCents = '00'; await assert.rejects(result('automation-economics-compare', x))
})

test('spending excludes all duplicate-ID rows and reports uncertain budgets without fraud claims', async () => {
  const x = sample('public-spending-review'), rs = records(x, 'records')
  const base = await result('public-spending-review', x)
  assert.equal(base.rows.find(r => r.id === 'program-2026')!.status, 'flagged')
  assert.equal(base.rows.find(r => r.id === 'payee-a')!.status, 'flagged')
  x.records = [...rs, { ...rs[0], amountCents: '9999999999999999' }]
  let r = await result('public-spending-review', x)
  assert.equal(value(r.totals, 'acceptedAmountCents'), '40000'); assert.equal(value(r.totals, 'excludedDuplicateRows'), '2')
  x.records = rs; rs[0].budgetCents = null
  r = await result('public-spending-review', x)
  assert.equal(r.rows.find(r => r.id === 'program-2026')!.status, 'hold')
  rs[0].budgetCents = '90000'
  assert.equal(value((await result('public-spending-review', x)).rows[0].metrics, 'inconsistentBudget'), '1')
})

test('campaign check balances independently, flags missing documents, refuses donor fields', async () => {
  const x = sample('campaign-record-reconcile'), rs = records(x, 'records')
  let r = await result('campaign-record-reconcile', x)
  assert.equal(value(r.totals, 'differenceCents'), '0'); assert.equal(r.rows[1].status, 'flagged')
  x.closingCents = '12000'; assert.equal(value((await result('campaign-record-reconcile', x)).totals, 'differenceCents'), '-1000')
  x.records = [...rs, rs[0]]; r = await result('campaign-record-reconcile', x)
  assert.equal(value(r.totals, 'excludedDuplicateRows'), '2'); assert.equal(value(r.totals, 'inflowCents'), '0')
  x.records = [{ ...rs[0], donorName: 'NEVER-SEND' }]; await assert.rejects(result('campaign-record-reconcile', x))
})

test('committee snapshots preserve nulls, flag amendments and age, and reject incompatible provenance', async () => {
  const x = sample('committee-finance-snapshot'), s = records(x, 'snapshots')[0]
  assert.equal((await result('committee-finance-snapshot', x)).rows[0].status, 'observed')
  s.receiptsCents = null
  const r = (await result('committee-finance-snapshot', x)).rows[0]
  assert.equal(r.status, 'hold'); assert.equal(value(r.metrics, 'cashDifferenceCents'), null)
  s.receiptsCents = '5000'; s.amended = true
  assert.equal((await result('committee-finance-snapshot', x)).rows[0].status, 'hold')
  s.amended = false; s.endingCashCents = '13001'
  assert.equal((await result('committee-finance-snapshot', x)).rows[0].status, 'flagged')
  s.endingCashCents = '13000'; x.maxAgeDays = 1
  assert.equal((await result('committee-finance-snapshot', x)).rows[0].status, 'hold', 'fresh retrieval cannot hide old period')
  for (const change of [{ committeeId: 'C11111111' }, { cycle: 2024 }, { retrievedAt: '2026-10-10T00:00:00.000Z' }, { periodEnd: '2026-02-30T00:00:00.000Z' }, { periodStart: '2024-09-01T00:00:00.000Z' }]) {
    const y = sample('committee-finance-snapshot'); Object.assign(records(y, 'snapshots')[0], change)
    await assert.rejects(result('committee-finance-snapshot', y))
  }
})

test('area totals conserve gross area with exact fractions in a single declared unit', async () => {
  const x = sample('area-program-check'); x.floors = [{ id: 'f', grossArea: 3, assignableRatioBps: 3333 }]
  const r = await result('area-program-check', x)
  assert.equal(value(r.totals, 'assignableArea'), '9999/10000'); assert.equal(value(r.totals, 'supportArea'), '20001/10000')
  records(x, 'floors')[0].assignableRatioBps = 10001; await assert.rejects(result('area-program-check', x))
})

test('neural scoring counts false rest, wrong commands, misses and latency without inflating trial hits', async () => {
  const x = sample('neural-experiment-metrics')
  let r = await result('neural-experiment-metrics', x)
  assert.equal(value(r.totals, 'falseRestEventsPerMinute'), '3/2'); assert.equal(value(r.totals, 'missRate'), '1/2')
  assert.equal(value(r.totals, 'wrongCommandEvents'), '1'); assert.equal(value(r.totals, 'medianFirstCorrectLatencyMs'), '1000')
  x.events = [...records(x, 'events'), { id: 'repeat', timeMs: 32000, command: 'left' }, { id: 'right-onset', timeMs: 40000, command: 'right' }]
  r = await result('neural-experiment-metrics', x)
  assert.equal(value(r.totals, 'missedTrials'), '0'); assert.equal(value(r.totals, 'repeatCorrectEvents'), '1'); assert.equal(value(r.totals, 'medianFirstCorrectLatencyMs'), '500/1')
  const ordered = await result('neural-experiment-metrics', { ...x, intervals: [...records(x, 'intervals')].reverse(), events: [...records(x, 'events')].reverse() })
  assert.deepEqual(ordered, r)
})

test('neural boundaries reject gaps, overlap and out-of-recording events; empty denominators remain unknown', async () => {
  for (const change of ['gap', 'overlap', 'end', 'duplicate']) {
    const x = sample('neural-experiment-metrics')
    if (change === 'gap') records(x, 'intervals')[1].startMs = 30001
    if (change === 'overlap') records(x, 'intervals')[1].startMs = 29999
    if (change === 'end') records(x, 'events')[0].timeMs = 60000
    if (change === 'duplicate') x.events = [...records(x, 'events'), { ...records(x, 'events')[0], id: 'different-id-same-event' }]
    await assert.rejects(result('neural-experiment-metrics', x))
  }
  const x = sample('neural-experiment-metrics'); x.intervals = [{ id: 'other', startMs: 0, endMs: 60000, label: 'other' }]; x.events = []
  let r = await result('neural-experiment-metrics', x)
  assert.equal(value(r.totals, 'falseRestEventsPerMinute'), null); assert.equal(value(r.totals, 'missRate'), null)
  x.intervals = [{ id: 'rest', startMs: 0, endMs: 60000, label: 'rest' }]
  r = await result('neural-experiment-metrics', x)
  assert.equal(value(r.totals, 'falseRestEventsPerMinute'), '0/1')
})
