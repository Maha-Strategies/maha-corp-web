import { z } from 'zod'
import { input, records, id, digest, utc, text, cents, field, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'contract-amendments-'
const frame = { tenantId: id, contractId: id }
const currency = z.enum(['USD', 'EUR', 'LKR'])
const clause = { name: 'amountMinor', type: 'minor-units', required: true, nullable: false }
const row = { id: 'a1', tenantId: 't1', contractId: 'c1', revision: hash, scope: 'work', amountMinor: '1000', currency: 'USD', effectiveAt: time }
const exported = records({ ...frame, revision: digest, scope: text, amountMinor: cents, currency, effectiveAt: utc }, 0)
export const BATCH5_CONTRACTS: AuditSpec[] = [
  spec(prefix + 'schema-directionality', 'Compare closed amendment projection fields and tenant/contract frames for removed fields, changed types, new requirements and narrowed nullability. No general schema subtyping or legal interpretation.',
    input({ beforeFrame: z.object(frame).strict(), afterFrame: z.object(frame).strict(), before: list(field, 1, 32), after: list(field, 0, 32) }),
    { beforeFrame: { tenantId: 't1', contractId: 'c1' }, afterFrame: { tenantId: 't1', contractId: 'c1' }, before: [clause], after: [clause] },
    { beforeFrame: { tenantId: 't1', contractId: 'c1' }, afterFrame: { tenantId: 't2', contractId: 'c1' }, before: [clause], after: [clause] },
    ['contract-schema-frame-changed', 'contract-field-removed', 'contract-field-type-changed', 'contract-nullability-narrowed', 'contract-field-newly-required'], ['request-breaking-count'], i => {
      unique(i.before.map(r => r.name)); unique(i.after.map(r => r.name)); const after = new Map(i.after.map(r => [r.name, r])), before = new Map(i.before.map(r => [r.name, r])), findings = []
      if (i.beforeFrame.tenantId !== i.afterFrame.tenantId || i.beforeFrame.contractId !== i.afterFrame.contractId) findings.push(f('contract-schema-frame-changed', 'frame'))
      for (const r of i.before) { const a = after.get(r.name); if (!a) findings.push(f('contract-field-removed', r.name)); else { if (r.type !== a.type) findings.push(f('contract-field-type-changed', r.name)); if (r.nullable && !a.nullable) findings.push(f('contract-nullability-narrowed', r.name)); if (!r.required && a.required) findings.push(f('contract-field-newly-required', r.name)) } }
      for (const a of i.after) if (!before.has(a.name) && a.required) findings.push(f('contract-field-newly-required', a.name))
      return { findings, metrics: [m('request-breaking-count', 'contract', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare supplied amendment revision sequences by identity, effective-time declarations and relative order among shared records. Added entries do not by themselves imply reordering; no legal precedence inference.',
    input({ before: records({ revision: digest, effectiveAt: utc }, 0), after: records({ revision: digest, effectiveAt: utc }, 0) }),
    { before: [{ id: 'a1', revision: hash, effectiveAt: time }], after: [{ id: 'a1', revision: hash, effectiveAt: time }] },
    { before: [{ id: 'a1', revision: hash, effectiveAt: time }], after: [{ id: 'a1', revision: otherHash, effectiveAt: time }] },
    ['amendment-revision-changed', 'amendment-effective-time-changed', 'amendment-added', 'amendment-removed', 'shared-amendment-order-changed'], ['shared-amendments'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const b = new Map(i.before.map(r => [r.id, r])), a = new Map(i.after.map(r => [r.id, r])), findings = []
      for (const r of i.before) { const v = a.get(r.id); if (!v) findings.push(f('amendment-removed', r.id)); else { if (v.revision !== r.revision) findings.push(f('amendment-revision-changed', r.id)); if (v.effectiveAt !== r.effectiveAt) findings.push(f('amendment-effective-time-changed', r.id)) } }
      for (const r of i.after) if (!b.has(r.id)) findings.push(f('amendment-added', r.id))
      const bs = i.before.filter(r => a.has(r.id)).map(r => r.id), as = i.after.filter(r => b.has(r.id)).map(r => r.id)
      if (demandDigest(bs) !== demandDigest(as)) findings.push(f('shared-amendment-order-changed', ...bs))
      return { findings, metrics: [m('shared-amendments', 'contract', bs.length)] }
    }),
  spec(prefix + 'provenance-edge-audit', 'Validate declared amendment-to-source edges against supplied revision pins and tenant/contract boundaries. Reports stale or absent endpoints, not passage support, signatures or authenticity.',
    input({ tenantId: id, contractId: id, amendments: records({ ...frame, revision: digest }), sources: records({ ...frame, revision: digest }, 0), edges: records({ amendmentId: id, amendmentRevision: digest, sourceId: id, sourceRevision: digest }) }),
    { tenantId: 't1', contractId: 'c1', amendments: [{ id: 'a1', tenantId: 't1', contractId: 'c1', revision: hash }], sources: [{ id: 's1', tenantId: 't1', contractId: 'c1', revision: hash }], edges: [{ id: 'e1', amendmentId: 'a1', amendmentRevision: hash, sourceId: 's1', sourceRevision: hash }] },
    { tenantId: 't1', contractId: 'c1', amendments: [{ id: 'a1', tenantId: 't1', contractId: 'c1', revision: hash }], sources: [], edges: [{ id: 'e1', amendmentId: 'a1', amendmentRevision: hash, sourceId: 's1', sourceRevision: hash }] },
    ['contract-edge-endpoint-missing', 'contract-edge-pin-stale', 'contract-edge-outside-frame'], ['bound-edges'], i => {
      unique(i.amendments.map(r => r.id)); unique(i.sources.map(r => r.id)); unique(i.edges.map(r => r.id)); const a = new Map(i.amendments.map(r => [r.id, r])), s = new Map(i.sources.map(r => [r.id, r])); let bound = 0
      const findings = i.edges.flatMap(r => { const av = a.get(r.amendmentId), sv = s.get(r.sourceId); if (!av || !sv) return [f('contract-edge-endpoint-missing', r.id)]; if (av.tenantId !== i.tenantId || sv.tenantId !== i.tenantId || av.contractId !== i.contractId || sv.contractId !== i.contractId) return [f('contract-edge-outside-frame', r.id)]; if (av.revision !== r.amendmentRevision || sv.revision !== r.sourceRevision) return [f('contract-edge-pin-stale', r.id)]; bound++; return [] })
      return { findings, metrics: [m('bound-edges', 'contract', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Filter supplied amendment declarations by exact tenant, contract and a caller-selected time using half-open effective windows. Missing supersession means an unbounded declared end, not proof of a complete active agreement.',
    input({ tenantId: id, contractId: id, questionAt: utc, amendments: records({ ...frame, effectiveAt: utc, supersededAt: utc.nullable() }) }),
    { tenantId: 't1', contractId: 'c1', questionAt: time, amendments: [{ id: 'a1', tenantId: 't1', contractId: 'c1', effectiveAt: time, supersededAt: later }] },
    { tenantId: 't1', contractId: 'c1', questionAt: time, amendments: [{ id: 'a1', tenantId: 't2', contractId: 'c1', effectiveAt: time, supersededAt: later }] },
    ['amendment-outside-tenant', 'amendment-outside-contract', 'amendment-outside-time', 'amendment-inverted-window'], ['declared-admissible-count'], i => {
      unique(i.amendments.map(r => r.id)); let admitted = 0
      const findings = i.amendments.flatMap(r => { const issues = [...(r.tenantId !== i.tenantId ? [f('amendment-outside-tenant', r.id)] : []), ...(r.contractId !== i.contractId ? [f('amendment-outside-contract', r.id)] : []), ...(r.supersededAt !== null && r.supersededAt <= r.effectiveAt ? [f('amendment-inverted-window', r.id)] : []), ...(i.questionAt < r.effectiveAt || r.supersededAt !== null && i.questionAt >= r.supersededAt ? [f('amendment-outside-time', r.id)] : [])]; if (!issues.length) admitted++; return issues })
      return { findings, metrics: [m('declared-admissible-count', 'contract', admitted)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare typed amendment metadata exports by stable ID, exact minor units, currency, scope, revision and time. Record order is ignored; no textual or legal semantic equivalence claim.',
    input({ before: exported, after: exported }), { before: [row], after: [row] }, { before: [row], after: [{ ...row, amountMinor: '1001' }] },
    ['amendment-export-fields-changed', 'amendment-export-missing', 'amendment-export-added'], ['unchanged-records'], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id)); const a = new Map(i.after.map(r => [r.id, r])), b = new Map(i.before.map(r => [r.id, r])); let same = 0
      const findings = i.before.flatMap(r => { const v = a.get(r.id); if (!v) return [f('amendment-export-missing', r.id)]; if (demandDigest(r) !== demandDigest(v)) return [f('amendment-export-fields-changed', r.id)]; same++; return [] })
      findings.push(...i.after.filter(r => !b.has(r.id)).map(r => f('amendment-export-added', r.id)))
      return { findings, metrics: [m('unchanged-records', 'contract', same)] }
    }),
]
