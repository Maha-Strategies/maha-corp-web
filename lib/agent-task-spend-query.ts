// Reading attributed spend back out.
//
// Deliberately separate from lib/chargeback-export.ts, which is pure. This file
// is the only part of the chargeback path that talks to a database, and keeping
// that boundary sharp is what let the exporter be tested against fixtures
// months before a real row existed.
//
// Every query is tenant-scoped. A chargeback report is a customer's own
// financial data, and a missing filter here would put one customer's task
// identifiers and department names in another's invoice -- which is a data
// breach wearing a reporting bug's clothes.

import type { SpendRow } from './chargeback-export.ts'
import type { BudgetRow } from './agent-task-spend.ts'

type Ledger = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        gte: (column: string, value: string) => {
          lte: (column: string, value: string) => PromiseLike<{ data: unknown; error: unknown }>
        }
      }
    }
  }
}

/** A day string this codebase is willing to send to Postgres. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export type SpendQuery = {
  tenantId: string
  startDate: string
  endDate: string
  /** Optional narrowing. Applied after the fetch; see the note below. */
  costCenter?: string
}

export type SpendQueryResult =
  | { ok: true; rows: SpendRow[] }
  | { ok: false; reason: 'invalid_window' | 'invalid_tenant' | 'ledger_unavailable' | 'query_failed' }

const SPEND_COLUMNS =
  'usage_day,tenant_id,task_id,cost_center,surface,request_count,credits_charged,'
  + 'input_tokens_estimated,output_tokens_estimated,tokens_saved_estimated'

/**
 * Fetch one tenant's attributed spend for a window.
 *
 * Rows come back sorted by the same total order the exporter applies, so a
 * caller that renders them directly sees the same sequence the CSV will carry.
 * The exporter sorts again rather than trusting this, because it must be
 * correct for any input, but a reader comparing the two should not have to
 * reconcile two orderings.
 *
 * `costCenter` filters in memory rather than in the query. The window is
 * already bounded by tenant and date, so the row count is small, and adding a
 * fourth chained filter to the ledger interface for a narrowing that changes
 * nothing about correctness is not worth the surface.
 */
export async function fetchAgentTaskSpendDaily(
  ledger: Ledger | null,
  query: SpendQuery,
): Promise<SpendQueryResult> {
  if (!ledger) return { ok: false, reason: 'ledger_unavailable' }
  if (!query.tenantId.trim()) return { ok: false, reason: 'invalid_tenant' }
  // Rejected rather than coerced. A malformed date silently widened to "all
  // time" would bill a customer for a period nobody asked about.
  if (!ISO_DAY.test(query.startDate) || !ISO_DAY.test(query.endDate)) return { ok: false, reason: 'invalid_window' }
  if (query.startDate > query.endDate) return { ok: false, reason: 'invalid_window' }

  try {
    const { data, error } = await ledger
      .from('agent_task_spend_daily')
      .select(SPEND_COLUMNS)
      .eq('tenant_id', query.tenantId.trim())
      .gte('usage_day', query.startDate)
      .lte('usage_day', query.endDate)
    if (error) {
      // Logged with the provider's own code because `query_failed` covers two
      // very different situations: a table PostgREST cannot see yet (PGRST205,
      // fixed by a schema reload) and a database that cannot be reached. The
      // first cost a round trip to diagnose once; it should name itself next
      // time. Not returned to the caller, which gets a stable code.
      console.error('agent task spend query failed', JSON.stringify({
        code: (error as { code?: unknown }).code ?? null,
        message: String((error as { message?: unknown }).message ?? '').slice(0, 200),
      }))
      return { ok: false, reason: 'query_failed' }
    }

    const rows = (Array.isArray(data) ? data : []) as SpendRow[]
    const filtered = query.costCenter ? rows.filter((row) => row.cost_center === query.costCenter) : rows
    return { ok: true, rows: sortRows(filtered) }
  } catch {
    return { ok: false, reason: 'query_failed' }
  }
}

/** Same total order the exporter uses, and for the same reason: no locale. */
function sortRows(rows: SpendRow[]): SpendRow[] {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...rows].sort((left, right) =>
    compare(left.usage_day, right.usage_day)
    || compare(left.surface, right.surface)
    || compare(left.cost_center, right.cost_center)
    || compare(left.task_id, right.task_id))
}

const BUDGET_COLUMNS = 'cost_center,credit_limit,alert_at_percent,period_start,period_end'

/**
 * Budgets whose period overlaps the requested window.
 *
 * Returns an empty list rather than failing when the table cannot be read. A
 * chargeback export without budget annotations is still a correct export; one
 * that refuses to render because a budget lookup failed would withhold the
 * financial record over a decoration.
 */
export async function fetchCostCenterBudgets(
  ledger: Ledger | null,
  query: { tenantId: string; startDate: string; endDate: string },
): Promise<BudgetRow[]> {
  if (!ledger || !query.tenantId.trim() || !ISO_DAY.test(query.startDate) || !ISO_DAY.test(query.endDate)) return []
  try {
    const { data, error } = await ledger
      .from('agent_cost_center_budgets')
      .select(BUDGET_COLUMNS)
      .eq('tenant_id', query.tenantId.trim())
      // A budget period that starts before the window ends and ends after it
      // begins overlaps it. Anchored on period_start for the range scan and
      // narrowed below, because the ledger interface chains one range only.
      .gte('period_end', query.startDate)
      .lte('period_start', query.endDate)
    if (error) return []
    return (Array.isArray(data) ? data : []) as BudgetRow[]
  } catch {
    return []
  }
}
