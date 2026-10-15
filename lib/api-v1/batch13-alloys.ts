import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBindingAudits, materialBoundary } from './batch13-material-core.ts'

const category = 'alloy-measurements', prefix = category + '-'
const pins = { datasetRef: id, alloyRef: id, materialLotRef: id, methodDigest: digest, recordRevision: digest, measurementsDigest: digest, compositionBasis: z.enum(['mass', 'atom']), scopeRef: id }
const row = { id: 'alloy1', datasetRef: 'dataset1', alloyRef: 'alloy-synthetic1', materialLotRef: 'lot1', methodDigest: hash, recordRevision: hash, measurementsDigest: hash, compositionBasis: 'mass', scopeRef: 'public-metadata' }
const units = ['ratio', 'percent', 'parts-per-million', 'pascal', 'megapascal', 'celsius', 'kelvin', 'kg-per-m3', 'g-per-cm3', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'alloy lot/method/composition-basis metadata', boundary: materialBoundary, pins, sample: row,
  owner: 'datasetRef', subject: 'alloyRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'alloy measurement quantities' }
const numeric = measurementAudits({ category, noun: 'alloy measurement declarations', quantities: ['fraction', 'stress', 'temperature', 'density', 'duration'], units,
  compatible: { fraction: ['ratio', 'percent', 'parts-per-million'], stress: ['pascal', 'megapascal'], temperature: ['celsius', 'kelvin'], density: ['kg-per-m3', 'g-per-cm3'], duration: ['seconds'] }, sampleQuantity: 'fraction', sampleUnit: 'ratio' })
const basis = z.enum(['mass', 'atom'])
const closure = spec(prefix + 'condition-coverage-map', 'Check whether at most 32 unique caller-declared constituent labels sum to 1,000,000 integer parts-per-million within an inclusive caller tolerance of 0–10,000 ppm. Mass and atom bases must match; unknown/censored values and duplicate labels block closure. No remainder is imputed or normalized, and arithmetic closure does not establish complete measurement or certify an alloy. ' + materialBoundary,
  input({ datasetRef: id, materialLotRef: id, methodDigest: digest, revision: digest, basis, tolerancePpm: z.number().int().min(0).max(10000), constituents: records({ elementRef: id, basis, amountPpm: z.number().int().min(0).max(1e6).nullable(), qualifier: z.enum(['exact', 'below-limit', 'unknown']) }) }),
  { datasetRef: row.datasetRef, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, basis: 'mass', tolerancePpm: 0, constituents: [{ id: 'c1', elementRef: 'A', basis: 'mass', amountPpm: 600000, qualifier: 'exact' }, { id: 'c2', elementRef: 'B', basis: 'mass', amountPpm: 400000, qualifier: 'exact' }] },
  { datasetRef: row.datasetRef, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, basis: 'mass', tolerancePpm: 0, constituents: [{ id: 'c1', elementRef: 'A', basis: 'mass', amountPpm: 600000, qualifier: 'exact' }] },
  [prefix + 'composition-total-outside-tolerance', prefix + 'composition-value-not-exact', prefix + 'composition-basis-mismatch', prefix + 'duplicate-constituent-label'],
  [prefix + 'arithmetic-closure-established', prefix + 'composition-total-ppm', prefix + 'composition-delta-ppm'], i => {
    unique(i.constituents.map(r => r.id)); const findings = i.constituents.flatMap(r => [...(r.amountPpm === null || r.qualifier !== 'exact' ? [f(prefix + 'composition-value-not-exact', r.id)] : []), ...(r.basis !== i.basis ? [f(prefix + 'composition-basis-mismatch', r.id)] : []), ...(i.constituents.filter(c => c.elementRef === r.elementRef).length > 1 ? [f(prefix + 'duplicate-constituent-label', r.id)] : [])])
    if (findings.length) return { findings, metrics: [m(prefix + 'arithmetic-closure-established', category, 0)] }
    const total = i.constituents.reduce((n, r) => n + BigInt(r.amountPpm!), 0n), delta = total - 1000000n, absolute = delta < 0n ? -delta : delta, matches = absolute <= BigInt(i.tolerancePpm)
    return { findings: matches ? [] : [f(prefix + 'composition-total-outside-tolerance', ...i.constituents.map(r => r.id))], metrics: [m(prefix + 'arithmetic-closure-established', category, matches ? 1 : 0), m(prefix + 'composition-total-ppm', category, total), m(prefix + 'composition-delta-ppm', category, delta)] }
  })
export const BATCH13_ALLOYS = scienceRecordSuite(policy, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), closure, ...materialBindingAudits(policy, 'alloyRef')])
