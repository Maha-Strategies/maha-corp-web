import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { THERMAL_POLICY, THERMAL_RECORD_AUDITS } from './batch14-thermal.ts'
import { materialBindingAudits, materialBoundary, rational } from './batch13-material-core.ts'

const prefix = 'thermal-measurements-'
const frame = { datasetRef: 'dataset1', thermalRef: 'thermal-synthetic1', materialLotRef: 'lot1', fixtureRef: 'fixture1', methodDigest: hash, revision: hash }
const row = { id: 'r1', fixtureRef: 'fixture1', regime: 'steady-state-declared', heatFlowMilliwatts: 500, temperatureDifferenceMillikelvin: 250, qualifier: 'exact' }
const conductance = spec(prefix + 'condition-coverage-map', 'Check applicability declarations before deriving a supplied heat-flow/temperature-difference ratio in W/K from nonnegative integer mW and positive integer mK. Each row must declare steady state and match the requested fixture; unknown readings, zero temperature difference and transient or wrong-fixture rows block that row. This is an apparent declared conductance ratio, NOT thermal conductivity, proof of steady state or a material property measurement. No geometry normalization, absolute-temperature subtraction, unit conversion, heater control or process advice. ' + materialBoundary,
  input({ datasetRef: id, thermalRef: id, materialLotRef: id, fixtureRef: id, methodDigest: digest, revision: digest, rows: records({ fixtureRef: id, regime: z.enum(['steady-state-declared', 'transient', 'unknown']), heatFlowMilliwatts: z.number().int().min(0).max(1e9).nullable(), temperatureDifferenceMillikelvin: z.number().int().min(0).max(1e9).nullable(), qualifier: z.enum(['exact', 'unknown']) }) }),
  { ...frame, rows: [row] }, { ...frame, rows: [{ ...row, regime: 'transient' }] },
  [prefix + 'steady-state-not-declared', prefix + 'fixture-frame-mismatch', prefix + 'reading-not-exact', prefix + 'temperature-difference-zero'],
  [prefix + 'declared-ratios-derived', prefix + 'apparent-conductance-W-per-K'], i => {
    unique(i.rows.map(r => r.id)); let derived = 0; const metrics: ReturnType<typeof m>[] = []
    const findings = i.rows.flatMap(r => {
      if (r.fixtureRef !== i.fixtureRef) return [f(prefix + 'fixture-frame-mismatch', r.id)]
      if (r.regime !== 'steady-state-declared') return [f(prefix + 'steady-state-not-declared', r.id)]
      if (r.qualifier !== 'exact' || r.heatFlowMilliwatts === null || r.temperatureDifferenceMillikelvin === null) return [f(prefix + 'reading-not-exact', r.id)]
      if (r.temperatureDifferenceMillikelvin === 0) return [f(prefix + 'temperature-difference-zero', r.id)]
      derived++; metrics.push(m(prefix + 'apparent-conductance-W-per-K', r.id, rational(BigInt(r.heatFlowMilliwatts), BigInt(r.temperatureDifferenceMillikelvin)))); return []
    })
    return { findings, metrics: [m(prefix + 'declared-ratios-derived', 'thermal', derived), ...metrics] }
  })
const overrides = new Map([conductance, ...materialBindingAudits(THERMAL_POLICY, 'thermalRef')].map(s => [s.id, s]))
export const BATCH15_THERMAL = THERMAL_RECORD_AUDITS.slice(6).map(s => overrides.get(s.id) ?? s)
