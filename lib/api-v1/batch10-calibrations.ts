import { z } from 'zod'
import { input, records, id, digest, utc, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, type AuditSpec } from './batch5-core.ts'
import { recordAuditSuite } from './batch9-record-suite.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import { qubit, qubitCount, calibrationBoundary } from './batch10-quantum-core.ts'
const prefix = 'quantum-calibrations-', code = (s: string) => 'qcal-' + s
const pins = { backendRef: id, calibrationRef: id, calibrationRevision: digest, measurementsDigest: digest, scopeRef: id, qubitCount }
const row = { id: 'calibration1', backendRef: 'backend1', calibrationRef: 'run1', calibrationRevision: hash, measurementsDigest: hash, scopeRef: 'public-metadata', qubitCount: 2 }
const quantity = z.enum(['error-rate', 'duration', 'frequency']), unit = z.enum(['ratio', 'percent', 'seconds', 'nanoseconds', 'hertz', 'gigahertz'])
const compatibleUnit = (q: z.infer<typeof quantity>, u: z.infer<typeof unit>) => ({ 'error-rate': ['ratio', 'percent'], duration: ['seconds', 'nanoseconds'], frequency: ['hertz', 'gigahertz'] })[q].includes(u)
const description = (s: string) => s + ' ' + calibrationBoundary
const custom: AuditSpec[] = [
  spec(prefix + 'duplicate-record-identities', description('Group exact backend/run/revision frames; conflicting measurement, scope or register-size pins are separate from repeated projections. Ingestion IDs do not identify calibration runs.'),
    input({ rows: records(pins) }), { rows: [row] }, { rows: [row, { ...row, id: 'run2' }] },
    [code('duplicate-run-frame'), code('run-frame-conflict')], [code('distinct-run-frames')], i => {
      unique(i.rows.map(r => r.id)); const groups = new Map<string, typeof i.rows>()
      for (const r of i.rows) { const key = demandDigest([r.backendRef, r.calibrationRef, r.calibrationRevision]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(code(new Set(g.map(r => demandDigest([r.measurementsDigest, r.qubitCount, r.scopeRef]))).size === 1 ? 'duplicate-run-frame' : 'run-frame-conflict'), ...g.map(r => r.id))), metrics: [m(code('distinct-run-frames'), 'calibration', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', description('Check quantity/unit labels and conflicting units within exact backend/run/revision/metric/ordered-qubit frames. Percent versus ratio is a label difference, not silently converted evidence.'),
    input({ measurements: records({ backendRef: id, runRef: id, revision: digest, metricRef: id, qubits: list(qubit, 1, 4), quantity, unit }) }),
    { measurements: [{ id: 'm1', backendRef: 'backend1', runRef: 'run1', revision: hash, metricRef: 'readout', qubits: [0], quantity: 'error-rate', unit: 'ratio' }] },
    { measurements: [{ id: 'm1', backendRef: 'backend1', runRef: 'run1', revision: hash, metricRef: 'readout', qubits: [0], quantity: 'error-rate', unit: 'seconds' }] },
    [code('quantity-unit-mismatch'), code('metric-unit-conflict'), code('duplicate-measurement-qubit')], [code('measurement-unit-frames')], i => {
      unique(i.measurements.map(r => r.id)); const groups = new Map<string, typeof i.measurements>(), findings = i.measurements.flatMap(r => [...(!compatibleUnit(r.quantity, r.unit) ? [f(code('quantity-unit-mismatch'), r.id)] : []), ...(new Set(r.qubits).size !== r.qubits.length ? [f(code('duplicate-measurement-qubit'), r.id)] : [])])
      for (const r of i.measurements) { const key = demandDigest([r.backendRef, r.runRef, r.revision, r.metricRef, r.qubits]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      findings.push(...[...groups.values()].filter(g => new Set(g.map(r => demandDigest([r.quantity, r.unit]))).size > 1).map(g => f(code('metric-unit-conflict'), ...g.map(r => r.id))))
      return { findings, metrics: [m(code('measurement-unit-frames'), 'calibration', groups.size)] }
    }),
  spec(prefix + 'timestamp-order-audit', description('Evaluate declared capture/valid-until times against caller assessment and maximum-age policy. Exact expiry is excluded, unknown expiry remains unknown, and freshness does not establish that a device retained its performance.'),
    input({ assessedAt: utc, maximumAgeMilliseconds: z.number().int().min(0).max(31 * 86400000), rows: records({ capturedAt: utc, validUntil: utc.nullable() }) }),
    { assessedAt: time, maximumAgeMilliseconds: 86400000, rows: [{ id: 'm1', capturedAt: time, validUntil: later }] },
    { assessedAt: later, maximumAgeMilliseconds: 31 * 86400000, rows: [{ id: 'm1', capturedAt: time, validUntil: later }] },
    [code('expired-at-assessment'), code('validity-before-capture'), code('capture-from-future'), code('maximum-age-exceeded'), code('expiry-undeclared')], [code('records-within-declared-freshness-policy')], i => {
      unique(i.rows.map(r => r.id)); let fresh = 0
      const findings = i.rows.flatMap(r => { const issues = [...(r.validUntil !== null && r.validUntil <= i.assessedAt ? [f(code('expired-at-assessment'), r.id)] : []), ...(r.validUntil !== null && r.validUntil < r.capturedAt ? [f(code('validity-before-capture'), r.id)] : []), ...(r.capturedAt > i.assessedAt ? [f(code('capture-from-future'), r.id)] : []), ...(Date.parse(i.assessedAt) - Date.parse(r.capturedAt) > i.maximumAgeMilliseconds ? [f(code('maximum-age-exceeded'), r.id)] : []), ...(r.validUntil === null ? [f(code('expiry-undeclared'), r.id)] : [])]; if (!issues.length) fresh++; return issues })
      return { findings, metrics: [m(code('records-within-declared-freshness-policy'), 'calibration', fresh)] }
    }),
  spec(prefix + 'reference-integrity-map', description('Bind each supplied measurement to an exact backend/configuration revision and check ordered operand indices against the declared register. Missing config pins and repeated/out-of-range qubits remain negative findings.'),
    input({ configurations: records({ backendRef: id, revision: digest, qubitCount }), measurements: records({ configId: id, backendRef: id, configRevision: digest, qubits: list(qubit, 1, 4) }) }),
    { configurations: [{ id: 'config1', backendRef: 'backend1', revision: hash, qubitCount: 2 }], measurements: [{ id: 'm1', configId: 'config1', backendRef: 'backend1', configRevision: hash, qubits: [0] }] },
    { configurations: [{ id: 'config1', backendRef: 'backend1', revision: hash, qubitCount: 2 }], measurements: [{ id: 'm1', configId: 'config1', backendRef: 'backend1', configRevision: hash, qubits: [2] }] },
    [code('measurement-qubit-outside-register'), code('configuration-missing'), code('configuration-frame-mismatch'), code('duplicate-measurement-qubit')], [code('bound-measurement-configurations')], i => {
      unique(i.configurations.map(r => r.id)); unique(i.measurements.map(r => r.id)); const configs = new Map(i.configurations.map(r => [r.id, r])); let bound = 0
      const findings = i.measurements.flatMap(r => { const c = configs.get(r.configId), issues = [...(c && r.qubits.some(q => q >= c.qubitCount) ? [f(code('measurement-qubit-outside-register'), r.id)] : []), ...(!c ? [f(code('configuration-missing'), r.id)] : c.backendRef !== r.backendRef || c.revision !== r.configRevision ? [f(code('configuration-frame-mismatch'), r.id)] : []), ...(new Set(r.qubits).size !== r.qubits.length ? [f(code('duplicate-measurement-qubit'), r.id)] : [])]; if (!issues.length) bound++; return issues })
      return { findings, metrics: [m(code('bound-measurement-configurations'), 'calibration', bound)] }
    }),
  spec(prefix + 'condition-coverage-map', description('Require one explicitly measured declaration for every requested metric/ordered-qubit target in an exact backend/run/revision. Unknown, duplicate, missing or unrelated records cannot establish measurement coverage.'),
    input({ backendRef: id, runRef: id, revision: digest, requiredTargets: records({ metricRef: id, qubits: list(qubit, 1, 4) }), measurements: records({ backendRef: id, runRef: id, revision: digest, metricRef: id, qubits: list(qubit, 1, 4), state: z.enum(['measured', 'missing', 'unknown']) }) }),
    { backendRef: 'backend1', runRef: 'run1', revision: hash, requiredTargets: [{ id: 't1', metricRef: 'readout', qubits: [0] }], measurements: [{ id: 'm1', backendRef: 'backend1', runRef: 'run1', revision: hash, metricRef: 'readout', qubits: [0], state: 'measured' }] },
    { backendRef: 'backend1', runRef: 'run1', revision: hash, requiredTargets: [{ id: 't1', metricRef: 'readout', qubits: [0] }], measurements: [{ id: 'm1', backendRef: 'backend1', runRef: 'run1', revision: hash, metricRef: 'readout', qubits: [0], state: 'unknown' }] },
    [code('required-measurement-not-established'), code('measurement-frame-mismatch')], [code('targets-with-unique-measurement')], i => {
      unique(i.requiredTargets.map(r => r.id)); unique(i.requiredTargets.map(r => demandDigest([r.metricRef, r.qubits]))); unique(i.measurements.map(r => r.id)); let measured = 0
      const findings = i.requiredTargets.flatMap(r => { const matching = i.measurements.filter(m => m.metricRef === r.metricRef && demandDigest(m.qubits) === demandDigest(r.qubits)), inFrame = matching.filter(m => m.backendRef === i.backendRef && m.runRef === i.runRef && m.revision === i.revision); if (matching.length === 1 && inFrame.length === 1 && inFrame[0].state === 'measured') { measured++; return [] }; return [f(code('required-measurement-not-established'), r.id)] })
      findings.push(...i.measurements.filter(m => m.backendRef !== i.backendRef || m.runRef !== i.runRef || m.revision !== i.revision).map(m => f(code('measurement-frame-mismatch'), m.id)))
      return { findings, metrics: [m(code('targets-with-unique-measurement'), 'calibration', measured)] }
    }),
  spec(prefix + 'declared-bound-audit', description('Compare finite measurement values with caller-defined inclusive metric/quantity/unit bounds. Unknown values are not zero; no universal hardware-quality threshold or unit conversion is inferred.'),
    input({ bounds: records({ metricRef: id, quantity, unit, minimum: z.number().finite(), maximum: z.number().finite() }), measurements: records({ metricRef: id, quantity, unit, value: z.number().finite().nullable() }) }),
    { bounds: [{ id: 'b1', metricRef: 'readout', quantity: 'error-rate', unit: 'ratio', minimum: 0, maximum: 0.1 }], measurements: [{ id: 'm1', metricRef: 'readout', quantity: 'error-rate', unit: 'ratio', value: 0.1 }] },
    { bounds: [{ id: 'b1', metricRef: 'readout', quantity: 'error-rate', unit: 'ratio', minimum: 0, maximum: 0.1 }], measurements: [{ id: 'm1', metricRef: 'readout', quantity: 'error-rate', unit: 'ratio', value: 0.2 }] },
    [code('value-outside-declared-bound'), code('bound-missing'), code('bound-quantity-unit-mismatch'), code('value-unknown')], [code('known-values-with-compatible-bounds')], i => {
      unique(i.bounds.map(r => r.id)); unique(i.bounds.map(r => r.metricRef)); unique(i.measurements.map(r => r.id)); if (i.bounds.some(b => b.minimum > b.maximum)) throw Error('reversed_calibration_bounds'); const bounds = new Map(i.bounds.map(b => [b.metricRef, b])); let known = 0
      const findings = i.measurements.flatMap(r => { const b = bounds.get(r.metricRef); if (!b) return [f(code('bound-missing'), r.id)]; if (b.quantity !== r.quantity || b.unit !== r.unit || !compatibleUnit(r.quantity, r.unit)) return [f(code('bound-quantity-unit-mismatch'), r.id)]; if (r.value === null) return [f(code('value-unknown'), r.id)]; known++; return r.value < b.minimum || r.value > b.maximum ? [f(code('value-outside-declared-bound'), r.id)] : [] })
      return { findings, metrics: [m(code('known-values-with-compatible-bounds'), 'calibration', known)] }
    }),
  spec(prefix + 'provenance-edge-audit', description('Bind measurement-to-configuration edges to exact backend/register-count/revision and measurement-content pins. This is supplied provenance consistency, not a device measurement or source-authenticity proof.'),
    input({ measurements: records({ backendRef: id, configRevision: digest, qubitCount, measurementsDigest: digest }), configurations: records({ backendRef: id, revision: digest, qubitCount }), edges: records({ measurementId: id, configurationId: id, measurementsDigest: digest }) }),
    { measurements: [{ id: 'm1', backendRef: 'backend1', configRevision: hash, qubitCount: 2, measurementsDigest: hash }], configurations: [{ id: 'c1', backendRef: 'backend1', revision: hash, qubitCount: 2 }], edges: [{ id: 'e1', measurementId: 'm1', configurationId: 'c1', measurementsDigest: hash }] },
    { measurements: [{ id: 'm1', backendRef: 'backend1', configRevision: hash, qubitCount: 2, measurementsDigest: hash }], configurations: [{ id: 'c1', backendRef: 'backend1', revision: hash, qubitCount: 2 }], edges: [{ id: 'e1', measurementId: 'm1', configurationId: 'c1', measurementsDigest: otherHash }] },
    [code('provenance-pin-mismatch'), code('provenance-endpoint-missing'), code('duplicate-provenance-edge')], [code('bound-config-provenance-edges')], i => {
      unique(i.measurements.map(r => r.id)); unique(i.configurations.map(r => r.id)); unique(i.edges.map(r => r.id)); const measurements = new Map(i.measurements.map(r => [r.id, r])), configs = new Map(i.configurations.map(r => [r.id, r])); let bound = 0
      const findings = i.edges.flatMap(e => { const r = measurements.get(e.measurementId), c = configs.get(e.configurationId), issues = [...(!r || !c ? [f(code('provenance-endpoint-missing'), e.id)] : []), ...(r && c && (r.backendRef !== c.backendRef || r.configRevision !== c.revision || r.qubitCount !== c.qubitCount || r.measurementsDigest !== e.measurementsDigest) ? [f(code('provenance-pin-mismatch'), e.id)] : []), ...(i.edges.filter(a => a.measurementId === e.measurementId && a.configurationId === e.configurationId).length > 1 ? [f(code('duplicate-provenance-edge'), e.id)] : [])]; if (!issues.length) bound++; return issues })
      return { findings, metrics: [m(code('bound-config-provenance-edges'), 'calibration', bound)] }
    }),
]
const base = recordAuditSuite({ category: 'quantum-calibrations', noun: 'bounded backend/run/register/measurement-pin records', boundary: calibrationBoundary,
  pins, sample: row, owner: 'backendRef', subject: 'calibrationRef', revision: 'calibrationRevision', content: 'measurementsDigest', units: ['ratio', 'percent'], unitMeaning: 'declared calibration metric',
})
const byId = new Map(custom.map(s => [s.id, s]))
export const BATCH10_CALIBRATIONS = base.slice(0, 14).map(s => byId.get(s.id) ?? { ...s, description: s.description.replace('issuer/subject or producer/work pins', 'backend/run/register/measurement pins') })
// Previously unimplemented tail; the first fourteen contracts stay unchanged.
export const BATCH11_CALIBRATIONS = base.slice(14)
