import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBindingAudits, materialBoundary, rational } from './batch13-material-core.ts'

const category = 'polymer-measurements', prefix = category + '-'
const pins = { datasetRef: id, polymerRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id }
const row = { id: 'polymer1', datasetRef: 'dataset1', polymerRef: 'polymer-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' }
const units = ['grams-per-mol', 'kilograms-per-mol', 'ratio', 'percent', 'celsius', 'kelvin', 'pascal', 'megapascal', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'polymer lot/method-pinned measurement declarations', boundary: materialBoundary, pins, sample: row,
  owner: 'datasetRef', subject: 'polymerRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'polymer measurement quantities' }
const numeric = measurementAudits({ category, noun: 'polymer measurement metadata', quantities: ['molar-mass', 'fraction', 'temperature', 'stress', 'duration'], units,
  compatible: { 'molar-mass': ['grams-per-mol', 'kilograms-per-mol'], fraction: ['ratio', 'percent'], temperature: ['celsius', 'kelvin'], stress: ['pascal', 'megapascal'], duration: ['seconds'] }, sampleQuantity: 'molar-mass', sampleUnit: 'grams-per-mol' })
const unit = z.enum(['grams-per-mol', 'kilograms-per-mol'])
const distribution = spec(prefix + 'condition-coverage-map', 'Check at most 32 caller-declared integer number-count bins with positive integer molar masses in one declared unit. Compute exact reduced-rational number-average molar mass, mass-average molar mass and their dispersity ratio; unknown/censored counts, repeated mass-bin labels or mixed units block derived averages. This is arithmetic on supplied bins, not measured sample coverage or property prediction. ' + materialBoundary,
  input({ datasetRef: id, materialLotRef: id, methodDigest: digest, revision: digest, unit, bins: records({ molarMass: z.number().int().min(1).max(1e9), count: z.number().int().min(0).max(1e6).nullable(), qualifier: z.enum(['exact', 'censored', 'unknown']), unit }) }),
  { datasetRef: row.datasetRef, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, unit: 'grams-per-mol', bins: [{ id: 'b1', molarMass: 100, count: 1, qualifier: 'exact', unit: 'grams-per-mol' }, { id: 'b2', molarMass: 200, count: 1, qualifier: 'exact', unit: 'grams-per-mol' }] },
  { datasetRef: row.datasetRef, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, unit: 'grams-per-mol', bins: [{ id: 'b1', molarMass: 100, count: null, qualifier: 'unknown', unit: 'grams-per-mol' }] },
  [prefix + 'distribution-count-not-exact', prefix + 'distribution-unit-mismatch', prefix + 'duplicate-molar-mass-bin', prefix + 'distribution-zero-total-count'],
  [prefix + 'averages-derived', prefix + 'number-average-molar-mass', prefix + 'mass-average-molar-mass', prefix + 'molar-mass-dispersity', prefix + 'total-declared-number-count'], i => {
    unique(i.bins.map(r => r.id)); const findings = i.bins.flatMap(r => [...(r.count === null || r.qualifier !== 'exact' ? [f(prefix + 'distribution-count-not-exact', r.id)] : []), ...(r.unit !== i.unit ? [f(prefix + 'distribution-unit-mismatch', r.id)] : []), ...(i.bins.filter(b => b.molarMass === r.molarMass).length > 1 ? [f(prefix + 'duplicate-molar-mass-bin', r.id)] : [])])
    if (findings.length) return { findings, metrics: [m(prefix + 'averages-derived', category, 0)] }
    let number = 0n, first = 0n, second = 0n
    for (const r of i.bins) { const n = BigInt(r.count!), mass = BigInt(r.molarMass); number += n; first += n * mass; second += n * mass * mass }
    if (number === 0n) return { findings: [f(prefix + 'distribution-zero-total-count')], metrics: [m(prefix + 'averages-derived', category, 0)] }
    return { findings: [], metrics: [m(prefix + 'averages-derived', category, 1), m(prefix + 'number-average-molar-mass', i.unit, rational(first, number)), m(prefix + 'mass-average-molar-mass', i.unit, rational(second, first)), m(prefix + 'molar-mass-dispersity', category, rational(second * number, first * first)), m(prefix + 'total-declared-number-count', category, number)] }
  })
export const BATCH13_POLYMERS = scienceRecordSuite(policy, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), distribution, ...materialBindingAudits(policy, 'polymerRef')])
