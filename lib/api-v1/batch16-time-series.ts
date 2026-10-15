import { z } from 'zod'
import { input, records, spec, unique, finding as f, metric as m } from './batch5-core.ts'
import { samePins } from './batch11-science-core.ts'

export const ticks = z.number().int().min(-1000000000).max(1000000000)
type Policy = { category: string; boundary: string; frame: z.ZodRawShape; sample: Record<string, unknown> }
/** Check supplied series in their declared order. Never sort away a regression,
 * bridge an unknown epoch, or compare ticks across frame/time-scale boundaries. */
export function declaredEpochOrder(p: Policy) {
  const prefix = p.category + '-', keys = Object.keys(p.frame)
  const row = { id: 'epoch1', ...p.sample, epochTick: 0, qualifier: 'exact' }
  return spec(prefix + 'timestamp-order-audit', 'Audit the supplied order of integer epoch ticks and a caller-defined maximum adjacent gap in one exact target/centre/frame/time-scale/origin/tick-unit/revision declaration. Equal or decreasing ticks are findings. A mismatched frame, null or unknown epoch breaks adjacency; no unit/time-scale conversion, sorting, interpolation or real-world freshness inference. ' + p.boundary,
    input({ ...p.frame, maximumGapTicks: z.number().int().min(0).max(2000000000), rows: records({ ...p.frame, epochTick: ticks.nullable(), qualifier: z.enum(['exact', 'unknown']) }) }),
    { ...p.sample, maximumGapTicks: 10, rows: [row, { ...row, id: 'epoch2', epochTick: 10 }] },
    { ...p.sample, maximumGapTicks: 9, rows: [row, { ...row, id: 'epoch2', epochTick: 10 }] },
    [prefix + 'epoch-gap-exceeded', prefix + 'epoch-not-increasing', prefix + 'epoch-frame-mismatch', prefix + 'epoch-not-exact'],
    [prefix + 'comparable-adjacent-epochs', prefix + 'largest-adjacent-gap-ticks'], i => {
      unique(i.rows.map(r => r.id)); let previous: number | null = null, compared = 0, maximum = 0
      const findings = i.rows.flatMap(r => {
        if (!samePins(r, i, keys)) { previous = null; return [f(prefix + 'epoch-frame-mismatch', r.id)] }
        if (r.epochTick === null || r.qualifier !== 'exact') { previous = null; return [f(prefix + 'epoch-not-exact', r.id)] }
        const last = previous; previous = r.epochTick
        if (last === null) return []
        compared++; const gap = r.epochTick - last
        if (gap <= 0) return [f(prefix + 'epoch-not-increasing', r.id)]
        maximum = Math.max(maximum, gap)
        return gap > i.maximumGapTicks ? [f(prefix + 'epoch-gap-exceeded', r.id)] : []
      })
      return { findings, metrics: [m(prefix + 'comparable-adjacent-epochs', p.category, compared), m(prefix + 'largest-adjacent-gap-ticks', p.category, maximum)] }
    })
}
