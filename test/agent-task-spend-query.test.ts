import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchAgentTaskSpendDaily, fetchCostCenterBudgets } from '../lib/agent-task-spend-query.ts'

// Every query here is tenant-scoped, and the failure that matters is not a slow
// report -- it is one customer's task identifiers and department names landing
// in another customer's invoice. That is a data breach wearing a reporting
// bug's clothes, so the filter is asserted rather than assumed.

type Filter = { column: string; value: string }

function ledgerSpy(rows: unknown, error: unknown = null) {
  const filters: Filter[] = []
  let table = ''
  let columns = ''
  const ledger = {
    from: (name: string) => {
      table = name
      return {
        select: (selected: string) => {
          columns = selected
          return {
            eq: (column: string, value: string) => {
              filters.push({ column, value })
              return {
                gte: (gteColumn: string, gteValue: string) => {
                  filters.push({ column: gteColumn, value: gteValue })
                  return {
                    lte: (lteColumn: string, lteValue: string) => {
                      filters.push({ column: lteColumn, value: lteValue })
                      return Promise.resolve({ data: rows, error })
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
  return { ledger, filters: () => filters, table: () => table, columns: () => columns }
}

const row = (over: Record<string, unknown> = {}) => ({
  usage_day: '2026-08-02', tenant_id: 'tenant_alpha', task_id: 'task_001',
  cost_center: 'platform', surface: 'compress', request_count: 1,
  credits_charged: 4, input_tokens_estimated: 100, output_tokens_estimated: 40,
  tokens_saved_estimated: 60, ...over,
})

const WINDOW = { tenantId: 'tenant_alpha', startDate: '2026-08-01', endDate: '2026-08-31' }

test('the query is always scoped to one tenant', async () => {
  const spy = ledgerSpy([row()])
  await fetchAgentTaskSpendDaily(spy.ledger, WINDOW)

  assert.equal(spy.table(), 'agent_task_spend_daily')
  assert.deepEqual(spy.filters()[0], { column: 'tenant_id', value: 'tenant_alpha' })
  assert.deepEqual(spy.filters().slice(1), [
    { column: 'usage_day', value: '2026-08-01' },
    { column: 'usage_day', value: '2026-08-31' },
  ])
})

test('a malformed window is refused rather than widened', async () => {
  // Coercing a bad date to "all time" would bill a customer for a period
  // nobody asked about, and it would look like a successful export.
  for (const window of [
    { ...WINDOW, startDate: 'yesterday' },
    { ...WINDOW, endDate: '2026-8-1' },
    { ...WINDOW, startDate: '' },
    { ...WINDOW, startDate: '2026-09-01', endDate: '2026-08-01' },
  ]) {
    const result = await fetchAgentTaskSpendDaily(ledgerSpy([]).ledger, window)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, 'invalid_window')
  }
})

test('an empty tenant is refused before any query runs', async () => {
  const spy = ledgerSpy([row()])
  const result = await fetchAgentTaskSpendDaily(spy.ledger, { ...WINDOW, tenantId: '  ' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'invalid_tenant')
  assert.equal(spy.table(), '', 'no query should have been issued')
})

test('a missing ledger is distinguishable from a failed query', async () => {
  const absent = await fetchAgentTaskSpendDaily(null, WINDOW)
  assert.equal(absent.ok, false)
  if (!absent.ok) assert.equal(absent.reason, 'ledger_unavailable')

  const failed = await fetchAgentTaskSpendDaily(ledgerSpy(null, { message: 'boom' }).ledger, WINDOW)
  assert.equal(failed.ok, false)
  if (!failed.ok) assert.equal(failed.reason, 'query_failed')
})

test('a throwing ledger is caught rather than surfacing as a crash', async () => {
  const exploding = { from: () => { throw new Error('connection reset') } } as never
  const result = await fetchAgentTaskSpendDaily(exploding, WINDOW)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'query_failed')
})

test('rows come back in the same total order the exporter applies', async () => {
  const rows = [
    row({ usage_day: '2026-08-03', task_id: 'task_c', surface: 'jobs' }),
    row({ usage_day: '2026-08-02', task_id: 'task_b', surface: 'gateway' }),
    row({ usage_day: '2026-08-02', task_id: 'task_a', surface: 'compress' }),
  ]
  const result = await fetchAgentTaskSpendDaily(ledgerSpy(rows).ledger, WINDOW)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.rows.map((entry) => `${entry.usage_day}/${entry.surface}/${entry.task_id}`),
    ['2026-08-02/compress/task_a', '2026-08-02/gateway/task_b', '2026-08-03/jobs/task_c'],
  )
})

test('a cost-centre narrowing keeps only that centre', async () => {
  const rows = [row({ cost_center: 'platform' }), row({ cost_center: 'growth', task_id: 'task_g' })]
  const result = await fetchAgentTaskSpendDaily(ledgerSpy(rows).ledger, { ...WINDOW, costCenter: 'growth' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.rows.map((entry) => entry.cost_center), ['growth'])
})

test('a non-array payload yields no rows rather than throwing', async () => {
  const result = await fetchAgentTaskSpendDaily(ledgerSpy({ unexpected: true }).ledger, WINDOW)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.rows, [])
})

test('a failed budget lookup degrades to no annotations, not to no export', async () => {
  // A chargeback file without budget decoration is still a correct financial
  // record. Withholding it because a budget query failed would be worse.
  assert.deepEqual(await fetchCostCenterBudgets(ledgerSpy(null, { message: 'boom' }).ledger, WINDOW), [])
  assert.deepEqual(await fetchCostCenterBudgets(null, WINDOW), [])
  assert.deepEqual(await fetchCostCenterBudgets(ledgerSpy([]).ledger, { ...WINDOW, startDate: 'nope' }), [])
})

test('budgets are read for the tenant and overlapping period only', async () => {
  const spy = ledgerSpy([{ cost_center: 'platform', credit_limit: 1_000, alert_at_percent: 80 }])
  const budgets = await fetchCostCenterBudgets(spy.ledger, WINDOW)

  assert.equal(spy.table(), 'agent_cost_center_budgets')
  assert.deepEqual(spy.filters()[0], { column: 'tenant_id', value: 'tenant_alpha' })
  // Overlap, not containment: a budget period straddling the window still applies.
  assert.deepEqual(spy.filters()[1], { column: 'period_end', value: '2026-08-01' })
  assert.deepEqual(spy.filters()[2], { column: 'period_start', value: '2026-08-31' })
  assert.equal(budgets.length, 1)
})
