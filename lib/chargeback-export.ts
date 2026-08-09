// Turning attributed spend into a file a finance team can file.
//
// Pure by construction: rows in, CSV out, no I/O and no clock. The caller reads
// agent_task_spend_daily and hands the rows over. That is what makes this
// testable against fixtures before a single real row exists, and it is also
// what makes the output reproducible, which is the property the whole artifact
// depends on -- an export that differs between runs cannot be reconciled
// against anything, and a chargeback nobody can reconcile is a dispute.
//
// Three commitments the format keeps:
//
//   * Deterministic bytes. The same rows in any order produce the same file,
//     because rows are sorted by an explicit total order over code units, not
//     by locale and not by insertion order.
//   * Credits, never invented dollars. The effective rate differs by pack and
//     correct valuation needs purchase-lot accounting that does not exist here,
//     so a money column appears only when the caller states a rate.
//   * Tokens saved as a quantity. Converting it to money needs the customer's
//     own model input price, which this service does not know. The reference
//     $3/M figure used in benchmarks is a reference, not this customer's price,
//     and printing it on an invoice would turn a caveat into a claim.

import { createHash } from 'node:crypto'

/** One row of agent_task_spend_daily, as Supabase returns it. */
export type SpendRow = {
  usage_day: string
  tenant_id: string
  task_id: string
  cost_center: string
  surface: string
  request_count: number | string
  credits_charged: number | string
  input_tokens_estimated: number | string
  output_tokens_estimated: number | string
  tokens_saved_estimated: number | string
}

export type ChargebackWindow = { fromDay: string; toDay: string }

export type ChargebackTotals = {
  requests: number
  credits: number
  inputTokens: number
  outputTokens: number
  tokensSaved: number
}

export type ChargebackExport = {
  csv: string
  /** SHA-256 of the CSV bytes. Not inside the file, which would be circular. */
  contentHash: string
  rowCount: number
  totals: ChargebackTotals
  window: ChargebackWindow
  granularity: Granularity
}

/**
 * `task` is the atomic fact and answers "what did this run cost".
 * `cost_center` is what finance files and answers "what does this department
 * owe". Both are derived from the same rows; neither is a different truth.
 */
export type Granularity = 'task' | 'cost_center'

const TASK_COLUMNS = [
  'usage_day', 'tenant_id', 'cost_center', 'task_id', 'surface',
  'requests', 'credits_charged', 'input_tokens_estimated', 'output_tokens_estimated', 'tokens_saved_estimated',
] as const

const COST_CENTER_COLUMNS = [
  'cost_center', 'tasks', 'requests', 'credits_charged',
  'input_tokens_estimated', 'output_tokens_estimated', 'tokens_saved_estimated',
] as const

/**
 * A field a spreadsheet would execute rather than display.
 *
 * Excel and Sheets treat a leading =, +, - or @ as the start of a formula, so a
 * value carrying one becomes code in the recipient's finance workbook. The
 * column constraints on task_id and cost_center already forbid these, but
 * tenant_id is only length-checked, and a defence that depends on a constraint
 * three layers away is not a defence. Prefixing with an apostrophe is the
 * conventional neutralisation and survives the round trip visibly.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/

function csvField(value: string | number): string {
  const raw = String(value)
  const guarded = FORMULA_LEAD.test(raw) ? `'${raw}` : raw
  // RFC 4180: quote when the field carries a delimiter, a quote or a line
  // break, and double any embedded quote. None of these can occur in the
  // constrained identifier columns, which is exactly why the rule belongs here
  // rather than in the caller -- the numbers and the header pass through it too.
  return /[",\r\n]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded
}

const csvRow = (fields: readonly (string | number)[]) => fields.map(csvField).join(',')

/** Numbers arrive from Postgres `numeric` as strings. Never NaN downstream. */
function count(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * A total order over rows that does not depend on locale.
 *
 * `localeCompare` would order differently under a different ICU build or
 * environment locale, which is precisely the class of difference that makes an
 * export irreproducible on someone else's machine. Comparing code units is
 * uglier for humans and identical everywhere.
 */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function sortTaskRows(rows: readonly SpendRow[]): SpendRow[] {
  return [...rows].sort((left, right) =>
    compare(left.usage_day, right.usage_day)
    || compare(left.cost_center, right.cost_center)
    || compare(left.task_id, right.task_id)
    || compare(left.surface, right.surface))
}

type CostCentreTotals = ChargebackTotals & { tasks: Set<string> }

function byCostCentre(rows: readonly SpendRow[]): Map<string, CostCentreTotals> {
  const grouped = new Map<string, CostCentreTotals>()
  for (const row of rows) {
    const entry = grouped.get(row.cost_center) ?? {
      requests: 0, credits: 0, inputTokens: 0, outputTokens: 0, tokensSaved: 0, tasks: new Set<string>(),
    }
    entry.requests += count(row.request_count)
    entry.credits += count(row.credits_charged)
    entry.inputTokens += count(row.input_tokens_estimated)
    entry.outputTokens += count(row.output_tokens_estimated)
    entry.tokensSaved += count(row.tokens_saved_estimated)
    // A task spanning several days is one task, counted once.
    entry.tasks.add(row.task_id)
    grouped.set(row.cost_center, entry)
  }
  return grouped
}

function sumRows(rows: readonly SpendRow[]): ChargebackTotals {
  return rows.reduce<ChargebackTotals>((totals, row) => ({
    requests: totals.requests + count(row.request_count),
    credits: totals.credits + count(row.credits_charged),
    inputTokens: totals.inputTokens + count(row.input_tokens_estimated),
    outputTokens: totals.outputTokens + count(row.output_tokens_estimated),
    tokensSaved: totals.tokensSaved + count(row.tokens_saved_estimated),
  }), { requests: 0, credits: 0, inputTokens: 0, outputTokens: 0, tokensSaved: 0 })
}

/**
 * Build the export.
 *
 * `creditRateUsd` is optional and has no default. Supplying one adds a
 * `cost_usd` column valued at that rate; omitting it produces a file with no
 * money in it at all. There is deliberately no fallback rate: this platform
 * sells credits at two different prices depending on pack, and a plausible
 * default would be quoted as though it were the customer's actual cost.
 *
 * Rows outside the window are dropped rather than trusted. The caller queried
 * for a window, but an export that silently includes a stray day would be
 * reconciled against a period that does not match it.
 */
export function buildChargebackExport(input: {
  rows: readonly SpendRow[]
  window: ChargebackWindow
  granularity?: Granularity
  creditRateUsd?: number
}): ChargebackExport {
  const granularity = input.granularity ?? 'cost_center'
  const rate = typeof input.creditRateUsd === 'number' && Number.isFinite(input.creditRateUsd) && input.creditRateUsd >= 0
    ? input.creditRateUsd
    : null

  const inWindow = input.rows.filter((row) =>
    row.usage_day >= input.window.fromDay && row.usage_day <= input.window.toDay)

  const lines: string[] = []
  let rowCount = 0

  if (granularity === 'task') {
    lines.push(csvRow(rate === null ? TASK_COLUMNS : [...TASK_COLUMNS, 'cost_usd']))
    for (const row of sortTaskRows(inWindow)) {
      const credits = count(row.credits_charged)
      const fields: (string | number)[] = [
        row.usage_day, row.tenant_id, row.cost_center, row.task_id, row.surface,
        count(row.request_count), credits,
        count(row.input_tokens_estimated), count(row.output_tokens_estimated), count(row.tokens_saved_estimated),
      ]
      if (rate !== null) fields.push(money(credits * rate))
      lines.push(csvRow(fields))
      rowCount += 1
    }
  } else {
    lines.push(csvRow(rate === null ? COST_CENTER_COLUMNS : [...COST_CENTER_COLUMNS, 'cost_usd']))
    const grouped = [...byCostCentre(inWindow).entries()].sort(([left], [right]) => compare(left, right))
    for (const [costCenter, totals] of grouped) {
      const fields: (string | number)[] = [
        costCenter, totals.tasks.size, totals.requests, totals.credits,
        totals.inputTokens, totals.outputTokens, totals.tokensSaved,
      ]
      if (rate !== null) fields.push(money(totals.credits * rate))
      lines.push(csvRow(fields))
      rowCount += 1
    }
  }

  // Trailing newline: POSIX text files end with one, and its absence is a
  // difference some tools report and others silently repair, which would make
  // two hashes of the same content disagree.
  const csv = `${lines.join('\r\n')}\r\n`

  return {
    csv,
    contentHash: `sha256:${createHash('sha256').update(csv, 'utf8').digest('hex')}`,
    rowCount,
    totals: sumRows(inWindow),
    window: input.window,
    granularity,
  }
}

/** Fixed to cents. Floating credits x rate would otherwise print 0.30000000000000004. */
function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}
