import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins, type SciencePolicy } from './batch11-science-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'
import { declaredEpochOrder, ticks } from './batch16-time-series.ts'

const category = 'orbital-records', prefix = category + '-'
const boundary = 'Public or synthetic nonpersonal orbital export declarations only. No orbit propagation, element/state conversion, force model, collision assessment, satellite tracking, manoeuvre guidance or navigation/safety certification. Target, centre, epoch, solution and source pins are not independently verified bytes or physical truth.'
const frame = { datasetRef: id, targetRef: id, centreRef: id, coordinateFrameRef: id, timeScaleRef: id, epochOriginRef: id, tickUnitRef: id, solutionDigest: digest, recordRevision: digest }
const sample = { datasetRef: 'orbits1', targetRef: 'synthetic-target1', centreRef: 'declared-centre1', coordinateFrameRef: 'declared-frame1', timeScaleRef: 'declared-scale1', epochOriginRef: 'declared-origin1', tickUnitRef: 'declared-seconds', solutionDigest: hash, recordRevision: hash }
const pins = { ...frame, statesDigest: digest, scopeRef: id }, row = { id: 'orbit1', ...sample, statesDigest: hash, scopeRef: 'public-metadata' }
const units = ['kilometres', 'au', 'kilometres-per-second', 'metres-per-second', 'degrees', 'radians', 'ratio', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'target/centre/frame/time-scale/solution-pinned orbital records', boundary, pins, sample: row, owner: 'datasetRef', subject: 'targetRef', revision: 'recordRevision', content: 'statesDigest', units, unitMeaning: 'orbital state quantities' }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities: ['distance', 'speed', 'angle', 'eccentricity', 'duration'], units,
  compatible: { distance: ['kilometres', 'au'], speed: ['kilometres-per-second', 'metres-per-second'], angle: ['degrees', 'radians'], eccentricity: ['ratio'], duration: ['seconds'] }, sampleQuantity: 'distance', sampleUnit: 'kilometres' })
const component = z.enum(['x', 'y', 'z', 'vx', 'vy', 'vz'])
const state = { id: 'state1', ...sample, epochTick: 0, component: 'x', unit: 'kilometres', value: 1, qualifier: 'exact' }
const coverage = spec(prefix + 'condition-coverage-map', 'Check coverage of a requested Cartesian state projection at one declared epoch. Each requested component must occur exactly once, with exact finite value, matching full solution frame and caller-selected distance/velocity units. Missing, duplicate, unknown and undeclared components remain findings. This checks component availability, not a physically consistent state or a complete orbit. ' + boundary,
  input({ ...frame, epochTick: ticks, positionUnit: z.enum(['kilometres', 'au']), velocityUnit: z.enum(['kilometres-per-second', 'metres-per-second']), requiredComponents: z.array(component).min(1).max(6),
    rows: records({ ...frame, epochTick: ticks, component, unit: z.enum(units), value: z.number().finite().min(-1e9).max(1e9).nullable(), qualifier: z.enum(['exact', 'unknown']) }, 0) }),
  { ...sample, epochTick: 0, positionUnit: 'kilometres', velocityUnit: 'kilometres-per-second', requiredComponents: ['x'], rows: [state] },
  { ...sample, epochTick: 0, positionUnit: 'kilometres', velocityUnit: 'kilometres-per-second', requiredComponents: ['x'], rows: [] },
  [prefix + 'state-component-not-established', prefix + 'state-frame-mismatch', prefix + 'state-component-undeclared', prefix + 'state-value-not-exact', prefix + 'state-unit-mismatch'],
  [prefix + 'established-requested-components'], i => {
    unique(i.requiredComponents); unique(i.rows.map(r => r.id)); let established = 0
    const keys = Object.keys(frame), issues = (r: typeof i.rows[number]) => [
      ...(!samePins(r, i, keys) || r.epochTick !== i.epochTick ? [f(prefix + 'state-frame-mismatch', r.id)] : []),
      ...(r.value === null || r.qualifier !== 'exact' ? [f(prefix + 'state-value-not-exact', r.id)] : []),
      ...(r.unit !== (r.component.startsWith('v') ? i.velocityUnit : i.positionUnit) ? [f(prefix + 'state-unit-mismatch', r.id)] : []),
    ]
    const findings = i.requiredComponents.flatMap(c => { const matches = i.rows.filter(r => r.component === c); if (matches.length === 1 && !issues(matches[0]).length) { established++; return [] }; return [f(prefix + 'state-component-not-established', c)] })
    findings.push(...i.rows.flatMap(r => [...issues(r), ...(!i.requiredComponents.includes(r.component) ? [f(prefix + 'state-component-undeclared', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'established-requested-components', category, established)] }
  })
export const BATCH16_ORBITAL = scienceRecordSuite(policy, [...numeric, declaredEpochOrder({ category, boundary, frame, sample }), coverage])
