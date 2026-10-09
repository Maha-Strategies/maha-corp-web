import { arraySchema as a, objectSchema as o, enumSchema as e, ID_SCHEMA as id, HASH_SCHEMA as hash, UTC_SCHEMA as utc, type MicroSchema } from './micro-schema.ts'

/** Owner-authorized fixed batch prices in millionths of USDC; deployment remains a separate gate. */
export const PLANNING_PRODUCTS = {
  'inspection-tolerance-check': { amount: '29000', title: 'Inspection Tolerance Batch', description: 'Classify up to 100 declared measurement intervals against tolerances as pass, fail or hold. Integer millimetres; uncertainty is an absolute interval half-width, not a confidence level. No sensor verification or engineering approval.' },
  'inspection-coverage-plan': { amount: '119000', title: 'Simulated Inspection Coverage', description: 'Compare up to 16 declared observation stations against 64 targets and 16 rectangular obstacles in a bounded 2D scene. Returns visible targets and uncovered IDs. No camera optics, 3D visibility, robot motion or physical inspection claim.' },
  'panel-packing-estimate': { amount: '59000', title: 'Rectangular Panel Packing Estimate', description: 'Compare up to 20 homogeneous rectangular-panel scenarios with fixed orientation, edge margin and kerf. Returns row/column capacity, sheet count and material utilization. Not mixed nesting, toolpaths, optimal packing or fabrication approval.' },
  'assembly-schedule-compare': { amount: '150000', title: 'Assembly Schedule Comparison', description: 'Simulate up to 10 sequential assembly scenarios of 100 identical units using one shared crane and declared crews. Factory releases, lift and connection durations are explicit. No lift-capacity, structural, site-safety or optimized scheduling approval.' },
  'automation-economics-compare': { amount: '90000', title: 'Automation Economics Comparison', description: 'Compare up to 20 automation scenarios using declared setup cost, per-unit costs and volumes. Exact cents, savings and break-even counts; no currency conversion, demand forecast, investment advice or independently measured costs.' },
  'public-spending-review': { amount: '180000', title: 'Public Spending Anomaly Review', description: 'Review up to 80 public or synthetic spending records for duplicate IDs, inconsistent budgets, budget overruns and declared payee concentration. Duplicate-ID rows are excluded from totals. Flags are review leads, not fraud or legality findings.' },
  'campaign-record-reconcile': { amount: '80000', title: 'Campaign Record Reconciliation', description: 'Reconcile up to 80 committee-aggregate or non-personal organizational public/synthetic campaign ledger entries against declared opening and closing balances. Flags duplicate IDs and missing document references. Individual-contributor records are prohibited, including hashed or redacted records. Caller must attest authorized commercial use. No contribution intake, payment execution, filing or legal compliance verdict.' },
  'committee-finance-snapshot': { amount: '70000', title: 'Committee Finance Snapshot Check', description: 'Compare up to 12 caller-supplied public committee-level totals and filing references at a declared assessment time. Preserves unknown totals, flags stale or amended snapshots and checks cash arithmetic. Caller must attest authorized commercial use and no individual-contributor information. No live FEC fetch, donor data, legal verdict or final-filing certification.' },
  'area-program-check': { amount: '39000', title: 'Architectural Area Program Check', description: 'Check up to 80 declared floor areas and assignable ratios, returning exact assignable/support-area totals. Uses one declared area unit and basis-point ratios. No geometry, zoning, code compliance, rentable-area or structural certification.' },
  'neural-experiment-metrics': { amount: '160000', title: 'Neural Interface Event Metrics', description: 'Score up to 64 labelled time intervals and 128 command events: rest false activations, missed trials, wrong commands and first-correct response times. Public or synthetic event metadata only. No raw EEG, participant identifiers, live control, diagnosis or human-enhancement claim.' },
} as const
export type PlanningProductId = keyof typeof PLANNING_PRODUCTS
export const PLANNING_IDS = Object.keys(PLANNING_PRODUCTS) as PlanningProductId[]
export const isPlanningProduct = (s: string): s is PlanningProductId => Object.hasOwn(PLANNING_PRODUCTS, s)
export const PLANNING_TAGS: Record<PlanningProductId, string[]> = {
  'inspection-tolerance-check': ['physical-ai', 'inspection'],
  'inspection-coverage-plan': ['physical-ai', 'inspection', 'simulation'],
  'panel-packing-estimate': ['physical-ai', 'manufacturing', 'simulation'],
  'assembly-schedule-compare': ['physical-ai', 'construction', 'simulation'],
  'automation-economics-compare': ['physical-ai', 'cost-comparison'],
  'public-spending-review': ['public-spending', 'reconciliation'],
  'campaign-record-reconcile': ['campaign-finance', 'read-only', 'reconciliation'],
  'committee-finance-snapshot': ['campaign-finance', 'read-only', 'public-aggregates'],
  'area-program-check': ['architecture', 'planning'],
  'neural-experiment-metrics': ['neural-interface', 'research-metrics'],
}
const n = (min = 0, max = 1000000): MicroSchema => ({ type: 'integer', minimum: min, maximum: max })
const cents: MicroSchema = { type: 'string', maxLength: 16, pattern: '^(0|[1-9][0-9]{0,15})$' }
const nullable = (s: MicroSchema): MicroSchema => ({ oneOf: [s, { type: 'null' }] })
const env = (fields: Record<string, MicroSchema>) => o({ dataClass: e('public', 'synthetic'), ...fields })
const point = o({ xMm: n(0, 100000), yMm: n(0, 100000) })
const yes: MicroSchema = { type: 'boolean', enum: [true] }

export function planningInputSchemas(): Record<PlanningProductId, MicroSchema> {
  return {
    'inspection-tolerance-check': env({ measurements: a(o({ id, offsetMm: n(-1000000), uncertaintyHalfWidthMm: n(), toleranceMm: n() }), 1, 100) }),
    'inspection-coverage-plan': env({ widthMm: n(1, 100000), heightMm: n(1, 100000), stations: a(o({ id, point, rangeMm: n(1, 200000) }), 1, 16), targets: a(o({ id, point }), 1, 64), obstacles: a(o({ id, min: point, max: point }), 0, 16) }),
    'panel-packing-estimate': env({ scenarios: a(o({ id, sheetWidthMm: n(1, 100000), sheetHeightMm: n(1, 100000), panelWidthMm: n(1, 100000), panelHeightMm: n(1, 100000), kerfMm: n(0, 1000), edgeMarginMm: n(0, 10000), quantity: n(1, 1000000) }), 1, 20) }),
    'assembly-schedule-compare': env({ scenarios: a(o({ id, units: n(1, 100), crews: n(1, 20), factoryIntervalMs: n(0, 86400000), liftMs: n(1, 86400000), connectionMs: n(1, 86400000), inspectionMs: n(0, 86400000) }), 1, 10) }),
    'automation-economics-compare': env({ currency: e('USD'), scenarios: a(o({ id, units: n(0, 1000000), setupCents: cents, manualPerUnitCents: cents, assistedPerUnitCents: cents }), 1, 20) }),
    'public-spending-review': env({ currency: e('USD'), sourceSetDigest: hash, concentrationThresholdBps: n(1, 10000), records: a(o({ id, groupId: id, payeeId: id, amountCents: cents, budgetCents: nullable(cents), sourceRef: id }), 1, 80) }),
    'campaign-record-reconcile': env({ noIndividualContributorInformation: yes, commercialUseAuthorized: yes, redactedNoPersonalData: yes, sourceSetDigest: hash, currency: e('USD'), openingCents: cents, closingCents: cents, records: a(o({ id, direction: e('in', 'out'), amountCents: cents, documentRef: nullable(id) }), 1, 80) }),
    'committee-finance-snapshot': env({ noIndividualContributorInformation: yes, commercialUseAuthorized: yes, committeeId: { type: 'string', pattern: '^C[0-9]{8}$', maxLength: 9 }, cycle: n(1980, 2100), assessedAt: utc, maxAgeDays: n(1, 366), snapshots: a(o({ id, committeeId: { type: 'string', pattern: '^C[0-9]{8}$', maxLength: 9 }, cycle: n(1980, 2100), periodStart: utc, periodEnd: utc, retrievedAt: utc, sourceDigest: hash, filingId: id, amended: { type: 'boolean' }, beginningCashCents: nullable(cents), receiptsCents: nullable(cents), disbursementsCents: nullable(cents), endingCashCents: nullable(cents) }), 1, 12) }),
    'area-program-check': env({ areaUnit: e('m2', 'ft2'), floors: a(o({ id, grossArea: n(1, 1000000), assignableRatioBps: n(0, 10000) }), 1, 80) }),
    'neural-experiment-metrics': env({ noParticipantIdentifiers: yes, durationMs: n(1, 86400000), intervals: a(o({ id, startMs: n(0, 86400000), endMs: n(1, 86400000), label: e('rest', 'left', 'right', 'other') }), 1, 64), events: a(o({ id, timeMs: n(0, 86400000), command: e('left', 'right') }), 0, 128) }),
  }
}

/** Shared, closed result vocabulary; names carry units and null is never zero. */
export function planningResultSchemas(): Record<PlanningProductId, MicroSchema> {
  const metric = o({ name: id, value: nullable({ type: 'string', maxLength: 48, pattern: '^-?[0-9]+(?:/[1-9][0-9]*)?$' }) })
  const rows = a(o({ id, status: e('pass', 'fail', 'hold', 'covered', 'uncovered', 'estimated', 'flagged', 'clear', 'observed', 'hit', 'missed'), metrics: a(metric, 0, 12), relatedIds: a(id, 0, 128) }), 0, 256)
  return Object.fromEntries(PLANNING_IDS.map(id => [id, o({ method: e(`${id}/1`), basis: e('synthetic', 'caller-declared-public'), rows, totals: a(metric, 0, 24), limitations: a({ type: 'string', minLength: 1, maxLength: 600 }, 1, 12), approvalGranted: { type: 'boolean', enum: [false] } })])) as Record<PlanningProductId, MicroSchema>
}
