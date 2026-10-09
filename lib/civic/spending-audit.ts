import { z } from 'zod'
import { civicDigest, civicIdSchema, digestSchema, immutableSnapshot, sourceUrlSchema } from './receipt.ts'

const centsSchema = z.string().regex(/^(0|[1-9][0-9]{0,17})$/)
export const spendingRecordSchema = z.object({
  id: civicIdSchema,
  agency: z.string().trim().min(1).max(120), contractor: z.string().trim().min(1).max(160),
  program: z.string().trim().min(1).max(160), fiscalYear: z.number().int().min(1900).max(2200),
  amountUsdCents: centsSchema, budgetUsdCents: centsSchema.optional(),
  competition: z.enum(['competitive', 'noncompetitive', 'unknown']),
  source: z.object({ citation: z.string().min(1).max(300), url: sourceUrlSchema, digest: digestSchema.optional() }).strict(),
}).strict()
export type SpendingRecord = z.infer<typeof spendingRecordSchema>
export const auditThresholdSchema = z.object({
  noncompetitiveAmountUsdCents: centsSchema.default('1000000000'),
  concentrationPercent: z.number().int().min(1).max(100).default(60),
  minimumGroupRecords: z.number().int().min(2).max(1000).default(3),
}).strict()
export const spendingAuditInputSchema = z.object({
  format: z.enum(['json', 'csv']), data: z.string().min(1).max(200_000),
  thresholds: auditThresholdSchema.default({ noncompetitiveAmountUsdCents: '1000000000', concentrationPercent: 60, minimumGroupRecords: 3 }),
}).strict()
export type SpendingAuditInput = z.input<typeof spendingAuditInputSchema>

const CSV_HEADERS = ['id', 'agency', 'contractor', 'program', 'fiscalYear', 'amountUsdCents', 'budgetUsdCents', 'competition', 'sourceCitation', 'sourceUrl']
/** Strict quoted-field CSV, including escaped quotes and embedded newlines. */
function csvRows(data: string): string[][] {
  const rows: string[][] = [], row: string[] = []
  let field = '', quoted = false, closedQuote = false
  function endField() { row.push(field); field = ''; closedQuote = false }
  function endRow() { endField(); rows.push(row.splice(0)); if (rows.length > 1002) throw new Error('At most 1,000 spending records are supported.') }
  const input = data.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { quoted = false; closedQuote = true }
      else field += char
    } else if (char === ',') endField()
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i++; endRow() }
    else if (closedQuote) throw new Error('Unexpected text after CSV quote.')
    else if (char === '"') { if (field.length) throw new Error('Unexpected CSV quote.'); quoted = true }
    else field += char
  }
  if (quoted) throw new Error('Unclosed CSV quote.')
  if (row.length || field.length || closedQuote) endRow()
  return rows
}

export function parseSpendingData(format: 'json' | 'csv', data: string): SpendingRecord[] {
  if (data.length > 200_000) throw new Error('Dataset too large.')
  if (format === 'json') return z.array(spendingRecordSchema).min(1).max(1000).parse(JSON.parse(data))
  if (format !== 'csv') throw new Error('Unsupported spending format.')
  const [header, ...rows] = csvRows(data)
  if (JSON.stringify(header) !== JSON.stringify(CSV_HEADERS)) throw new Error(`CSV headers must be: ${CSV_HEADERS.join(',')}`)
  return z.array(spendingRecordSchema).min(1).max(1000).parse(rows.map(row => {
    if (row.length !== CSV_HEADERS.length) throw new Error('CSV row has the wrong number of columns.')
    if (!/^\d{4}$/.test(row[4])) throw new Error('CSV fiscalYear must be a four-digit integer.')
    return { id: row[0], agency: row[1], contractor: row[2], program: row[3], fiscalYear: Number(row[4]),
      amountUsdCents: row[5], ...(row[6] ? { budgetUsdCents: row[6] } : {}), competition: row[7],
      source: { citation: row[8], url: row[9] } }
  }))
}

type Finding = {
  rule: 'duplicate-id' | 'budget-exceedance' | 'inconsistent-budget' | 'contractor-concentration' | 'large-noncompetitive-award'
  status: 'review-required'; recordIds: string[]; explanation: string
  observed: string; threshold: string | null; sources: SpendingRecord['source'][]
}

export function auditSpending(input: SpendingAuditInput) {
  const request = spendingAuditInputSchema.parse(input), records = parseSpendingData(request.format, request.data)
  const findings: Finding[] = []
  function add(rule: Finding['rule'], rows: SpendingRecord[], explanation: string, observed: string, threshold: string | null) {
    findings.push({ rule, status: 'review-required', recordIds: rows.map(r => r.id), explanation, observed, threshold,
      sources: [...new Map(rows.map(r => [civicDigest(r.source), r.source])).values()] })
  }
  const byId = new Map<string, SpendingRecord[]>()
  for (const row of records) byId.set(row.id, [...(byId.get(row.id) ?? []), row])
  const duplicates = [...byId.values()].filter(rows => rows.length > 1)
  for (const rows of duplicates) add('duplicate-id', rows, 'Repeated award IDs may represent duplicate exports or legitimate amendments. All rows with this ID are excluded from totals until reconciled.', String(rows.length), '1')
  const excluded = new Set(duplicates.map(rows => rows[0].id)), eligible = records.filter(r => !excluded.has(r.id))
  const groups = new Map<string, SpendingRecord[]>()
  for (const row of eligible) {
    const key = JSON.stringify([row.agency, row.program, row.fiscalYear])
    groups.set(key, [...(groups.get(key) ?? []), row])
    if (row.competition === 'noncompetitive' && BigInt(row.amountUsdCents) >= BigInt(request.thresholds.noncompetitiveAmountUsdCents)) {
      add('large-noncompetitive-award', [row], 'A reported noncompetitive award crosses the configured review threshold. Statutory exceptions and procurement context require review; this is not proof of waste or illegality.', row.amountUsdCents, request.thresholds.noncompetitiveAmountUsdCents)
    }
  }
  for (const rows of groups.values()) {
    const total = rows.reduce((sum, row) => sum + BigInt(row.amountUsdCents), BigInt(0))
    const budgets = new Set(rows.map(r => r.budgetUsdCents).filter(v => v !== undefined))
    if (budgets.size > 1) add('inconsistent-budget', rows, 'Different budget caps reported for the same agency/program/year. Budget comparisons withheld.', [...budgets].join(', '), null)
    else if (budgets.size === 1) {
      const budget = [...budgets][0]!
      if (total > BigInt(budget)) add('budget-exceedance', rows, 'Sum of reported award amounts exceeds the supplied group budget cap. Obligation timing, amendments and accounting basis need reconciliation.', total.toString(), budget)
    }
    if (rows.length >= request.thresholds.minimumGroupRecords && total > BigInt(0)) {
      const contractors = new Map<string, bigint>()
      for (const row of rows) contractors.set(row.contractor, (contractors.get(row.contractor) ?? BigInt(0)) + BigInt(row.amountUsdCents))
      for (const [contractor, amount] of contractors) if (amount * BigInt(100) >= total * BigInt(request.thresholds.concentrationPercent)) {
        add('contractor-concentration', rows.filter(r => r.contractor === contractor), 'One contractor receives a large share of reported agency/program/year awards. Specialization or export selection may explain concentration; this does not establish regulatory capture.', `${amount} of ${total} USD cents`, `${request.thresholds.concentrationPercent}%`)
      }
    }
  }
  const payload = { version: 'civic-spending-audit-1' as const,
    rawInputDigest: civicDigest({ format: request.format, data: request.data }), datasetDigest: civicDigest(records),
    records,
    thresholds: request.thresholds, recordsScanned: records.length, recordsIncludedInTotals: eligible.length,
    excludedDuplicateIds: [...excluded], totalReportedUsdCents: eligible.reduce((sum, r) => sum + BigInt(r.amountUsdCents), BigInt(0)).toString(),
    findings,
    limitations: ['Rule-based screening only; findings are review leads, not allegations or determinations of waste, corruption or regulatory capture.',
      'Input sources and source digests are supplied by the caller and have not been fetched or independently verified.',
      'Amounts use integer USD cents. Budget caps apply to an agency/program/fiscal-year group, not each row.',
      'No inflation adjustment, amendment reconciliation, contractor entity resolution or population-completeness check. No findings does not establish clean spending.'],
  }
  return immutableSnapshot({ ...payload, digest: civicDigest(payload) })
}
export type SpendingAuditReceipt = ReturnType<typeof auditSpending>
