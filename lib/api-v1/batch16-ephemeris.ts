import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins, type SciencePolicy } from './batch11-science-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'
import { declaredEpochOrder, ticks } from './batch16-time-series.ts'

const category = 'ephemeris-snapshots', prefix = category + '-'
const boundary = 'Supplied public or synthetic ephemeris export metadata only. No Horizons/SPICE download, live positions, kernel execution, interpolation, time-scale conversion, light-time correction or navigation certification. Source, kernel, frame and correction labels are declarations, not verified computations or source bytes.'
const frame = { datasetRef: id, targetRef: id, centreRef: id, coordinateFrameRef: id, timeScaleRef: id, epochOriginRef: id, tickUnitRef: id, correctionRef: id, kernelDigest: digest, snapshotRevision: digest }
const sample = { datasetRef: 'ephemeris1', targetRef: 'synthetic-target1', centreRef: 'declared-centre1', coordinateFrameRef: 'declared-frame1', timeScaleRef: 'declared-scale1', epochOriginRef: 'declared-origin1', tickUnitRef: 'declared-seconds', correctionRef: 'declared-geometric', kernelDigest: hash, snapshotRevision: hash }
const pins = { ...frame, exportDigest: digest, scopeRef: id }, row = { id: 'snapshot1', ...sample, exportDigest: hash, scopeRef: 'public-metadata' }
const units = ['kilometres', 'au', 'kilometres-per-second', 'au-per-day', 'degrees', 'radians', 'seconds', 'days'] as const
const policy: SciencePolicy = { category, noun: 'target/centre/frame/time-scale/correction/kernel-pinned ephemeris snapshots', boundary, pins, sample: row, owner: 'datasetRef', subject: 'targetRef', revision: 'snapshotRevision', content: 'exportDigest', units, unitMeaning: 'ephemeris export quantities' }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities: ['distance', 'speed', 'angle', 'duration'], units,
  compatible: { distance: ['kilometres', 'au'], speed: ['kilometres-per-second', 'au-per-day'], angle: ['degrees', 'radians'], duration: ['seconds', 'days'] }, sampleQuantity: 'distance', sampleUnit: 'kilometres' })
const coverage = spec(prefix + 'condition-coverage-map', 'Audit a bounded requested epoch grid against supplied export-row declarations. Every requested integer tick must have exactly one usable row in the identical target/centre/frame/time-scale/origin/correction/kernel/revision frame. Report missing/ambiguous coverage, unusable rows and unrequested epochs; never silently interpolate or extrapolate. A covered grid does not prove the values are accurate. ' + boundary,
  input({ ...frame, requestedEpochTicks: z.array(ticks).min(1).max(32), rows: records({ ...frame, epochTick: ticks, valueState: z.enum(['available', 'missing', 'unknown']) }, 0) }),
  { ...sample, requestedEpochTicks: [0, 10], rows: [{ id: 'e1', ...sample, epochTick: 0, valueState: 'available' }, { id: 'e2', ...sample, epochTick: 10, valueState: 'available' }] },
  { ...sample, requestedEpochTicks: [0, 10], rows: [{ id: 'e1', ...sample, epochTick: 0, valueState: 'available' }] },
  [prefix + 'epoch-coverage-not-established', prefix + 'grid-frame-mismatch', prefix + 'grid-row-unusable', prefix + 'epoch-not-requested'],
  [prefix + 'requested-epochs-covered', prefix + 'requested-epochs-uncovered'], i => {
    unique(i.requestedEpochTicks.map(String)); unique(i.rows.map(r => r.id)); let covered = 0; const keys = Object.keys(frame)
    const findings = i.requestedEpochTicks.flatMap(t => { const matches = i.rows.filter(r => r.epochTick === t); if (matches.length === 1 && samePins(matches[0], i, keys) && matches[0].valueState === 'available') { covered++; return [] }; return [f(prefix + 'epoch-coverage-not-established', 'tick:' + t)] })
    findings.push(...i.rows.flatMap(r => [...(!samePins(r, i, keys) ? [f(prefix + 'grid-frame-mismatch', r.id)] : []), ...(r.valueState !== 'available' ? [f(prefix + 'grid-row-unusable', r.id)] : []), ...(!i.requestedEpochTicks.includes(r.epochTick) ? [f(prefix + 'epoch-not-requested', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'requested-epochs-covered', category, covered), m(prefix + 'requested-epochs-uncovered', category, i.requestedEpochTicks.length - covered)] }
  })
// An existing ephemeris parity product is already built; never count it twice.
export const BATCH16_EPHEMERIS = scienceRecordSuite(policy, [...numeric, declaredEpochOrder({ category, boundary, frame, sample }), coverage]).filter(s => s.id !== prefix + 'export-semantic-parity')
