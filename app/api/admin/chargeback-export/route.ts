/**
 * Chargeback CSV for one tenant and one finance period.
 *
 * Operator-authenticated rather than tenant-authenticated, and deliberately so
 * for now: this returns a customer's task identifiers and department names, and
 * exposing it to the tenant's own API key would make every credential a reader
 * of the whole organisation's spend. Narrowing that to a tenant-scoped
 * self-serve export is a later decision with its own authorization model.
 *
 * Read-only end to end. It queries two tables, formats, and returns. No budget
 * is enforced, nothing is charged, and no request path anywhere depends on this
 * route answering.
 *
 * Lives under /api/admin rather than /api/v1/admin because proxy.ts matches
 * `/api/v1/:path*` and would demand a customer API key -- and spend one of that
 * customer's credits -- before this route's bearer token was ever read. Every
 * other operator route sits outside that matcher for the same reason.
 */

import { authorizeRevenueOperations } from '@/lib/revenue-control-plane'
import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { fetchAgentTaskSpendDaily, fetchCostCenterBudgets } from '@/lib/agent-task-spend-query'
import { buildChargebackExport, type Granularity } from '@/lib/chargeback-export'
import { evaluateBudgets, spendByCostCenter } from '@/lib/agent-task-spend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Filename a finance team can file without renaming it. */
function attachmentName(tenantId: string, startDate: string, endDate: string): string {
  const safeTenant = tenantId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60)
  return `chargeback_${safeTenant}_${startDate}_${endDate}.csv`
}

export async function GET(request: Request) {
  const authorization = authorizeRevenueOperations(request)
  if (authorization.kind === 'unconfigured') return json({ error: { code: 'operations_unavailable', message: 'The revenue control plane is not configured.' } }, 503)
  if (authorization.kind === 'unauthorized') return json({ error: { code: 'unauthorized', message: 'A valid revenue control bearer token is required.' } }, 401)

  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? ''
  const startDate = url.searchParams.get('startDate')?.trim() ?? ''
  const endDate = url.searchParams.get('endDate')?.trim() ?? ''
  const costCenter = url.searchParams.get('costCenter')?.trim() || undefined
  const granularity: Granularity = url.searchParams.get('granularity') === 'task' ? 'task' : 'cost_center'
  // No default rate. Credits sell at two prices depending on pack, so a
  // plausible one would be filed as the customer's actual cost.
  const rateParameter = url.searchParams.get('creditRateUsd')
  const creditRateUsd = rateParameter === null ? undefined : Number(rateParameter)

  if (!tenantId) return json({ error: { code: 'tenant_required', message: 'tenantId is required.' } }, 400)

  // The Supabase client's generic chain is far wider than the three methods
  // used here, and inferring it through them exceeds TypeScript's instantiation
  // depth. Narrowed once, at the boundary, so the query module keeps a small
  // hand-written interface it can be tested against with a stub.
  const ledger = createAgentInquiryLedger() as unknown as Parameters<typeof fetchAgentTaskSpendDaily>[0]
  const spend = await fetchAgentTaskSpendDaily(ledger, { tenantId, startDate, endDate, costCenter })
  if (!spend.ok) {
    const status = spend.reason === 'ledger_unavailable' || spend.reason === 'query_failed' ? 503 : 400
    return json({ error: { code: spend.reason, message: 'The chargeback window could not be read.' } }, status)
  }

  const report = buildChargebackExport({
    rows: spend.rows,
    window: { fromDay: startDate, toDay: endDate },
    granularity,
    ...(creditRateUsd === undefined ? {} : { creditRateUsd }),
  })

  // Budget status rides on headers rather than in the file. A CSV that finance
  // imports must contain columns and nothing else; an annotation row would
  // become a phantom cost centre in whatever it is imported into.
  const budgets = await fetchCostCenterBudgets(ledger, { tenantId, startDate, endDate })
  const statuses = evaluateBudgets({ spendByCostCenter: spendByCostCenter(spend.rows), budgets })
  const breaching = statuses.filter((status) => status.state !== 'within')

  return new Response(report.csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${attachmentName(tenantId, startDate, endDate)}"`,
      'Cache-Control': 'no-store',
      // Lets a caller prove the file it filed is the file that was produced,
      // without reading the body back.
      'X-Maha-Content-Hash': report.contentHash,
      'X-Maha-Row-Count': String(report.rowCount),
      'X-Maha-Credits-Total': String(report.totals.credits),
      'X-Maha-Tokens-Saved-Total': String(report.totals.tokensSaved),
      'X-Maha-Budget-Status': breaching.length === 0
        ? 'within'
        : breaching.map((status) => `${status.costCenter}=${status.state}:${status.percentUsed}%`).join(','),
    },
  })
}
