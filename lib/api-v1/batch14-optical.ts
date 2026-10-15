import { z } from 'zod'
import { input, records, id, digest, spec, hash, otherHash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { materialBindingAudits, materialBoundary, rational } from './batch13-material-core.ts'

const category = 'optical-measurements', prefix = category + '-'
const boundary = 'Supplied public or synthetic optical export metadata only; no beam controls, laser operating instructions, spectroscopy identification, medical or material efficacy claims or calibration certification. ' + materialBoundary
const pins = { datasetRef: id, opticalRef: id, materialLotRef: id, methodDigest: digest, geometryRef: id, calibrationDigest: digest, recordRevision: digest, measurementsDigest: digest, scopeRef: id }
const row = { id: 'optical1', datasetRef: 'dataset1', opticalRef: 'optical-synthetic1', materialLotRef: 'lot1', methodDigest: hash, geometryRef: 'geometry1', calibrationDigest: hash, recordRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata' }
const units = ['watts', 'milliwatts', 'microwatts', 'nanometres', 'micrometres', 'ratio', 'percent', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'optical geometry/calibration/lot/method-pinned records', boundary, pins, sample: row, owner: 'datasetRef', subject: 'opticalRef', revision: 'recordRevision', content: 'measurementsDigest', units, unitMeaning: 'optical export quantities' }
const numeric = measurementAudits({ category, noun: 'optical export metadata', quantities: ['power', 'wavelength', 'transmission-fraction', 'duration'], units,
  compatible: { power: ['watts', 'milliwatts', 'microwatts'], wavelength: ['nanometres', 'micrometres'], 'transmission-fraction': ['ratio', 'percent'], duration: ['seconds'] }, sampleQuantity: 'power', sampleUnit: 'microwatts' })
const power = z.number().int().min(0).max(1e9).nullable()
const reading = { id: 'r1', geometryRef: row.geometryRef, bandRef: 'band1', calibrationDigest: hash, incidentMicrowatts: 1000, transmittedMicrowatts: 600, reflectedMicrowatts: 200, qualifier: 'exact' }
const frame = { datasetRef: row.datasetRef, opticalRef: row.opticalRef, materialLotRef: row.materialLotRef, methodDigest: hash, revision: hash, geometryRef: row.geometryRef, bandRef: 'band1', calibrationDigest: hash, tolerancePpm: 0 }
const accounting = spec(prefix + 'condition-coverage-map', 'Audit at most 32 declared incident/transmitted/reflected power readings in integer microwatts, requiring matching geometry, band and calibration pins. Report exact transmitted, reflected and unaccounted fractions of a positive incident reading. Unaccounted power is NOT inferred absorption: unmeasured scattering or other loss channels may exist. Unknown readings, frame mismatches or zero incident power block normalization. An inclusive caller tolerance flags excess outgoing power; tolerated negative residuals are not clipped. No unit conversion, dark correction or calibration verification. ' + boundary,
  input({ datasetRef: id, opticalRef: id, materialLotRef: id, methodDigest: digest, revision: digest, geometryRef: id, bandRef: id, calibrationDigest: digest, tolerancePpm: z.number().int().min(0).max(10000), rows: records({ geometryRef: id, bandRef: id, calibrationDigest: digest, incidentMicrowatts: power, transmittedMicrowatts: power, reflectedMicrowatts: power, qualifier: z.enum(['exact', 'unknown']) }) }),
  { ...frame, rows: [reading] }, { ...frame, rows: [{ ...reading, calibrationDigest: otherHash }] },
  [prefix + 'power-frame-mismatch', prefix + 'power-not-exact', prefix + 'incident-power-zero', prefix + 'outgoing-power-excess'],
  [prefix + 'readings-normalized', prefix + 'transmitted-fraction', prefix + 'reflected-fraction', prefix + 'unaccounted-fraction'], i => {
    unique(i.rows.map(r => r.id)); let normalized = 0; const metrics: ReturnType<typeof m>[] = []
    const findings = i.rows.flatMap(r => {
      if (r.geometryRef !== i.geometryRef || r.bandRef !== i.bandRef || r.calibrationDigest !== i.calibrationDigest) return [f(prefix + 'power-frame-mismatch', r.id)]
      if (r.qualifier !== 'exact' || r.incidentMicrowatts === null || r.transmittedMicrowatts === null || r.reflectedMicrowatts === null) return [f(prefix + 'power-not-exact', r.id)]
      if (r.incidentMicrowatts === 0) return [f(prefix + 'incident-power-zero', r.id)]
      const incident = BigInt(r.incidentMicrowatts), transmitted = BigInt(r.transmittedMicrowatts), reflected = BigInt(r.reflectedMicrowatts), remainder = incident - transmitted - reflected
      normalized++; metrics.push(m(prefix + 'transmitted-fraction', r.id, rational(transmitted, incident)), m(prefix + 'reflected-fraction', r.id, rational(reflected, incident)), m(prefix + 'unaccounted-fraction', r.id, rational(remainder, incident)))
      return -remainder * 1000000n > BigInt(i.tolerancePpm) * incident ? [f(prefix + 'outgoing-power-excess', r.id)] : []
    })
    return { findings, metrics: [m(prefix + 'readings-normalized', category, normalized), ...metrics] }
  })
export const BATCH14_OPTICAL = scienceRecordSuite(policy, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), accounting, ...materialBindingAudits(policy, 'opticalRef')])
