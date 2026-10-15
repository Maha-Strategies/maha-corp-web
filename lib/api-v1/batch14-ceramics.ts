import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { CERAMIC_POLICY, CERAMIC_RECORD_AUDITS } from './batch13-ceramics.ts'
import { materialBindingAudits, materialBoundary, rational } from './batch13-material-core.ts'

const prefix = 'ceramic-measurements-', density = z.number().int().min(1).max(1e9), unit = z.enum(['kg-per-m3', 'g-per-cm3'])
const check = spec(prefix + 'condition-coverage-map', 'Compare declared bulk and pore-free-solid density ratios in one exact unit against a caller-declared density-deficit fraction in integer ppm, using an inclusive caller tolerance. This ratio is not a measured porosity determination: compatible composition, temperature and volume definitions remain caller assumptions. No open/closed-pore inference or density-unit conversion. ' + materialBoundary,
  input({ datasetRef: id, ceramicRef: id, materialLotRef: id, methodDigest: digest, revision: digest, tolerancePpm: z.number().int().min(0).max(10000), rows: records({ bulkDensity: density, bulkUnit: unit, solidDensity: density, solidUnit: unit, poreFreeSolidDeclared: z.boolean(), declaredDeficitPpm: z.number().int().min(0).max(1e6).nullable(), qualifier: z.enum(['exact', 'unknown']) }) }),
  { datasetRef: 'dataset1', ceramicRef: 'ceramic-synthetic1', materialLotRef: 'lot1', methodDigest: hash, revision: hash, tolerancePpm: 0, rows: [{ id: 'r1', bulkDensity: 1500, bulkUnit: 'kg-per-m3', solidDensity: 2000, solidUnit: 'kg-per-m3', poreFreeSolidDeclared: true, declaredDeficitPpm: 250000, qualifier: 'exact' }] },
  { datasetRef: 'dataset1', ceramicRef: 'ceramic-synthetic1', materialLotRef: 'lot1', methodDigest: hash, revision: hash, tolerancePpm: 0, rows: [{ id: 'r1', bulkDensity: 1500, bulkUnit: 'kg-per-m3', solidDensity: 2000, solidUnit: 'kg-per-m3', poreFreeSolidDeclared: true, declaredDeficitPpm: 200000, qualifier: 'exact' }] },
  [prefix + 'density-deficit-outside-tolerance', prefix + 'density-unit-mismatch', prefix + 'density-assumption-not-established', prefix + 'bulk-density-exceeds-solid-density'],
  [prefix + 'density-ratios-compared', prefix + 'density-deficit-fraction'], i => {
    unique(i.rows.map(r => r.id)); let checked = 0; const metrics: ReturnType<typeof m>[] = []
    const findings = i.rows.flatMap(r => {
      if (r.bulkUnit !== r.solidUnit) return [f(prefix + 'density-unit-mismatch', r.id)]
      if (!r.poreFreeSolidDeclared || r.qualifier !== 'exact' || r.declaredDeficitPpm === null) return [f(prefix + 'density-assumption-not-established', r.id)]
      if (r.bulkDensity > r.solidDensity) return [f(prefix + 'bulk-density-exceeds-solid-density', r.id)]
      const solid = BigInt(r.solidDensity), deficit = solid - BigInt(r.bulkDensity), delta = deficit * 1000000n - BigInt(r.declaredDeficitPpm) * solid, absolute = delta < 0n ? -delta : delta
      checked++; metrics.push(m(prefix + 'density-deficit-fraction', r.id, rational(deficit, solid)))
      return absolute > BigInt(i.tolerancePpm) * solid ? [f(prefix + 'density-deficit-outside-tolerance', r.id)] : []
    })
    return { findings, metrics: [m(prefix + 'density-ratios-compared', 'ceramic', checked), ...metrics] }
  })
const overrides = new Map([check, ...materialBindingAudits(CERAMIC_POLICY, 'ceramicRef')].map(s => [s.id, s]))
export const BATCH14_CERAMICS = CERAMIC_RECORD_AUDITS.slice(4).map(s => overrides.get(s.id) ?? s)
