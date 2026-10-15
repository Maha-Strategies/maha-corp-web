import { z } from 'zod'
import { recordAuditSuite } from './batch9-record-suite.ts'
import { input, records, id, digest, utc, list, spec, time, later, unique, finding as f, metric as m, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'

export type SciencePolicy = Parameters<typeof recordAuditSuite>[0]
export const scientificBoundary = 'Public or synthetic nonpersonal metadata only; no patient or individual genomic records, raw sequences, diagnosis, clinical interpretation, experimental instructions, source download or scientific-validity certification. Supplied digests are pins, not verified bytes.'
export const finiteValue = z.number().finite().min(-1e9).max(1e9)
export const samePins = (a: Record<string, unknown>, b: Record<string, unknown>, keys: string[]) => keys.every(k => a[k] === b[k])

/** Preserve the closed record algebra while making duplicate conflicts include
 * every scientific frame pin (protocol/isoform/coordinate convention included). */
export function scienceRecordSuite(p: SciencePolicy, overrides: AuditSpec[]): AuditSpec[] {
  const keys = Object.keys(p.pins), prefix = p.category + '-'
  const duplicate = spec(prefix + 'duplicate-record-identities', 'Compare duplicate owner/subject/revision declarations against every scientific frame pin. ' + p.boundary,
    input({ rows: records({ ...p.pins, id }) }), { rows: [p.sample] }, { rows: [p.sample, { ...p.sample, id: 'r2' }] },
    [prefix + 'duplicate-frame', prefix + 'conflicting-frame-content'], [prefix + 'distinct-frames'], i => {
      unique(i.rows.map(r => r.id)); const groups = new Map<string, typeof i.rows>()
      for (const row of i.rows) { const declared: Record<string, unknown> = row; const key = demandDigest([declared[p.owner], declared[p.subject], declared[p.revision]]); groups.set(key, [...(groups.get(key) ?? []), row]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(prefix + (g.every(r => samePins(r, g[0], keys)) ? 'duplicate-frame' : 'conflicting-frame-content'), ...g.map(r => r.id))), metrics: [m(prefix + 'distinct-frames', p.category, groups.size)] }
    })
  const custom = new Map([duplicate, ...overrides].map(s => [s.id, s]))
  return recordAuditSuite(p).map(s => custom.get(s.id) ?? { ...s, description: s.description.replace('issuer/subject or producer/work pins', 'scientific dataset/method/revision/content pins') })
}

type MeasurementPolicy = {
  category: string; noun: string; quantities: readonly [string, ...string[]]; units: readonly [string, string, ...string[]];
  compatible: Record<string, readonly string[]>; sampleQuantity: string; sampleUnit: string;
}
/** Bounded measurement algebra. All thresholds and control outcomes are caller
 * policy, not inferred biological facts. No conversions or imputation. */
export function measurementAudits(p: MeasurementPolicy): AuditSpec[] {
  const prefix = p.category + '-', quantity = z.enum(p.quantities), unit = z.enum(p.units)
  const frame = { datasetRef: id, subjectRef: id, runRef: id, methodDigest: digest, revision: digest }
  const row = { id: 'm1', datasetRef: 'dataset1', subjectRef: 'target1', runRef: 'run1', methodDigest: 'sha256:' + 'a'.repeat(64), revision: 'sha256:' + 'a'.repeat(64) }
  const pinKeys = Object.keys(frame) as (keyof typeof frame)[], validUnit = (q: string, u: string) => p.compatible[q].includes(u)
  const statement = (text: string) => text + ' for ' + p.noun + '. ' + scientificBoundary
  const measured = { ...row, quantity: p.sampleQuantity, unit: p.sampleUnit, value: 1 }
  return [
    spec(prefix + 'unit-label-consistency', statement('Check quantity/unit compatibility and conflicting unit labels only within the same dataset/subject/run/method/revision/quantity frame; never convert numerically'),
      input({ measurements: records({ ...frame, quantity, unit, value: finiteValue.nullable() }) }),
      { measurements: [measured] }, { measurements: [{ ...measured, unit: p.units.find(u => !validUnit(p.sampleQuantity, u))! }] },
      [prefix + 'quantity-unit-mismatch', prefix + 'unit-label-conflict'], [prefix + 'compatible-unit-records'], i => {
        unique(i.measurements.map(r => r.id)); const groups = new Map<string, typeof i.measurements>()
        for (const r of i.measurements) { const key = demandDigest([...pinKeys.map(k => r[k]), r.quantity]); groups.set(key, [...(groups.get(key) ?? []), r]) }
        return { findings: [...i.measurements.filter(r => !validUnit(r.quantity, r.unit)).map(r => f(prefix + 'quantity-unit-mismatch', r.id)), ...[...groups.values()].filter(g => new Set(g.map(r => r.unit)).size > 1).map(g => f(prefix + 'unit-label-conflict', ...g.map(r => r.id)))], metrics: [m(prefix + 'compatible-unit-records', p.category, i.measurements.filter(r => validUnit(r.quantity, r.unit)).length)] }
      }),
    spec(prefix + 'timestamp-order-audit', statement('Check collection/processing/export order and caller-defined maximum age; absent processing or export timestamps stay unknown, and equal timestamps are allowed'),
      input({ assessedAt: utc, maximumAgeSeconds: z.number().int().min(0).max(31536000), rows: records({ collectedAt: utc, processedAt: utc.nullable(), exportedAt: utc.nullable() }) }),
      { assessedAt: time, maximumAgeSeconds: 86400, rows: [{ id: 'm1', collectedAt: time, processedAt: time, exportedAt: time }] },
      { assessedAt: time, maximumAgeSeconds: 86400, rows: [{ id: 'm1', collectedAt: later, processedAt: later, exportedAt: later }] },
      [prefix + 'collection-from-future', prefix + 'timestamp-order-conflict', prefix + 'processing-time-unknown', prefix + 'export-time-unknown', prefix + 'maximum-age-exceeded'], [prefix + 'complete-in-order-time-records'], i => {
        unique(i.rows.map(r => r.id)); let complete = 0
        const findings = i.rows.flatMap(r => { const issues = [...(r.collectedAt > i.assessedAt ? [f(prefix + 'collection-from-future', r.id)] : []), ...(r.processedAt !== null && (r.processedAt < r.collectedAt || r.processedAt > i.assessedAt) || r.exportedAt !== null && (r.exportedAt < r.collectedAt || r.exportedAt > i.assessedAt || r.processedAt !== null && r.exportedAt < r.processedAt) ? [f(prefix + 'timestamp-order-conflict', r.id)] : []), ...(r.processedAt === null ? [f(prefix + 'processing-time-unknown', r.id)] : []), ...(r.exportedAt === null ? [f(prefix + 'export-time-unknown', r.id)] : []), ...(Date.parse(i.assessedAt) - Date.parse(r.collectedAt) > i.maximumAgeSeconds * 1000 ? [f(prefix + 'maximum-age-exceeded', r.id)] : [])]; if (!issues.length) complete++; return issues })
        return { findings, metrics: [m(prefix + 'complete-in-order-time-records', p.category, complete)] }
      }),
    spec(prefix + 'condition-coverage-map', statement('Require exactly one satisfied control declaration for each required control in an exact run/method/revision; missing, unknown, duplicate or wrong-frame controls cannot pass'),
      input({ runRef: id, methodDigest: digest, revision: digest, requiredControls: list(id, 1, 16), controls: records({ runRef: id, methodDigest: digest, revision: digest, controlRef: id, state: z.enum(['satisfied', 'unsatisfied', 'unknown']) }, 0) }),
      { runRef: row.runRef, methodDigest: row.methodDigest, revision: row.revision, requiredControls: ['blank'], controls: [{ id: 'c1', runRef: row.runRef, methodDigest: row.methodDigest, revision: row.revision, controlRef: 'blank', state: 'satisfied' }] },
      { runRef: row.runRef, methodDigest: row.methodDigest, revision: row.revision, requiredControls: ['blank'], controls: [{ id: 'c1', runRef: row.runRef, methodDigest: row.methodDigest, revision: row.revision, controlRef: 'blank', state: 'unknown' }] },
      [prefix + 'control-not-established', prefix + 'control-frame-mismatch', prefix + 'control-undeclared'], [prefix + 'uniquely-satisfied-controls'], i => {
        unique(i.requiredControls); unique(i.controls.map(r => r.id)); let covered = 0
        const inFrame = (r: typeof i.controls[number]) => r.runRef === i.runRef && r.methodDigest === i.methodDigest && r.revision === i.revision
        const findings = i.requiredControls.flatMap(k => { const matches = i.controls.filter(r => r.controlRef === k); if (matches.length === 1 && inFrame(matches[0]) && matches[0].state === 'satisfied') { covered++; return [] }; return [f(prefix + 'control-not-established', k)] })
        findings.push(...i.controls.filter(r => !inFrame(r)).map(r => f(prefix + 'control-frame-mismatch', r.id)), ...i.controls.filter(r => !i.requiredControls.includes(r.controlRef)).map(r => f(prefix + 'control-undeclared', r.id)))
        return { findings, metrics: [m(prefix + 'uniquely-satisfied-controls', p.category, covered)] }
      }),
    spec(prefix + 'declared-bound-audit', statement('Compare finite measurements with inclusive caller-supplied quantity/unit bounds in the exact dataset/subject/run/method/revision frame; null and censored values are unknown, not zero; thresholds are not clinical or safety limits'),
      input({ bounds: records({ ...frame, quantity, unit, minimum: finiteValue, maximum: finiteValue }), measurements: records({ ...frame, quantity, unit, value: finiteValue.nullable(), qualifier: z.enum(['exact', 'below-limit', 'above-limit', 'unknown']) }) }),
      { bounds: [{ ...row, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, qualifier: 'exact' }] },
      { bounds: [{ ...row, quantity: p.sampleQuantity, unit: p.sampleUnit, minimum: 0, maximum: 1 }], measurements: [{ ...measured, value: 2, qualifier: 'exact' }] },
      [prefix + 'value-outside-declared-bound', prefix + 'bound-not-unique', prefix + 'bound-frame-or-unit-mismatch', prefix + 'value-not-exact'], [prefix + 'exact-values-with-compatible-bounds'], i => {
        unique(i.bounds.map(r => r.id)); unique(i.measurements.map(r => r.id)); if (i.bounds.some(b => b.minimum > b.maximum)) throw Error('reversed_science_bounds'); let checked = 0
        const findings = i.measurements.flatMap(r => { const matches = i.bounds.filter(b => samePins(b, r, pinKeys) && b.quantity === r.quantity); if (matches.length !== 1) return [f(prefix + 'bound-not-unique', r.id)]; const b = matches[0]; if (b.unit !== r.unit || !validUnit(r.quantity, r.unit)) return [f(prefix + 'bound-frame-or-unit-mismatch', r.id)]; if (r.value === null || r.qualifier !== 'exact') return [f(prefix + 'value-not-exact', r.id)]; checked++; return r.value < b.minimum || r.value > b.maximum ? [f(prefix + 'value-outside-declared-bound', r.id)] : [] })
        return { findings, metrics: [m(prefix + 'exact-values-with-compatible-bounds', p.category, checked)] }
      }),
  ].map(s => s.id.endsWith('timestamp-order-audit') ? { ...s, expectedCodes: [prefix + 'collection-from-future', prefix + 'timestamp-order-conflict'] } : s)
}
