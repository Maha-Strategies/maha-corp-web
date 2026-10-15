import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { rational } from './batch13-material-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'

const category = 'sky-observations', prefix = category + '-'
const boundary = 'Public or synthetic nonpersonal sky-observation metadata only. No live catalogue/ephemeris query, object identification, coordinate transformation, time-scale conversion, pointing instructions, telescope control, astrometric precision or navigation certification. Frame, epoch and observer pins are declarations, not verified observation/source bytes.'
const pins = { datasetRef: id, observationRef: id, coordinateFrameRef: id, epochRef: id, observerConfigDigest: digest, methodDigest: digest, recordRevision: digest, observationsDigest: digest, scopeRef: id }
const row = { id: 'observation1', datasetRef: 'dataset1', observationRef: 'observation-synthetic1', coordinateFrameRef: 'declared-frame1', epochRef: 'declared-epoch1', observerConfigDigest: hash, methodDigest: hash, recordRevision: hash, observationsDigest: hash, scopeRef: 'public-metadata' }
const units = ['degrees', 'radians', 'arcseconds', 'hours-angle', 'nanometres', 'micrometres', 'seconds', 'milliseconds'] as const
const policy: SciencePolicy = { category, noun: 'sky frame/epoch/observer/method-pinned metadata', boundary, pins, sample: row, owner: 'datasetRef', subject: 'observationRef', revision: 'recordRevision', content: 'observationsDigest', units, unitMeaning: 'sky-observation quantities' }
const frame = { datasetRef: id, observationRef: id, coordinateFrameRef: id, epochRef: id, observerConfigDigest: digest, methodDigest: digest, recordRevision: digest }
const sampleFrame = { id: 'm1', datasetRef: row.datasetRef, observationRef: row.observationRef, coordinateFrameRef: row.coordinateFrameRef, epochRef: row.epochRef, observerConfigDigest: hash, methodDigest: hash, recordRevision: hash }
const quantities = ['right-ascension', 'declination', 'angular-size', 'wavelength', 'duration'] as const
const compatible = { 'right-ascension': ['degrees', 'radians', 'hours-angle'], declination: ['degrees', 'radians'], 'angular-size': ['degrees', 'radians', 'arcseconds'], wavelength: ['nanometres', 'micrometres'], duration: ['seconds', 'milliseconds'] }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: sampleFrame, quantities, units, compatible, sampleQuantity: 'right-ascension', sampleUnit: 'degrees' })
const timeAudit = measurementAudits({ category, noun: 'sky-observation export metadata', quantities, units, compatible, sampleQuantity: 'right-ascension', sampleUnit: 'degrees' }).find(s => s.id.endsWith('timestamp-order-audit'))!
const ms = z.number().int().min(0).max(86400000)
const expected = { datasetRef: row.datasetRef, observationRef: row.observationRef, coordinateFrameRef: row.coordinateFrameRef, epochRef: row.epochRef, observerConfigDigest: hash, methodDigest: hash, recordRevision: hash, clockRef: 'declared-clock1', windowStartMs: 0, windowEndMs: 1000, minimumCoveragePpm: 1000000 }
const exposure = { id: 'e1', coordinateFrameRef: row.coordinateFrameRef, epochRef: row.epochRef, observerConfigDigest: hash, clockRef: 'declared-clock1', startsMs: 0, endsMs: 1000, qualifier: 'exact' }
const coverage = spec(prefix + 'condition-coverage-map', 'Compute the union of at most 32 declared half-open exposure intervals inside one requested window, with exact frame/epoch/observer/clock pins. Overlap is never double-counted: report union, uncovered and redundant duration plus an exact coverage fraction. Compare to an inclusive caller minimum in integer ppm. Unknown intervals, invalid windows or pin mismatches block all totals. Relative ms are not converted between clocks or epochs. Declared coverage does not prove that usable photons/data were acquired. ' + boundary,
  input({ datasetRef: id, observationRef: id, coordinateFrameRef: id, epochRef: id, observerConfigDigest: digest, methodDigest: digest, recordRevision: digest, clockRef: id, windowStartMs: ms, windowEndMs: ms, minimumCoveragePpm: z.number().int().min(0).max(1e6), exposures: records({ coordinateFrameRef: id, epochRef: id, observerConfigDigest: digest, clockRef: id, startsMs: ms.nullable(), endsMs: ms.nullable(), qualifier: z.enum(['exact', 'unknown']) }, 0) }),
  { ...expected, exposures: [exposure] }, { ...expected, exposures: [{ ...exposure, endsMs: 500 }] },
  [prefix + 'declared-coverage-below-target', prefix + 'exposure-frame-mismatch', prefix + 'exposure-not-exact', prefix + 'exposure-window-invalid'],
  [prefix + 'coverage-derived', prefix + 'union-milliseconds', prefix + 'uncovered-milliseconds', prefix + 'redundant-milliseconds', prefix + 'declared-coverage-fraction'], i => {
    unique(i.exposures.map(r => r.id)); if (i.windowStartMs >= i.windowEndMs) throw Error('invalid_sky_requested_window')
    const findings = i.exposures.flatMap(r => {
      if (r.coordinateFrameRef !== i.coordinateFrameRef || r.epochRef !== i.epochRef || r.observerConfigDigest !== i.observerConfigDigest || r.clockRef !== i.clockRef) return [f(prefix + 'exposure-frame-mismatch', r.id)]
      if (r.qualifier !== 'exact' || r.startsMs === null || r.endsMs === null) return [f(prefix + 'exposure-not-exact', r.id)]
      return r.startsMs < i.windowStartMs || r.endsMs > i.windowEndMs || r.startsMs >= r.endsMs ? [f(prefix + 'exposure-window-invalid', r.id)] : []
    })
    if (findings.length) return { findings, metrics: [m(prefix + 'coverage-derived', category, 0)] }
    const sorted = [...i.exposures].sort((a, b) => a.startsMs! - b.startsMs! || a.endsMs! - b.endsMs!)
    let covered = 0, total = 0, end = i.windowStartMs
    for (const r of sorted) { total += r.endsMs! - r.startsMs!; covered += Math.max(0, r.endsMs! - Math.max(r.startsMs!, end)); end = Math.max(end, r.endsMs!) }
    const window = i.windowEndMs - i.windowStartMs
    return { findings: BigInt(covered) * 1000000n < BigInt(i.minimumCoveragePpm) * BigInt(window) ? [f(prefix + 'declared-coverage-below-target')] : [], metrics: [m(prefix + 'coverage-derived', category, 1), m(prefix + 'union-milliseconds', category, covered), m(prefix + 'uncovered-milliseconds', category, window - covered), m(prefix + 'redundant-milliseconds', category, total - covered), m(prefix + 'declared-coverage-fraction', category, rational(BigInt(covered), BigInt(window)))] }
  })
// Only the first ten sky proposals are in this batch.
export const SKY_RECORD_AUDITS = scienceRecordSuite(policy, [...numeric, timeAudit, coverage])
export const BATCH15_SKY = SKY_RECORD_AUDITS.slice(0, 10)
