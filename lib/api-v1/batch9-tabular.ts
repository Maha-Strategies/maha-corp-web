import { z } from 'zod'
import { input, object, records, id, digest, list, spec, hash, otherHash, finding as f, metric as m, unique, cycles, type AuditSpec } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
const prefix = 'tabular-records-'
const pins = { tableRef: id, revision: digest, primaryKeyDigest: digest, contentDigest: digest }
const row = { id: 'r1', tableRef: 'table1', revision: hash, primaryKeyDigest: hash, contentDigest: hash }
const projection = object({ id, ...pins })
const column = object({ name: id, type: z.enum(['text', 'number', 'boolean', 'utc']), unitRef: id.nullable(), required: z.boolean(), nullable: z.boolean() })
const amount = { name: 'amount', type: 'number', unitRef: 'USDC', required: true, nullable: false }
const key = (r: typeof row) => demandDigest([r.tableRef, r.revision, r.primaryKeyDigest])
const diff = (before: typeof row[], after: typeof row[], ordered: boolean) => {
  unique(before.map(r => r.id)); unique(after.map(r => r.id)); unique(before.map(key)); unique(after.map(key))
  const a = new Map(after.map(r => [key(r), r])), b = new Set(before.map(key))
  const findings = before.flatMap(r => !a.has(key(r)) ? [f('tabular-projection-removed', r.id)] : a.get(key(r))!.contentDigest !== r.contentDigest ? [f('tabular-projection-changed', r.id, a.get(key(r))!.id)] : [])
  findings.push(...after.filter(r => !b.has(key(r))).map(r => f('tabular-projection-added', r.id)))
  if (ordered) { const left = before.filter(r => a.has(key(r))).map(key), right = after.filter(r => b.has(key(r))).map(key)
    if (left.some((v, n) => right[n] !== v)) findings.push(f('tabular-shared-key-order-changed')) }
  return { findings, metrics: [m('tabular-projection-differences', 'tabular', findings.length)] }
}
export const BATCH9_TABULAR: AuditSpec[] = [
  spec(prefix + 'condition-coverage-map', 'Check each required row-validation condition has exactly one satisfied declaration. Unknown, contradictory, duplicate or missing declarations do not establish valid cells or successful ingestion.',
    input({ requiredChecks: list(id, 1, 8), checks: records({ rowId: id, checkId: id, state: z.enum(['satisfied', 'unsatisfied', 'unknown']) }), rowIds: list(id, 1, 16) }),
    { rowIds: ['r1'], requiredChecks: ['typed'], checks: [{ id: 'c1', rowId: 'r1', checkId: 'typed', state: 'satisfied' }] }, { rowIds: ['r1'], requiredChecks: ['typed'], checks: [{ id: 'c1', rowId: 'r1', checkId: 'typed', state: 'unknown' }] },
    ['tabular-condition-not-established', 'tabular-condition-undeclared'], ['tabular-rows-with-required-checks'], i => {
      unique(i.rowIds); unique(i.requiredChecks); unique(i.checks.map(c => c.id)); let complete = 0
      const findings = i.rowIds.flatMap(rowId => { const issues = i.requiredChecks.flatMap(checkId => { const matches = i.checks.filter(c => c.rowId === rowId && c.checkId === checkId); return matches.length === 1 && matches[0].state === 'satisfied' ? [] : [f('tabular-condition-not-established', rowId, checkId)] }); if (!issues.length) complete++; return issues })
      findings.push(...i.checks.filter(c => !i.rowIds.includes(c.rowId) || !i.requiredChecks.includes(c.checkId)).map(c => f('tabular-condition-undeclared', c.id)))
      return { findings, metrics: [m('tabular-rows-with-required-checks', 'tabular', complete)] }
    }),
  spec(prefix + 'declared-bound-audit', 'Compare bounded public/synthetic numeric projections with caller-defined inclusive column limits in an exact table/revision/unit frame. No raw CSV import, conversion, scientific safety or financial suitability conclusion.',
    input({ tableRef: id, revision: digest, bounds: records({ columnRef: id, unitRef: id, minimum: z.number().finite(), maximum: z.number().finite() }), values: records({ tableRef: id, revision: digest, columnRef: id, unitRef: id, value: z.number().finite() }) }),
    { tableRef: 'table1', revision: hash, bounds: [{ id: 'b1', columnRef: 'amount', unitRef: 'USDC', minimum: 0, maximum: 10 }], values: [{ id: 'r1', tableRef: 'table1', revision: hash, columnRef: 'amount', unitRef: 'USDC', value: 10 }] },
    { tableRef: 'table1', revision: hash, bounds: [{ id: 'b1', columnRef: 'amount', unitRef: 'USDC', minimum: 0, maximum: 10 }], values: [{ id: 'r1', tableRef: 'table1', revision: hash, columnRef: 'amount', unitRef: 'USDC', value: 11 }] },
    ['tabular-value-outside-declared-bound', 'tabular-bound-frame-mismatch', 'tabular-bound-missing'], ['tabular-values-with-compatible-bounds'], i => {
      unique(i.bounds.map(b => b.id)); unique(i.bounds.map(b => b.columnRef)); unique(i.values.map(v => v.id)); if (i.bounds.some(b => b.minimum > b.maximum)) throw Error('reversed_tabular_bounds'); let compatible = 0
      const bounds = new Map(i.bounds.map(b => [b.columnRef, b])); const findings = i.values.flatMap(v => { const b = bounds.get(v.columnRef); if (!b) return [f('tabular-bound-missing', v.id)]; if (v.tableRef !== i.tableRef || v.revision !== i.revision || v.unitRef !== b.unitRef) return [f('tabular-bound-frame-mismatch', v.id)]; compatible++; return v.value < b.minimum || v.value > b.maximum ? [f('tabular-value-outside-declared-bound', v.id)] : [] })
      return { findings, metrics: [m('tabular-values-with-compatible-bounds', 'tabular', compatible)] }
    }),
  spec(prefix + 'missingness-cooccurrence', 'Count pairwise absent required-column declarations in bounded row-presence metadata. No raw cells, missing-value imputation, population inference or database query.',
    input({ requiredColumns: list(id, 2, 14), rows: records({ presentColumns: list(id, 0, 32) }) }),
    { requiredColumns: ['a', 'b'], rows: [{ id: 'r1', presentColumns: ['a', 'b'] }] }, { requiredColumns: ['a', 'b'], rows: [{ id: 'r1', presentColumns: [] }] },
    ['tabular-joint-required-column-missingness'], ['tabular-column-pair-missing-count'], i => {
      unique(i.requiredColumns); unique(i.rows.map(r => r.id)); i.rows.forEach(r => unique(r.presentColumns))
      const pairs = i.requiredColumns.flatMap((a, n) => i.requiredColumns.slice(n + 1).map(b => [a, b]))
      return { findings: i.rows.flatMap(r => { const missing = i.requiredColumns.filter(c => !r.presentColumns.includes(c)); return missing.length > 1 ? [f('tabular-joint-required-column-missingness', r.id, ...missing)] : [] }), metrics: pairs.map(([a, b]) => m('tabular-column-pair-missing-count', demandDigest([a, b]), i.rows.filter(r => !r.presentColumns.includes(a) && !r.presentColumns.includes(b)).length)) }
    }),
  spec(prefix + 'schema-directionality', 'Compare typed tabular export-column guarantees and exact unit labels. Required/non-null weakening, removal, type/unit change and unexpected strict-consumer columns are reported; no general SQL/schema compatibility certificate.',
    input({ before: list(column, 1, 32), after: list(column, 0, 32), consumerAllowsExtraColumns: z.boolean() }),
    { before: [amount], after: [amount], consumerAllowsExtraColumns: false }, { before: [amount], after: [], consumerAllowsExtraColumns: false },
    ['tabular-schema-column-removed', 'tabular-schema-type-changed', 'tabular-schema-unit-changed', 'tabular-schema-guarantee-weakened', 'tabular-schema-extra-column'], ['tabular-schema-directional-breaks'], i => {
      unique(i.before.map(c => c.name)); unique(i.after.map(c => c.name)); const a = new Map(i.after.map(c => [c.name, c])), b = new Set(i.before.map(c => c.name))
      const findings = i.before.flatMap(c => { const n = a.get(c.name); if (!n) return [f('tabular-schema-column-removed', c.name)]; return [...(n.type !== c.type ? [f('tabular-schema-type-changed', c.name)] : []), ...(n.unitRef !== c.unitRef ? [f('tabular-schema-unit-changed', c.name)] : []), ...(c.required && !n.required || !c.nullable && n.nullable ? [f('tabular-schema-guarantee-weakened', c.name)] : [])] })
      if (!i.consumerAllowsExtraColumns) findings.push(...i.after.filter(c => !b.has(c.name)).map(c => f('tabular-schema-extra-column', c.name)))
      return { findings, metrics: [m('tabular-schema-directional-breaks', 'tabular', findings.length)] }
    }),
  spec(prefix + 'record-sequence-diff', 'Compare pinned tabular row projections by exact table/revision/primary-key frame, ignoring ingestion-ID changes. Insertion is distinct from shared-key reordering; no actual table read.',
    input({ before: list(projection, 0, 32), after: list(projection, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [{ ...row, contentDigest: otherHash }] },
    ['tabular-projection-changed', 'tabular-projection-removed', 'tabular-projection-added', 'tabular-shared-key-order-changed'], ['tabular-projection-differences'], i => diff(i.before, i.after, true)),
  spec(prefix + 'provenance-edge-audit', 'Check row-lineage parent pins, cycles and explicit parent-table declarations. Cross-table joins need matching declared parent tables; no executed query or source-origin certification.',
    input({ rows: records({ ...pins, parentId: id.nullable(), expectedParentTableRef: id.nullable(), parentContentDigest: digest.nullable() }) }),
    { rows: [{ ...row, parentId: null, expectedParentTableRef: null, parentContentDigest: null }] }, { rows: [{ ...row, parentId: 'missing', expectedParentTableRef: 'table1', parentContentDigest: hash }] },
    ['tabular-provenance-parent-missing', 'tabular-provenance-cycle', 'tabular-provenance-parent-pin-mismatch', 'tabular-provenance-parent-declaration-missing', 'tabular-provenance-orphan-parent-declaration'], ['tabular-bound-parent-content-pins'], i => {
      const cyclic = cycles(i.rows), rows = new Map(i.rows.map(r => [r.id, r])); let bound = 0
      const findings = i.rows.flatMap(r => { const parent = r.parentId === null ? undefined : rows.get(r.parentId)
        const issues = [...(r.parentId !== null && !parent ? [f('tabular-provenance-parent-missing', r.id)] : []), ...(cyclic.has(r.id) ? [f('tabular-provenance-cycle', r.id)] : []), ...(parent && (r.expectedParentTableRef !== parent.tableRef || r.parentContentDigest !== parent.contentDigest) ? [f('tabular-provenance-parent-pin-mismatch', r.id)] : []), ...(r.parentId !== null && (r.expectedParentTableRef === null || r.parentContentDigest === null) ? [f('tabular-provenance-parent-declaration-missing', r.id)] : []), ...(r.parentId === null && (r.expectedParentTableRef !== null || r.parentContentDigest !== null) ? [f('tabular-provenance-orphan-parent-declaration', r.id)] : [])]
        if (parent && !issues.length) bound++; return issues })
      return { findings, metrics: [m('tabular-bound-parent-content-pins', 'tabular', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', 'Compare exact allowed table, revision and column IDs with row export declarations. Scope labels are caller policy, not permission grants or database access control.',
    input({ tableRef: id, revision: digest, allowedColumns: list(id, 1, 16), rows: records({ tableRef: id, revision: digest, columnRefs: list(id, 0, 16) }) }),
    { tableRef: 'table1', revision: hash, allowedColumns: ['amount'], rows: [{ id: 'r1', tableRef: 'table1', revision: hash, columnRefs: ['amount'] }] },
    { tableRef: 'table1', revision: hash, allowedColumns: ['amount'], rows: [{ id: 'r1', tableRef: 'other-table', revision: hash, columnRefs: ['amount'] }] },
    ['tabular-export-outside-table-frame', 'tabular-export-column-outside-scope'], ['tabular-in-scope-export-rows'], i => {
      unique(i.allowedColumns); unique(i.rows.map(r => r.id)); let inside = 0
      const findings = i.rows.flatMap(r => { unique(r.columnRefs); const absent = r.columnRefs.filter(c => !i.allowedColumns.includes(c)), issues = [...(r.tableRef !== i.tableRef || r.revision !== i.revision ? [f('tabular-export-outside-table-frame', r.id)] : []), ...(absent.length ? [f('tabular-export-column-outside-scope', r.id, ...absent)] : [])]; if (!issues.length) inside++; return issues })
      return { findings, metrics: [m('tabular-in-scope-export-rows', 'tabular', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', 'Compare parsed pinned tabular row projections without relying on row order or ingestion IDs. Primary keys, table/revision frames and content digests must match; this does not compare unseen cell contents.',
    input({ before: list(projection, 0, 32), after: list(projection, 0, 32) }), { before: [row], after: [row] }, { before: [row], after: [{ ...row, contentDigest: otherHash }] },
    ['tabular-projection-changed', 'tabular-projection-removed', 'tabular-projection-added'], ['tabular-projection-differences'], i => diff(i.before, i.after, false)),
]
