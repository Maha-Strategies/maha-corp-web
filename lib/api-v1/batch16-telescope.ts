import { z } from 'zod'
import { input, records, id, digest, spec, hash, utc, time, later, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, samePins, type SciencePolicy } from './batch11-science-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'

const category = 'telescope-calibrations', prefix = category + '-'
const boundary = 'Supplied public or synthetic telescope calibration manifests only. No FITS parsing, image correction, detector characterization, pointing, hardware control or scientific/standards/safety certification. Calibration compatibility and validity windows are caller policy; no master-file bytes or calibration performance are verified.'
const frame = { datasetRef: id, instrumentRef: id, detectorRef: id, filterRef: id, binningRef: id, readoutModeRef: id, pipelineDigest: digest, calibrationDigest: digest, recordRevision: digest }
const sample = { datasetRef: 'calibrations1', instrumentRef: 'instrument-synthetic1', detectorRef: 'detector1', filterRef: 'filter1', binningRef: 'binning1', readoutModeRef: 'readout1', pipelineDigest: hash, calibrationDigest: hash, recordRevision: hash }
const pins = { ...frame, manifestDigest: digest, scopeRef: id }, row = { id: 'calibration1', ...sample, manifestDigest: hash, scopeRef: 'public-metadata' }
const units = ['electrons-per-adu', 'adu-per-electron', 'seconds', 'milliseconds', 'kelvin', 'degrees-celsius', 'electrons', 'adu'] as const
const policy: SciencePolicy = { category, noun: 'instrument/detector/filter/binning/readout/pipeline-pinned calibration manifests', boundary, pins, sample: row, owner: 'datasetRef', subject: 'instrumentRef', revision: 'recordRevision', content: 'manifestDigest', units, unitMeaning: 'telescope calibration quantities' }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: { id: 'm1', ...sample }, quantities: ['gain', 'exposure', 'temperature', 'read-noise'], units,
  compatible: { gain: ['electrons-per-adu', 'adu-per-electron'], exposure: ['seconds', 'milliseconds'], temperature: ['kelvin', 'degrees-celsius'], 'read-noise': ['electrons', 'adu'] }, sampleQuantity: 'exposure', sampleUnit: 'seconds' })
const master = { id: 'master1', ...sample, createdAt: time, validFrom: time, validUntil: later }
const timestamp = spec(prefix + 'timestamp-order-audit', 'Check a requested science acquisition time against declared calibration validity [validFrom, validUntil), requiring the identical instrument/detector/filter/binning/readout/pipeline/calibration/revision frame. Unknown expiry, future creation or reversed/empty windows cannot establish applicability; equality at the end is expired. Not an assertion of calibration quality or real acquisition. ' + boundary,
  input({ ...frame, acquiredAt: utc, rows: records({ ...frame, createdAt: utc, validFrom: utc, validUntil: utc.nullable() }) }),
  { ...sample, acquiredAt: time, rows: [master] }, { ...sample, acquiredAt: later, rows: [master] },
  [prefix + 'acquisition-outside-validity', prefix + 'validity-frame-mismatch', prefix + 'validity-window-unknown', prefix + 'validity-window-invalid', prefix + 'calibration-created-after-acquisition'],
  [prefix + 'applicable-declared-calibrations'], i => {
    unique(i.rows.map(r => r.id)); let applicable = 0
    const findings = i.rows.flatMap(r => { const issues = [...(!samePins(r, i, Object.keys(frame)) ? [f(prefix + 'validity-frame-mismatch', r.id)] : []), ...(r.validUntil === null ? [f(prefix + 'validity-window-unknown', r.id)] : r.validFrom >= r.validUntil ? [f(prefix + 'validity-window-invalid', r.id)] : i.acquiredAt < r.validFrom || i.acquiredAt >= r.validUntil ? [f(prefix + 'acquisition-outside-validity', r.id)] : []), ...(r.createdAt > i.acquiredAt ? [f(prefix + 'calibration-created-after-acquisition', r.id)] : [])]; if (!issues.length) applicable++; return issues })
    return { findings, metrics: [m(prefix + 'applicable-declared-calibrations', category, applicable)] }
  })
const conditions = spec(prefix + 'condition-coverage-map', 'Require exactly one declared available master per requested calibration kind in the science exposure configuration. Verify instrument, detector, filter, binning, readout and pipeline/revision pins, and an exact exposure duration in milliseconds; duplicates, missing/unknown masters and mismatches do not pass. Exact exposure matching is an explicit restrictive policy, not a universal rule for bias/dark/flat processing. ' + boundary,
  input({ ...frame, exposureMilliseconds: z.number().int().min(0).max(86400000), requiredKinds: z.array(z.enum(['bias', 'dark', 'flat'])).min(1).max(3),
    rows: records({ ...frame, kind: z.enum(['bias', 'dark', 'flat']), exposureMilliseconds: z.number().int().min(0).max(86400000).nullable(), state: z.enum(['available', 'missing', 'unknown']) }, 0) }),
  { ...sample, exposureMilliseconds: 1000, requiredKinds: ['dark'], rows: [{ id: 'dark1', ...sample, kind: 'dark', exposureMilliseconds: 1000, state: 'available' }] },
  { ...sample, exposureMilliseconds: 1000, requiredKinds: ['dark'], rows: [] },
  [prefix + 'master-not-established', prefix + 'master-configuration-mismatch', prefix + 'master-not-available', prefix + 'master-kind-undeclared'], [prefix + 'compatible-requested-masters'], i => {
    unique(i.requiredKinds); unique(i.rows.map(r => r.id)); let compatible = 0
    const valid = (r: typeof i.rows[number]) => samePins(r, i, Object.keys(frame)) && r.exposureMilliseconds === i.exposureMilliseconds && r.state === 'available'
    const findings = i.requiredKinds.flatMap(k => { const matches = i.rows.filter(r => r.kind === k); if (matches.length === 1 && valid(matches[0])) { compatible++; return [] }; return [f(prefix + 'master-not-established', k)] })
    findings.push(...i.rows.flatMap(r => [...(!samePins(r, i, Object.keys(frame)) || r.exposureMilliseconds !== i.exposureMilliseconds ? [f(prefix + 'master-configuration-mismatch', r.id)] : []), ...(r.state !== 'available' ? [f(prefix + 'master-not-available', r.id)] : []), ...(!i.requiredKinds.includes(r.kind) ? [f(prefix + 'master-kind-undeclared', r.id)] : [])]))
    return { findings, metrics: [m(prefix + 'compatible-requested-masters', category, compatible)] }
  })
export const TELESCOPE_CALIBRATION_AUDITS = scienceRecordSuite(policy, [...numeric, timestamp, conditions])
export const BATCH16_TELESCOPE = TELESCOPE_CALIBRATION_AUDITS.slice(0, 13)
