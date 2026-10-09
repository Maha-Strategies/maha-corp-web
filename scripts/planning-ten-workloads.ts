import { PLANNING_SAMPLES } from '../lib/x402/micro-planning-samples.ts'

/** High-count synthetic fixtures, not exhaustive worst-case execution proofs. */
export const planningWorkloads = structuredClone(PLANNING_SAMPLES)
const repeat = (id: keyof typeof planningWorkloads, key: string, count: number) => {
  const x = planningWorkloads[id], template = (x[key] as Record<string, unknown>[])[0]
  x[key] = Array.from({ length: count }, (_, i) => ({ ...template, id: `fixture-${i}` }))
}
repeat('inspection-tolerance-check', 'measurements', 100)
const coverage = planningWorkloads['inspection-coverage-plan']
coverage.stations = Array.from({ length: 16 }, (_, i) => ({ id: `station-${i}`, point: { xMm: 1000, yMm: 1000 + i * 100 }, rangeMm: 200000 }))
coverage.targets = Array.from({ length: 64 }, (_, i) => ({ id: `target-${i}`, point: { xMm: 9000, yMm: 1000 + i * 100 } }))
// All obstacles lie beyond the rays, forcing every bounded intersection test.
coverage.obstacles = Array.from({ length: 16 }, (_, i) => ({ id: `obstacle-${i}`, min: { xMm: 2000 + i * 100, yMm: 7600 }, max: { xMm: 2050 + i * 100, yMm: 7700 } }))
repeat('panel-packing-estimate', 'scenarios', 20)
repeat('assembly-schedule-compare', 'scenarios', 10)
for (const r of planningWorkloads['assembly-schedule-compare'].scenarios as Record<string, unknown>[]) Object.assign(r, { units: 100, crews: 20, liftMs: 86400000, connectionMs: 86400000, inspectionMs: 86400000 })
repeat('automation-economics-compare', 'scenarios', 20)
for (const r of planningWorkloads['automation-economics-compare'].scenarios as Record<string, unknown>[]) Object.assign(r, { units: 1000000, setupCents: '9999999999999999', manualPerUnitCents: '9999999999999999', assistedPerUnitCents: '9999999999999998' })
repeat('public-spending-review', 'records', 80)
for (const [i, r] of (planningWorkloads['public-spending-review'].records as Record<string, unknown>[]).entries()) Object.assign(r, { groupId: `group-${i}`, payeeId: `payee-${i}`, amountCents: '9999999999999999' })
repeat('campaign-record-reconcile', 'records', 80)
repeat('committee-finance-snapshot', 'snapshots', 12)
repeat('area-program-check', 'floors', 80)
const neural = planningWorkloads['neural-experiment-metrics']
neural.durationMs = 64000
neural.intervals = Array.from({ length: 64 }, (_, i) => ({ id: `interval-${i}`, startMs: i * 1000, endMs: (i + 1) * 1000, label: i % 4 === 0 ? 'rest' : i % 4 === 1 ? 'left' : i % 4 === 2 ? 'right' : 'other' }))
neural.events = Array.from({ length: 128 }, (_, i) => ({ id: `event-${i}`, timeMs: i * 500, command: i % 2 ? 'left' : 'right' }))
