import { z } from 'zod'
import { input, object, list, id, digest, utc, cents, text, finding as f, metric as m, unique, cycles, type AuditResult, type AuditSpec, type Finding } from './batch4-audit-core.ts'
const base = { dataClass: 'synthetic', nonpersonalMetadata: true }, hash = 'sha256:' + 'a'.repeat(64)
const time = '2026-01-01T00:00:00.000Z', later = '2026-02-01T00:00:00.000Z'
const prefix = 'contract-amendments-'
const records = <T extends z.ZodRawShape>(shape: T, min = 1) => list(object({ id, ...shape }), min, 32)
const spec = <S extends z.ZodType>(action: string, description: string, schema: S, sample: Record<string, unknown>, adverse: Record<string, unknown>, codes: string[], metricKeys: string[], run: (value: z.output<S>) => AuditResult): AuditSpec =>
  ({ id: prefix + action, description, input: schema, sample: { ...base, ...sample }, adverse: { ...base, ...adverse }, expectedCodes: codes.slice(0, 1), codes, metricKeys, run: value => run(schema.parse(value)) })
const revision = object({ id, tenantId: id, contractId: id, revision: digest, scope: text, currency: z.enum(['USD', 'EUR', 'LKR']), amountMinor: cents, effectiveAt: utc })
const r = { id: 'r1', tenantId: 'tenant', contractId: 'contract', revision: hash, scope: 'declared-scope', currency: 'USD', amountMinor: '1000', effectiveAt: time }
export const CONTRACT_AUDITS: AuditSpec[] = [
  spec('required-field-coverage', 'Report null scope, source-ID and effective-time declarations in supplied amendment records; no contract completeness or legal-effect certification.',
    input({ records: records({ scope: text.nullable(), sourceId: id.nullable(), effectiveAt: utc.nullable() }) }),
    { records: [{ id: 'r1', scope: 'work', sourceId: 's1', effectiveAt: time }] }, { records: [{ id: 'r1', scope: null, sourceId: 's1', effectiveAt: time }] },
    ['scope-missing', 'source-id-missing', 'effective-time-missing'], ['missing-field-count'], i => {
      unique(i.records.map((r) => r.id)); const findings = i.records.flatMap((r) => [...(r.scope === null ? [f('scope-missing', r.id)] : []), ...(r.sourceId === null ? [f('source-id-missing', r.id)] : []), ...(r.effectiveAt === null ? [f('effective-time-missing', r.id)] : [])])
      return { findings, metrics: [m('missing-field-count', 'cohort', findings.length)] }
    }),
  spec('duplicate-record-identities', 'Group repeated amendment IDs by revision digest, distinguishing identical duplicate rows from conflicting revisions. No amendment validity judgment.',
    input({ records: records({ revision: digest }) }), { records: [{ id: 'r1', revision: hash }] },
    { records: [{ id: 'r1', revision: hash }, { id: 'r1', revision: hash }] }, ['identical-duplicate-id', 'conflicting-duplicate-id'], ['duplicate-group-count'], i => {
      const groups = new Map<string, Set<string>>(), counts = new Map<string, number>()
      for (const r of i.records) { groups.set(r.id, new Set([...(groups.get(r.id) ?? []), r.revision])); counts.set(r.id, (counts.get(r.id) ?? 0) + 1) }
      const findings = [...groups].filter(([k]) => counts.get(k)! > 1).map(([k, values]) => f(values.size === 1 ? 'identical-duplicate-id' : 'conflicting-duplicate-id', k))
      return { findings, metrics: [m('duplicate-group-count', 'cohort', findings.length)] }
    }),
  spec('unit-label-consistency', 'Detect multiple declared currencies for the same contract monetary field without converting currencies or interpreting payment terms.',
    input({ contractId: id, records: records({ contractId: id, field: id, currency: z.enum(['USD', 'EUR', 'LKR']) }) }),
    { contractId: 'c1', records: [{ id: 'r1', contractId: 'c1', field: 'fee', currency: 'USD' }] },
    { contractId: 'c1', records: [{ id: 'r1', contractId: 'c1', field: 'fee', currency: 'USD' }, { id: 'r2', contractId: 'c1', field: 'fee', currency: 'EUR' }] },
    ['currency-label-conflict', 'outside-contract-scope'], ['conflicted-fields'], i => {
      unique(i.records.map((r) => r.id)); const findings = i.records.filter((r) => r.contractId !== i.contractId).map((r) => f('outside-contract-scope', r.id)), groups = new Map<string, typeof i.records>()
      for (const r of i.records.filter((r) => r.contractId === i.contractId)) groups.set(r.field, [...(groups.get(r.field) ?? []), r])
      let conflicted = 0; for (const group of groups.values()) if (new Set(group.map(r => r.currency)).size > 1) { conflicted++; findings.push(f('currency-label-conflict', ...group.map(r => r.id))) }
      return { findings, metrics: [m('conflicted-fields', 'cohort', conflicted)] }
    }),
  spec('timestamp-order-audit', 'Inspect amendment start/end declarations and their supplied order. Flags reversed windows and chronological regressions; not trusted timestamping or legal applicability.',
    input({ records: records({ effectiveAt: utc, supersededAt: utc.nullable() }) }), { records: [{ id: 'r1', effectiveAt: time, supersededAt: later }] },
    { records: [{ id: 'r1', effectiveAt: later, supersededAt: time }] }, ['end-before-start', 'effective-order-regression'], ['checked-windows'], i => {
      unique(i.records.map((r) => r.id)); const findings: Finding[] = []
      i.records.forEach((r, j: number) => { if (r.supersededAt !== null && r.supersededAt < r.effectiveAt) findings.push(f('end-before-start', r.id)); if (j && r.effectiveAt < i.records[j - 1].effectiveAt) findings.push(f('effective-order-regression', i.records[j - 1].id, r.id)) })
      return { findings, metrics: [m('checked-windows', 'cohort', i.records.length)] }
    }),
  spec('revision-delta-map', 'Enumerate exact scope, currency, amount and effective-time changes between pinned amendment declarations while checking tenant/contract frames. No semantic equivalence or legal analysis.',
    input({ before: revision, after: revision }), { before: r, after: { ...r, revision: 'sha256:' + 'b'.repeat(64) } },
    { before: r, after: { ...r, revision: 'sha256:' + 'b'.repeat(64), scope: 'changed-scope' } },
    ['scope-changed', 'currency-changed', 'amount-changed', 'effective-time-changed', 'revision-not-advanced', 'contract-frame-mismatch'], ['changed-field-count'], i => {
      const mapping = { scope: 'scope-changed', currency: 'currency-changed', amountMinor: 'amount-changed', effectiveAt: 'effective-time-changed' }, changed = (Object.keys(mapping) as (keyof typeof mapping)[]).filter(k => i.before[k] !== i.after[k])
      return { findings: [...changed.map(k => f(mapping[k], i.before.id, i.after.id)), ...(i.before.revision === i.after.revision ? [f('revision-not-advanced', i.before.id)] : []), ...((['tenantId', 'contractId'] as const).some(k => i.before[k] !== i.after[k]) ? [f('contract-frame-mismatch', i.before.id, i.after.id)] : [])], metrics: [m('changed-field-count', 'comparison', changed.length)] }
    }),
  spec('source-coverage-map', 'Find amendment references absent from the supplied source/revision manifest, preserving declared contract scope. Does not prove passage support or an exhaustive agreement set.',
    input({ contractId: id, sources: records({ revision: digest }, 0), amendments: records({ contractId: id, sourceId: id, sourceRevision: digest }) }),
    { contractId: 'c1', sources: [{ id: 's1', revision: hash }], amendments: [{ id: 'r1', contractId: 'c1', sourceId: 's1', sourceRevision: hash }] },
    { contractId: 'c1', sources: [], amendments: [{ id: 'r1', contractId: 'c1', sourceId: 's1', sourceRevision: hash }] },
    ['source-binding-missing', 'source-revision-mismatch', 'outside-contract-scope'], ['covered-amendments'], i => {
      unique(i.sources.map((r) => r.id)); unique(i.amendments.map((r) => r.id)); const sources = new Map(i.sources.map((r) => [r.id, r])); let covered = 0
      const findings = i.amendments.flatMap((r) => { const source = sources.get(r.sourceId); if (r.contractId !== i.contractId) return [f('outside-contract-scope', r.id)]; if (!source) return [f('source-binding-missing', r.id)]; if (source.revision !== r.sourceRevision) return [f('source-revision-mismatch', r.id)]; covered++; return [] })
      return { findings, metrics: [m('covered-amendments', 'cohort', covered)] }
    }),
  spec('identifier-crosswalk-audit', 'Check supplied clause-ID mappings for unmapped required source clauses, unknown targets and many-to-one collisions. No textual-equivalence inference.',
    input({ sourceClauseIds: list(id, 1, 32), targetClauseIds: list(id, 1, 32), mappings: records({ sourceId: id, targetId: id }, 0) }),
    { sourceClauseIds: ['a'], targetClauseIds: ['b'], mappings: [{ id: 'x', sourceId: 'a', targetId: 'b' }] },
    { sourceClauseIds: ['a'], targetClauseIds: ['b'], mappings: [] }, ['source-clause-unmapped', 'crosswalk-unknown-id', 'many-to-one-mapping'], ['mapped-source-count'], i => {
      unique(i.sourceClauseIds); unique(i.targetClauseIds); unique(i.mappings.map((r) => r.id)); const findings = i.sourceClauseIds.filter((s: string) => !i.mappings.some((r) => r.sourceId === s)).map((s: string) => f('source-clause-unmapped', s))
      findings.push(...i.mappings.filter((r) => !i.sourceClauseIds.includes(r.sourceId) || !i.targetClauseIds.includes(r.targetId)).map((r) => f('crosswalk-unknown-id', r.id)))
      for (const t of i.targetClauseIds) { const group = i.mappings.filter((r) => r.targetId === t); if (new Set(group.map((r) => r.sourceId)).size > 1) findings.push(f('many-to-one-mapping', ...group.map((r) => r.id))) }
      return { findings, metrics: [m('mapped-source-count', 'cohort', i.sourceClauseIds.filter((s: string) => i.mappings.some((r) => r.sourceId === s && i.targetClauseIds.includes(r.targetId))).length)] }
    }),
  spec('reference-integrity-map', 'Check declared amendment-parent links within one tenant and contract for missing parents, cycles and cross-scope references. No authenticity or enforceability judgment.',
    input({ tenantId: id, contractId: id, amendments: records({ tenantId: id, contractId: id, parentId: id.nullable() }) }),
    { tenantId: 't1', contractId: 'c1', amendments: [{ id: 'a1', tenantId: 't1', contractId: 'c1', parentId: null }] },
    { tenantId: 't1', contractId: 'c1', amendments: [{ id: 'a1', tenantId: 't1', contractId: 'c1', parentId: 'missing' }] }, ['amendment-parent-missing', 'amendment-cycle', 'outside-tenant-contract-scope'], ['checked-amendments'], i => {
      const cyclic = cycles(i.amendments), known = new Set(i.amendments.map((r) => r.id))
      return { findings: i.amendments.flatMap((r) => [...(r.parentId && !known.has(r.parentId) ? [f('amendment-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('amendment-cycle', r.id)] : []), ...(r.tenantId !== i.tenantId || r.contractId !== i.contractId ? [f('outside-tenant-contract-scope', r.id)] : [])]), metrics: [m('checked-amendments', 'cohort', i.amendments.length)] }
    }),
  spec('condition-coverage-map', 'Compare required applicability-condition IDs with caller-declared yes/no/unknown assessments. Missing and unknown conditions remain explicit; no legal applicability verdict.',
    input({ requiredConditionIds: list(id, 1, 32), assessments: records({ conditionId: id, status: z.enum(['yes', 'no', 'unknown']) }, 0) }),
    { requiredConditionIds: ['c1'], assessments: [{ id: 'a1', conditionId: 'c1', status: 'yes' }] },
    { requiredConditionIds: ['c1'], assessments: [] }, ['condition-unassessed', 'condition-unknown', 'condition-declared-no', 'condition-conflicting'], ['declared-yes-count'], i => {
      unique(i.requiredConditionIds); unique(i.assessments.map((r) => r.id)); const findings = []; let yes = 0
      for (const c of i.requiredConditionIds) { const group = i.assessments.filter((r) => r.conditionId === c), states = new Set(group.map((r) => r.status)); if (!group.length) findings.push(f('condition-unassessed', c)); else if (states.size > 1) findings.push(f('condition-conflicting', c)); else if (states.has('unknown')) findings.push(f('condition-unknown', c)); else if (states.has('no')) findings.push(f('condition-declared-no', c)); else yes++ }
      return { findings, metrics: [m('declared-yes-count', 'cohort', yes)] }
    }),
  spec('declared-bound-audit', 'Compare declared amendment amounts with caller-supplied same-currency minimum and maximum bounds using exact minor units. Not legal fee review or payment authorization.',
    input({ currency: z.enum(['USD', 'EUR', 'LKR']), minimumMinor: cents, maximumMinor: cents, amendments: records({ amountMinor: cents, currency: z.enum(['USD', 'EUR', 'LKR']) }) }),
    { currency: 'USD', minimumMinor: '0', maximumMinor: '1000', amendments: [{ id: 'a1', amountMinor: '1000', currency: 'USD' }] },
    { currency: 'USD', minimumMinor: '0', maximumMinor: '1000', amendments: [{ id: 'a1', amountMinor: '1001', currency: 'USD' }] }, ['amount-outside-declared-bounds', 'bound-currency-mismatch'], ['checked-amounts'], i => {
      if (BigInt(i.minimumMinor) > BigInt(i.maximumMinor)) throw Error('inverted_amount_bounds'); unique(i.amendments.map((r) => r.id))
      return { findings: i.amendments.flatMap((r) => r.currency !== i.currency ? [f('bound-currency-mismatch', r.id)] : BigInt(r.amountMinor) < BigInt(i.minimumMinor) || BigInt(r.amountMinor) > BigInt(i.maximumMinor) ? [f('amount-outside-declared-bounds', r.id)] : []), metrics: [m('checked-amounts', 'cohort', i.amendments.length)] }
    }),
  spec('missingness-cooccurrence', 'Count joint nulls in scope, effective-time and amount declarations across supplied amendments. Zero minor units remain supplied; no imputation or completeness inference.',
    input({ records: records({ scope: text.nullable(), effectiveAt: utc.nullable(), amountMinor: cents.nullable() }) }),
    { records: [{ id: 'a1', scope: 'work', effectiveAt: time, amountMinor: '0' }] },
    { records: [{ id: 'a1', scope: null, effectiveAt: null, amountMinor: '0' }] }, ['joint-missing-fields'], ['scope-time-null-pairs', 'scope-amount-null-pairs', 'time-amount-null-pairs'], i => {
      unique(i.records.map((r) => r.id)); const pairs = [['scope', 'effectiveAt', 'scope-time-null-pairs'], ['scope', 'amountMinor', 'scope-amount-null-pairs'], ['effectiveAt', 'amountMinor', 'time-amount-null-pairs']] as const
      return { findings: i.records.filter((r) => (['scope', 'effectiveAt', 'amountMinor'] as const).filter(k => r[k] === null).length >= 2).map((r) => f('joint-missing-fields', r.id)), metrics: pairs.map(([a, b, key]) => m(key, 'cohort', i.records.filter((r) => r[a] === null && r[b] === null).length)) }
    }),
]
