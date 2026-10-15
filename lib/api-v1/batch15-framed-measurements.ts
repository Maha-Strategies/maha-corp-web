import { z } from 'zod'
import { input, records, id, spec, finding as f, metric as m, unique } from './batch5-core.ts'
import { finiteValue, samePins } from './batch11-science-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

type Policy = { category: string; boundary: string; frame: z.ZodRawShape; sample: Record<string, unknown>;
  quantities: readonly [string, ...string[]]; units: readonly [string, string, ...string[]]; compatible: Record<string, readonly string[]>;
  sampleQuantity: string; sampleUnit: string }
/** Quantity labels are meaningful only inside the declared coordinate, clock,
 * pipeline and revision frame. No implicit unit or frame transformations. */
export function framedMeasurementAudits(p: Policy) {
  const prefix = p.category + '-', keys = Object.keys(p.frame), shape = { ...p.frame, id }, quantity = z.enum(p.quantities), unit = z.enum(p.units)
  const validUnit = (q: string, u: string) => p.compatible[q].includes(u)
  const measured = { ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, value: 1 }
  return [
    spec(prefix + 'unit-label-consistency', 'Audit quantity/unit labels in the exact supplied frame, including coordinate/clock or model/calibration pins. Separate frames are not pooled. Numerically equal values in different units are not inferred equivalent; values are not physical-validity checked. ' + p.boundary,
      input({ measurements: records({ ...shape, quantity, unit, value: finiteValue.nullable() }) }),
      { measurements: [measured] }, { measurements: [{ ...measured, unit: p.units.find(u => !validUnit(p.sampleQuantity, u))! }] },
      [prefix + 'quantity-unit-mismatch', prefix + 'unit-label-conflict'], [prefix + 'compatible-unit-records'], i => {
        unique(i.measurements.map(r => r.id)); const groups = new Map<string, typeof i.measurements>()
        for (const r of i.measurements) { const row: Record<string, unknown> = r, key = demandDigest([...keys.map(k => row[k]), r.quantity]); groups.set(key, [...(groups.get(key) ?? []), r]) }
        return { findings: [...i.measurements.filter(r => !validUnit(r.quantity, r.unit)).map(r => f(prefix + 'quantity-unit-mismatch', r.id)), ...[...groups.values()].filter(g => new Set(g.map(r => r.unit)).size > 1).map(g => f(prefix + 'unit-label-conflict', ...g.map(r => r.id)))], metrics: [m(prefix + 'compatible-unit-records', p.category, i.measurements.filter(r => validUnit(r.quantity, r.unit)).length)] }
      }),
    spec(prefix + 'declared-bound-audit', 'Compare exact finite values with one matching inclusive caller-supplied quantity/unit bound in the full declared frame. Ambiguous bounds, mismatched units or frames, null and censored values never pass. Thresholds are caller policy, not physical, medical, navigation or safety limits. ' + p.boundary,
      input({ bounds: records({ ...shape, quantity, unit, minimum: finiteValue, maximum: finiteValue }), measurements: records({ ...shape, quantity, unit, value: finiteValue.nullable(), qualifier: z.enum(['exact', 'below-limit', 'above-limit', 'unknown']) }) }),
      { bounds: [{ ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, qualifier: 'exact' }] },
      { bounds: [{ ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, value: 2, qualifier: 'exact' }] },
      [prefix + 'value-outside-declared-bound', prefix + 'bound-not-unique', prefix + 'bound-frame-or-unit-mismatch', prefix + 'value-not-exact'], [prefix + 'exact-values-with-compatible-bounds'], i => {
        unique(i.bounds.map(r => r.id)); unique(i.measurements.map(r => r.id)); if (i.bounds.some(b => b.minimum > b.maximum)) throw Error('reversed_framed_bounds'); let checked = 0
        const findings = i.measurements.flatMap(r => { const matches = i.bounds.filter(b => samePins(b, r, keys) && b.quantity === r.quantity); if (matches.length !== 1) return [f(prefix + 'bound-not-unique', r.id)]; const b = matches[0]
          if (b.unit !== r.unit || !validUnit(r.quantity, r.unit)) return [f(prefix + 'bound-frame-or-unit-mismatch', r.id)]
          if (r.value === null || r.qualifier !== 'exact') return [f(prefix + 'value-not-exact', r.id)]
          checked++; return r.value < b.minimum || r.value > b.maximum ? [f(prefix + 'value-outside-declared-bound', r.id)] : [] })
        return { findings, metrics: [m(prefix + 'exact-values-with-compatible-bounds', p.category, checked)] }
      }),
  ]
}
