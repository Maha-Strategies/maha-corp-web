import { z } from 'zod'
import { input, records, id, digest, utc, spec, hash, otherHash, time, later, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, finiteValue } from './batch11-science-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

const category = 'spectrometry-records', prefix = category + '-'
const boundary = 'Bounded public or synthetic spectrum/calibration metadata only; no raw instrument file parsing, hardware calls, peak identification, compound inference, medical interpretation, calibration-performance guarantee or laboratory instructions. Supplied source pins are not verified source bytes.'
const pins = { datasetRef: id, spectrumRef: id, recordRevision: digest, spectrumDigest: digest, instrumentRef: id, calibrationDigest: digest, acquisitionMethodDigest: digest, scopeRef: id }
const row = { id: 'spectrum1', datasetRef: 'dataset1', spectrumRef: 'spectrum-synthetic1', recordRevision: hash, spectrumDigest: hash, instrumentRef: 'instrument1', calibrationDigest: hash, acquisitionMethodDigest: hash, scopeRef: 'public-metadata' }
const statement = (text: string) => text + '. ' + boundary
const units = ['m/z', 'nanometres', 'inverse-centimetres', 'counts', 'AU', 'seconds'] as const
const numeric = measurementAudits({ category, noun: 'spectral axis/intensity export declarations', quantities: ['mass-to-charge', 'wavelength', 'wavenumber', 'intensity', 'duration'], units,
  compatible: { 'mass-to-charge': ['m/z'], wavelength: ['nanometres'], wavenumber: ['inverse-centimetres'], intensity: ['counts', 'AU'], duration: ['seconds'] }, sampleQuantity: 'mass-to-charge', sampleUnit: 'm/z' })
const axis = z.enum(['mass-to-charge', 'wavelength', 'wavenumber']), axisUnit = z.enum(['m/z', 'nanometres', 'inverse-centimetres'])
const compatibleAxis = (a: string, u: string) => ({ 'mass-to-charge': 'm/z', wavelength: 'nanometres', wavenumber: 'inverse-centimetres' })[a as 'mass-to-charge' | 'wavelength' | 'wavenumber'] === u
const acquisitionPins = { datasetRef: id, spectrumRef: id, revision: digest, instrumentRef: id, calibrationDigest: digest, axis, axisUnit }
const acquisition = { id: 'a1', datasetRef: row.datasetRef, spectrumRef: row.spectrumRef, revision: hash, instrumentRef: row.instrumentRef, calibrationDigest: hash, axis: 'mass-to-charge', axisUnit: 'm/z' }
const reference = spec(prefix + 'reference-integrity-map', statement('Bind point records to exact dataset/spectrum/revision/instrument/calibration and compatible axis-label declarations; no cross-axis numeric equivalence is inferred'),
  input({ acquisitions: records(acquisitionPins), points: records({ ...acquisitionPins, acquisitionId: id, axisValue: z.number().finite().min(0).max(1e9), intensity: finiteValue.nullable() }) }),
  { acquisitions: [acquisition], points: [{ ...acquisition, id: 'p1', acquisitionId: 'a1', axisValue: 100, intensity: 1 }] },
  { acquisitions: [acquisition], points: [{ ...acquisition, id: 'p1', acquisitionId: 'a1', calibrationDigest: otherHash, axisValue: 100, intensity: 1 }] },
  [prefix + 'acquisition-pin-mismatch', prefix + 'acquisition-missing', prefix + 'axis-unit-incompatible'], [prefix + 'bound-point-acquisitions'], i => {
    unique(i.acquisitions.map(r => r.id)); unique(i.points.map(r => r.id)); const acquisitions = new Map(i.acquisitions.map(r => [r.id, r])); let bound = 0
    const findings = i.points.flatMap(r => { const a = acquisitions.get(r.acquisitionId), issues = [...(!a ? [f(prefix + 'acquisition-missing', r.id)] : a.datasetRef !== r.datasetRef || a.spectrumRef !== r.spectrumRef || a.revision !== r.revision || a.instrumentRef !== r.instrumentRef || a.calibrationDigest !== r.calibrationDigest || a.axis !== r.axis || a.axisUnit !== r.axisUnit ? [f(prefix + 'acquisition-pin-mismatch', r.id)] : []), ...(!compatibleAxis(r.axis, r.axisUnit) || a && !compatibleAxis(a.axis, a.axisUnit) ? [f(prefix + 'axis-unit-incompatible', r.id)] : [])]; if (!issues.length) bound++; return issues })
    return { findings, metrics: [m(prefix + 'bound-point-acquisitions', category, bound)] }
  })
const calibration = { id: 'c1', calibrationRef: 'cal1', revision: hash, instrumentRef: row.instrumentRef, methodDigest: hash, capturedAt: time, validUntil: later, state: 'valid' }
const coverage = spec(prefix + 'condition-coverage-map', statement('Require one caller-declared valid calibration for each requested reference/revision in the exact instrument/method frame and start-inclusive, expiry-exclusive assessment window; unknown, absent or duplicate evidence cannot pass'),
  input({ assessedAt: utc, instrumentRef: id, methodDigest: digest, requiredCalibrations: records({ calibrationRef: id, revision: digest }), calibrations: records({ calibrationRef: id, revision: digest, instrumentRef: id, methodDigest: digest, capturedAt: utc, validUntil: utc.nullable(), state: z.enum(['valid', 'invalid', 'unknown']) }, 0) }),
  { assessedAt: time, instrumentRef: row.instrumentRef, methodDigest: hash, requiredCalibrations: [{ id: 'r1', calibrationRef: 'cal1', revision: hash }], calibrations: [calibration] },
  { assessedAt: time, instrumentRef: row.instrumentRef, methodDigest: hash, requiredCalibrations: [{ id: 'r1', calibrationRef: 'cal1', revision: hash }], calibrations: [{ ...calibration, state: 'unknown' }] },
  [prefix + 'calibration-not-established', prefix + 'calibration-frame-mismatch', prefix + 'calibration-undeclared'], [prefix + 'uniquely-covered-calibrations'], i => {
    unique(i.requiredCalibrations.map(r => r.id)); unique(i.requiredCalibrations.map(r => demandDigest([r.calibrationRef, r.revision]))); unique(i.calibrations.map(r => r.id)); let covered = 0
    const findings = i.requiredCalibrations.flatMap(r => { const matches = i.calibrations.filter(c => c.calibrationRef === r.calibrationRef && c.revision === r.revision); if (matches.length === 1) { const c = matches[0]; if (c.instrumentRef === i.instrumentRef && c.methodDigest === i.methodDigest && c.state === 'valid' && c.capturedAt <= i.assessedAt && c.validUntil !== null && c.validUntil > i.assessedAt) { covered++; return [] } }; return [f(prefix + 'calibration-not-established', r.id)] })
    findings.push(...i.calibrations.filter(c => c.instrumentRef !== i.instrumentRef || c.methodDigest !== i.methodDigest).map(c => f(prefix + 'calibration-frame-mismatch', c.id)), ...i.calibrations.filter(c => !i.requiredCalibrations.some(r => r.calibrationRef === c.calibrationRef && r.revision === c.revision)).map(c => f(prefix + 'calibration-undeclared', c.id)))
    return { findings, metrics: [m(prefix + 'uniquely-covered-calibrations', category, covered)] }
  })
const point = { axisValue: z.number().finite().min(0).max(1e9), intensity: finiteValue.nullable(), axisUnit, intensityUnit: z.enum(['counts', 'AU']) }
const p1 = { id: 'p1', axisValue: 100, intensity: 1, axisUnit: 'm/z', intensityUnit: 'counts' }
const sequence = spec(prefix + 'record-sequence-diff', statement('Separate added/removed/changed spectral points from reordering of surviving point IDs; report non-increasing axis order and mismatched units within each supplied export. Reordering does not imply peak identity or signal quality'),
  input({ axis, axisUnit, intensityUnit: z.enum(['counts', 'AU']), before: records(point, 0), after: records(point, 0) }),
  { axis: 'mass-to-charge', axisUnit: 'm/z', intensityUnit: 'counts', before: [p1], after: [p1] },
  { axis: 'mass-to-charge', axisUnit: 'm/z', intensityUnit: 'counts', before: [p1], after: [{ ...p1, intensity: 2 }] },
  [prefix + 'point-changed', prefix + 'point-removed', prefix + 'point-added', prefix + 'shared-point-order-changed', prefix + 'axis-not-strictly-increasing', prefix + 'point-unit-mismatch'], [prefix + 'point-projection-differences'], i => {
    unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), beforeIds = new Set(i.before.map(r => r.id))
    const findings = i.before.flatMap(r => !a.has(r.id) ? [f(prefix + 'point-removed', r.id)] : demandDigest(r) !== demandDigest(a.get(r.id)) ? [f(prefix + 'point-changed', r.id)] : [])
    findings.push(...i.after.filter(r => !beforeIds.has(r.id)).map(r => f(prefix + 'point-added', r.id)))
    const left = i.before.filter(r => a.has(r.id)).map(r => r.id), right = i.after.filter(r => beforeIds.has(r.id)).map(r => r.id)
    if (left.some((v, n) => v !== right[n])) findings.push(f(prefix + 'shared-point-order-changed', ...left))
    for (const [label, points] of [['before', i.before], ['after', i.after]] as const) {
      if (points.some((r, n) => n > 0 && points[n - 1].axisValue >= r.axisValue)) findings.push(f(prefix + 'axis-not-strictly-increasing', label))
      if (!compatibleAxis(i.axis, i.axisUnit) || points.some(r => r.axisUnit !== i.axisUnit || r.intensityUnit !== i.intensityUnit)) findings.push(f(prefix + 'point-unit-mismatch', label))
    }
    return { findings, metrics: [m(prefix + 'point-projection-differences', category, findings.length)] }
  })
const provenance = spec(prefix + 'provenance-edge-audit', statement('Bind spectrum exports to exact instrument/calibration/acquisition-method/source-revision/artifact pins; metadata provenance is not proof of instrument execution'),
  input({ sources: records({ datasetRef: id, instrumentRef: id, calibrationDigest: digest, acquisitionMethodDigest: digest, sourceRevision: digest, artifactDigest: digest }), rows: records({ ...pins, sourceId: id, sourceRevision: digest, artifactDigest: digest }) }),
  { sources: [{ id: 's1', datasetRef: row.datasetRef, instrumentRef: row.instrumentRef, calibrationDigest: hash, acquisitionMethodDigest: hash, sourceRevision: hash, artifactDigest: hash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, artifactDigest: hash }] },
  { sources: [{ id: 's1', datasetRef: row.datasetRef, instrumentRef: row.instrumentRef, calibrationDigest: otherHash, acquisitionMethodDigest: hash, sourceRevision: hash, artifactDigest: hash }], rows: [{ ...row, sourceId: 's1', sourceRevision: hash, artifactDigest: hash }] },
  [prefix + 'spectrum-source-pin-mismatch', prefix + 'spectrum-source-missing'], [prefix + 'bound-spectrum-sources'], i => {
    unique(i.sources.map(r => r.id)); unique(i.rows.map(r => r.id)); const sources = new Map(i.sources.map(r => [r.id, r])); let bound = 0
    const findings = i.rows.flatMap(r => { const s = sources.get(r.sourceId); if (!s) return [f(prefix + 'spectrum-source-missing', r.id)]; if (s.datasetRef !== r.datasetRef || s.instrumentRef !== r.instrumentRef || s.calibrationDigest !== r.calibrationDigest || s.acquisitionMethodDigest !== r.acquisitionMethodDigest || s.sourceRevision !== r.sourceRevision || s.artifactDigest !== r.artifactDigest) return [f(prefix + 'spectrum-source-pin-mismatch', r.id)]; bound++; return [] })
    return { findings, metrics: [m(prefix + 'bound-spectrum-sources', category, bound)] }
  })
export const BATCH12_SPECTROMETRY = scienceRecordSuite({ category, noun: 'instrument/calibration/method-pinned spectrum metadata', boundary, pins, sample: row,
  owner: 'datasetRef', subject: 'spectrumRef', revision: 'recordRevision', content: 'spectrumDigest', units, unitMeaning: 'spectral axis and intensity declarations' }, [...numeric.filter(s => !s.id.endsWith('condition-coverage-map')), reference, coverage, sequence, provenance])
