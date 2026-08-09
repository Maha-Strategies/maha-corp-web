// Writing one attributed spend row.
//
// Same contract as the usage meter it sits beside: this runs after the response
// exists, never throws, and never delays delivery. An attribution outage costs
// a line on a report, and a report is not worth a failed request.
//
// It records credits *charged*, not credits owed. A chargeback ledger whose
// numbers cannot be reconciled against the balance they claim to explain is
// worse than no ledger, because it will be believed.

import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'

export type SpendSurface = 'compress' | 'jobs' | 'gateway' | 'audit'

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> } | null

const whole = (value: number | undefined) => Math.max(0, Math.round(value ?? 0))

export async function recordAgentTaskSpend(input: {
  tenantId: string
  taskId: string
  costCenter: string
  surface: SpendSurface
  creditsCharged?: number
  inputTokens?: number
  outputTokens?: number
  tokensSaved?: number
  ledger?: Ledger
}): Promise<void> {
  try {
    // Guarded here as well as in the function: a row with no tenant or task is
    // an unallocatable line on an invoice, and the cheapest place to not create
    // one is before the round trip.
    if (!input.tenantId.trim() || !input.taskId.trim()) return

    const ledger = input.ledger !== undefined ? input.ledger : createAgentInquiryLedger()
    if (!ledger) return

    const { error } = await ledger.rpc('record_agent_task_spend', {
      p_tenant_id: input.tenantId,
      p_task_id: input.taskId,
      p_cost_center: input.costCenter,
      p_surface: input.surface,
      p_credits_charged: whole(input.creditsCharged),
      p_input_tokens: whole(input.inputTokens),
      p_output_tokens: whole(input.outputTokens),
      p_tokens_saved: whole(input.tokensSaved),
    })
    if (error) console.error('agent task spend ledger failed')
  } catch {
    // Deliberately silent beyond the log above.
  }
}

// ---------------------------------------------------------------------------
// Budget status
// ---------------------------------------------------------------------------
//
// Read-only, and structurally incapable of being anything else: it takes spend
// and a budget and returns a label. There is no request path that calls it, no
// throw, and no outcome that could refuse anything. Enforcement would move this
// system inline, which is the one property that makes it sellable to a finance
// team without a security review.

export type BudgetRow = {
  cost_center: string
  credit_limit: number | string
  alert_at_percent: number | string
  period_start?: string
  period_end?: string
}

export type BudgetState = 'within' | 'approaching' | 'exceeded'

export type BudgetStatus = {
  costCenter: string
  creditsSpent: number
  creditLimit: number
  /** Spend as a percentage of the limit, one decimal. Can exceed 100. */
  percentUsed: number
  alertAtPercent: number
  state: BudgetState
}

const numeric = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Compare spend per cost centre against the budgets defined for them.
 *
 * Cost centres with no budget are omitted rather than reported as unlimited or
 * as zero. A budget nobody set is not a budget met, and inventing either
 * reading would put a green tick against a department nobody is watching.
 *
 * `exceeded` is `>=`, not `>`: spending exactly the limit has consumed all of
 * it, and reporting that as still within budget is the kind of off-by-one a
 * finance team notices immediately.
 */
export function evaluateBudgets(input: {
  spendByCostCenter: Map<string, number> | Record<string, number>
  budgets: readonly BudgetRow[]
}): BudgetStatus[] {
  const spend = input.spendByCostCenter instanceof Map
    ? input.spendByCostCenter
    : new Map(Object.entries(input.spendByCostCenter))

  return input.budgets
    .map((budget): BudgetStatus | null => {
      const creditLimit = numeric(budget.credit_limit)
      // A non-positive limit cannot produce a meaningful percentage, and the
      // column forbids one. Reported as absent rather than as a division by
      // zero dressed up as Infinity.
      if (creditLimit <= 0) return null

      const creditsSpent = Math.max(0, numeric(spend.get(budget.cost_center)))
      const alertAtPercent = numeric(budget.alert_at_percent) || 80
      const percentUsed = Number(((creditsSpent / creditLimit) * 100).toFixed(1))

      const state: BudgetState = creditsSpent >= creditLimit
        ? 'exceeded'
        : percentUsed >= alertAtPercent ? 'approaching' : 'within'

      return { costCenter: budget.cost_center, creditsSpent, creditLimit, percentUsed, alertAtPercent, state }
    })
    .filter((status): status is BudgetStatus => status !== null)
    .sort((left, right) => (left.costCenter < right.costCenter ? -1 : left.costCenter > right.costCenter ? 1 : 0))
}

/** Spend per cost centre, in the shape `evaluateBudgets` wants. */
export function spendByCostCenter(rows: readonly { cost_center: string; credits_charged: number | string }[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.cost_center, (totals.get(row.cost_center) ?? 0) + numeric(row.credits_charged))
  }
  return totals
}
