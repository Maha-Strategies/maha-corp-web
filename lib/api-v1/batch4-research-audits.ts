import { z } from 'zod'
import { input, object, list, id, digest, signed, count, utc, finding as f, metric as m, unique, cycles, type AuditResult, type AuditSpec } from './batch4-audit-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const base = { dataClass: 'synthetic', nonpersonalMetadata: true }, hash = 'sha256:' + 'a'.repeat(64)
const observed = '2026-01-01T00:00:00.000Z', assessed = '2026-01-02T00:00:00.000Z'
const records = <T extends z.ZodRawShape>(shape: T) => list(object({ id, ...shape }), 1, 32)
const spec = <S extends z.ZodType>(id: string, description: string, schema: S, sample: Record<string, unknown>, adverse: Record<string, unknown>,
  codes: string[], metricKeys: string[], run: (value: z.output<S>) => AuditResult): AuditSpec => ({ id, description, input: schema, sample: { ...base, ...sample }, adverse: { ...base, ...adverse }, expectedCodes: codes.slice(0, 1), codes, metricKeys, run: value => run(schema.parse(value)) })
const stressScale = { Pa: 1, kPa: 1000, MPa: 1000000 } as const
const volumeScale = { L: 1000000, mL: 1000, uL: 1 } as const
const measure = object({ id, property: id, valueMilli: signed, unit: z.enum(['Pa', 'kPa', 'MPa']), temperatureMilliK: count, method: id })
const commonMeasure = { id: 'm1', property: 'yield-stress', valueMilli: 2, unit: 'MPa', temperatureMilliK: 300000, method: 'tensile' }
const cohort = records({ batchId: id, assay: id, endpoint: id, unit: id, revision: digest })
const qRow = { id: 'r1', batchId: 'b1', assay: 'a1', endpoint: 'response', unit: 'relative', revision: hash }
export const RESEARCH_AUDITS: AuditSpec[] = [
  spec('materials-curve-unit-reconciliation', 'Compare supplied stress samples after exact Pa/kPa/MPa scale conversion; flag mixed properties, methods or declared test temperatures. No curve interpolation or measurement certification.',
    input({ reference: measure, samples: list(measure, 1, 32) }), { reference: commonMeasure, samples: [{ ...commonMeasure, id: 'm2', unit: 'kPa', valueMilli: 2000 }] },
    { reference: commonMeasure, samples: [{ ...commonMeasure, id: 'm2', property: 'elastic-modulus' }] }, ['condition-mismatch', 'converted-value-mismatch'], ['scaled-pascal-milli'], i => {
      unique([i.reference.id, ...i.samples.map((r) => r.id)])
      const findings = [], metrics = []
      for (const r of i.samples) { const value = BigInt(r.valueMilli) * BigInt(stressScale[r.unit as keyof typeof stressScale]); metrics.push(m('scaled-pascal-milli', r.id, value))
        if ((['property', 'temperatureMilliK', 'method'] as const).some(k => r[k] !== i.reference[k])) findings.push(f('condition-mismatch', r.id))
        else if (value !== BigInt(i.reference.valueMilli) * BigInt(stressScale[i.reference.unit as keyof typeof stressScale])) findings.push(f('converted-value-mismatch', r.id)) }
      return { findings, metrics }
    }),
  spec('materials-test-condition-clustering', 'Group supplied property records by exact declared unit, test temperature and method. Reports separate conditions rather than merging incompatible measurements.',
    input({ records: list(measure, 1, 32) }), { records: [commonMeasure, { ...commonMeasure, id: 'm2' }] },
    { records: [commonMeasure, { ...commonMeasure, id: 'm2', temperatureMilliK: 310000 }] }, ['different-condition-clusters'], ['cluster-count', 'cluster-size'], i => {
      unique(i.records.map((r) => r.id)); const groups = new Map<string, string[]>()
      for (const r of i.records) { const key = demandDigest([r.property, r.unit, r.temperatureMilliK, r.method]); groups.set(key, [...(groups.get(key) ?? []), r.id]) }
      return { findings: groups.size > 1 ? [f('different-condition-clusters', ...i.records.map((r) => r.id))] : [],
        metrics: [m('cluster-count', 'cohort', groups.size), ...[...groups.values()].map(g => m('cluster-size', g[0], g.length))] }
    }),
  spec('materials-batch-lot-traceability', 'Resolve declared sample-to-lot and lot-parent links, reporting missing lots and cyclic genealogy. Does not authenticate suppliers or physical materials.',
    input({ lots: records({ parentId: id.nullable(), revision: digest }), samples: records({ lotId: id }) }),
    { lots: [{ id: 'l1', parentId: null, revision: hash }], samples: [{ id: 's1', lotId: 'l1' }] },
    { lots: [{ id: 'l1', parentId: null, revision: hash }], samples: [{ id: 's1', lotId: 'missing' }] }, ['lot-missing', 'parent-missing', 'lot-cycle'], ['resolved-samples'], i => {
      unique(i.samples.map((r) => r.id)); const known = new Set(i.lots.map((r) => r.id)), cyclic = cycles(i.lots)
      return { findings: [...i.samples.filter((r) => !known.has(r.lotId)).map((r) => f('lot-missing', r.id)),
        ...i.lots.filter((r) => r.parentId && !known.has(r.parentId)).map((r) => f('parent-missing', r.id)), ...[...cyclic].map(r => f('lot-cycle', r))],
        metrics: [m('resolved-samples', 'cohort', i.samples.filter((r) => known.has(r.lotId)).length)] }
    }),
  spec('materials-property-source-snapshot', 'Rehash a supplied structured material-property snapshot against a pinned metadata digest and age threshold. No source download or authenticity claim.',
    input({ sourceId: id, expectedDigest: digest, snapshot: object({ sourceRevision: digest, observedAt: utc, measurement: measure }), assessedAt: utc, maxAgeSeconds: count }),
    { sourceId: 'src', expectedDigest: demandDigest({ sourceRevision: hash, observedAt: observed, measurement: commonMeasure }), snapshot: { sourceRevision: hash, observedAt: observed, measurement: commonMeasure }, assessedAt: assessed, maxAgeSeconds: 90000 },
    { sourceId: 'src', expectedDigest: hash, snapshot: { sourceRevision: hash, observedAt: observed, measurement: commonMeasure }, assessedAt: assessed, maxAgeSeconds: 90000 }, ['snapshot-digest-mismatch', 'snapshot-stale', 'snapshot-from-future'], ['age-seconds'], i => {
      const age = (Date.parse(i.assessedAt) - Date.parse(i.snapshot.observedAt)) / 1000
      return { findings: [...(demandDigest(i.snapshot) !== i.expectedDigest ? [f('snapshot-digest-mismatch', i.sourceId)] : []), ...(age > i.maxAgeSeconds ? [f('snapshot-stale', i.sourceId)] : []), ...(age < 0 ? [f('snapshot-from-future', i.sourceId)] : [])], metrics: [m('age-seconds', i.sourceId, age)] }
    }),
  spec('materials-measurement-revision-diff', 'Compare two declared measurement revisions field by field, separating value changes from changed method, unit and temperature. No inference of equivalent experiments.',
    input({ beforeRevision: digest, afterRevision: digest, before: measure, after: measure }), { beforeRevision: hash, afterRevision: 'sha256:' + 'b'.repeat(64), before: commonMeasure, after: commonMeasure },
    { beforeRevision: hash, afterRevision: 'sha256:' + 'b'.repeat(64), before: commonMeasure, after: { ...commonMeasure, unit: 'kPa' } }, ['measurement-fields-changed', 'revision-not-advanced', 'measurement-id-mismatch'], ['changed-field-count'], i => {
      const changed = (['property', 'valueMilli', 'unit', 'temperatureMilliK', 'method'] as const).filter(k => i.before[k] !== i.after[k])
      return { findings: [...(changed.length ? [f('measurement-fields-changed', i.before.id)] : []), ...(i.beforeRevision === i.afterRevision ? [f('revision-not-advanced', i.before.id)] : []), ...(i.before.id !== i.after.id ? [f('measurement-id-mismatch', i.before.id, i.after.id)] : [])], metrics: [m('changed-field-count', i.before.id, changed.length)] }
    }),
  spec('biology-assay-endpoint-crosswalk', 'Match declared assay endpoint mappings to reference endpoint/unit/revision tuples. Flags missing or ambiguous mappings; no biological-equivalence or clinical inference.',
    input({ references: records({ assay: id, endpoint: id, unit: id, revision: digest }), mappings: records({ referenceId: id, endpoint: id, unit: id, revision: digest }) }),
    { references: [{ id: 'ref', assay: 'a1', endpoint: 'response', unit: 'relative', revision: hash }], mappings: [{ id: 'map', referenceId: 'ref', endpoint: 'response', unit: 'relative', revision: hash }] },
    { references: [{ id: 'ref', assay: 'a1', endpoint: 'response', unit: 'relative', revision: hash }], mappings: [{ id: 'map', referenceId: 'ref', endpoint: 'survival', unit: 'relative', revision: hash }] }, ['endpoint-frame-mismatch', 'reference-missing', 'ambiguous-mapping'], ['matching-mappings'], i => {
      unique(i.references.map((r) => r.id)); unique(i.mappings.map((r) => r.id)); const refs = new Map(i.references.map((r) => [r.id, r])); let matches = 0
      const findings = i.mappings.flatMap((r) => { const ref = refs.get(r.referenceId); if (!ref) return [f('reference-missing', r.id)]; if ((['endpoint', 'unit', 'revision'] as const).some(k => ref[k] !== r[k])) return [f('endpoint-frame-mismatch', r.id)]; matches++; return [] })
      for (const ref of i.references) if (i.mappings.filter((r) => r.referenceId === ref.id).length > 1) findings.push(f('ambiguous-mapping', ref.id))
      return { findings, metrics: [m('matching-mappings', 'cohort', matches)] }
    }),
  spec('biology-sample-label-reconciliation', 'Reconcile anonymization-independent public/synthetic sample labels and batch/assay/endpoint metadata between two declared exports. No participant data or identity matching.',
    input({ before: cohort, after: cohort }), { before: [qRow], after: [qRow] }, { before: [qRow], after: [{ ...qRow, batchId: 'b2' }] },
    ['sample-label-frame-changed', 'sample-missing', 'sample-added'], ['matched-sample-count'], i => {
      unique(i.before.map((r) => r.id)); unique(i.after.map((r) => r.id)); const b = new Map(i.before.map((r) => [r.id, r])), a = new Map(i.after.map((r) => [r.id, r])); const findings = []
      for (const r of i.before) { const v = a.get(r.id); if (!v) findings.push(f('sample-missing', r.id)); else if ((['batchId', 'assay', 'endpoint', 'unit', 'revision'] as const).some(k => v[k] !== r[k])) findings.push(f('sample-label-frame-changed', r.id)) }
      for (const r of i.after) if (!b.has(r.id)) findings.push(f('sample-added', r.id))
      return { findings, metrics: [m('matched-sample-count', 'cohort', i.before.filter((r) => a.has(r.id)).length)] }
    }),
  spec('biology-assay-unit-conversion-audit', 'Compare declared assay volumes in L, mL or uL using exact integer microunit ratios. No concentration, potency, clinical dosing or measurement-validity inference.',
    input({ records: records({ valueMilli: signed, unit: z.enum(['L', 'mL', 'uL']), claimedMicrolitreMilli: signed }) }),
    { records: [{ id: 'v1', valueMilli: 2, unit: 'mL', claimedMicrolitreMilli: 2000 }] }, { records: [{ id: 'v1', valueMilli: 2, unit: 'mL', claimedMicrolitreMilli: 2 }] }, ['volume-conversion-mismatch'], ['microlitre-milli'], i => {
      unique(i.records.map((r) => r.id)); const findings = [], metrics = []
      for (const r of i.records) { const value = BigInt(r.valueMilli) * BigInt(volumeScale[r.unit as keyof typeof volumeScale]); metrics.push(m('microlitre-milli', r.id, value)); if (value !== BigInt(r.claimedMicrolitreMilli)) findings.push(f('volume-conversion-mismatch', r.id)) }
      return { findings, metrics }
    }),
  spec('biology-correction-propagation-report', 'Find supplied assay references still pinned to a corrected metadata revision. Classifies links only; does not establish truth, efficacy or source acceptance.',
    input({ sourceId: id, originalRevision: digest, correctedRevision: digest, references: records({ sourceId: id, revision: digest }) }),
    { sourceId: 's1', originalRevision: hash, correctedRevision: 'sha256:' + 'b'.repeat(64), references: [{ id: 'ref', sourceId: 's1', revision: 'sha256:' + 'b'.repeat(64) }] },
    { sourceId: 's1', originalRevision: hash, correctedRevision: 'sha256:' + 'b'.repeat(64), references: [{ id: 'ref', sourceId: 's1', revision: hash }] }, ['reference-needs-correction', 'reference-other-revision', 'reference-other-source'], ['current-references'], i => {
      if (i.originalRevision === i.correctedRevision) throw Error('correction_revision_not_changed'); unique(i.references.map((r) => r.id))
      return { findings: i.references.flatMap((r) => r.sourceId !== i.sourceId ? [f('reference-other-source', r.id)] : r.revision === i.originalRevision ? [f('reference-needs-correction', r.id)] : r.revision !== i.correctedRevision ? [f('reference-other-revision', r.id)] : []), metrics: [m('current-references', 'cohort', i.references.filter((r) => r.sourceId === i.sourceId && r.revision === i.correctedRevision).length)] }
    }),
  spec('quantum-calibration-age-report', 'Calculate declared calibration ages at a supplied assessment time, flagging future or stale records under a caller-specified threshold. No device-state or fidelity guarantee.',
    input({ assessedAt: utc, maximumAgeSeconds: count, calibrations: records({ observedAt: utc, configurationDigest: digest, expectedConfigurationDigest: digest }) }),
    { assessedAt: assessed, maximumAgeSeconds: 90000, calibrations: [{ id: 'c1', observedAt: observed, configurationDigest: hash, expectedConfigurationDigest: hash }] },
    { assessedAt: assessed, maximumAgeSeconds: 10, calibrations: [{ id: 'c1', observedAt: observed, configurationDigest: hash, expectedConfigurationDigest: hash }] }, ['calibration-stale', 'calibration-from-future', 'configuration-mismatch'], ['age-seconds'], i => {
      unique(i.calibrations.map((r) => r.id)); const findings = [], metrics = []
      for (const r of i.calibrations) { const age = (Date.parse(i.assessedAt) - Date.parse(r.observedAt)) / 1000; metrics.push(m('age-seconds', r.id, age)); if (age > i.maximumAgeSeconds) findings.push(f('calibration-stale', r.id)); if (age < 0) findings.push(f('calibration-from-future', r.id)); if (r.configurationDigest !== r.expectedConfigurationDigest) findings.push(f('configuration-mismatch', r.id)) }
      return { findings, metrics }
    }),
  spec('quantum-shot-dataset-lineage', 'Check declared shot-dataset parent IDs, configuration pins and shot-count totals. Reports missing/cyclic lineage without querying hardware or validating randomness.',
    input({ expectedConfigurationDigest: digest, expectedShots: count, datasets: records({ parentId: id.nullable(), configurationDigest: digest, shots: count }) }),
    { expectedConfigurationDigest: hash, expectedShots: 100, datasets: [{ id: 'd1', parentId: null, configurationDigest: hash, shots: 100 }] },
    { expectedConfigurationDigest: hash, expectedShots: 101, datasets: [{ id: 'd1', parentId: null, configurationDigest: hash, shots: 100 }] }, ['shot-total-mismatch', 'shot-parent-missing', 'shot-lineage-cycle', 'shot-configuration-mismatch'], ['total-shots'], i => {
      const cyclic = cycles(i.datasets), known = new Set(i.datasets.map((r) => r.id)), total = i.datasets.reduce((n: number, r) => n + r.shots, 0)
      return { findings: [...(total !== i.expectedShots ? [f('shot-total-mismatch', 'cohort')] : []), ...i.datasets.flatMap((r) => [...(r.parentId && !known.has(r.parentId) ? [f('shot-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('shot-lineage-cycle', r.id)] : []), ...(r.configurationDigest !== i.expectedConfigurationDigest ? [f('shot-configuration-mismatch', r.id)] : [])])], metrics: [m('total-shots', 'cohort', total)] }
    }),
  spec('quantum-hardware-configuration-snapshot', 'Compare supplied qubit, topology, gate-set and configuration-revision declarations with a pinned snapshot digest. No live hardware query or architecture ranking.',
    input({ expectedDigest: digest, snapshot: object({ revision: digest, qubits: count, topology: z.enum(['line', 'grid', 'all-to-all', 'declared-other']), gates: list(id, 1, 32) }) }),
    { expectedDigest: demandDigest({ revision: hash, qubits: 4, topology: 'line', gates: ['x', 'cx'] }), snapshot: { revision: hash, qubits: 4, topology: 'line', gates: ['x', 'cx'] } },
    { expectedDigest: hash, snapshot: { revision: hash, qubits: 4, topology: 'line', gates: ['x', 'cx'] } }, ['hardware-snapshot-digest-mismatch'], ['qubit-count'], i => {
      unique(i.snapshot.gates); return { findings: demandDigest(i.snapshot) !== i.expectedDigest ? [f('hardware-snapshot-digest-mismatch', 'configuration')] : [], metrics: [m('qubit-count', 'configuration', i.snapshot.qubits)] }
    }),
  spec('robotics-message-clock-audit', 'Audit supplied per-stream sequence numbers and integer timestamps for duplicates, regressions and excessive declared gaps. No synchronization correction, network capture or robot control.',
    input({ maximumGapMs: count, messages: records({ stream: id, sequence: count, timeMs: count }) }),
    { maximumGapMs: 100, messages: [{ id: 'a', stream: 's1', sequence: 1, timeMs: 10 }, { id: 'b', stream: 's1', sequence: 2, timeMs: 20 }] },
    { maximumGapMs: 100, messages: [{ id: 'a', stream: 's1', sequence: 1, timeMs: 20 }, { id: 'b', stream: 's1', sequence: 2, timeMs: 10 }] }, ['clock-regression', 'sequence-regression', 'clock-gap'], ['checked-messages'], i => {
      unique(i.messages.map((r) => r.id)); const last = new Map<string, typeof i.messages[number]>(), findings = []
      for (const r of i.messages) { const previous = last.get(r.stream); if (previous) { if (r.timeMs < previous.timeMs) findings.push(f('clock-regression', previous.id, r.id)); if (r.sequence <= previous.sequence) findings.push(f('sequence-regression', previous.id, r.id)); if (r.timeMs - previous.timeMs > i.maximumGapMs) findings.push(f('clock-gap', previous.id, r.id)) }; last.set(r.stream, r) }
      return { findings, metrics: [m('checked-messages', 'cohort', i.messages.length)] }
    }),
  spec('robotics-frame-tree-consistency', 'Check a declared frame-parent tree for multiple roots, missing parents, cycles and self-links. Does not compose transforms or verify coordinate correctness.',
    input({ expectedRoot: id, frames: records({ parentId: id.nullable() }) }), { expectedRoot: 'world', frames: [{ id: 'world', parentId: null }, { id: 'tool', parentId: 'world' }] },
    { expectedRoot: 'world', frames: [{ id: 'world', parentId: null }, { id: 'tool', parentId: 'missing' }] }, ['frame-parent-missing', 'frame-cycle', 'frame-root-mismatch'], ['root-count'], i => {
      const cyclic = cycles(i.frames), known = new Set(i.frames.map((r) => r.id)), roots = i.frames.filter((r) => r.parentId === null)
      return { findings: [...i.frames.filter((r) => r.parentId && !known.has(r.parentId)).map((r) => f('frame-parent-missing', r.id)), ...[...cyclic].map(r => f('frame-cycle', r)), ...(roots.length !== 1 || roots[0]?.id !== i.expectedRoot ? [f('frame-root-mismatch', i.expectedRoot)] : [])], metrics: [m('root-count', 'cohort', roots.length)] }
    }),
]
