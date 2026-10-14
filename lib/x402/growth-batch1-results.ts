import { z } from 'zod'
const n = z.number().int().min(0).max(500)
const no = z.literal(false)
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
const quote = z.object({ id: z.string().min(1).max(80), network: z.string().regex(/^eip155:[1-9][0-9]{0,12}$/),
  asset: z.string().regex(/^0x[0-9a-fA-F]{40}$/), amountBaseUnits: z.string().regex(/^[1-9][0-9]{0,77}$/),
  decimals: z.number().int().min(0).max(36).nullable(), tokenAmount: z.string().regex(/^\d+(?:\.\d+)?$/).max(116).nullable(),
  status: z.enum(['normalized_from_supplied_metadata', 'unknown_asset_decimals']),
  metadataBasis: z.enum(['contract-read', 'official-registry', 'caller-declaration']).nullable(),
  metadataSource: z.string().min(1).max(500).nullable(), metadataObservedAt: z.iso.datetime().nullable(),
  usdPrice: z.null(), independentlyVerifiedThisCall: no }).strict()
export const GROWTH_BATCH1_RESULTS = {
  'catalogue-price-unit-audit': z.object({ quotes: z.array(quote).min(1).max(64), unknownCount: z.number().int().min(0).max(64),
    decimalsAssumedFromSymbol: no, usdPegVerified: no, paymentsMade: z.literal(0), boundary: z.string().min(1).max(300) }).strict(),
  'dataset-null-pattern-audit': z.object({ rowCount: n, columns: z.array(z.object({ column: name, missing: n, nulls: n, emptyStrings: n,
    populated: n, nullOrMissingFraction: z.number().min(0).max(1).nullable() }).strict()).min(1).max(64), imputationPerformed: no }).strict(),
  'dataset-key-integrity': z.object({ rowCount: n, completeKeyRows: n, distinctCompleteKeys: n, duplicateKeyGroups: n,
    excessDuplicateRows: n, missingOrNullKeyRows: n, firstMissingRowIndices: z.array(n).max(64), uniqueCompleteKey: z.boolean(), typeCoercionPerformed: no }).strict(),
  'dataset-join-loss-preview': z.object({ leftRows: n, rightRows: n, innerJoinRows: z.number().int().min(0).max(250000),
    leftJoinRows: z.number().int().min(0).max(250500), fullOuterJoinRows: z.number().int().min(0).max(251000),
    unmatchedLeftRows: n, unmatchedRightRows: n, manyToManyKeys: n, nullOrMissingKeysMatch: no, typeCoercionPerformed: no, joinedCellsReturned: no }).strict(),
  'dataset-schema-evolution-plan': z.object({ direction: z.literal('new_schema_accepts_records_per_old_declaration'),
    changes: z.array(z.object({ field: name, kind: z.enum(['added', 'removed', 'type_changed', 'required_changed', 'nullable_changed', 'unit_changed']),
      breaksDeclaredOldRecords: z.boolean() }).strict()).max(384), declaredCompatibility: z.enum(['breaking_change', 'no_declared_break']),
    recordsExecutedAgainstSchema: no, semanticEquivalenceProved: no }).strict(),
  'dataset-export-roundtrip-check': z.object({ beforeRows: n, afterRows: n, equalAtSamePositions: z.boolean(), changedCells: z.number().int().min(0).max(64000),
    findings: z.array(z.object({ rowIndex: n, column: name, kind: z.enum(['added', 'removed', 'type_changed', 'value_changed']) }).strict()).max(64),
    findingsTruncated: z.boolean(), beforeDigest: hash, afterDigest: hash, orderIgnored: no, cellValuesReturned: no }).strict(),
} as const
