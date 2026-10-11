/** Offline, bounded public/synthetic calculators. No integrations, model calls or hardware. */
import { objectSchema as obj, arraySchema as arr, enumSchema as en, schemaAccepts, type MicroSchema } from './micro-schema.ts'

type Spec = { amount: string; title: string; description: string; category: string; inputSchema: MicroSchema; sample: Record<string, unknown>; resultSchema: MicroSchema }
const integer = (minimum: number, maximum: number): MicroSchema => ({ type: 'integer', minimum, maximum })
// A bare JS "$" also matches before a final newline; assert the actual end of input.
const strictEnd = '$(?![\\s\\S])'
const token: MicroSchema = { type: 'string', minLength: 1, maxLength: 24, pattern: `^[a-z][a-z0-9-]{0,23}${strictEnd}` }
// Six fractional places, magnitude below one million, no exponent/coercion/NaN.
const dec: MicroSchema = { type: 'string', maxLength: 14, pattern: `^-?(0|[1-9][0-9]{0,5})(\\.[0-9]{1,6})?${strictEnd}` }
const nonnegative: MicroSchema = { ...dec, maxLength: 13, pattern: `^(0|[1-9][0-9]{0,5})(\\.[0-9]{1,6})?${strictEnd}` }
const ratio: MicroSchema = { type: 'string', maxLength: 8, pattern: `^(0(\\.[0-9]{1,6})?|1(\\.0{1,6})?)${strictEnd}` }
const decimalResult: MicroSchema = { type: 'string', maxLength: 38, pattern: `^-?(0|[1-9][0-9]{0,23})(\\.[0-9]{1,12})?${strictEnd}` }
const nil: MicroSchema = { type: 'null' }
const nullable = (s: MicroSchema): MicroSchema => ({ oneOf: [s, nil] })
const yes: MicroSchema = { type: 'boolean', enum: [true] }
const no: MicroSchema = { type: 'boolean', enum: [false] }
const bool: MicroSchema = { type: 'boolean' }
const dataClass = en('public', 'synthetic')
const input = (p: Record<string, MicroSchema>) => obj({ dataClass, ...p })
const output = (p: Record<string, MicroSchema>) => obj({ dataClass, ...p })
const count = integer(0, 1000000000)
const signedCount = integer(-1000000000, 1000000000)
const fraction = obj({ numerator: { type: 'string', maxLength: 200, pattern: `^(0|-?[1-9][0-9]{0,198})${strictEnd}` }, denominator: { type: 'string', maxLength: 200, pattern: `^[1-9][0-9]{0,199}${strictEnd}` } })
const point = obj({ x: integer(0, 23), y: integer(0, 23) })
const lengthUnit = en('mm', 'cm', 'm')
const propertyUnit = en('mm', 'cm', 'm', 'deg', 'ratio')
const twin = obj({ key: token, poseUnit: lengthUnit, pose: obj({ x: dec, y: dec, z: dec, yawDeg: dec }), properties: arr(obj({ name: token, value: dec, unit: propertyUnit }), 0, 6) })
const summary = obj({ count: integer(1, 1000000), mean: dec, variance: nonnegative })
const trial = obj({ label: en('rest', 'intention'), startMs: integer(0, 600000), endMs: integer(1, 600000), points: arr(obj({ timeMs: integer(0, 599999), score: ratio }), 1, 128) })
const trials = arr(trial, 1, 16)
const metrics = { restFalseEvents: count, restActiveMs: count, missedIntentionTrials: count, intentionTrials: count, latencyByIntentionMs: arr(nullable(count), 0, 16), meanLatencyMs: nullable(decimalResult) }
const replay = obj({ ...metrics, events: arr(obj({ timeMs: count, type: en('onset', 'release') }), 0, 512), finalState: en('idle', 'pending-onset', 'active', 'pending-release'), pendingSinceMs: nullable(count) })
const parameters = obj({ onsetThreshold: ratio, releaseThreshold: ratio, dwellMs: integer(0, 10000), releaseMs: integer(0, 10000) })
const demoTrials = [
  { label: 'rest', startMs: 0, endMs: 100, points: [{ timeMs: 0, score: '0.1' }, { timeMs: 50, score: '0.8' }] },
  { label: 'intention', startMs: 100, endMs: 200, points: [{ timeMs: 100, score: '0.8' }, { timeMs: 150, score: '0.2' }] },
]

export const SPECS: Record<string, Spec> = {
  'toy-grid-path-dry-run': {
    amount: '34500', title: 'Toy grid path dry run', category: 'physical-ai',
    description: 'Deterministic four-neighbor BFS on a grid of at most 24×24 cells. Returns a shortest obstacle-free route or an explicit unreachable/step-limit result. Toy discrete geometry only; no hardware, collision certification or physical feasibility claim.',
    inputSchema: input({ width: integer(1, 24), height: integer(1, 24), start: point, goal: point, obstacles: arr(point, 0, 576), maxSteps: integer(0, 575) }),
    sample: { dataClass: 'synthetic', width: 4, height: 3, start: { x: 0, y: 0 }, goal: { x: 3, y: 0 }, obstacles: [{ x: 1, y: 0 }], maxSteps: 8 },
    resultSchema: output({ state: en('found', 'unreachable', 'step-limit'), route: arr(point, 0, 576), minimumSteps: nullable(integer(0, 575)), visitedCells: integer(1, 576), maxSteps: integer(0, 575), method: en('bounded-four-neighbor-bfs'), hardwareControlled: no }),
  },
  'digital-twin-config-diff': {
    amount: '15500', title: 'Digital twin configuration diff', category: 'physical-ai',
    description: 'Compare up to eight declared records per version, converting length units and comparing properties, XYZ poses and wrapped yaw against separate length/angle/ratio tolerances. Reports additions, removals, unit changes and incompatible dimensions. Not field certification.',
    inputSchema: input({ before: arr(twin, 0, 8), after: arr(twin, 0, 8), tolerances: obj({ lengthM: nonnegative, angleDeg: nonnegative, ratio: nonnegative }) }),
    sample: { dataClass: 'synthetic', before: [{ key: 'arm', poseUnit: 'mm', pose: { x: '0', y: '0', z: '0', yawDeg: '179' }, properties: [{ name: 'reach', value: '100', unit: 'mm' }] }], after: [{ key: 'arm', poseUnit: 'm', pose: { x: '0.01', y: '0', z: '0', yawDeg: '-179' }, properties: [{ name: 'reach', value: '10', unit: 'cm' }] }], tolerances: { lengthM: '0.005', angleDeg: '3', ratio: '0.01' } },
    resultSchema: output({ comparisons: arr(obj({ key: token, kind: en('added', 'removed', 'changed', 'unchanged'), poseUnitChanged: bool, positionDeltaM: nullable(obj({ x: decimalResult, y: decimalResult, z: decimalResult })), positionDistanceM: nullable(decimalResult), yawDifferenceDeg: nullable(decimalResult), poseWithinTolerance: nullable(bool), propertyChanges: arr(obj({ name: token, state: en('added', 'removed', 'unit-incompatible', 'within-tolerance', 'outside-tolerance'), beforeUnit: nullable(propertyUnit), afterUnit: nullable(propertyUnit), beforeValueBaseUnits: nullable(decimalResult), afterValueBaseUnits: nullable(decimalResult), deltaBaseUnits: nullable(decimalResult), baseUnit: en('m', 'deg', 'ratio', 'incompatible'), unitChanged: bool }), 0, 12) }), 0, 16), poseAssumption: en('common-declared-coordinate-frame; yaw-only-not-full-3d-orientation'), fieldCertified: no }),
  },
  'weighted-calibration-fit': {
    amount: '26500', title: 'Weighted linear calibration fit', category: 'physical-ai',
    description: 'Fit y = intercept + slope*x to 2–64 declared pairs using positive weights and exact rational normal equations. Returns residuals and weighted SSE rounded to 12 decimal places, plus finite float64 RMSE. Rejects degenerate X values; weights are not verified uncertainties. Not field certification.',
    inputSchema: input({ pairs: arr(obj({ x: dec, y: dec, weight: nonnegative }), 2, 64) }),
    sample: { dataClass: 'synthetic', pairs: [{ x: '0', y: '1', weight: '1' }, { x: '1', y: '3', weight: '2' }, { x: '2', y: '5', weight: '1' }] },
    resultSchema: output({ slope: decimalResult, intercept: decimalResult, weightedSSE: decimalResult, weightedRMSE: decimalResult, residuals: arr(obj({ sampleIndex: integer(0, 63), predicted: decimalResult, residual: decimalResult }), 2, 64), arithmetic: en('exact-rational-fit-and-sse-rounded-12-places; float64-rmse'), finiteChecked: yes, fieldCertified: no }),
  },
  'sampling-aliasing-check': {
    amount: '6500', title: 'Sampling and aliasing check', category: 'physical-ai',
    description: 'Check a declared bandwidth and up to 16 tones against the strict Nyquist inequality, with equality reported separately. Computes folded tone frequencies exactly. Assumes uniform sampling, bandlimited input and no jitter; does not verify filters, acquisition hardware or real signal bandwidth.',
    inputSchema: input({ sampleRateHz: nonnegative, highestBandHz: nonnegative, tonesHz: arr(nonnegative, 0, 16), assumption: en('uniform-bandlimited-no-jitter') }),
    sample: { dataClass: 'public', sampleRateHz: '100', highestBandHz: '70', tonesHz: ['20', '70'], assumption: 'uniform-bandlimited-no-jitter' },
    resultSchema: output({ state: en('strict-nyquist-satisfied', 'nyquist-boundary', 'undersampled'), nyquistHz: decimalResult, requiredRateExclusiveHz: decimalResult, tones: arr(obj({ frequencyHz: decimalResult, foldedHz: decimalResult, aliases: bool }), 0, 16), assumptions: en('uniform-bandlimited-no-jitter; declared-bandwidth; filters-unverified'), hardwareVerified: no }),
  },
  'assembly-critical-path': {
    amount: '57000', title: 'Assembly critical path', category: 'physical-ai',
    description: 'Compute earliest/latest starts and finishes and slack on a declared DAG of at most 48 tasks. Rejects cycles and unknown dependencies. Reports peak overlap of declared unit resource claims at the earliest schedule; does not optimize a resource-constrained schedule or verify physical resources.',
    inputSchema: input({ tasks: arr(obj({ key: token, durationTicks: integer(0, 1000000), dependsOn: arr(token, 0, 48), resources: arr(token, 0, 8) }), 1, 48), resources: arr(obj({ key: token, capacity: integer(1, 16) }), 0, 16) }),
    sample: { dataClass: 'synthetic', tasks: [{ key: 'prep', durationTicks: 2, dependsOn: [], resources: ['bench'] }, { key: 'assemble', durationTicks: 3, dependsOn: ['prep'], resources: ['bench'] }], resources: [{ key: 'bench', capacity: 1 }] },
    resultSchema: output({ projectTicks: integer(0, 48000000), topologicalOrder: arr(token, 1, 48), tasks: arr(obj({ key: token, earliestStart: count, earliestFinish: count, latestStart: count, latestFinish: count, slack: count, critical: bool }), 1, 48), resourceClaims: arr(obj({ resource: token, capacity: integer(1, 16), peakDeclaredUse: integer(0, 48), exceedsCapacity: bool }), 0, 16), declaredResourcesOnly: yes, resourceConstrainedSchedule: no }),
  },
  'manufacturing-yield-sensitivity': {
    amount: '49000', title: 'Manufacturing yield sensitivity', category: 'physical-ai',
    description: 'Exact rational expected-yield and cost arithmetic for up to 16 scenarios and 12 sequential conditional reject rates. All batch units incur unit cost; rejected units incur an additional penalty. Reports differences from the first scenario and undefined cost per good unit at zero yield. Declared assumptions, not a production forecast.',
    inputSchema: input({ batchSize: integer(1, 1000000), unitCostMicros: integer(0, 1000000000), rejectCostMicros: integer(0, 1000000000), scenarios: arr(obj({ key: token, rejectRates: arr(ratio, 1, 12) }), 1, 16) }),
    sample: { dataClass: 'synthetic', batchSize: 100, unitCostMicros: 1000, rejectCostMicros: 100, scenarios: [{ key: 'baseline', rejectRates: ['0.1', '0.2'] }, { key: 'improved', rejectRates: ['0.05', '0.1'] }] },
    resultSchema: output({ scenarios: arr(obj({ key: token, yieldFraction: fraction, expectedGood: fraction, expectedRejected: fraction, expectedCostMicros: fraction, costPerGoodMicros: nullable(fraction), deltaGoodVsFirst: fraction, deltaCostVsFirst: fraction }), 1, 16), assumption: en('sequential-conditional-reject-rates; all-units-base-cost; reject-penalty'), productionForecast: no }),
  },
  'inspection-station-selection': {
    amount: '118000', title: 'Inspection station selection', category: 'physical-ai',
    description: 'Exact minimum-cost set cover over at most 12 stations and 16 declared requirements. Enumerates at most 4,095 nonempty subsets; breaks equal costs by station count then sorted keys. Reports infeasible coverage explicitly. Coverage and costs are caller declarations, not field verification.',
    inputSchema: input({ requirements: arr(token, 1, 16), stations: arr(obj({ key: token, covers: arr(token, 0, 16), costMicros: integer(0, 1000000000) }), 1, 12) }),
    sample: { dataClass: 'synthetic', requirements: ['visual', 'dimension'], stations: [{ key: 'combined', covers: ['visual', 'dimension'], costMicros: 7 }, { key: 'camera', covers: ['visual'], costMicros: 3 }, { key: 'gauge', covers: ['dimension'], costMicros: 3 }] },
    resultSchema: output({ feasible: bool, selected: arr(token, 0, 12), totalCostMicros: integer(0, 12000000000), uncovered: arr(token, 0, 16), subsetsExamined: integer(1, 4095), method: en('exact-subset-enumeration; min-cost-then-count-then-lex'), declaredCoverageOnly: yes }),
  },
  'material-cut-list-consolidation': {
    amount: '22500', title: 'Material cut list consolidation', category: 'physical-ai',
    description: 'Consolidate up to 128 cut rows by material and exact converted length in metres, summing integer quantities and total lengths without floating-point arithmetic. Supports mm/cm/m and four material classes. No kerf, stock nesting, waste optimization or fabrication certification.',
    inputSchema: input({ cuts: arr(obj({ material: en('timber', 'steel', 'aluminum', 'polymer'), unit: lengthUnit, length: nonnegative, quantity: integer(1, 1000000) }), 1, 128) }),
    sample: { dataClass: 'public', cuts: [{ material: 'steel', unit: 'mm', length: '1000', quantity: 2 }, { material: 'steel', unit: 'cm', length: '100', quantity: 3 }] },
    resultSchema: output({ groups: arr(obj({ material: en('timber', 'steel', 'aluminum', 'polymer'), lengthM: decimalResult, quantity: integer(1, 128000000), totalLengthM: decimalResult }), 1, 128), totalQuantity: integer(1, 128000000), totalLengthM: decimalResult, exactDecimalArithmetic: yes, kerfOrNestingIncluded: no }),
  },
  'feature-distribution-drift': {
    amount: '43000', title: 'Summary feature drift report', category: 'neural',
    description: 'Compare up to 24 public/synthetic feature summaries: mean differences, reference-standardized shifts and variance ratios. Explicitly flags zero reference variance. Counts and variance convention are declared, not verified; not a distribution test or clinical inference. No raw EEG, participant identifiers or full participant signals.',
    inputSchema: input({ features: arr(obj({ name: token, reference: summary, current: summary }), 1, 24), varianceConvention: en('population', 'sample'), maxStandardizedMeanShift: nonnegative }),
    sample: { dataClass: 'synthetic', features: [{ name: 'band-power', reference: { count: 100, mean: '2', variance: '4' }, current: { count: 100, mean: '5', variance: '8' } }], varianceConvention: 'population', maxStandardizedMeanShift: '1' },
    resultSchema: output({ features: arr(obj({ name: token, meanDifference: decimalResult, standardizedMeanShift: nullable(decimalResult), varianceRatio: nullable(decimalResult), state: en('mean-shift-flagged', 'within-declared-mean-threshold', 'zero-reference-variance') }), 1, 24), varianceConvention: en('population', 'sample'), distributionTestPerformed: no, participantSignalsIncluded: no }),
  },
  'intention-threshold-sweep': {
    amount: '73000', title: 'Offline intention threshold sweep', category: 'neural',
    description: 'Replay up to 24 declared thresholds over at most 512 labelled scores in contiguous half-open trials. Reports rest rising-edge false events, rest active time, intention misses and first-active latency. State carries across trials; scores are held to the next sample. Held-out status is declared, not verified. No automatic selection or live control.',
    inputSchema: input({ trials, thresholds: arr(ratio, 1, 24), scoreUnits: en('unit-interval'), evaluationSplit: en('declared-held-out-offline') }),
    sample: { dataClass: 'synthetic', trials: demoTrials, thresholds: ['0.5', '0.9'], scoreUnits: 'unit-interval', evaluationSplit: 'declared-held-out-offline' },
    resultSchema: output({ thresholds: arr(obj({ threshold: decimalResult, ...metrics }), 1, 24), semantics: en('contiguous-half-open-trials; zero-order-hold; continuous-state; first-active-latency'), heldOutVerified: no, thresholdSelected: no, liveControl: no }),
  },
  'dwell-release-comparison': {
    amount: '96000', title: 'Paired dwell and release replay', category: 'neural',
    description: 'Paired finite-state replay of onset/dwell and hysteretic release settings over at most 512 labelled offline scores. Timers and state carry across contiguous trials. At equal timestamps score changes precede timers; no event fires at the final endpoint. Reports paired false-event, miss and latency metrics. No hardware or live control.',
    inputSchema: input({ trials, a: parameters, b: parameters, scoreUnits: en('unit-interval'), evaluationSplit: en('declared-held-out-offline') }),
    sample: { dataClass: 'synthetic', trials: demoTrials, a: { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 20, releaseMs: 10 }, b: { onsetThreshold: '0.7', releaseThreshold: '0.3', dwellMs: 60, releaseMs: 20 }, scoreUnits: 'unit-interval', evaluationSplit: 'declared-held-out-offline' },
    resultSchema: output({ a: replay, b: replay, deltaBMinusA: obj({ restFalseEvents: signedCount, restActiveMs: signedCount, missedIntentionTrials: signedCount, pairedLatencyDeltaByIntentionMs: arr(nullable(signedCount), 0, 16), meanPairedDetectedLatencyDeltaMs: nullable(decimalResult) }), semantics: en('zero-order-hold; continuous-timers; updates-before-equal-time-timers; final-end-exclusive'), heldOutVerified: no, liveControl: no, hardwareControlled: no }),
  },
  'synthetic-artifact-test-pack': {
    amount: '53000', title: 'Seeded synthetic artifact test pack', category: 'neural',
    description: 'Generate 16–256 original synthetic sine/noise samples with seeded LCG noise and declared nonoverlapping blink-like pulses, single-sample spikes or dropouts. Returns artifact labels in arbitrary synthetic units. Toy test data only, not physiological simulation or third-party research data; no participant signals.',
    inputSchema: obj({ dataClass: en('synthetic'), seed: integer(0, 4294967295), sampleCount: integer(16, 256), sampleRateHz: integer(16, 4096), frequencyHz: nonnegative, amplitude: nonnegative, noiseAmplitude: nonnegative, artifacts: arr(obj({ kind: en('blink', 'spike', 'dropout'), startIndex: integer(0, 255), length: integer(1, 256), magnitude: dec }), 0, 8) }),
    sample: { dataClass: 'synthetic', seed: 42, sampleCount: 32, sampleRateHz: 128, frequencyHz: '8', amplitude: '1', noiseAmplitude: '0.05', artifacts: [{ kind: 'spike', startIndex: 4, length: 1, magnitude: '3' }, { kind: 'dropout', startIndex: 20, length: 3, magnitude: '0' }] },
    resultSchema: obj({ dataClass: en('synthetic'), seed: integer(0, 4294967295), sampleRateHz: integer(16, 4096), waveform: arr(decimalResult, 16, 256), labels: arr(en('clean', 'blink', 'spike', 'dropout'), 16, 256), generatorVersion: en('original-sine-lcg-v1'), signalUnit: en('arbitrary-synthetic'), thirdPartyResearchData: no, participantSignalsIncluded: no }),
  },
  'confidence-calibration-report': {
    amount: '47000', title: 'Binary confidence calibration report', category: 'neural',
    description: 'Compute binary Brier score and count-weighted ECE for up to 256 declared held-out score/outcome pairs. Supports probability or percent scores, normalized to probabilities. Equal-width bins use exact rational boundaries: lower inclusive, upper exclusive, final bin includes 1. Empty bins report null means/gaps. No clinical validity claim.',
    inputSchema: input({ pairs: arr(obj({ score: nonnegative, outcome: integer(0, 1) }), 1, 256), scoreUnits: en('probability', 'percent'), binCount: integer(2, 20), evaluationSplit: en('declared-held-out-offline') }),
    sample: { dataClass: 'synthetic', pairs: [{ score: '0', outcome: 0 }, { score: '0.5', outcome: 1 }, { score: '1', outcome: 1 }], scoreUnits: 'probability', binCount: 2, evaluationSplit: 'declared-held-out-offline' },
    resultSchema: output({ brier: decimalResult, ece: decimalResult, bins: arr(obj({ index: integer(0, 19), lowerBound: fraction, upperBound: fraction, upperInclusive: bool, count: integer(0, 256), meanScore: nullable(decimalResult), observedRate: nullable(decimalResult), absoluteGap: nullable(decimalResult) }), 2, 20), scoreUnits: en('probability'), binConvention: en('equal-width; lower-inclusive-upper-exclusive; final-includes-one; exact-membership'), heldOutVerified: no, clinicalValidityClaimed: no }),
  },
  'fictional-decision-debrief': {
    amount: '45000', title: 'Fictional decision trace debrief', category: 'neural',
    description: 'Evaluate up to 64 explicitly fictional strategy/game choices against caller-declared integer utilities. Reports best declared actions, chosen utility, regret and observed-minus-declared error. No hindsight counterfactual outcome inference, financial advice, real-world intelligence assessment or strategy fitness claim.',
    inputSchema: input({ fictional: yes, evaluation: en('declared-game-utilities-only'), trace: arr(obj({ options: arr(obj({ action: token, utility: integer(-1000000, 1000000) }), 1, 12), chosen: token, observedUtility: integer(-1000000, 1000000) }), 1, 64) }),
    sample: { dataClass: 'synthetic', fictional: true, evaluation: 'declared-game-utilities-only', trace: [{ options: [{ action: 'wait', utility: 2 }, { action: 'explore', utility: 5 }], chosen: 'wait', observedUtility: 1 }] },
    resultSchema: output({ fictional: yes, decisions: arr(obj({ step: integer(0, 63), chosen: token, bestDeclaredActions: arr(token, 1, 12), chosenUtility: integer(-1000000, 1000000), maxDeclaredUtility: integer(-1000000, 1000000), declaredRegret: integer(0, 2000000), observedUtility: integer(-1000000, 1000000), observedMinusDeclared: integer(-2000000, 2000000) }), 1, 64), totalDeclaredRegret: integer(0, 128000000), totalObservedUtility: integer(-64000000, 64000000), financialAdvice: no, intelligenceMeasured: no, strategyFitnessClaimed: no }),
  },
}

function requireThat(ok: unknown, code: string): asserts ok { if (!ok) throw new Error(code) }
const unique = (keys: string[], code = 'duplicate-key') => requireThat(new Set(keys).size === keys.length, code)
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
const numeric = (s: string) => { const n = Number(s); requireThat(Number.isFinite(n), 'nonfinite-decimal'); return n }
function display(n: number): string {
  requireThat(Number.isFinite(n) && Math.abs(n) < 1e21, 'nonfinite-or-output-range')
  const s = n.toFixed(12).replace(/\.?0+$/, '')
  return s === '' || s === '-0' ? '0' : s
}
const million = BigInt(1000000)
function fixed(s: string): bigint {
  const negative = s.startsWith('-'), [whole, decimals = ''] = (negative ? s.slice(1) : s).split('.')
  const n = BigInt(whole) * million + BigInt(decimals.padEnd(6, '0'))
  return negative ? -n : n
}
function fixedDisplay(n: bigint, places: number): string {
  const sign = n < BigInt(0) ? '-' : '', v = (n < BigInt(0) ? -n : n).toString().padStart(places + 1, '0')
  const s = `${sign}${v.slice(0, -places)}.${v.slice(-places)}`.replace(/\.?0+$/, '')
  return s === '-0' ? '0' : s
}
type Q = { n: bigint; d: bigint }
function q(n: bigint, d = BigInt(1)): Q {
  requireThat(d > BigInt(0), 'invalid-denominator')
  let a = n < BigInt(0) ? -n : n, b = d
  while (b) { const r = a % b; a = b; b = r }
  return { n: n / a, d: d / a }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const subtract = (a: Q, b: Q) => add(a, { n: -b.n, d: b.d })
const multiply = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const wire = (v: Q) => ({ numerator: v.n.toString(), denominator: v.d.toString() })
function rationalDisplay(v: Q): string {
  const scaled = absBig(v.n) * BigInt(1000000000000)
  const rounded = scaled / v.d + (scaled % v.d * BigInt(2) >= v.d ? BigInt(1) : BigInt(0))
  return fixedDisplay(v.n < BigInt(0) ? -rounded : rounded, 12)
}

type Point = { x: number; y: number }
function grid(i: Record<string, unknown>) {
  const width = i.width as number, height = i.height as number, start = i.start as Point, goal = i.goal as Point, obstacles = i.obstacles as Point[]
  const inside = (p: Point) => p.x < width && p.y < height
  requireThat([start, goal, ...obstacles].every(inside), 'coordinate-outside-grid')
  const index = (p: Point) => p.y * width + p.x, blocked = obstacles.map(index)
  unique(blocked.map(String), 'duplicate-obstacle')
  const walls = new Set(blocked), source = index(start), target = index(goal)
  requireThat(!walls.has(source) && !walls.has(target), 'blocked-endpoint')
  const previous = new Map<number, number>([[source, -1]]), queue = [source]
  // Every cell is enqueued once. The full search distinguishes a step limit from disconnection.
  for (let head = 0; head < queue.length && !previous.has(target); head++) {
    const cell = queue[head], x = cell % width, y = Math.floor(cell / width)
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy, next = ny * width + nx
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || walls.has(next) || previous.has(next)) continue
      previous.set(next, cell); queue.push(next)
    }
  }
  const path: Point[] = []
  if (previous.has(target)) for (let at = target; at !== -1; at = previous.get(at)!) path.push({ x: at % width, y: Math.floor(at / width) })
  path.reverse()
  const minimumSteps = path.length ? path.length - 1 : null, maxSteps = i.maxSteps as number
  const state = minimumSteps === null ? 'unreachable' : minimumSteps > maxSteps ? 'step-limit' : 'found'
  return { state, route: state === 'found' ? path : [], minimumSteps, visitedCells: queue.length, maxSteps, method: 'bounded-four-neighbor-bfs', hardwareControlled: false }
}

type Property = { name: string; value: string; unit: string }
type Twin = { key: string; poseUnit: string; pose: { x: string; y: string; z: string; yawDeg: string }; properties: Property[] }
const scales: Record<string, bigint> = { mm: BigInt(1), cm: BigInt(10), m: BigInt(1000) }
const baseUnit = (unit: string) => Object.hasOwn(scales, unit) ? 'm' : unit
const baseFixed = (value: string, unit: string) => fixed(value) * (scales[unit] ?? BigInt(1))
const baseDisplay = (value: string, unit: string) => fixedDisplay(baseFixed(value, unit), baseUnit(unit) === 'm' ? 9 : 6)
const absBig = (n: bigint) => n < BigInt(0) ? -n : n
function twinDiff(i: Record<string, unknown>) {
  const before = i.before as Twin[], after = i.after as Twin[], t = i.tolerances as { lengthM: string; angleDeg: string; ratio: string }
  for (const records of [before, after]) {
    unique(records.map(r => r.key))
    for (const r of records) {
      unique(r.properties.map(p => p.name), 'duplicate-property')
      requireThat(absBig(fixed(r.pose.yawDeg)) <= BigInt(180) * million, 'yaw-outside-canonical-range')
    }
  }
  const b = new Map(before.map(r => [r.key, r])), a = new Map(after.map(r => [r.key, r]))
  const comparisons = [...new Set([...b.keys(), ...a.keys()])].sort(lexical).map(key => {
    const old = b.get(key), next = a.get(key), bp = new Map(old?.properties.map(p => [p.name, p]) ?? []), ap = new Map(next?.properties.map(p => [p.name, p]) ?? [])
    let changed = false
    const propertyChanges = [...new Set([...bp.keys(), ...ap.keys()])].sort(lexical).map(name => {
      const p = bp.get(name), r = ap.get(name), pu = p ? baseUnit(p.unit) : null, ru = r ? baseUnit(r.unit) : null
      const compatible = p && r && pu === ru, unit = compatible ? pu! : !p ? ru! : !r ? pu! : 'incompatible'
      const delta = compatible ? baseFixed(r.value, r.unit) - baseFixed(p.value, p.unit) : null
      const tolerance = unit === 'm' ? fixed(t.lengthM) * BigInt(1000) : unit === 'deg' ? fixed(t.angleDeg) : fixed(t.ratio)
      const unitChanged = !!p && !!r && p.unit !== r.unit
      changed ||= !compatible || delta !== BigInt(0) || unitChanged
      return { name, state: !p ? 'added' : !r ? 'removed' : !compatible ? 'unit-incompatible' : absBig(delta!) <= tolerance ? 'within-tolerance' : 'outside-tolerance', beforeUnit: p?.unit ?? null, afterUnit: r?.unit ?? null, beforeValueBaseUnits: p ? baseDisplay(p.value, p.unit) : null, afterValueBaseUnits: r ? baseDisplay(r.value, r.unit) : null, deltaBaseUnits: delta === null ? null : fixedDisplay(delta, unit === 'm' ? 9 : 6), baseUnit: unit, unitChanged }
    })
    let distance: number | null = null, yaw: bigint | null = null, poseWithinTolerance: boolean | null = null, positionDeltaM: { x: string; y: string; z: string } | null = null
    const poseUnitChanged = !!old && !!next && old.poseUnit !== next.poseUnit
    if (old && next) {
      const deltas = (['x', 'y', 'z'] as const).map(axis => baseFixed(next.pose[axis], next.poseUnit) - baseFixed(old.pose[axis], old.poseUnit))
      positionDeltaM = { x: fixedDisplay(deltas[0], 9), y: fixedDisplay(deltas[1], 9), z: fixedDisplay(deltas[2], 9) }
      distance = Math.hypot(...deltas.map(d => Number(d) / 1e9))
      const difference = absBig(fixed(next.pose.yawDeg) - fixed(old.pose.yawDeg)), full = BigInt(360) * million
      yaw = difference > full / BigInt(2) ? full - difference : difference
      const lengthTolerance = fixed(t.lengthM) * BigInt(1000)
      poseWithinTolerance = deltas.reduce((sum, d) => sum + d * d, BigInt(0)) <= lengthTolerance * lengthTolerance && yaw <= fixed(t.angleDeg)
      changed ||= distance !== 0 || yaw !== BigInt(0) || poseUnitChanged
    }
    return { key, kind: !old ? 'added' : !next ? 'removed' : changed ? 'changed' : 'unchanged', poseUnitChanged, positionDeltaM, positionDistanceM: distance === null ? null : display(distance), yawDifferenceDeg: yaw === null ? null : fixedDisplay(yaw, 6), poseWithinTolerance, propertyChanges }
  })
  return { comparisons, poseAssumption: 'common-declared-coordinate-frame; yaw-only-not-full-3d-orientation', fieldCertified: false }
}

function fit(i: Record<string, unknown>) {
  const raw = i.pairs as { x: string; y: string; weight: string }[]
  requireThat(raw.every(p => fixed(p.weight) > BigInt(0)), 'weights-must-be-positive')
  requireThat(new Set(raw.map(p => fixed(p.x).toString())).size > 1, 'degenerate-x')
  const pairs = raw.map(p => ({ x: fixed(p.x), y: fixed(p.y), w: fixed(p.weight) }))
  const sum = (f: (p: typeof pairs[number]) => bigint) => pairs.reduce((s, p) => s + f(p), BigInt(0))
  const W = sum(p => p.w), X = sum(p => p.w * p.x), Y = sum(p => p.w * p.y), XX = sum(p => p.w * p.x * p.x), XY = sum(p => p.w * p.x * p.y)
  const determinant = W * XX - X * X
  requireThat(determinant > BigInt(0), 'degenerate-x')
  // Integer normal equations avoid catastrophic cancellation at large X offsets.
  const slopeNumerator = W * XY - X * Y, slope = q(slopeNumerator, determinant), intercept = q(Y * determinant - slopeNumerator * X, W * determinant * million)
  const predicted = pairs.map(p => add(intercept, multiply(slope, q(p.x, million)))), residual = pairs.map((p, index) => subtract(q(p.y, million), predicted[index]))
  const sse = pairs.reduce((s, p, index) => add(s, multiply(q(p.w, million), multiply(residual[index], residual[index]))), q(BigInt(0)))
  const finiteValue = (v: Q) => { const n = Number(v.n) / Number(v.d); requireThat(Number.isFinite(n), 'nonfinite-fit'); return n }
  requireThat([slope, intercept, sse, ...predicted, ...residual].every(v => Number.isFinite(finiteValue(v))), 'nonfinite-fit')
  return { slope: rationalDisplay(slope), intercept: rationalDisplay(intercept), weightedSSE: rationalDisplay(sse), weightedRMSE: display(Math.sqrt(finiteValue(sse) / (Number(W) / 1e6))), residuals: pairs.map((_, sampleIndex) => ({ sampleIndex, predicted: rationalDisplay(predicted[sampleIndex]), residual: rationalDisplay(residual[sampleIndex]) })), arithmetic: 'exact-rational-fit-and-sse-rounded-12-places; float64-rmse', finiteChecked: true, fieldCertified: false }
}

function sampling(i: Record<string, unknown>) {
  const rate = fixed(i.sampleRateHz as string), band = fixed(i.highestBandHz as string), tones = (i.tonesHz as string[]).map(fixed)
  requireThat(rate > BigInt(0), 'positive-sample-rate-required')
  requireThat(tones.every(t => t <= band), 'tone-exceeds-declared-band')
  unique(tones.map(String), 'duplicate-tone')
  return { state: rate > band * BigInt(2) ? 'strict-nyquist-satisfied' : rate === band * BigInt(2) ? 'nyquist-boundary' : 'undersampled', nyquistHz: fixedDisplay(rate * BigInt(5), 7), requiredRateExclusiveHz: fixedDisplay(band * BigInt(2), 6), tones: tones.map(f => { const residue = f % rate, fold = residue * BigInt(2) > rate ? rate - residue : residue; return { frequencyHz: fixedDisplay(f, 6), foldedHz: fixedDisplay(fold, 6), aliases: f * BigInt(2) > rate } }), assumptions: 'uniform-bandlimited-no-jitter; declared-bandwidth; filters-unverified', hardwareVerified: false }
}

type Task = { key: string; durationTicks: number; dependsOn: string[]; resources: string[] }
function assembly(i: Record<string, unknown>) {
  const tasks = i.tasks as Task[], resources = i.resources as { key: string; capacity: number }[]
  unique(tasks.map(t => t.key)); unique(resources.map(r => r.key))
  const byKey = new Map(tasks.map(t => [t.key, t])), resourceKeys = new Set(resources.map(r => r.key))
  for (const t of tasks) {
    unique(t.dependsOn, 'duplicate-dependency'); unique(t.resources, 'duplicate-resource-claim')
    requireThat(t.dependsOn.every(k => byKey.has(k) && k !== t.key), 'unknown-or-self-dependency')
    requireThat(t.resources.every(k => resourceKeys.has(k)), 'undeclared-resource')
  }
  const order: string[] = [], done = new Set<string>()
  while (order.length < tasks.length) {
    const available = tasks.filter(t => !done.has(t.key) && t.dependsOn.every(k => done.has(k))).map(t => t.key).sort(lexical)
    requireThat(available.length, 'cyclic-dag')
    for (const key of available) { done.add(key); order.push(key) }
  }
  const es = new Map<string, number>(), ef = new Map<string, number>(), ls = new Map<string, number>(), lf = new Map<string, number>()
  for (const key of order) { const t = byKey.get(key)!, start = Math.max(0, ...t.dependsOn.map(k => ef.get(k)!)); es.set(key, start); ef.set(key, start + t.durationTicks) }
  const projectTicks = Math.max(...ef.values())
  for (const key of [...order].reverse()) { const successors = tasks.filter(t => t.dependsOn.includes(key)), finish = successors.length ? Math.min(...successors.map(t => ls.get(t.key)!)) : projectTicks; lf.set(key, finish); ls.set(key, finish - byKey.get(key)!.durationTicks) }
  const resourceClaims = [...resources].sort((a, b) => lexical(a.key, b.key)).map(r => {
    const events = new Map<number, number>()
    for (const t of tasks) if (t.durationTicks > 0 && t.resources.includes(r.key)) { const start = es.get(t.key)!, end = ef.get(t.key)!; events.set(start, (events.get(start) ?? 0) + 1); events.set(end, (events.get(end) ?? 0) - 1) }
    let active = 0, peak = 0
    for (const [, delta] of [...events].sort((a, b) => a[0] - b[0])) { active += delta; peak = Math.max(peak, active) }
    return { resource: r.key, capacity: r.capacity, peakDeclaredUse: peak, exceedsCapacity: peak > r.capacity }
  })
  return { projectTicks, topologicalOrder: order, tasks: [...tasks].sort((a, b) => lexical(a.key, b.key)).map(t => ({ key: t.key, earliestStart: es.get(t.key)!, earliestFinish: ef.get(t.key)!, latestStart: ls.get(t.key)!, latestFinish: lf.get(t.key)!, slack: ls.get(t.key)! - es.get(t.key)!, critical: ls.get(t.key) === es.get(t.key) })), resourceClaims, declaredResourcesOnly: true, resourceConstrainedSchedule: false }
}

function yieldSensitivity(i: Record<string, unknown>) {
  const scenarios = i.scenarios as { key: string; rejectRates: string[] }[]
  unique(scenarios.map(s => s.key))
  const batch = q(BigInt(i.batchSize as number)), baseCost = q(BigInt(i.batchSize as number) * BigInt(i.unitCostMicros as number)), penalty = q(BigInt(i.rejectCostMicros as number))
  const calculated = scenarios.map(s => {
    const yieldFraction = s.rejectRates.reduce((v, rate) => multiply(v, q(million - fixed(rate), million)), q(BigInt(1)))
    const good = multiply(batch, yieldFraction), rejected = subtract(batch, good), cost = add(baseCost, multiply(rejected, penalty))
    return { key: s.key, yieldFraction, good, rejected, cost }
  })
  return { scenarios: calculated.map(s => ({ key: s.key, yieldFraction: wire(s.yieldFraction), expectedGood: wire(s.good), expectedRejected: wire(s.rejected), expectedCostMicros: wire(s.cost), costPerGoodMicros: s.good.n === BigInt(0) ? null : wire(q(s.cost.n * s.good.d, s.cost.d * s.good.n)), deltaGoodVsFirst: wire(subtract(s.good, calculated[0].good)), deltaCostVsFirst: wire(subtract(s.cost, calculated[0].cost)) })), assumption: 'sequential-conditional-reject-rates; all-units-base-cost; reject-penalty', productionForecast: false }
}

function stations(i: Record<string, unknown>) {
  const requirements = [...i.requirements as string[]].sort(lexical), stations = [...i.stations as { key: string; covers: string[]; costMicros: number }[]].sort((a, b) => lexical(a.key, b.key))
  unique(requirements); unique(stations.map(s => s.key))
  for (const s of stations) { unique(s.covers, 'duplicate-coverage'); requireThat(s.covers.every(k => requirements.includes(k)), 'unknown-coverage') }
  const stationMasks = stations.map(s => s.covers.reduce((mask, k) => mask | (1 << requirements.indexOf(k)), 0)), complete = (1 << requirements.length) - 1
  let best: { cost: number; keys: string[] } | null = null
  const subsetsExamined = (1 << stations.length) - 1
  for (let subset = 1; subset <= subsetsExamined; subset++) {
    let coverage = 0, cost = 0
    const keys: string[] = []
    for (let j = 0; j < stations.length; j++) if (subset & (1 << j)) { coverage |= stationMasks[j]; cost += stations[j].costMicros; keys.push(stations[j].key) }
    if (coverage !== complete) continue
    if (!best || cost < best.cost || (cost === best.cost && (keys.length < best.keys.length || (keys.length === best.keys.length && lexical(keys.join(','), best.keys.join(',')) < 0)))) best = { cost, keys }
  }
  const union = new Set(stations.flatMap(s => s.covers))
  return { feasible: best !== null, selected: best?.keys ?? [], totalCostMicros: best?.cost ?? 0, uncovered: best ? [] : requirements.filter(k => !union.has(k)), subsetsExamined, method: 'exact-subset-enumeration; min-cost-then-count-then-lex', declaredCoverageOnly: true }
}

function cuts(i: Record<string, unknown>) {
  const cuts = i.cuts as { material: string; unit: string; length: string; quantity: number }[], groups = new Map<string, { material: string; length: bigint; quantity: number }>()
  for (const c of cuts) {
    const length = baseFixed(c.length, c.unit)
    requireThat(length > BigInt(0), 'positive-cut-length-required')
    const key = `${c.material}:${length}`, old = groups.get(key)
    if (old) old.quantity += c.quantity
    else groups.set(key, { material: c.material, length, quantity: c.quantity })
  }
  const sorted = [...groups.values()].sort((a, b) => lexical(a.material, b.material) || (a.length < b.length ? -1 : a.length > b.length ? 1 : 0))
  return { groups: sorted.map(g => ({ material: g.material, lengthM: fixedDisplay(g.length, 9), quantity: g.quantity, totalLengthM: fixedDisplay(g.length * BigInt(g.quantity), 9) })), totalQuantity: sorted.reduce((s, g) => s + g.quantity, 0), totalLengthM: fixedDisplay(sorted.reduce((s, g) => s + g.length * BigInt(g.quantity), BigInt(0)), 9), exactDecimalArithmetic: true, kerfOrNestingIncluded: false }
}

type Summary = { count: number; mean: string; variance: string }
function drift(i: Record<string, unknown>) {
  const features = i.features as { name: string; reference: Summary; current: Summary }[], threshold = numeric(i.maxStandardizedMeanShift as string)
  unique(features.map(f => f.name))
  requireThat(threshold > 0, 'positive-drift-threshold-required')
  if (i.varianceConvention === 'sample') requireThat(features.every(f => f.reference.count >= 2 && f.current.count >= 2), 'sample-variance-requires-two-observations')
  return { features: [...features].sort((a, b) => lexical(a.name, b.name)).map(f => {
    const delta = fixed(f.current.mean) - fixed(f.reference.mean), variance = fixed(f.reference.variance), shift = variance === BigInt(0) ? null : (Number(delta) / 1e6) / Math.sqrt(Number(variance) / 1e6)
    const cutoff = fixed(i.maxStandardizedMeanShift as string), flagged = delta * delta * million > cutoff * cutoff * variance
    return { name: f.name, meanDifference: fixedDisplay(delta, 6), standardizedMeanShift: shift === null ? null : display(shift), varianceRatio: variance === BigInt(0) ? null : rationalDisplay(q(fixed(f.current.variance), variance)), state: shift === null ? 'zero-reference-variance' : flagged ? 'mean-shift-flagged' : 'within-declared-mean-threshold' }
  }), varianceConvention: i.varianceConvention, distributionTestPerformed: false, participantSignalsIncluded: false }
}

type Trial = { label: 'rest' | 'intention'; startMs: number; endMs: number; points: { timeMs: number; score: string }[] }
type Segment = { start: number; end: number; score: bigint }
type Event = { timeMs: number; type: 'onset' | 'release' }
type Interval = { start: number; end: number }
function validatedTrials(i: Record<string, unknown>): { trials: Trial[]; segments: Segment[] } {
  const trials = i.trials as Trial[]
  requireThat(trials[0].startMs === 0, 'trials-must-start-at-zero')
  requireThat(trials.reduce((s, t) => s + t.points.length, 0) <= 512, 'total-score-limit-512')
  const segments: Segment[] = []
  trials.forEach((t, trialIndex) => {
    requireThat(t.endMs > t.startMs && (trialIndex === 0 || t.startMs === trials[trialIndex - 1].endMs), 'noncontiguous-trials')
    requireThat(t.points[0].timeMs === t.startMs, 'first-score-required-at-trial-start')
    t.points.forEach((p, j) => {
      requireThat(p.timeMs >= t.startMs && p.timeMs < t.endMs && (j === 0 || p.timeMs > t.points[j - 1].timeMs), 'unordered-or-out-of-trial-score')
      segments.push({ start: p.timeMs, end: t.points[j + 1]?.timeMs ?? t.endMs, score: fixed(p.score) })
    })
  })
  return { trials, segments }
}

function replayMetrics(trials: Trial[], intervals: Interval[], events: Event[]) {
  const latencies: (number | null)[] = []
  let restFalseEvents = 0, restActiveMs = 0
  for (const t of trials) {
    if (t.label === 'rest') {
      restFalseEvents += events.filter(e => e.type === 'onset' && e.timeMs >= t.startMs && e.timeMs < t.endMs).length
      restActiveMs += intervals.reduce((s, v) => s + Math.max(0, Math.min(v.end, t.endMs) - Math.max(v.start, t.startMs)), 0)
    } else {
      const active = intervals.find(v => v.start < t.endMs && v.end > t.startMs)
      latencies.push(active ? Math.max(t.startMs, active.start) - t.startMs : null)
    }
  }
  const detected = latencies.filter((x): x is number => x !== null)
  return { restFalseEvents, restActiveMs, missedIntentionTrials: latencies.length - detected.length, intentionTrials: latencies.length, latencyByIntentionMs: latencies, meanLatencyMs: detected.length ? display(detected.reduce((s, x) => s + x, 0) / detected.length) : null }
}

function sweep(i: Record<string, unknown>) {
  const { trials, segments } = validatedTrials(i), thresholds = i.thresholds as string[]
  unique(thresholds.map(s => fixed(s).toString()), 'duplicate-threshold')
  return { thresholds: thresholds.map(threshold => {
    let active = false
    const intervals: Interval[] = [], events: Event[] = [], cutoff = fixed(threshold)
    for (const s of segments) {
      const high = s.score >= cutoff
      if (high && !active) events.push({ timeMs: s.start, type: 'onset' })
      if (high) intervals.push({ start: s.start, end: s.end })
      active = high
    }
    return { threshold: fixedDisplay(cutoff, 6), ...replayMetrics(trials, intervals, events) }
  }), semantics: 'contiguous-half-open-trials; zero-order-hold; continuous-state; first-active-latency', heldOutVerified: false, thresholdSelected: false, liveControl: false }
}

type Parameters = { onsetThreshold: string; releaseThreshold: string; dwellMs: number; releaseMs: number }
function dwellReplay(trials: Trial[], segments: Segment[], p: Parameters) {
  const onset = fixed(p.onsetThreshold), release = fixed(p.releaseThreshold)
  requireThat(release < onset, 'release-threshold-must-be-below-onset')
  let active = false, pending: number | null = null, activeStart: number | null = null
  const events: Event[] = [], intervals: Interval[] = []
  for (const s of segments) {
    if (!active) {
      if (s.score < onset) { pending = null; continue }
      pending ??= s.start
      const due = pending + p.dwellMs
      if (due < s.end) { const at = Math.max(due, s.start); active = true; activeStart = at; pending = null; events.push({ timeMs: at, type: 'onset' }) }
    } else {
      if (s.score > release) { pending = null; continue }
      pending ??= s.start
      const due = pending + p.releaseMs
      if (due < s.end) { const at = Math.max(due, s.start); intervals.push({ start: activeStart!, end: at }); active = false; activeStart = null; pending = null; events.push({ timeMs: at, type: 'release' }) }
    }
  }
  if (active) intervals.push({ start: activeStart!, end: trials.at(-1)!.endMs })
  return { ...replayMetrics(trials, intervals, events), events, finalState: active ? pending === null ? 'active' : 'pending-release' : pending === null ? 'idle' : 'pending-onset', pendingSinceMs: pending }
}

function dwell(i: Record<string, unknown>) {
  const { trials, segments } = validatedTrials(i), a = dwellReplay(trials, segments, i.a as Parameters), b = dwellReplay(trials, segments, i.b as Parameters)
  const pairedLatencyDeltaByIntentionMs = a.latencyByIntentionMs.map((x, j) => x === null || b.latencyByIntentionMs[j] === null ? null : b.latencyByIntentionMs[j]! - x), paired = pairedLatencyDeltaByIntentionMs.filter((x): x is number => x !== null)
  return { a, b, deltaBMinusA: { restFalseEvents: b.restFalseEvents - a.restFalseEvents, restActiveMs: b.restActiveMs - a.restActiveMs, missedIntentionTrials: b.missedIntentionTrials - a.missedIntentionTrials, pairedLatencyDeltaByIntentionMs, meanPairedDetectedLatencyDeltaMs: paired.length ? display(paired.reduce((s, x) => s + x, 0) / paired.length) : null }, semantics: 'zero-order-hold; continuous-timers; updates-before-equal-time-timers; final-end-exclusive', heldOutVerified: false, liveControl: false, hardwareControlled: false }
}

function synthetic(i: Record<string, unknown>) {
  const size = i.sampleCount as number, rate = i.sampleRateHz as number, frequency = numeric(i.frequencyHz as string), amplitude = numeric(i.amplitude as string), noise = numeric(i.noiseAmplitude as string)
  requireThat(frequency > 0 && 2 * frequency < rate, 'synthetic-frequency-must-be-strictly-below-nyquist')
  const artifacts = i.artifacts as { kind: 'blink' | 'spike' | 'dropout'; startIndex: number; length: number; magnitude: string }[]
  const labels: string[] = Array(size).fill('clean')
  for (const a of artifacts) {
    requireThat(a.startIndex + a.length <= size, 'artifact-outside-waveform')
    requireThat(a.kind !== 'spike' || a.length === 1, 'spike-must-be-one-sample')
    requireThat(a.kind !== 'dropout' || fixed(a.magnitude) === BigInt(0), 'dropout-magnitude-must-be-zero')
    for (let j = a.startIndex; j < a.startIndex + a.length; j++) { requireThat(labels[j] === 'clean', 'overlapping-artifacts'); labels[j] = a.kind }
  }
  let state = i.seed as number
  const waveform = Array.from({ length: size }, (_, j) => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return amplitude * Math.sin(2 * Math.PI * frequency * j / rate) + noise * (2 * state / 4294967296 - 1) })
  for (const a of artifacts) for (let j = 0; j < a.length; j++) {
    const at = a.startIndex + j, magnitude = numeric(a.magnitude)
    if (a.kind === 'dropout') waveform[at] = 0
    else waveform[at] += a.kind === 'spike' ? magnitude : magnitude * Math.sin(Math.PI * (j + 1) / (a.length + 1))
  }
  return { seed: i.seed, sampleRateHz: rate, waveform: waveform.map(display), labels, generatorVersion: 'original-sine-lcg-v1', signalUnit: 'arbitrary-synthetic', thirdPartyResearchData: false, participantSignalsIncluded: false }
}

function confidence(i: Record<string, unknown>) {
  const pairs = i.pairs as { score: string; outcome: number }[], bins = i.binCount as number, divisor = i.scoreUnits === 'percent' ? million * BigInt(100) : million
  const grouped = Array.from({ length: bins }, () => ({ count: 0, scoreSum: BigInt(0), outcomes: 0 }))
  let squaredError = BigInt(0)
  for (const p of pairs) {
    const score = fixed(p.score)
    requireThat(score <= divisor, 'score-outside-declared-units')
    const bin = Math.min(bins - 1, Number(score * BigInt(bins) / divisor)), g = grouped[bin], error = score - BigInt(p.outcome) * divisor
    g.count++; g.scoreSum += score; g.outcomes += p.outcome; squaredError += error * error
  }
  const gapSum = grouped.reduce((s, g) => s + absBig(g.scoreSum - BigInt(g.outcomes) * divisor), BigInt(0))
  return { brier: display(Number(squaredError) / Number(divisor * divisor * BigInt(pairs.length))), ece: display(Number(gapSum) / Number(divisor * BigInt(pairs.length))), bins: grouped.map((g, index) => ({ index, lowerBound: wire(q(BigInt(index), BigInt(bins))), upperBound: wire(q(BigInt(index + 1), BigInt(bins))), upperInclusive: index === bins - 1, count: g.count, meanScore: g.count ? display(Number(g.scoreSum) / Number(divisor * BigInt(g.count))) : null, observedRate: g.count ? display(g.outcomes / g.count) : null, absoluteGap: g.count ? display(Number(absBig(g.scoreSum - BigInt(g.outcomes) * divisor)) / Number(divisor * BigInt(g.count))) : null })), scoreUnits: 'probability', binConvention: 'equal-width; lower-inclusive-upper-exclusive; final-includes-one; exact-membership', heldOutVerified: false, clinicalValidityClaimed: false }
}

function fictional(i: Record<string, unknown>) {
  const trace = i.trace as { options: { action: string; utility: number }[]; chosen: string; observedUtility: number }[]
  const decisions = trace.map((t, step) => {
    unique(t.options.map(o => o.action), 'duplicate-action')
    const choice = t.options.find(o => o.action === t.chosen)
    requireThat(choice, 'chosen-action-not-declared')
    const maximum = Math.max(...t.options.map(o => o.utility))
    return { step, chosen: t.chosen, bestDeclaredActions: t.options.filter(o => o.utility === maximum).map(o => o.action).sort(lexical), chosenUtility: choice.utility, maxDeclaredUtility: maximum, declaredRegret: maximum - choice.utility, observedUtility: t.observedUtility, observedMinusDeclared: t.observedUtility - choice.utility }
  })
  return { fictional: true, decisions, totalDeclaredRegret: decisions.reduce((s, d) => s + d.declaredRegret, 0), totalObservedUtility: decisions.reduce((s, d) => s + d.observedUtility, 0), financialAdvice: false, intelligenceMeasured: false, strategyFitnessClaimed: false }
}

const builders: Record<string, (i: Record<string, unknown>) => Record<string, unknown>> = {
  'toy-grid-path-dry-run': grid,
  'digital-twin-config-diff': twinDiff,
  'weighted-calibration-fit': fit,
  'sampling-aliasing-check': sampling,
  'assembly-critical-path': assembly,
  'manufacturing-yield-sensitivity': yieldSensitivity,
  'inspection-station-selection': stations,
  'material-cut-list-consolidation': cuts,
  'feature-distribution-drift': drift,
  'intention-threshold-sweep': sweep,
  'dwell-release-comparison': dwell,
  'synthetic-artifact-test-pack': synthetic,
  'confidence-calibration-report': confidence,
  'fictional-decision-debrief': fictional,
}

/** Unknown IDs return null; invalid known requests throw before any calculation/output. */
export function buildPhysicalNeuralExpansion(id: string, input: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.hasOwn(SPECS, id)) return null
  const spec = SPECS[id]
  requireThat(schemaAccepts(spec.inputSchema, input), 'physical-neural-input-schema')
  // Defense in depth; the shared integration must also enforce its total request/response limits.
  requireThat(new TextEncoder().encode(JSON.stringify(input)).byteLength <= 32768, 'physical-neural-input-32KiB')
  const result = { dataClass: input.dataClass, ...builders[id](input) }
  requireThat(schemaAccepts(spec.resultSchema, result), 'physical-neural-output-schema')
  requireThat(new TextEncoder().encode(JSON.stringify(result)).byteLength <= 65536, 'physical-neural-output-64KiB')
  return result
}
