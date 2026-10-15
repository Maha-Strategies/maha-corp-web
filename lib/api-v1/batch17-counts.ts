import { z } from 'zod'
import { input, records, spec, unique, finding as f, metric as m } from './batch5-core.ts'
import { samePins } from './batch11-science-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

/** Public aggregate counts only. Never conflate counts with individual records,
 * convert labels, fill unknown values or pool different pinned snapshots. */
export function declaredCountAudits(p: { category: string; boundary: string; frame: z.ZodRawShape; sample: Record<string, unknown>;
  quantities: readonly [string, ...string[]]; units: readonly [string, string, ...string[]]; compatible: Record<string, readonly string[]>; sampleQuantity: string; sampleUnit: string }) {
  const prefix = p.category + '-', quantity = z.enum(p.quantities), unit = z.enum(p.units), count = z.number().int().min(0).max(1000000), keys = Object.keys(p.frame)
  const measured = { ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, value: 1 }
  const valid = (q: string, u: string) => p.compatible[q].includes(u)
  return [
    spec(prefix + 'unit-label-consistency', 'Check declared aggregate count kinds against unit labels in one exact source/work/study/revision snapshot. Counts must be nonnegative integers; null remains unknown. Separate frames are never pooled. ' + p.boundary,
      input({ measurements: records({ ...p.frame, quantity, unit, value: count.nullable() }) }), { measurements: [measured] },
      { measurements: [{ ...measured, unit: p.units.find(u => !valid(p.sampleQuantity, u))! }] },
      [prefix + 'quantity-unit-mismatch', prefix + 'unit-label-conflict'], [prefix + 'compatible-unit-records'], i => {
        unique(i.measurements.map(r => r.id)); const groups = new Map<string, typeof i.measurements>()
        for (const r of i.measurements) { const key = demandDigest([...keys.map(k => (r as Record<string, unknown>)[k]), r.quantity]); groups.set(key, [...(groups.get(key) ?? []), r]) }
        return { findings: [...i.measurements.filter(r => !valid(r.quantity, r.unit)).map(r => f(prefix + 'quantity-unit-mismatch', r.id)), ...[...groups.values()].filter(g => new Set(g.map(r => r.unit)).size > 1).map(g => f(prefix + 'unit-label-conflict', ...g.map(r => r.id)))], metrics: [m(prefix + 'compatible-unit-records', p.category, i.measurements.filter(r => valid(r.quantity, r.unit)).length)] }
      }),
    spec(prefix + 'declared-bound-audit', 'Compare exact nonnegative integer aggregate counts with one inclusive caller-supplied bound matching every source, subject, snapshot and unit pin. No imputation, count conversion, scientific threshold or quality judgement. ' + p.boundary,
      input({ bounds: records({ ...p.frame, quantity, unit, minimum: count, maximum: count }), measurements: records({ ...p.frame, quantity, unit, value: count.nullable(), qualifier: z.enum(['exact', 'estimated', 'unknown']) }) }),
      { bounds: [{ ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, qualifier: 'exact' }] },
      { bounds: [{ ...p.sample, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, value: 2, qualifier: 'exact' }] },
      [prefix + 'value-outside-declared-bound', prefix + 'bound-not-unique', prefix + 'bound-frame-or-unit-mismatch', prefix + 'value-not-exact'], [prefix + 'exact-values-with-compatible-bounds'], i => {
        unique(i.bounds.map(r => r.id)); unique(i.measurements.map(r => r.id)); if (i.bounds.some(r => r.minimum > r.maximum)) throw Error('reversed_declared_count_bound')
        let checked = 0
        const findings = i.measurements.flatMap(r => { const matches = i.bounds.filter(b => samePins(b, r, keys) && b.quantity === r.quantity); if (matches.length !== 1) return [f(prefix + 'bound-not-unique', r.id)]; const b = matches[0]
          if (b.unit !== r.unit || !valid(r.quantity, r.unit)) return [f(prefix + 'bound-frame-or-unit-mismatch', r.id)]
          if (r.value === null || r.qualifier !== 'exact') return [f(prefix + 'value-not-exact', r.id)]
          checked++; return r.value < b.minimum || r.value > b.maximum ? [f(prefix + 'value-outside-declared-bound', r.id)] : [] })
        return { findings, metrics: [m(prefix + 'exact-values-with-compatible-bounds', p.category, checked)] }
      }),
  ]
}
