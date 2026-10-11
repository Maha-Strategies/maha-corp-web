import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { SPECS, buildPhysicalNeuralExpansion } from '../lib/x402/expansion-physical-neural.ts'
import { schemaAccepts, type MicroSchema } from '../lib/x402/micro-schema.ts'

const ids = [
  'toy-grid-path-dry-run', 'digital-twin-config-diff', 'weighted-calibration-fit', 'sampling-aliasing-check',
  'assembly-critical-path', 'manufacturing-yield-sensitivity', 'inspection-station-selection', 'material-cut-list-consolidation',
  'feature-distribution-drift', 'intention-threshold-sweep', 'dwell-release-comparison', 'synthetic-artifact-test-pack',
  'confidence-calibration-report', 'fictional-decision-debrief',
]
const amounts = ['34500', '15500', '26500', '6500', '57000', '49000', '118000', '22500', '43000', '73000', '96000', '53000', '47000', '45000']
type Row = Record<string, unknown>
const sample = (id: string) => structuredClone(SPECS[id].sample)
function run(id: string, changes: Row = {}): Row {
  const result = buildPhysicalNeuralExpansion(id, { ...sample(id), ...changes })
  assert.ok(result)
  assert.ok(schemaAccepts(SPECS[id].resultSchema, result))
  return result
}
const rows = (v: unknown) => v as Row[]
const row = (v: unknown) => v as Row
const number = (v: unknown) => Number(v)
const near = (actual: unknown, expected: number, epsilon = 1e-9) => assert.ok(Math.abs(number(actual) - expected) <= epsilon, `${String(actual)} != ${expected}`)
const reject = (id: string, changes: Row, message?: RegExp) => { if (message) assert.throws(() => run(id, changes), message); else assert.throws(() => run(id, changes)) }
const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value))
function exactFraction(v: unknown, numerator: bigint, denominator = BigInt(1)) {
  const f = v as { numerator: string; denominator: string }
  assert.equal(BigInt(f.numerator) * denominator, numerator * BigInt(f.denominator))
  assert.ok(BigInt(f.denominator) > BigInt(0))
}
const mkTrial = (label: string, startMs: number, endMs: number, values: [number, string][]) => ({ label, startMs, endMs, points: values.map(([timeMs, score]) => ({ timeMs, score })) })

test('14 priced contracts have deterministic, nonmutating, schema-valid bounded samples', () => {
  assert.deepEqual(Object.keys(SPECS), ids)
  for (let j = 0; j < ids.length; j++) {
    const id = ids[j], spec = SPECS[id], input = sample(id), copy = structuredClone(input)
    assert.equal(spec.amount, amounts[j]); assert.equal(spec.category, j < 8 ? 'physical-ai' : 'neural')
    assert.ok(spec.title.length > 0 && spec.description.length > 0 && spec.description.length <= 500)
    assert.ok(schemaAccepts(spec.inputSchema, input)); assert.ok(byteLength(input) <= 32768)
    const first = buildPhysicalNeuralExpansion(id, input)
    assert.deepEqual(buildPhysicalNeuralExpansion(id, input), first)
    assert.deepEqual(input, copy); assert.ok(schemaAccepts(spec.resultSchema, first)); assert.ok(byteLength(first) <= 65536)
    assert.equal(schemaAccepts(spec.resultSchema, { ...first, injectedOutput: true }), false)
    for (const key of Object.keys(first!)) { const missing: Row = { ...first }; delete missing[key]; assert.equal(schemaAccepts(spec.resultSchema, missing), false) }
    if (id !== 'synthetic-artifact-test-pack') assert.equal(run(id, { dataClass: 'public' }).dataClass, 'public')
  }
  for (const id of ['unknown', '__proto__', 'constructor', 'toString']) assert.equal(buildPhysicalNeuralExpansion(id, {}), null)
})

test('schemas are closed recursively, bounded and only integer/string numeric; no identity or raw signal inputs', () => {
  const inspect = (s: MicroSchema): void => {
    if (s.oneOf) { s.oneOf.forEach(inspect); return }
    assert.ok(['object', 'array', 'string', 'integer', 'boolean', 'null'].includes(s.type!))
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false)
      assert.deepEqual(s.required, Object.keys(s.properties!))
      Object.entries(s.properties!).forEach(([k, child]) => { assert.doesNotMatch(k, /^(participant|patient|email|rawEEG|subjectId)$/i); inspect(child) })
    }
    if (s.type === 'array') { assert.ok(s.minItems! >= 0 && s.maxItems! <= 576); inspect(s.items!) }
    if (s.type === 'integer') { assert.ok(Number.isSafeInteger(s.minimum) && Number.isSafeInteger(s.maximum)); assert.ok(s.minimum! <= s.maximum!) }
    if (s.type === 'string') assert.ok(s.enum?.length || (s.maxLength! <= 200 && s.pattern))
  }
  for (const id of ids) { inspect(SPECS[id].inputSchema); inspect(SPECS[id].resultSchema) }
  const source = readFileSync(new URL('../lib/x402/expansion-physical-neural.ts', import.meta.url), 'utf8')
  const imports = source.match(/^import .+$/gm)
  assert.equal(imports?.length, 1); assert.match(imports![0], /from '\.\/micro-schema\.ts'/)
  assert.doesNotMatch(source, /\b(fetch|process\.env|Math\.random|Date\.now)\s*\(/)
})

test('all required top-level fields, data classes and extra keys are enforced', () => {
  for (const id of ids) {
    for (const dataClass of ['private', 'participant', '', 1, null]) reject(id, { dataClass })
    for (const identityKey of ['participantId', 'email', 'rawEEG', 'apiKey']) reject(id, { [identityKey]: 'disallowed' })
    for (const key of Object.keys(sample(id))) {
      const incomplete = sample(id); delete incomplete[key]
      assert.equal(schemaAccepts(SPECS[id].inputSchema, incomplete), false)
      assert.throws(() => buildPhysicalNeuralExpansion(id, incomplete), /input-schema/)
    }
  }
  reject('synthetic-artifact-test-pack', { dataClass: 'public' })
  reject('fictional-decision-debrief', { fictional: false })
})

test('nested unknown fields, oversized arrays, unsafe integers and malformed decimals fail', () => {
  reject(ids[0], { start: { x: 0, y: 0, deviceId: 'x' } })
  reject(ids[0], { width: Number.MAX_SAFE_INTEGER + 1 }); reject(ids[0], { width: 2.5 }); reject(ids[0], { maxSteps: Infinity })
  const fitId = ids[2]
  for (const value of ['NaN', 'Infinity', '1e3', '01', '+1', '.1', '1.', '1000000', '0.0000001', ' 1', '1\n', '1\r', '1\r\n', '1\u2028', '', 1, NaN, Infinity]) {
    reject(fitId, { pairs: [{ x: value, y: '1', weight: '1' }, { x: '2', y: '3', weight: '1' }] })
  }
  reject(fitId, { pairs: Array.from({ length: 65 }, (_, j) => ({ x: String(j), y: '1', weight: '1' })) })
  reject(ids[6], { stations: Array(13).fill(rows(sample(ids[6]).stations)[0]) })
  reject(ids[12], { binCount: 21 }); reject(ids[11], { seed: 4294967296 })
  reject(ids[9], { scoreUnits: 'percent' }); reject(ids[10], { evaluationSplit: 'training' })
  reject(ids[6], { requirements: ['visual\n', 'dimension'] })
  reject(ids[9], { thresholds: ['0.5\n'] })
})

test('BFS agrees with independent repeated-distance relaxation for every 3×3 obstacle map', () => {
  const id = ids[0], candidates = [1, 2, 3, 4, 5, 6, 7]
  for (let mask = 0; mask < 128; mask++) {
    const blocked = new Set(candidates.filter((_, j) => mask & (1 << j)))
    const distances = Array(9).fill(Infinity); distances[0] = 0
    for (let pass = 0; pass < 9; pass++) for (let cell = 0; cell < 9; cell++) {
      if (blocked.has(cell)) continue
      for (let next = 0; next < 9; next++) if (!blocked.has(next) && Math.abs(cell % 3 - next % 3) + Math.abs(Math.floor(cell / 3) - Math.floor(next / 3)) === 1) distances[next] = Math.min(distances[next], distances[cell] + 1)
    }
    const result = run(id, { width: 3, height: 3, start: { x: 0, y: 0 }, goal: { x: 2, y: 2 }, obstacles: [...blocked].map(c => ({ x: c % 3, y: Math.floor(c / 3) })), maxSteps: 8 })
    assert.equal(result.minimumSteps, distances[8] === Infinity ? null : distances[8])
    const path = result.route as { x: number; y: number }[]
    path.forEach((p, j) => { assert.ok(!blocked.has(p.y * 3 + p.x)); if (j) assert.equal(Math.abs(p.x - path[j - 1].x) + Math.abs(p.y - path[j - 1].y), 1) })
  }
})

test('grid handles zero steps, disconnection, limits, coordinates and duplicate obstacles', () => {
  const id = ids[0]
  assert.equal(run(id, { maxSteps: 1 }).state, 'step-limit')
  assert.equal(run(id, { goal: { x: 0, y: 0 }, maxSteps: 0 }).minimumSteps, 0)
  assert.equal(run(id, { width: 3, height: 1, goal: { x: 2, y: 0 }, obstacles: [{ x: 1, y: 0 }] }).state, 'unreachable')
  reject(id, { obstacles: [{ x: 0, y: 0 }] }); reject(id, { goal: { x: 4, y: 0 } })
  reject(id, { obstacles: [{ x: 1, y: 0 }, { x: 1, y: 0 }] }, /duplicate-obstacle/)
  const max = run(id, { width: 24, height: 24, goal: { x: 23, y: 23 }, obstacles: [], maxSteps: 575 })
  assert.equal(max.minimumSteps, 46); assert.ok(number(max.visitedCells) <= 576)
})

test('twin compares converted properties, wrapped poses, dimension mismatch and record membership', () => {
  const id = ids[1], original = run(id), comparison = rows(original.comparisons)[0]
  near(comparison.positionDistanceM, 0.01); near(comparison.yawDifferenceDeg, 2)
  assert.deepEqual(comparison.positionDeltaM, { x: '0.01', y: '0', z: '0' })
  assert.equal(comparison.poseWithinTolerance, false)
  const reach = rows(comparison.propertyChanges)[0]
  assert.equal(reach.deltaBaseUnits, '0'); assert.equal(reach.beforeValueBaseUnits, '0.1'); assert.equal(reach.unitChanged, true)
  const old = rows(sample(id).before)[0]
  assert.equal(rows(run(id, { after: [old] }).comparisons)[0].kind, 'unchanged')
  assert.equal(rows(run(id, { after: [] }).comparisons)[0].kind, 'removed')
  assert.equal(rows(run(id, { before: [] }).comparisons)[0].kind, 'added')
  const mismatch = { ...old, properties: [{ name: 'reach', value: '1', unit: 'deg' }] }
  const p = rows(rows(run(id, { after: [mismatch] }).comparisons)[0].propertyChanges)[0]
  assert.equal(p.state, 'unit-incompatible'); assert.equal(p.deltaBaseUnits, null)
  const boundary = { ...old, pose: { x: '3', y: '4', z: '0', yawDeg: '179' } }
  assert.equal(rows(run(id, { after: [boundary], tolerances: { lengthM: '0.005', angleDeg: '0', ratio: '0' } }).comparisons)[0].poseWithinTolerance, true)
  reject(id, { before: [old, old] }, /duplicate-key/)
  reject(id, { after: [{ ...old, properties: [{ name: 'a', unit: 'm', value: '0' }, { name: 'a', unit: 'mm', value: '0' }] }] }, /duplicate-property/)
  reject(id, { after: [{ ...old, pose: { ...row(old.pose), yawDeg: '181' } }] }, /yaw-outside/)
  reject(id, { tolerances: { lengthM: '-1', angleDeg: '1', ratio: '1' } })
})

test('weighted fit obeys independently solved normal equations and weighted residual orthogonality', () => {
  const id = ids[2], pairs = [{ x: '-2', y: '3', weight: '1' }, { x: '0', y: '1', weight: '4' }, { x: '1', y: '4', weight: '2' }, { x: '3', y: '9', weight: '3' }]
  const W = pairs.reduce((s, p) => s + Number(p.weight), 0), X = pairs.reduce((s, p) => s + Number(p.weight) * Number(p.x), 0), Y = pairs.reduce((s, p) => s + Number(p.weight) * Number(p.y), 0)
  const XX = pairs.reduce((s, p) => s + Number(p.weight) * Number(p.x) ** 2, 0), XY = pairs.reduce((s, p) => s + Number(p.weight) * Number(p.x) * Number(p.y), 0)
  const slope = (W * XY - X * Y) / (W * XX - X * X), intercept = (Y - slope * X) / W
  const r = run(id, { pairs }), residuals = rows(r.residuals)
  near(r.slope, slope); near(r.intercept, intercept)
  let residualSum = 0, crossSum = 0, sse = 0
  residuals.forEach((p, j) => { const residual = Number(pairs[j].y) - intercept - slope * Number(pairs[j].x); near(p.residual, residual); residualSum += Number(pairs[j].weight) * number(p.residual); crossSum += Number(pairs[j].weight) * Number(pairs[j].x) * number(p.residual); sse += Number(pairs[j].weight) * residual ** 2 })
  near(residualSum, 0); near(crossSum, 0); near(r.weightedSSE, sse); near(r.weightedRMSE, Math.sqrt(sse / W))
  const replicated = run(id, { pairs: [...pairs, ...pairs] })
  near(replicated.slope, slope); near(replicated.weightedSSE, sse * 2)
})

test('fit rejects zero/negative weights and degenerate x; supports finite extreme decimal separation', () => {
  const id = ids[2]
  reject(id, { pairs: [{ x: '1', y: '1', weight: '1' }, { x: '1.000000', y: '2', weight: '1' }] }, /degenerate-x/)
  for (const weight of ['0', '-1']) reject(id, { pairs: [{ x: '0', y: '1', weight }, { x: '1', y: '3', weight: '1' }] })
  const r = run(id, { pairs: [{ x: '0', y: '-999999', weight: '0.000001' }, { x: '0.000001', y: '999999', weight: '999999' }] })
  assert.equal(r.finiteChecked, true); assert.ok(Number.isFinite(Number(r.slope)))
  near(run(id).slope, 2); assert.equal(run(id).weightedSSE, '0')
  for (const weight of ['1', '999999']) {
    const offset = run(id, { pairs: [{ x: '999999', y: '0', weight: '0.000001' }, { x: '999999.000001', y: '1', weight }] })
    assert.equal(offset.slope, '1000000'); assert.equal(offset.intercept, '-999999000000')
    assert.equal(offset.weightedSSE, '0'); assert.deepEqual(rows(offset.residuals).map(p => p.residual), ['0', '0'])
  }
})

test('Nyquist equality is not safe, exact folding handles multiples, zero band and declared assumptions', () => {
  const id = ids[3]
  assert.equal(run(id).state, 'undersampled'); assert.equal(rows(run(id).tones)[1].foldedHz, '30')
  assert.equal(run(id, { sampleRateHz: '140' }).state, 'nyquist-boundary')
  assert.equal(run(id, { sampleRateHz: '140.000001' }).state, 'strict-nyquist-satisfied')
  const folded = run(id, { sampleRateHz: '0.000003', highestBandHz: '0.000006', tonesHz: ['0.000006', '0.000005', '0.000001'] })
  assert.deepEqual(rows(folded.tones).map(t => t.foldedHz), ['0', '0.000001', '0.000001']); assert.equal(folded.nyquistHz, '0.0000015')
  assert.equal(run(id, { highestBandHz: '0', tonesHz: [] }).state, 'strict-nyquist-satisfied')
  reject(id, { sampleRateHz: '0' }); reject(id, { highestBandHz: '10' }); reject(id, { assumption: 'irregular' })
  reject(id, { tonesHz: ['20', '20.000000'] }, /duplicate-tone/)
})

test('critical path handles fork/join, disconnected nodes, resource overlap and zero duration', () => {
  const id = ids[4], tasks = [
    { key: 'a', durationTicks: 2, dependsOn: [], resources: ['bench'] },
    { key: 'b', durationTicks: 4, dependsOn: ['a'], resources: ['bench'] },
    { key: 'c', durationTicks: 1, dependsOn: ['a'], resources: ['bench'] },
    { key: 'd', durationTicks: 3, dependsOn: ['b', 'c'], resources: ['bench'] },
    { key: 'e', durationTicks: 1, dependsOn: [], resources: [] },
    { key: 'zero', durationTicks: 0, dependsOn: ['d'], resources: ['bench'] },
  ]
  const r = run(id, { tasks, resources: [{ key: 'bench', capacity: 1 }] }), byKey = new Map(rows(r.tasks).map(t => [t.key, t]))
  assert.equal(r.projectTicks, 9); assert.equal(byKey.get('c')!.slack, 3); assert.equal(byKey.get('e')!.slack, 8)
  assert.deepEqual(rows(r.tasks).filter(t => t.critical).map(t => t.key), ['a', 'b', 'd', 'zero'])
  assert.equal(rows(r.resourceClaims)[0].peakDeclaredUse, 2); assert.equal(rows(r.resourceClaims)[0].exceedsCapacity, true); assert.equal(r.resourceConstrainedSchedule, false)
  for (const t of tasks) for (const dependency of t.dependsOn) assert.ok(number(byKey.get(t.key)!.earliestStart) >= number(byKey.get(dependency)!.earliestFinish))
  assert.deepEqual(run(id, { tasks: [...tasks].reverse() }), r)
  const base = tasks[0]
  reject(id, { tasks: [base, base] }); reject(id, { tasks: [{ ...base, dependsOn: ['a'] }] })
  reject(id, { tasks: [{ ...base, dependsOn: ['missing'] }] })
  reject(id, { tasks: [{ ...base, dependsOn: ['b'] }, { ...base, key: 'b', dependsOn: ['a'] }] }, /cyclic/)
  reject(id, { tasks: [{ ...base, dependsOn: ['b', 'b'] }, { ...base, key: 'b' }] })
  reject(id, { tasks: [{ ...base, resources: ['undeclared'] }] })
  reject(id, { tasks: [{ ...base, resources: ['bench', 'bench'] }] })
  reject(id, { resources: [{ key: 'bench', capacity: 1 }, { key: 'bench', capacity: 2 }] })
})

test('yield and costs are exact rational arithmetic, with total rejection and scenario deltas', () => {
  const id = ids[5], r = run(id), first = rows(r.scenarios)[0], second = rows(r.scenarios)[1]
  exactFraction(first.yieldFraction, BigInt(18), BigInt(25)); exactFraction(first.expectedGood, BigInt(72)); exactFraction(first.expectedRejected, BigInt(28))
  exactFraction(first.expectedCostMicros, BigInt(102800)); exactFraction(first.costPerGoodMicros, BigInt(102800), BigInt(72))
  exactFraction(second.expectedGood, BigInt(171), BigInt(2)); exactFraction(second.deltaGoodVsFirst, BigInt(27), BigInt(2)); exactFraction(second.deltaCostVsFirst, BigInt(-1350))
  const zero = rows(run(id, { scenarios: [{ key: 'zero', rejectRates: ['1'] }] }).scenarios)[0]
  assert.equal(zero.costPerGoodMicros, null); exactFraction(zero.expectedGood, BigInt(0))
  reject(id, { batchSize: Number.MAX_SAFE_INTEGER }); reject(id, { scenarios: [{ key: 'bad', rejectRates: ['1.000001'] }] })
  reject(id, { scenarios: [{ key: 'same', rejectRates: ['0'] }, { key: 'same', rejectRates: ['0.1'] }] })
  const max = rows(run(id, { batchSize: 1000000, unitCostMicros: 1000000000, rejectCostMicros: 1000000000, scenarios: [{ key: 'fine', rejectRates: Array(12).fill('0.000001') }] }).scenarios)[0]
  exactFraction(max.yieldFraction, BigInt(999999) ** BigInt(12), BigInt(1000000) ** BigInt(12))
})

test('station exact optimum beats greedy, ties are stable and infeasibility is explicit', () => {
  const id = ids[6]
  assert.deepEqual(run(id).selected, ['camera', 'gauge']); assert.equal(run(id).totalCostMicros, 6)
  const requirements = ['a', 'b', 'c', 'd', 'e', 'f'], stations = [
    { key: 'greedy', covers: ['a', 'b', 'c', 'd'], costMicros: 3 },
    { key: 'left', covers: ['a', 'b', 'e'], costMicros: 3 },
    { key: 'right', covers: ['c', 'd', 'f'], costMicros: 3 },
  ]
  assert.deepEqual(run(id, { requirements, stations }).selected, ['left', 'right'])
  const ties = [{ key: 'z', covers: ['a'], costMicros: 0 }, { key: 'a', covers: ['a'], costMicros: 0 }]
  assert.deepEqual(run(id, { requirements: ['a'], stations: ties }).selected, ['a'])
  const failure = run(id, { requirements: ['a', 'b'], stations: ties })
  assert.equal(failure.feasible, false); assert.deepEqual(failure.uncovered, ['b'])
  assert.deepEqual(run(id, { requirements: [...requirements].reverse(), stations: [...stations].reverse() }), run(id, { requirements, stations }))
  reject(id, { requirements: ['a', 'a'] }); reject(id, { stations: [ties[0], ties[0]] })
  reject(id, { requirements: ['a'], stations: [{ ...ties[0], covers: ['a', 'a'] }] })
  reject(id, { requirements: ['a'], stations: [{ ...ties[0], covers: ['b'] }] })
})

test('set cover agrees with independent dynamic programming on small coverage lattices', () => {
  const id = ids[6], requirements = ['a', 'b', 'c', 'd']
  for (let seed = 1; seed <= 30; seed++) {
    const masks = Array.from({ length: 7 }, (_, j) => (seed * (j + 3) + j * j) % 16)
    const costs = masks.map((_, j) => (seed + j * 3) % 9)
    const stations = masks.map((mask, j) => ({ key: `s-${j}`, costMicros: costs[j], covers: requirements.filter((_, k) => mask & (1 << k)) }))
    const dp = Array(16).fill(Infinity); dp[0] = 0
    masks.forEach((mask, j) => { const old = [...dp]; for (let coverage = 0; coverage < 16; coverage++) dp[coverage | mask] = Math.min(dp[coverage | mask], old[coverage] + costs[j]) })
    const r = run(id, { requirements, stations })
    assert.equal(r.feasible, dp[15] !== Infinity)
    if (r.feasible) assert.equal(r.totalCostMicros, dp[15])
  }
  const max = run(id, { requirements: ['a'], stations: Array.from({ length: 12 }, (_, j) => ({ key: `s-${j}`, covers: ['a'], costMicros: 1000000000 })) })
  assert.equal(max.subsetsExamined, 4095); assert.equal(max.totalCostMicros, 1000000000)
})

test('cut list exact conversion/quantity accumulation is material-aware and retains sub-mm decimals', () => {
  const id = ids[7], r = run(id)
  assert.equal(rows(r.groups).length, 1); assert.equal(rows(r.groups)[0].quantity, 5); assert.equal(r.totalLengthM, '5')
  const tiny = run(id, { cuts: [{ material: 'timber', unit: 'mm', length: '0.000001', quantity: 3 }, { material: 'steel', unit: 'm', length: '0.1', quantity: 2 }, { material: 'steel', unit: 'cm', length: '10.000000', quantity: 5 }] })
  assert.equal(tiny.totalLengthM, '0.700000003'); assert.equal(rows(tiny.groups).length, 2)
  reject(id, { cuts: [{ material: 'steel', unit: 'm', length: '0', quantity: 1 }] })
  reject(id, { cuts: [{ material: 'steel', unit: 'inch', length: '1', quantity: 1 }] })
  reject(id, { cuts: [{ material: 'steel', unit: 'm', length: '1', quantity: Number.MAX_SAFE_INTEGER + 1 }] })
  const max = run(id, { cuts: Array(128).fill({ material: 'steel', unit: 'm', length: '999999.999999', quantity: 1000000 }) })
  assert.equal(max.totalQuantity, 128000000); assert.equal(max.totalLengthM, '127999999999872')
})

test('summary drift compares means/variances, treats zero variance explicitly and rejects invalid summaries', () => {
  const id = ids[8], f = rows(run(id).features)[0]
  assert.equal(f.meanDifference, '3'); assert.equal(f.standardizedMeanShift, '1.5'); assert.equal(f.varianceRatio, '2'); assert.equal(f.state, 'mean-shift-flagged')
  const feature = { name: 'constant', reference: { count: 1, mean: '2', variance: '0' }, current: { count: 2, mean: '3', variance: '1' } }
  const zero = rows(run(id, { features: [feature] }).features)[0]
  assert.equal(zero.standardizedMeanShift, null); assert.equal(zero.varianceRatio, null); assert.equal(zero.state, 'zero-reference-variance')
  reject(id, { features: [feature], varianceConvention: 'sample' }); reject(id, { features: [feature, feature] })
  reject(id, { features: [{ ...feature, reference: { count: 2, mean: '0', variance: '-1' } }] })
  reject(id, { maxStandardizedMeanShift: '0' })
  assert.equal(rows(run(id, { maxStandardizedMeanShift: '1.5' }).features)[0].state, 'within-declared-mean-threshold')
})

test('threshold sweep counts continuous rising events, rest duration, misses and first-active latency', () => {
  const id = ids[9], trials = [
    mkTrial('rest', 0, 100, [[0, '0.8'], [20, '0.1'], [50, '0.8']]),
    mkTrial('intention', 100, 200, [[100, '0.8'], [150, '0.1']]),
    mkTrial('rest', 200, 300, [[200, '0.8'], [250, '0.1']]),
    mkTrial('intention', 300, 400, [[300, '0.1'], [320, '0.8']]),
    mkTrial('intention', 400, 500, [[400, '0.1']]),
  ]
  const r = rows(run(id, { trials, thresholds: ['0.5', '0.9'] }).thresholds)
  assert.equal(r[0].restFalseEvents, 3); assert.equal(r[0].restActiveMs, 120); assert.equal(r[0].missedIntentionTrials, 1)
  assert.deepEqual(r[0].latencyByIntentionMs, [0, 20, null]); assert.equal(r[0].meanLatencyMs, '10')
  assert.equal(r[1].restFalseEvents, 0); assert.equal(r[1].missedIntentionTrials, 3); assert.equal(r[1].meanLatencyMs, null)
  const carry = rows(run(id, { trials: [mkTrial('intention', 0, 10, [[0, '0.7']]), mkTrial('rest', 10, 20, [[10, '0.7']])], thresholds: ['0.7'] }).thresholds)[0]
  assert.equal(carry.restFalseEvents, 0); assert.equal(carry.restActiveMs, 10)
  reject(id, { thresholds: ['0.5', '0.500000'] }, /duplicate-threshold/)
  reject(id, { thresholds: ['1.000001'] })
})

test('score trial boundaries are contiguous, ordered, complete at starts, nonempty and bounded in total', () => {
  for (const id of [ids[9], ids[10]]) {
    reject(id, { trials: [mkTrial('rest', 1, 10, [[1, '0']])] }, /start-at-zero/)
    reject(id, { trials: [mkTrial('rest', 0, 10, [[0, '0']]), mkTrial('intention', 11, 20, [[11, '1']])] }, /noncontiguous/)
    reject(id, { trials: [mkTrial('rest', 0, 10, [[1, '0']])] }, /trial-start/)
    reject(id, { trials: [mkTrial('rest', 0, 10, [[0, '0'], [0, '1']])] }, /unordered/)
    reject(id, { trials: [mkTrial('rest', 0, 10, [[0, '0'], [10, '1']])] }, /out-of-trial/)
    reject(id, { trials: [mkTrial('rest', 0, 10, [[0, '0'], [8, '1'], [4, '0']])] }, /unordered/)
    reject(id, { trials: [mkTrial('rest', 0, 0, [[0, '0']])] })
    const tooMany = Array.from({ length: 5 }, (_, j) => mkTrial(j % 2 ? 'intention' : 'rest', j * 128, (j + 1) * 128, Array.from({ length: 128 }, (_, k) => [j * 128 + k, '0'])))
    reject(id, { trials: tooMany }, /total-score-limit/)
  }
})

test('dwell timers span trial boundaries, equality updates precede timers and final endpoints are exclusive', () => {
  const id = ids[10], a = { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 10, releaseMs: 5 }
  const trials = [mkTrial('rest', 0, 5, [[0, '0.9']]), mkTrial('intention', 5, 30, [[5, '0.9'], [20, '0.1']])]
  const r = run(id, { trials, a, b: a }), replay = row(r.a)
  assert.deepEqual(replay.events, [{ timeMs: 10, type: 'onset' }, { timeMs: 25, type: 'release' }])
  assert.deepEqual(replay.latencyByIntentionMs, [5]); assert.equal(replay.restFalseEvents, 0)
  assert.deepEqual(r.a, r.b); assert.deepEqual(r.deltaBMinusA, { restFalseEvents: 0, restActiveMs: 0, missedIntentionTrials: 0, pairedLatencyDeltaByIntentionMs: [0], meanPairedDetectedLatencyDeltaMs: '0' })
  const canceled = row(run(id, { a, b: a, trials: [mkTrial('rest', 0, 20, [[0, '0.9'], [10, '0.1']])] }).a)
  assert.deepEqual(canceled.events, []); assert.equal(canceled.finalState, 'idle')
  const final = row(run(id, { a, b: a, trials: [mkTrial('intention', 0, 10, [[0, '0.9']])] }).a)
  assert.deepEqual(final.events, []); assert.equal(final.finalState, 'pending-onset'); assert.deepEqual(final.latencyByIntentionMs, [null])
  const zero = { ...a, dwellMs: 0, releaseMs: 0 }
  const instant = row(run(id, { a: zero, b: zero, trials: [mkTrial('rest', 0, 20, [[0, '0.7'], [10, '0.3']])] }).a)
  assert.deepEqual(instant.events, [{ timeMs: 0, type: 'onset' }, { timeMs: 10, type: 'release' }]); assert.equal(instant.restActiveMs, 10)
  reject(id, { a: { ...a, releaseThreshold: '0.7' } }, /below-onset/)
})

test('paired latency comparison never mixes different detected-trial populations', () => {
  const id = ids[10], trials = [mkTrial('intention', 0, 10, [[0, '0.9'], [3, '0.1']]), mkTrial('intention', 10, 30, [[10, '0.9']])]
  const a = { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 1, releaseMs: 0 }, b = { ...a, dwellMs: 5 }
  const r = run(id, { trials, a, b }), delta = row(r.deltaBMinusA)
  assert.deepEqual(row(r.a).latencyByIntentionMs, [1, 1]); assert.deepEqual(row(r.b).latencyByIntentionMs, [null, 5])
  assert.deepEqual(delta.pairedLatencyDeltaByIntentionMs, [null, 4]); assert.equal(delta.meanPairedDetectedLatencyDeltaMs, '4')
})

test('hysteresis retains activation in the middle band and cancels equal-time release on recovery', () => {
  const id = ids[10], p = { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 0, releaseMs: 5 }
  const replay = row(run(id, { a: p, b: p, trials: [mkTrial('rest', 0, 25, [[0, '0.9'], [5, '0.5'], [10, '0.1'], [15, '0.5'], [20, '0.1']])] }).a)
  assert.deepEqual(replay.events, [{ timeMs: 0, type: 'onset' }])
  assert.equal(replay.restActiveMs, 25); assert.equal(replay.finalState, 'pending-release'); assert.equal(replay.pendingSinceMs, 20)
})

// Independent millisecond oracle: not the segment/timer-jump implementation in the product.
function tickOracle(scores: number[], dwellMs: number, releaseMs: number) {
  let active = false, pendingTicks = 0
  const events: { timeMs: number; type: string }[] = [], activeAt: boolean[] = []
  for (let t = 0; t < scores.length; t++) {
    const qualifies = active ? scores[t] <= 0.3 : scores[t] >= 0.7
    if (!qualifies) pendingTicks = 0
    else {
      const delay = active ? releaseMs : dwellMs
      if (pendingTicks >= delay) { active = !active; pendingTicks = 0; events.push({ timeMs: t, type: active ? 'onset' : 'release' }) }
      else pendingTicks++
    }
    activeAt.push(active)
  }
  return { events, activeAt }
}

test('paired dwell replay agrees with independent tick oracle over exhaustive pulse trains and delays', () => {
  const id = ids[10]
  for (let mask = 0; mask < 64; mask++) for (const [dwellMs, releaseMs] of [[0, 0], [2, 1], [3, 3], [10, 10]]) {
    const scores = Array.from({ length: 12 }, (_, t) => mask & (1 << Math.floor(t / 2)) ? 0.9 : 0.1)
    const first = mkTrial('rest', 0, 6, [[0, String(scores[0])], [2, String(scores[2])], [4, String(scores[4])]])
    const second = mkTrial('intention', 6, 12, [[6, String(scores[6])], [8, String(scores[8])], [10, String(scores[10])]])
    const parameters = { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs, releaseMs }, oracle = tickOracle(scores, dwellMs, releaseMs)
    const actual = row(run(id, { trials: [first, second], a: parameters, b: parameters }).a)
    assert.deepEqual(actual.events, oracle.events, `mask=${mask} dwell=${dwellMs} release=${releaseMs}`)
    assert.equal(actual.restActiveMs, oracle.activeAt.slice(0, 6).filter(Boolean).length)
    assert.equal(actual.restFalseEvents, oracle.events.filter(e => e.type === 'onset' && e.timeMs < 6).length)
    const latency = oracle.activeAt.slice(6).findIndex(Boolean)
    assert.deepEqual(actual.latencyByIntentionMs, [latency < 0 ? null : latency])
  }
})

test('synthetic generator has original deterministic LCG noise, explicit artifacts and no participant data', () => {
  const id = ids[11], r = run(id)
  assert.equal((r.labels as string[])[4], 'spike'); assert.deepEqual((r.waveform as string[]).slice(20, 23), ['0', '0', '0'])
  const pure = run(id, { seed: 0, noiseAmplitude: '0', artifacts: [] }), wave = pure.waveform as string[]
  near(wave[0], 0); near(wave[4], 1); near(wave[8], 0); near(wave[12], -1)
  const noise = run(id, { seed: 0, amplitude: '0', noiseAmplitude: '1', artifacts: [] })
  near((noise.waveform as string[])[0], 2 * 1013904223 / 4294967296 - 1, 1e-12)
  assert.notDeepEqual(run(id, { seed: 0 }).waveform, run(id, { seed: 1 }).waveform)
  const blink = run(id, { amplitude: '0', noiseAmplitude: '0', artifacts: [{ kind: 'blink', startIndex: 0, length: 3, magnitude: '2' }] })
  near((blink.waveform as string[])[1], 2); near((blink.waveform as string[])[0], Math.SQRT2)
  reject(id, { frequencyHz: '64' }); reject(id, { frequencyHz: '0' })
  reject(id, { artifacts: [{ kind: 'spike', startIndex: 0, length: 2, magnitude: '1' }] })
  reject(id, { artifacts: [{ kind: 'dropout', startIndex: 0, length: 1, magnitude: '1' }] })
  reject(id, { artifacts: [{ kind: 'blink', startIndex: 31, length: 2, magnitude: '1' }] })
  const artifact = { kind: 'spike', startIndex: 0, length: 1, magnitude: '1' }
  reject(id, { artifacts: [artifact, artifact] }, /overlapping/)
})

test('confidence report Brier and ECE match direct arithmetic; boundary, units and empty bins are explicit', () => {
  const id = ids[12], r = run(id)
  near(r.brier, 1 / 12); near(r.ece, 1 / 6)
  assert.deepEqual(rows(r.bins).map(b => b.count), [1, 2]); assert.equal(rows(r.bins)[1].upperInclusive, true)
  exactFraction(rows(r.bins)[1].lowerBound, BigInt(1), BigInt(2))
  const pairs = [{ score: '0', outcome: 1 }, { score: '0.25', outcome: 0 }, { score: '0.5', outcome: 1 }, { score: '0.75', outcome: 0 }, { score: '1', outcome: 1 }]
  const bins = rows(run(id, { pairs, binCount: 4 }).bins)
  assert.deepEqual(bins.map(b => b.count), [1, 1, 1, 2])
  const equivalent = run(id, { pairs: pairs.map(p => ({ score: String(Number(p.score) * 100), outcome: p.outcome })), scoreUnits: 'percent', binCount: 4 })
  assert.deepEqual(equivalent, run(id, { pairs, binCount: 4 }))
  const empty = rows(run(id, { pairs: [{ score: '1', outcome: 0 }], binCount: 3 }).bins)
  assert.equal(empty[0].meanScore, null); assert.equal(empty[0].absoluteGap, null); exactFraction(empty[1].lowerBound, BigInt(1), BigInt(3))
  const perfect = run(id, { pairs: [{ score: '0', outcome: 0 }, { score: '1', outcome: 1 }] })
  assert.equal(perfect.brier, '0'); assert.equal(perfect.ece, '0')
  reject(id, { pairs: [{ score: '1.000001', outcome: 0 }] }); reject(id, { scoreUnits: 'percent', pairs: [{ score: '100.000001', outcome: 0 }] })
  reject(id, { pairs: [{ score: '0.5', outcome: 2 }] })
})

test('confidence calculation agrees with independent bin sums across varied datasets', () => {
  const id = ids[12]
  for (let n = 2; n <= 20; n++) {
    const pairs = Array.from({ length: 31 }, (_, j) => ({ score: String((j * n % 101) / 100), outcome: j % 2 }))
    const grouped = Array.from({ length: n }, () => [] as typeof pairs)
    pairs.forEach(p => grouped[Math.min(n - 1, Math.floor(Number(p.score) * n + 1e-12))].push(p))
    const expectedBrier = pairs.reduce((s, p) => s + (Number(p.score) - p.outcome) ** 2, 0) / pairs.length
    const expectedECE = grouped.reduce((s, group) => s + Math.abs(group.reduce((v, p) => v + Number(p.score) - p.outcome, 0)), 0) / pairs.length
    const result = run(id, { pairs, binCount: n })
    near(result.brier, expectedBrier); near(result.ece, expectedECE)
  }
})

test('fictional debrief only evaluates declared options/utilities and handles ties and extremes', () => {
  const id = ids[13], r = run(id), decision = rows(r.decisions)[0]
  assert.equal(decision.declaredRegret, 3); assert.equal(decision.observedMinusDeclared, -1); assert.equal(r.intelligenceMeasured, false)
  const extreme = { options: [{ action: 'a', utility: -1000000 }, { action: 'b', utility: 1000000 }, { action: 'c', utility: 1000000 }], chosen: 'a', observedUtility: 1000000 }
  const max = run(id, { trace: Array(64).fill(extreme) })
  assert.equal(max.totalDeclaredRegret, 128000000); assert.equal(max.totalObservedUtility, 64000000)
  assert.deepEqual(rows(max.decisions)[0].bestDeclaredActions, ['b', 'c'])
  reject(id, { trace: [{ ...extreme, chosen: 'missing' }] }, /not-declared/)
  reject(id, { trace: [{ ...extreme, options: [extreme.options[0], extreme.options[0]] }] }, /duplicate-action/)
  reject(id, { trace: [{ ...extreme, observedUtility: Number.MAX_SAFE_INTEGER + 1 }] })
  reject(id, { evaluation: 'investment' }); reject(id, { fictional: false })
})

test('maximum declared loops remain bounded and outputs stay under 64KiB', () => {
  const twin = (version: number) => Array.from({ length: 8 }, (_, j) => ({ key: `part-${j}`, poseUnit: 'm', pose: { x: String(version), y: '0', z: '0', yawDeg: '0' }, properties: Array.from({ length: 6 }, (_, k) => ({ name: `prop-${version}-${k}`, value: '999999.999999', unit: 'mm' })) }))
  const scoreTrials = Array.from({ length: 4 }, (_, j) => mkTrial(j % 2 ? 'intention' : 'rest', j * 128, (j + 1) * 128, Array.from({ length: 128 }, (_, k) => [j * 128 + k, k % 2 ? '0' : '1'])))
  const params = { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 0, releaseMs: 0 }
  const changes: Record<string, Row> = {
    [ids[1]]: { before: twin(0), after: twin(1) },
    [ids[2]]: { pairs: Array.from({ length: 64 }, (_, j) => ({ x: String(j), y: String(2 * j + 1), weight: '1' })) },
    [ids[3]]: { highestBandHz: '999999.999999', tonesHz: Array.from({ length: 16 }, (_, j) => String(j * 50000)) },
    [ids[4]]: { tasks: Array.from({ length: 48 }, (_, j) => ({ key: `t-${j}`, durationTicks: 1000000, dependsOn: j ? [`t-${j - 1}`] : [], resources: [] })), resources: [] },
    [ids[5]]: { scenarios: Array.from({ length: 16 }, (_, j) => ({ key: `scenario-${j}`, rejectRates: Array(12).fill('0.999999') })) },
    [ids[7]]: { cuts: Array.from({ length: 128 }, (_, j) => ({ material: 'steel', unit: 'm', length: `${j + 1}.000001`, quantity: 1000000 })) },
    [ids[8]]: { features: Array.from({ length: 24 }, (_, j) => ({ name: `feature-${j}`, reference: { count: 1000000, mean: '-999999', variance: '0.000001' }, current: { count: 1000000, mean: '999999', variance: '999999' } })) },
    [ids[9]]: { trials: scoreTrials, thresholds: Array.from({ length: 24 }, (_, j) => String(j / 100)) },
    [ids[10]]: { trials: scoreTrials, a: params, b: params },
    [ids[11]]: { sampleCount: 256, seed: 4294967295, artifacts: Array.from({ length: 8 }, (_, j) => ({ kind: 'blink', startIndex: j * 32, length: 32, magnitude: '999999.999999' })) },
    [ids[12]]: { pairs: Array.from({ length: 256 }, (_, j) => ({ score: '0.999999', outcome: j % 2 })), binCount: 20 },
    [ids[13]]: { trace: Array(64).fill({ options: Array.from({ length: 12 }, (_, j) => ({ action: `action-${j}`, utility: 100 })), chosen: 'action-0', observedUtility: -100 }) },
  }
  for (const [id, change] of Object.entries(changes)) {
    const input = { ...sample(id), ...change }, result = run(id, change)
    assert.ok(byteLength(input) <= 32768); assert.ok(byteLength(result) <= 65536, `${id} exceeds output cap`)
  }
  const dense = run(ids[10], changes[ids[10]])
  assert.equal(rows(row(dense.a).events).length, 512)
  assert.equal(run(ids[4], changes[ids[4]]).projectTicks, 48000000)
})

test('aggregate 32KiB limit applies even to schema-valid combinations', () => {
  const id = ids[13], actions = Array.from({ length: 12 }, (_, j) => ({ action: `action-${String(j).padStart(17, '0')}`, utility: 999999 }))
  const input = { ...sample(id), trace: Array(64).fill({ options: actions, chosen: actions[0].action, observedUtility: 999999 }) }
  assert.ok(schemaAccepts(SPECS[id].inputSchema, input)); assert.ok(byteLength(input) > 32768)
  assert.throws(() => buildPhysicalNeuralExpansion(id, input), /input-32KiB/)
})
