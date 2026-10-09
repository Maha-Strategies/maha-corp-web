import type { PlanningProductId } from './micro-planning-contracts.ts'

type Metric = { name: string; value: string | null }
type Status = 'pass' | 'fail' | 'hold' | 'covered' | 'uncovered' | 'estimated' | 'flagged' | 'clear' | 'observed' | 'hit' | 'missed'
type Row = { id: string; status: Status; metrics: Metric[]; relatedIds: string[] }
type Point = { xMm: number; yMm: number }
const B = BigInt
const metric = (name: string, value: number | bigint | string | null): Metric => ({ name, value: value === null ? null : String(value) })
const row = (id: string, status: Status, metrics: Metric[], relatedIds: string[] = []): Row => ({ id, status, metrics, relatedIds })
const fraction = (numerator: bigint, denominator: bigint): string => {
  if (denominator <= B(0)) throw new Error('invalid denominator')
  let a = numerator < B(0) ? -numerator : numerator, b = denominator
  while (b) { const r = a % b; a = b; b = r }
  return `${numerator / a}/${denominator / a}`
}
const unique = (xs: { id: string }[]) => {
  if (new Set(xs.map(x => x.id)).size !== xs.length) throw new Error('duplicate identifier')
}
const duplicateIds = (xs: { id: string }[]) => {
  const counts = new Map<string, number>()
  for (const x of xs) counts.set(x.id, (counts.get(x.id) ?? 0) + 1)
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
}
const date = (s: string) => {
  const d = new Date(s)
  if (!Number.isFinite(d.getTime()) || d.toISOString() !== s || d.getUTCFullYear() < 1600 || d.getUTCFullYear() > 2099) throw new Error('invalid date')
  return d.getTime()
}
const inside = (p: Point, min: Point, max: Point) => p.xMm >= min.xMm && p.xMm <= max.xMm && p.yMm >= min.yMm && p.yMm <= max.yMm
const cross = (a: Point, b: Point, c: Point) => (b.xMm - a.xMm) * (c.yMm - a.yMm) - (b.yMm - a.yMm) * (c.xMm - a.xMm)
const onSegment = (a: Point, b: Point, c: Point) => cross(a, b, c) === 0 && inside(c, { xMm: Math.min(a.xMm, b.xMm), yMm: Math.min(a.yMm, b.yMm) }, { xMm: Math.max(a.xMm, b.xMm), yMm: Math.max(a.yMm, b.yMm) })
const intersects = (a: Point, b: Point, c: Point, d: Point) => {
  const u = cross(a, b, c), v = cross(a, b, d), w = cross(c, d, a), z = cross(c, d, b)
  return (Math.sign(u) * Math.sign(v) < 0 && Math.sign(w) * Math.sign(z) < 0) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)
}
const blocked = (a: Point, b: Point, min: Point, max: Point) => {
  if (inside(a, min, max) || inside(b, min, max)) return true
  const corners = [min, { xMm: max.xMm, yMm: min.yMm }, max, { xMm: min.xMm, yMm: max.yMm }]
  return corners.some((c, i) => intersects(a, b, c, corners[(i + 1) % 4]))
}

/** Called only after the closed input schema has accepted the entire request. No I/O. */
export function buildPlanningProduct(id: PlanningProductId, raw: Record<string, unknown>) {
  const rows: Row[] = [], totals: Metric[] = [], limitations: string[] = []
  switch (id) {
    case 'inspection-tolerance-check': {
      const { measurements } = raw as unknown as { measurements: { id: string; offsetMm: number; uncertaintyHalfWidthMm: number; toleranceMm: number }[] }
      unique(measurements)
      for (const m of measurements) {
        const low = m.offsetMm - m.uncertaintyHalfWidthMm, high = m.offsetMm + m.uncertaintyHalfWidthMm
        const status = low >= -m.toleranceMm && high <= m.toleranceMm ? 'pass' : low > m.toleranceMm || high < -m.toleranceMm ? 'fail' : 'hold'
        rows.push(row(m.id, status, [metric('lowerMm', low), metric('upperMm', high), metric('toleranceMm', m.toleranceMm)]))
      }
      for (const status of ['pass', 'fail', 'hold']) totals.push(metric(`${status}Count`, rows.filter(r => r.status === status).length))
      limitations.push('Inclusive tolerance boundaries; overlapping uncertainty intervals produce hold. Declared intervals are not verified sensor accuracy or statistical confidence intervals.')
      break
    }
    case 'inspection-coverage-plan': {
      const x = raw as unknown as { widthMm: number; heightMm: number; stations: { id: string; point: Point; rangeMm: number }[]; targets: { id: string; point: Point }[]; obstacles: { id: string; min: Point; max: Point }[] }
      unique(x.stations); unique(x.targets); unique(x.obstacles)
      const scene = { xMm: x.widthMm, yMm: x.heightMm }, origin = { xMm: 0, yMm: 0 }
      if ([...x.stations, ...x.targets].some(p => !inside(p.point, origin, scene)) || x.obstacles.some(o => !inside(o.min, origin, scene) || !inside(o.max, origin, scene) || o.min.xMm >= o.max.xMm || o.min.yMm >= o.max.yMm)) throw new Error('invalid geometry')
      if (x.stations.some(s => x.obstacles.some(o => inside(s.point, o.min, o.max)))) throw new Error('station in obstacle')
      for (const t of x.targets) {
        const visible = x.stations.filter(s => (s.point.xMm - t.point.xMm) ** 2 + (s.point.yMm - t.point.yMm) ** 2 <= s.rangeMm ** 2 && !x.obstacles.some(o => blocked(s.point, t.point, o.min, o.max))).map(s => s.id)
        rows.push(row(t.id, visible.length ? 'covered' : 'uncovered', [metric('visibleStationCount', visible.length)], visible))
      }
      totals.push(metric('targetCount', rows.length), metric('coveredCount', rows.filter(r => r.status === 'covered').length))
      limitations.push('Omnidirectional 2D point observations only. Touching an obstacle edge blocks visibility. No 3D geometry, lens model, localization uncertainty or robot motion.')
      break
    }
    case 'panel-packing-estimate': {
      const { scenarios } = raw as unknown as { scenarios: { id: string; sheetWidthMm: number; sheetHeightMm: number; panelWidthMm: number; panelHeightMm: number; kerfMm: number; edgeMarginMm: number; quantity: number }[] }
      unique(scenarios)
      for (const s of scenarios) {
        const width = s.sheetWidthMm - 2 * s.edgeMarginMm, height = s.sheetHeightMm - 2 * s.edgeMarginMm
        if (width <= 0 || height <= 0) throw new Error('margin consumes sheet')
        const columns = Math.floor((width + s.kerfMm) / (s.panelWidthMm + s.kerfMm)), lines = Math.floor((height + s.kerfMm) / (s.panelHeightMm + s.kerfMm)), capacity = columns * lines
        const sheets = capacity ? Math.ceil(s.quantity / capacity) : null
        const utilization = sheets === null ? null : fraction(B(s.quantity) * B(s.panelWidthMm) * B(s.panelHeightMm), B(sheets) * B(s.sheetWidthMm) * B(s.sheetHeightMm))
        rows.push(row(s.id, capacity ? 'estimated' : 'fail', [metric('columns', columns), metric('rows', lines), metric('panelsPerSheet', capacity), metric('sheets', sheets), metric('materialUtilizationRatio', utilization)]))
      }
      limitations.push('Identical panels, fixed orientation, kerf only between adjacent panels, edge margin on all sides. Utilization includes unused last-sheet area; no optimality, grain, defects, toolpaths or fabrication approval.')
      break
    }
    case 'assembly-schedule-compare': {
      const { scenarios } = raw as unknown as { scenarios: { id: string; units: number; crews: number; factoryIntervalMs: number; liftMs: number; connectionMs: number; inspectionMs: number }[] }
      unique(scenarios)
      for (const s of scenarios) {
        const crews = Array<number>(s.crews).fill(0); let crane = 0, waiting = 0
        for (let i = 0; i < s.units; i++) {
          const crew = crews.indexOf(Math.min(...crews)), released = i * s.factoryIntervalMs, start = Math.max(released, crane, crews[crew])
          waiting += start - released; crane = start + s.liftMs; crews[crew] = crane + s.connectionMs + s.inspectionMs
        }
        rows.push(row(s.id, 'estimated', [metric('completionMs', Math.max(...crews)), metric('cumulativeUnitWaitMs', waiting), metric('craneBusyMs', s.units * s.liftMs)]))
      }
      limitations.push('First unit ready at time zero; later units released at fixed intervals. One crane is occupied only during lifting. One crew remains occupied through lift, connection and inspection. No travel, breaks, capacity or safety model; not an optimized schedule.')
      break
    }
    case 'automation-economics-compare': {
      const { scenarios } = raw as unknown as { scenarios: { id: string; units: number; setupCents: string; manualPerUnitCents: string; assistedPerUnitCents: string }[] }
      unique(scenarios)
      for (const s of scenarios) {
        const manual = B(s.manualPerUnitCents) * B(s.units), assisted = B(s.setupCents) + B(s.assistedPerUnitCents) * B(s.units), margin = B(s.manualPerUnitCents) - B(s.assistedPerUnitCents)
        const breakEven = margin > B(0) ? (B(s.setupCents) + margin - B(1)) / margin : B(s.setupCents) === B(0) && margin === B(0) ? B(0) : null
        rows.push(row(s.id, 'estimated', [metric('manualCents', manual), metric('assistedCents', assisted), metric('savingsCents', manual - assisted), metric('breakEvenUnits', breakEven)]))
      }
      limitations.push('USD nominal declared costs only, without discounting, tax, maintenance, financing or demand assumptions. Break-even means assisted cost is no greater than manual cost; null means no break-even under this linear model.')
      break
    }
    case 'public-spending-review': {
      const x = raw as unknown as { concentrationThresholdBps: number; records: { id: string; groupId: string; payeeId: string; amountCents: string; budgetCents: string | null; sourceRef: string }[] }
      const duplicates = duplicateIds(x.records), accepted = x.records.filter(r => !duplicates.has(r.id))
      for (const id of duplicates) rows.push(row(id, 'flagged', [metric('duplicateId', 1)]))
      for (const groupId of [...new Set(accepted.map(r => r.groupId))].sort()) {
        const records = accepted.filter(r => r.groupId === groupId), sum = records.reduce((s, r) => s + B(r.amountCents), B(0)), budgets = [...new Set(records.map(r => r.budgetCents).filter((v): v is string => v !== null))]
        const missing = records.some(r => r.budgetCents === null), inconsistent = budgets.length > 1, budget = !missing && budgets.length === 1 ? B(budgets[0]) : null
        rows.push(row(groupId, inconsistent || budget !== null && sum > budget ? 'flagged' : missing ? 'hold' : 'clear', [metric('amountCents', sum), metric('budgetCents', budget), metric('inconsistentBudget', Number(inconsistent)), metric('missingBudget', Number(missing))], records.map(r => r.sourceRef)))
        for (const payeeId of [...new Set(records.map(r => r.payeeId))].sort()) {
          const amount = records.filter(r => r.payeeId === payeeId).reduce((s, r) => s + B(r.amountCents), B(0)), concentration = sum ? fraction(amount, sum) : null
          rows.push(row(payeeId, sum && amount * B(10000) >= sum * B(x.concentrationThresholdBps) ? 'flagged' : 'observed', [metric('amountCents', amount), metric('concentrationRatio', concentration)], [groupId]))
        }
      }
      totals.push(metric('excludedDuplicateRows', x.records.length - accepted.length), metric('acceptedAmountCents', accepted.reduce((s, r) => s + B(r.amountCents), B(0))))
      limitations.push('Caller defines comparable groups, payee identities, budgets, source bindings and currency consistently. All duplicate-ID rows are excluded, not silently deduplicated. Concentration is a review lead even for small groups; no fraud inference, currency conversion or source verification.')
      break
    }
    case 'campaign-record-reconcile': {
      const x = raw as unknown as { openingCents: string; closingCents: string; records: { id: string; direction: 'in' | 'out'; amountCents: string; documentRef: string | null }[] }
      const duplicates = duplicateIds(x.records); let inflow = B(0), outflow = B(0)
      for (const r of x.records) {
        const duplicate = duplicates.has(r.id), missing = r.documentRef === null
        if (!duplicate) { if (r.direction === 'in') inflow += B(r.amountCents); else outflow += B(r.amountCents) }
        rows.push(row(r.id, duplicate || missing ? 'flagged' : 'clear', [metric('duplicateId', Number(duplicate)), metric('missingDocumentRef', Number(missing))], r.documentRef === null ? [] : [r.documentRef]))
      }
      const expected = B(x.openingCents) + inflow - outflow
      totals.push(metric('inflowCents', inflow), metric('outflowCents', outflow), metric('expectedClosingCents', expected), metric('declaredClosingCents', x.closingCents), metric('differenceCents', B(x.closingCents) - expected), metric('excludedDuplicateRows', x.records.filter(r => duplicates.has(r.id)).length))
      limitations.push('Public or synthetic, redacted non-personal metadata only. References are declarations, not inspected documents. All duplicate-ID rows are excluded. USD arithmetic is not filing, contribution eligibility, foreign-national analysis, legal compliance or authorization to move funds.')
      break
    }
    case 'committee-finance-snapshot': {
      type Snapshot = { id: string; committeeId: string; cycle: number; periodStart: string; periodEnd: string; retrievedAt: string; sourceDigest: string; filingId: string; amended: boolean; beginningCashCents: string | null; receiptsCents: string | null; disbursementsCents: string | null; endingCashCents: string | null }
      const x = raw as unknown as { committeeId: string; cycle: number; assessedAt: string; maxAgeDays: number; snapshots: Snapshot[] }
      unique(x.snapshots)
      if (x.cycle % 2) throw new Error('cycle must be even')
      const now = date(x.assessedAt)
      for (const s of x.snapshots) {
        const start = date(s.periodStart), end = date(s.periodEnd), retrieved = date(s.retrievedAt)
        if (s.committeeId !== x.committeeId || s.cycle !== x.cycle || start > end || end > retrieved || retrieved > now || new Date(start).getUTCFullYear() < x.cycle - 1 || new Date(end).getUTCFullYear() > x.cycle) throw new Error('incompatible snapshot')
        const stale = now - retrieved > x.maxAgeDays * 86400000, ageOfPeriod = now - end
        const values = [s.beginningCashCents, s.receiptsCents, s.disbursementsCents, s.endingCashCents], unknown = values.some(v => v === null)
        const delta = unknown ? null : B(s.endingCashCents!) - (B(s.beginningCashCents!) + B(s.receiptsCents!) - B(s.disbursementsCents!))
        rows.push(row(s.id, delta !== null && delta !== B(0) ? 'flagged' : unknown || stale || ageOfPeriod > x.maxAgeDays * 86400000 || s.amended ? 'hold' : 'observed', [metric('retrievalAgeMs', now - retrieved), metric('periodAgeMs', ageOfPeriod), metric('retrievalStale', Number(stale)), metric('amended', Number(s.amended)), metric('receiptsCents', s.receiptsCents), metric('disbursementsCents', s.disbursementsCents), metric('endingCashCents', s.endingCashCents), metric('cashDifferenceCents', delta)], [s.filingId]))
      }
      limitations.push('Caller-supplied committee aggregates only; source digests and filing IDs are bound by the input receipt but not authenticated. No live OpenFEC retrieval, contributor records, ranking, solicitation or certification of latest/final filings. Snapshots may overlap: never sum them.', 'Fresh retrieval does not make an old reporting period current. Cash arithmetic omits adjustments not provided and a mismatch alone does not establish a reporting error.')
      break
    }
    case 'area-program-check': {
      const x = raw as unknown as { areaUnit: 'm2' | 'ft2'; floors: { id: string; grossArea: number; assignableRatioBps: number }[] }
      unique(x.floors); let gross = B(0), assignable = B(0)
      for (const f of x.floors) {
        gross += B(f.grossArea); assignable += B(f.grossArea) * B(f.assignableRatioBps)
        rows.push(row(f.id, 'estimated', [metric('grossArea', f.grossArea), metric('assignableArea', fraction(B(f.grossArea) * B(f.assignableRatioBps), B(10000))), metric('supportArea', fraction(B(f.grossArea) * B(10000 - f.assignableRatioBps), B(10000)))]))
      }
      totals.push(metric('grossArea', gross), metric('assignableArea', fraction(assignable, B(10000))), metric('supportArea', fraction(gross * B(10000) - assignable, B(10000))), metric('weightedAssignableRatio', fraction(assignable, gross * B(10000))))
      limitations.push(`All areas use caller-declared ${x.areaUnit}; exact fractions are numerator/denominator. Support area is the remainder, not a verified circulation/structure model. No geometry, overlap, zoning, code, accessibility, rentable-area or engineering approval.`)
      break
    }
    case 'neural-experiment-metrics': {
      type Interval = { id: string; startMs: number; endMs: number; label: 'rest' | 'left' | 'right' | 'other' }
      type Event = { id: string; timeMs: number; command: 'left' | 'right' }
      const x = raw as unknown as { durationMs: number; intervals: Interval[]; events: Event[] }
      unique(x.intervals); unique(x.events)
      const intervals = [...x.intervals].sort((a, b) => a.startMs - b.startMs), events = [...x.events].sort((a, b) => a.timeMs - b.timeMs || a.id.localeCompare(b.id, 'en'))
      if (intervals[0].startMs !== 0 || intervals.at(-1)!.endMs !== x.durationMs || intervals.some((v, i) => v.startMs >= v.endMs || i > 0 && v.startMs !== intervals[i - 1].endMs)) throw new Error('labels must partition the recording')
      if (events.some(v => v.timeMs >= x.durationMs) || new Set(events.map(v => `${v.timeMs}:${v.command}`)).size !== events.length) throw new Error('invalid or duplicate command event')
      let restMs = 0, falseRest = 0, otherEvents = 0, trials = 0, misses = 0, wrong = 0, repeated = 0
      const latencies: number[] = []
      for (const v of intervals) {
        const observed = events.filter(ev => ev.timeMs >= v.startMs && ev.timeMs < v.endMs)
        if (v.label === 'rest') { restMs += v.endMs - v.startMs; falseRest += observed.length }
        else if (v.label === 'other') otherEvents += observed.length
        else {
          trials++; const correct = observed.filter(ev => ev.command === v.label), latency = correct.length ? correct[0].timeMs - v.startMs : null
          const wrongHere = observed.length - correct.length; wrong += wrongHere; repeated += Math.max(0, correct.length - 1)
          if (latency === null) misses++; else latencies.push(latency)
          rows.push(row(v.id, latency === null ? 'missed' : 'hit', [metric('firstCorrectLatencyMs', latency), metric('wrongCommandEvents', wrongHere), metric('repeatCorrectEvents', Math.max(0, correct.length - 1))], observed.map(ev => ev.id)))
        }
      }
      latencies.sort((a, b) => a - b)
      const k = latencies.length, median = !k ? null : k % 2 ? String(latencies[Math.floor(k / 2)]) : fraction(B(latencies[k / 2 - 1] + latencies[k / 2]), B(2))
      totals.push(metric('restDurationMs', restMs), metric('falseRestEvents', falseRest), metric('falseRestEventsPerMinute', restMs ? fraction(B(falseRest) * B(60000), B(restMs)) : null), metric('intentionalTrials', trials), metric('missedTrials', misses), metric('missRate', trials ? fraction(B(misses), B(trials)) : null), metric('wrongCommandEvents', wrong), metric('otherIntervalEvents', otherEvents), metric('repeatCorrectEvents', repeated), metric('medianFirstCorrectLatencyMs', median))
      limitations.push('Labels fully partition the recording in half-open intervals [start,end). A hit means at least one matching command; wrong and repeated events remain counted. Zero rest or zero trials yields null rates, never evidence of safety. No raw EEG, participant identifiers, training, clinical validation or live commands.')
      break
    }
  }
  return { method: `${id}/1`, basis: raw.dataClass === 'synthetic' ? 'synthetic' : 'caller-declared-public', rows, totals, limitations, approvalGranted: false }
}
