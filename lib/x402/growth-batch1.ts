import { createHash } from 'node:crypto'
import canonicalize from 'canonicalize'
import { z } from 'zod'
import { auditCataloguePriceUnits, PRICE_UNIT_INPUT } from './catalogue-price-units.ts'
import { GROWTH_BATCH1_RESULTS } from './growth-batch1-results.ts'

const canonical = canonicalize as unknown as (value: unknown) => string | undefined
const digest = (value: unknown) => `sha256:${createHash('sha256').update(canonical(value) ?? '').digest('hex')}`
const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
const names = z.array(name).min(1).max(64).refine(v => new Set(v).size === v.length, 'duplicate_field_name')
const cell = z.union([z.string().max(256), z.number().finite(), z.boolean(), z.null()])
const record = z.record(name, cell).refine(r => Object.keys(r).length <= 64)
const rows = z.array(record).max(500)
const envelope = { dataClass: z.enum(['synthetic', 'public']) }
const keyFields = z.array(name).min(1).max(8).refine(v => new Set(v).size === v.length, 'duplicate_field_name')
const field = z.object({ name, type: z.enum(['string', 'number', 'integer', 'boolean']),
  required: z.boolean(), nullable: z.boolean(), unit: z.string().min(1).max(40).nullable() }).strict()
const fields = z.array(field).min(1).max(64).refine(v => new Set(v.map(f => f.name)).size === v.length, 'duplicate_field_name')
export const GROWTH_BATCH1_INPUTS = {
  'catalogue-price-unit-audit': PRICE_UNIT_INPUT,
  'dataset-null-pattern-audit': z.object({ ...envelope, columns: names, rows }).strict(),
  'dataset-key-integrity': z.object({ ...envelope, keyFields, rows }).strict(),
  'dataset-join-loss-preview': z.object({ ...envelope, keyFields, left: rows, right: rows }).strict(),
  'dataset-schema-evolution-plan': z.object({ ...envelope, before: fields,
    after: fields, rejectExtraFields: z.boolean() }).strict(),
  'dataset-export-roundtrip-check': z.object({ ...envelope, before: rows, after: rows }).strict(),
} as const
export type GrowthBatch1Id = keyof typeof GROWTH_BATCH1_INPUTS
export const GROWTH_BATCH1_IDS = Object.keys(GROWTH_BATCH1_INPUTS) as GrowthBatch1Id[]
const unique = (values: string[]) => { if (new Set(values).size !== values.length) throw new Error('duplicate_field_name') }
const own = (row: Record<string, unknown>, key: string) => Object.hasOwn(row, key)
function rowKey(row: z.infer<typeof record>, fields: string[]) {
  if (fields.some(f => !own(row, f) || row[f] === null)) return null
  return canonical(fields.map(f => [typeof row[f], row[f]]))!
}
function groups(inputRows: z.infer<typeof rows>, fields: string[]) {
  unique(fields)
  const keys = new Map<string, number>(), missing: number[] = []
  inputRows.forEach((row, i) => {
    const key = rowKey(row, fields)
    if (key === null) missing.push(i)
    else keys.set(key, (keys.get(key) ?? 0) + 1)
  })
  return { keys, missing }
}

export function buildGrowthBatch1(id: GrowthBatch1Id, supplied: unknown) {
  if (!Object.hasOwn(GROWTH_BATCH1_INPUTS, id)) throw new Error('unknown_growth_product')
  const serialized = canonical(supplied)
  if (!serialized || Buffer.byteLength(serialized) > 262144) throw new Error('oversized_growth_input')
  let result: unknown
  switch (id) {
    case 'catalogue-price-unit-audit': result = auditCataloguePriceUnits(supplied); break
    case 'dataset-null-pattern-audit': {
      const input = GROWTH_BATCH1_INPUTS[id].parse(supplied); unique(input.columns)
      result = { rowCount: input.rows.length, columns: input.columns.map(column => {
        const missing = input.rows.filter(r => !own(r, column)).length
        const nulls = input.rows.filter(r => own(r, column) && r[column] === null).length
        const emptyStrings = input.rows.filter(r => r[column] === '').length
        return { column, missing, nulls, emptyStrings, populated: input.rows.length - missing - nulls - emptyStrings,
          nullOrMissingFraction: input.rows.length ? (nulls + missing) / input.rows.length : null }
      }), imputationPerformed: false }
      break
    }
    case 'dataset-key-integrity': {
      const input = GROWTH_BATCH1_INPUTS[id].parse(supplied), grouped = groups(input.rows, input.keyFields)
      const duplicates = [...grouped.keys.values()].filter(n => n > 1)
      result = { rowCount: input.rows.length, completeKeyRows: input.rows.length - grouped.missing.length,
        distinctCompleteKeys: grouped.keys.size, duplicateKeyGroups: duplicates.length,
        excessDuplicateRows: duplicates.reduce((n, count) => n + count - 1, 0),
        missingOrNullKeyRows: grouped.missing.length, firstMissingRowIndices: grouped.missing.slice(0, 64),
        uniqueCompleteKey: !duplicates.length && !grouped.missing.length, typeCoercionPerformed: false }
      break
    }
    case 'dataset-join-loss-preview': {
      const input = GROWTH_BATCH1_INPUTS[id].parse(supplied)
      const l = groups(input.left, input.keyFields), r = groups(input.right, input.keyFields)
      let pairs = 0, unmatchedLeft = l.missing.length, unmatchedRight = r.missing.length, manyToManyKeys = 0
      for (const [key, count] of l.keys) {
        const other = r.keys.get(key) ?? 0
        if (other) { pairs += count * other; if (count > 1 && other > 1) manyToManyKeys++ }
        else unmatchedLeft += count
      }
      for (const [key, count] of r.keys) if (!l.keys.has(key)) unmatchedRight += count
      result = { leftRows: input.left.length, rightRows: input.right.length, innerJoinRows: pairs,
        leftJoinRows: pairs + unmatchedLeft, fullOuterJoinRows: pairs + unmatchedLeft + unmatchedRight,
        unmatchedLeftRows: unmatchedLeft, unmatchedRightRows: unmatchedRight, manyToManyKeys,
        nullOrMissingKeysMatch: false, typeCoercionPerformed: false, joinedCellsReturned: false }
      break
    }
    case 'dataset-schema-evolution-plan': {
      const input = GROWTH_BATCH1_INPUTS[id].parse(supplied)
      unique(input.before.map(f => f.name)); unique(input.after.map(f => f.name))
      const before = new Map(input.before.map(f => [f.name, f])), after = new Map(input.after.map(f => [f.name, f]))
      const changes: { field: string; kind: string; breaksDeclaredOldRecords: boolean }[] = []
      for (const f of input.after) {
        const old = before.get(f.name)
        if (!old) { changes.push({ field: f.name, kind: 'added', breaksDeclaredOldRecords: f.required }); continue }
        if (old.type !== f.type) changes.push({ field: f.name, kind: 'type_changed', breaksDeclaredOldRecords: !(old.type === 'integer' && f.type === 'number') })
        if (old.required !== f.required) changes.push({ field: f.name, kind: 'required_changed', breaksDeclaredOldRecords: f.required })
        if (old.nullable !== f.nullable) changes.push({ field: f.name, kind: 'nullable_changed', breaksDeclaredOldRecords: !f.nullable })
        if (old.unit !== f.unit) changes.push({ field: f.name, kind: 'unit_changed', breaksDeclaredOldRecords: true })
      }
      for (const old of input.before) if (!after.has(old.name)) changes.push({ field: old.name, kind: 'removed', breaksDeclaredOldRecords: input.rejectExtraFields })
      result = { direction: 'new_schema_accepts_records_per_old_declaration', changes,
        declaredCompatibility: changes.some(c => c.breaksDeclaredOldRecords) ? 'breaking_change' : 'no_declared_break',
        recordsExecutedAgainstSchema: false, semanticEquivalenceProved: false }
      break
    }
    case 'dataset-export-roundtrip-check': {
      const input = GROWTH_BATCH1_INPUTS[id].parse(supplied)
      const diffs: { rowIndex: number; column: string; kind: string }[] = []; let total = 0
      for (let i = 0; i < Math.max(input.before.length, input.after.length); i++) {
        const a = input.before[i], b = input.after[i]
        for (const column of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
          const oldHas = !!a && own(a, column), newHas = !!b && own(b, column)
          if (oldHas === newHas && canonical(a?.[column]) === canonical(b?.[column])) continue
          total++
          if (diffs.length < 64) diffs.push({ rowIndex: i, column, kind: !oldHas ? 'added' : !newHas ? 'removed' : typeof a![column] !== typeof b![column] ? 'type_changed' : 'value_changed' })
        }
      }
      // Empty records are still records; a dropped empty row cannot pass.
      result = { beforeRows: input.before.length, afterRows: input.after.length, equalAtSamePositions: total === 0 && input.before.length === input.after.length,
        changedCells: total, findings: diffs, findingsTruncated: total > diffs.length,
        beforeDigest: digest(input.before), afterDigest: digest(input.after), orderIgnored: false, cellValuesReturned: false }
      break
    }
  }
  const output = { schemaVersion: 'maha-growth-batch1/0.1.0', productId: id, status: 'local-prototype',
    inputDigest: digest(supplied), result: GROWTH_BATCH1_RESULTS[id].parse(result), paymentsMade: 0, productionPayable: false,
    boundary: 'Caller-supplied public or synthetic records only. No external lookup, automatic repair, private-data detection, legal/scientific certification or settlement.' }
  if (Buffer.byteLength(canonical(output)!) > 65536) throw new Error('oversized_growth_result')
  return output
}
