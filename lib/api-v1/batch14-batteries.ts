import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBindingAudits, materialBoundary, rational } from './batch13-material-core.ts'

const category = 'battery-measurements', prefix = category + '-'
const boundary = 'Supplied public or synthetic battery test metadata only; no charging advice, battery-management commands, hardware access, state-of-health, degradation or cycle-life inference, cell safety certification or formulation. ' + materialBoundary
const pins = { datasetRef: id, batteryRef: id, materialLotRef: id, methodDigest: digest, cellConfigDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id }
const row = { id: 'battery1', datasetRef: 'dataset1', batteryRef: 'battery-synthetic1', materialLotRef: 'lot1', methodDigest: hash, cellConfigDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' }
const units = ['volts', 'millivolts', 'amperes', 'milliamperes', 'coulombs', 'milliampere-hours', 'watt-hours', 'milliwatt-hours', 'celsius', 'kelvin', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'battery/cell-config/lot/method-pinned records', boundary, pins, sample: row, owner: 'datasetRef', subject: 'batteryRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'battery test quantities' }
const numeric = measurementAudits({ category, noun: 'battery test export metadata', quantities: ['voltage', 'current', 'charge', 'energy', 'temperature', 'duration'], units,
  compatible: { voltage: ['volts', 'millivolts'], current: ['amperes', 'milliamperes'], charge: ['coulombs', 'milliampere-hours'], energy: ['watt-hours', 'milliwatt-hours'], temperature: ['celsius', 'kelvin'], duration: ['seconds'] }, sampleQuantity: 'voltage', sampleUnit: 'millivolts' })
const ms = z.number().int().min(0).max(86400000)
const integrate = spec(prefix + 'condition-coverage-map', 'Integrate at most 32 caller-declared piecewise-constant current/voltage segments across one fully covered window of at most 24 hours. Inputs use explicit mA, mV and ms; results are exact rational mAh and mWh, split by charge/discharge. Gaps, overlaps, unknown samples and inconsistent explicit current-sign/mode declarations block all totals. This is sampled-log arithmetic, not measured cell capacity, efficiency, safety or advice. ' + boundary,
  input({ datasetRef: id, batteryRef: id, cellConfigDigest: digest, materialLotRef: id, methodDigest: digest, revision: digest, windowStartMs: ms, windowEndMs: ms, currentSignConvention: z.enum(['positive-discharge', 'positive-charge']), segments: records({ startsMs: ms, endsMs: ms, currentMilliAmps: z.number().int().min(-1e6).max(1e6).nullable(), voltageMilliVolts: z.number().int().min(0).max(1e6).nullable(), mode: z.enum(['charge', 'discharge', 'rest']), qualifier: z.enum(['exact', 'unknown']) }) }),
  { datasetRef: row.datasetRef, batteryRef: row.batteryRef, cellConfigDigest: hash, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, windowStartMs: 0, windowEndMs: 3600000, currentSignConvention: 'positive-discharge', segments: [{ id: 's1', startsMs: 0, endsMs: 3600000, currentMilliAmps: 1000, voltageMilliVolts: 4000, mode: 'discharge', qualifier: 'exact' }] },
  { datasetRef: row.datasetRef, batteryRef: row.batteryRef, cellConfigDigest: hash, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, windowStartMs: 0, windowEndMs: 3600000, currentSignConvention: 'positive-discharge', segments: [{ id: 's1', startsMs: 0, endsMs: 1800000, currentMilliAmps: 1000, voltageMilliVolts: 4000, mode: 'discharge', qualifier: 'exact' }] },
  [prefix + 'segment-coverage-gap', prefix + 'segment-overlap', prefix + 'segment-window-invalid', prefix + 'sample-not-exact', prefix + 'current-mode-sign-conflict'],
  [prefix + 'sampled-totals-derived', prefix + 'charge-mAh', prefix + 'discharge-mAh', prefix + 'charge-mWh', prefix + 'discharge-mWh', prefix + 'covered-milliseconds'], i => {
    unique(i.segments.map(r => r.id)); if (i.windowStartMs >= i.windowEndMs) throw Error('invalid_battery_requested_window')
    const segments = [...i.segments].sort((a, b) => a.startsMs - b.startsMs || a.endsMs - b.endsMs), findings: ReturnType<typeof f>[] = []
    let cursor = i.windowStartMs
    for (const r of segments) {
      if (r.startsMs < i.windowStartMs || r.endsMs > i.windowEndMs || r.startsMs >= r.endsMs) findings.push(f(prefix + 'segment-window-invalid', r.id))
      if (r.startsMs > cursor) findings.push(f(prefix + 'segment-coverage-gap', r.id))
      if (r.startsMs < cursor) findings.push(f(prefix + 'segment-overlap', r.id))
      cursor = Math.max(cursor, r.endsMs)
      if (r.currentMilliAmps === null || r.voltageMilliVolts === null || r.qualifier !== 'exact') findings.push(f(prefix + 'sample-not-exact', r.id))
      if (r.currentMilliAmps !== null) { const dischargeSign = i.currentSignConvention === 'positive-discharge' ? 1 : -1, normalized = r.currentMilliAmps * dischargeSign
        if (r.mode === 'rest' && normalized !== 0 || r.mode === 'discharge' && normalized < 0 || r.mode === 'charge' && normalized > 0) findings.push(f(prefix + 'current-mode-sign-conflict', r.id)) }
    }
    if (cursor < i.windowEndMs) findings.push(f(prefix + 'segment-coverage-gap'))
    if (findings.length) return { findings, metrics: [m(prefix + 'sampled-totals-derived', category, 0)] }
    let charge = 0n, discharge = 0n, chargeEnergy = 0n, dischargeEnergy = 0n
    for (const r of segments) { const duration = BigInt(r.endsMs - r.startsMs), current = BigInt(Math.abs(r.currentMilliAmps!)), voltage = BigInt(r.voltageMilliVolts!)
      if (r.mode === 'charge') { charge += current * duration; chargeEnergy += current * voltage * duration }
      if (r.mode === 'discharge') { discharge += current * duration; dischargeEnergy += current * voltage * duration } }
    return { findings: [], metrics: [m(prefix + 'sampled-totals-derived', category, 1), m(prefix + 'charge-mAh', category, rational(charge, 3600000n)), m(prefix + 'discharge-mAh', category, rational(discharge, 3600000n)), m(prefix + 'charge-mWh', category, rational(chargeEnergy, 3600000000n)), m(prefix + 'discharge-mWh', category, rational(dischargeEnergy, 3600000000n)), m(prefix + 'covered-milliseconds', category, i.windowEndMs - i.windowStartMs)] }
  })
export const BATCH14_BATTERIES = scienceRecordSuite(policy, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), integrate, ...materialBindingAudits(policy, 'batteryRef')])
