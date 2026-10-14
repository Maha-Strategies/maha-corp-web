import { z } from 'zod'
import { field, unique, finding as f, metric as m, type AuditResult } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
export const network = z.enum(['eip155:8453', 'eip155:42161', 'eip155:137'])
export const decimals = z.number().int().min(0).max(18)
export const state = z.enum(['satisfied', 'unsatisfied', 'unknown'])
export function checks(required: string[], supplied: { id: string; checkId: string; state: z.infer<typeof state> }[], prefix: string, key: string): AuditResult {
  unique(required); unique(supplied.map(r => r.id)); const findings = []; let satisfied = 0
  for (const k of required) { const states = new Set(supplied.filter(r => r.checkId === k).map(r => r.state)); if (!states.size) findings.push(f(prefix + '-check-missing', k)); else if (states.size > 1) findings.push(f(prefix + '-check-conflicting', k)); else if (states.has('unknown')) findings.push(f(prefix + '-check-unknown', k)); else if (states.has('unsatisfied')) findings.push(f(prefix + '-check-unsatisfied', k)); else satisfied++ }
  return { findings, metrics: [m(key, prefix, satisfied)] }
}
export function schemaBreaks(before: z.infer<typeof field>[], after: z.infer<typeof field>[], prefix: string): AuditResult {
  unique(before.map(r => r.name)); unique(after.map(r => r.name)); const a = new Map(after.map(r => [r.name, r])), b = new Map(before.map(r => [r.name, r])), findings = []
  for (const r of before) { const v = a.get(r.name); if (!v) findings.push(f(prefix + '-field-removed', r.name)); else { if (r.type !== v.type) findings.push(f(prefix + '-field-type-changed', r.name)); if (r.nullable && !v.nullable) findings.push(f(prefix + '-nullability-narrowed', r.name)); if (!r.required && v.required) findings.push(f(prefix + '-field-newly-required', r.name)) } }
  for (const r of after) if (!b.has(r.name) && r.required) findings.push(f(prefix + '-field-newly-required', r.name))
  return { findings, metrics: [m(prefix + '-ingestion-breaks', prefix, findings.length)] }
}
export const schemaCodes = (prefix: string) => ['field-removed', 'field-type-changed', 'nullability-narrowed', 'field-newly-required'].map(s => prefix + '-' + s)
export function sequence<T extends { id: string }>(before: T[], after: T[], prefix: string): AuditResult {
  unique(before.map(r => r.id)); unique(after.map(r => r.id)); const a = new Map(after.map(r => [r.id, r])), b = new Map(before.map(r => [r.id, r]))
  const findings = [...before.flatMap(r => !a.has(r.id) ? [f(prefix + '-record-removed', r.id)] : demandDigest(a.get(r.id)) !== demandDigest(r) ? [f(prefix + '-record-changed', r.id)] : []), ...after.filter(r => !b.has(r.id)).map(r => f(prefix + '-record-added', r.id))]
  const bs = before.filter(r => a.has(r.id)).map(r => r.id), as = after.filter(r => b.has(r.id)).map(r => r.id)
  if (demandDigest(bs) !== demandDigest(as)) findings.push(f(prefix + '-shared-order-changed', ...bs))
  return { findings, metrics: [m(prefix + '-shared-records', prefix, bs.length)] }
}
export const sequenceCodes = (prefix: string) => ['record-changed', 'record-added', 'record-removed', 'shared-order-changed'].map(s => prefix + '-' + s)
export function parity<T extends { id: string }>(before: T[], after: T[], prefix: string): AuditResult {
  unique(before.map(r => r.id)); unique(after.map(r => r.id)); const a = new Map(after.map(r => [r.id, r])), b = new Set(before.map(r => r.id))
  const findings = [...before.filter(r => !a.has(r.id) || demandDigest(a.get(r.id)) !== demandDigest(r)).map(r => f(prefix + '-export-projection-changed', r.id)), ...after.filter(r => !b.has(r.id)).map(r => f(prefix + '-export-record-added', r.id))]
  return { findings, metrics: [m(prefix + '-export-differences', prefix, findings.length)] }
}
export function duplicates<T extends { id: string }>(rows: T[], frame: (row: T) => unknown, prefix: string): AuditResult {
  const groups = new Map<string, T[]>(); for (const r of rows) { const k = demandDigest(frame(r)); groups.set(k, [...(groups.get(k) ?? []), r]) }
  return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(prefix + (new Set(g.map(r => demandDigest(r))).size === 1 ? '-identical-duplicate' : '-conflicting-projection'), ...g.map(r => r.id))), metrics: [m(prefix + '-identity-groups', prefix, groups.size)] }
}
