import { z } from 'zod'
import { input, records, id, digest, list, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, type SciencePolicy } from './batch11-science-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'

const category = 'robotics-telemetry', prefix = category + '-'
const boundary = 'Bounded public or synthetic nonpersonal telemetry declarations only; no robot connection, commands, path planning, collision/safety certification, pose reconstruction or implicit coordinate/clock conversion. Coordinate and calibration pins are caller declarations, not verified physical transforms or source bytes.'
const pins = { datasetRef: id, robotRef: id, frameRef: id, clockRef: id, calibrationDigest: digest, recordRevision: digest, telemetryDigest: digest, scopeRef: id }
const row = { id: 'message1', datasetRef: 'dataset1', robotRef: 'robot-synthetic1', frameRef: 'frame1', clockRef: 'clock1', calibrationDigest: hash, recordRevision: hash, telemetryDigest: hash, scopeRef: 'public-metadata' }
const units = ['metres', 'millimetres', 'metres-per-second', 'millimetres-per-second', 'radians', 'degrees', 'radians-per-second', 'degrees-per-second', 'seconds', 'milliseconds'] as const
const policy: SciencePolicy = { category, noun: 'robot/frame/clock/calibration-pinned telemetry export records', boundary, pins, sample: row, owner: 'datasetRef', subject: 'robotRef', revision: 'recordRevision', content: 'telemetryDigest', units, unitMeaning: 'robot telemetry quantities' }
const frame = { datasetRef: id, robotRef: id, frameRef: id, clockRef: id, calibrationDigest: digest, recordRevision: digest }
const sampleFrame = { id: 'm1', datasetRef: row.datasetRef, robotRef: row.robotRef, frameRef: row.frameRef, clockRef: row.clockRef, calibrationDigest: hash, recordRevision: hash }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: sampleFrame, quantities: ['position', 'linear-velocity', 'orientation-angle', 'angular-velocity', 'duration'], units,
  compatible: { position: ['metres', 'millimetres'], 'linear-velocity': ['metres-per-second', 'millimetres-per-second'], 'orientation-angle': ['radians', 'degrees'], 'angular-velocity': ['radians-per-second', 'degrees-per-second'], duration: ['seconds', 'milliseconds'] }, sampleQuantity: 'position', sampleUnit: 'metres' })
const clockFrame = { datasetRef: row.datasetRef, robotRef: row.robotRef, frameRef: row.frameRef, clockRef: row.clockRef, recordRevision: hash, maximumGapTicks: 10 }
const first = { id: 's1', frameRef: row.frameRef, clockRef: row.clockRef, sequence: 0, timeTicks: 0, qualifier: 'exact' }
const timeAudit = spec(prefix + 'timestamp-order-audit', 'Inspect supplied message order against one explicit coordinate frame and clock, without sorting away sequence regressions. Require increasing sequence numbers and ticks between adjacent exact records and flag gaps above an inclusive caller maximum. Unknown/wrong-frame records break adjacency; counters are never compared across them. Ticks have no inferred seconds conversion, and a singleton has no continuity evidence. ' + boundary,
  input({ datasetRef: id, robotRef: id, frameRef: id, clockRef: id, recordRevision: digest, maximumGapTicks: z.number().int().min(1).max(1e9), rows: records({ frameRef: id, clockRef: id, sequence: z.number().int().min(0).max(1e9), timeTicks: z.number().int().min(0).max(1e9).nullable(), qualifier: z.enum(['exact', 'unknown']) }) }),
  { ...clockFrame, rows: [first, { ...first, id: 's2', sequence: 1, timeTicks: 10 }] },
  { ...clockFrame, rows: [first, { ...first, id: 's2', sequence: 1, timeTicks: 11 }] },
  [prefix + 'clock-gap-exceeded', prefix + 'clock-frame-mismatch', prefix + 'timestamp-not-exact', prefix + 'sequence-not-increasing', prefix + 'ticks-not-increasing'], [prefix + 'comparable-adjacent-pairs', prefix + 'in-policy-adjacent-pairs'], i => {
    unique(i.rows.map(r => r.id)); const findings: ReturnType<typeof f>[] = []
    let previous: typeof i.rows[number] | undefined, comparable = 0, passing = 0
    for (const r of i.rows) {
      if (r.frameRef !== i.frameRef || r.clockRef !== i.clockRef) { findings.push(f(prefix + 'clock-frame-mismatch', r.id)); previous = undefined; continue }
      if (r.qualifier !== 'exact' || r.timeTicks === null) { findings.push(f(prefix + 'timestamp-not-exact', r.id)); previous = undefined; continue }
      if (previous) { comparable++; let valid = true
        if (r.sequence <= previous.sequence) { findings.push(f(prefix + 'sequence-not-increasing', r.id)); valid = false }
        if (r.timeTicks <= previous.timeTicks!) { findings.push(f(prefix + 'ticks-not-increasing', r.id)); valid = false }
        else if (r.timeTicks - previous.timeTicks! > i.maximumGapTicks) { findings.push(f(prefix + 'clock-gap-exceeded', r.id)); valid = false }
        if (valid) passing++
      }
      previous = r
    }
    return { findings, metrics: [m(prefix + 'comparable-adjacent-pairs', category, comparable), m(prefix + 'in-policy-adjacent-pairs', category, passing)] }
  })
const check = { id: 'c1', checkRef: 'calibration-pinned', frameRef: row.frameRef, clockRef: row.clockRef, calibrationDigest: hash, state: 'satisfied' }
const conditions = spec(prefix + 'condition-coverage-map', 'Require one satisfied observation precondition per requested check in the exact coordinate/clock/calibration frame. Missing, duplicate, unknown and undeclared checks are explicit findings, not permission to operate hardware. ' + boundary,
  input({ robotRef: id, frameRef: id, clockRef: id, calibrationDigest: digest, requiredChecks: list(id, 1, 16), checks: records({ checkRef: id, frameRef: id, clockRef: id, calibrationDigest: digest, state: z.enum(['satisfied', 'unsatisfied', 'unknown']) }, 0) }),
  { robotRef: row.robotRef, frameRef: row.frameRef, clockRef: row.clockRef, calibrationDigest: hash, requiredChecks: ['calibration-pinned'], checks: [check] },
  { robotRef: row.robotRef, frameRef: row.frameRef, clockRef: row.clockRef, calibrationDigest: hash, requiredChecks: ['calibration-pinned'], checks: [{ ...check, state: 'unknown' }] },
  [prefix + 'condition-not-established', prefix + 'condition-frame-mismatch', prefix + 'condition-undeclared'], [prefix + 'uniquely-satisfied-conditions'], i => {
    unique(i.requiredChecks); unique(i.checks.map(r => r.id)); let count = 0
    const matchesFrame = (r: typeof i.checks[number]) => r.frameRef === i.frameRef && r.clockRef === i.clockRef && r.calibrationDigest === i.calibrationDigest
    const findings = i.requiredChecks.flatMap(k => { const matches = i.checks.filter(r => r.checkRef === k); if (matches.length === 1 && matchesFrame(matches[0]) && matches[0].state === 'satisfied') { count++; return [] }; return [f(prefix + 'condition-not-established', k)] })
    findings.push(...i.checks.filter(r => !matchesFrame(r)).map(r => f(prefix + 'condition-frame-mismatch', r.id)), ...i.checks.filter(r => !i.requiredChecks.includes(r.checkRef)).map(r => f(prefix + 'condition-undeclared', r.id)))
    return { findings, metrics: [m(prefix + 'uniquely-satisfied-conditions', category, count)] }
  })
// This sequence-diff identity was implemented in Batch 4; preserve its contract.
export const BATCH15_ROBOTICS = scienceRecordSuite(policy, [...numeric, timeAudit, conditions]).filter(s => s.id !== prefix + 'record-sequence-diff')
