import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChargebackExport, type SpendRow } from '../lib/chargeback-export.ts'

// This file is the reason the exporter is pure. Every property below is
// checkable against fixtures, months before a real row exists, and the
// properties are the product: a chargeback nobody can reconcile is a dispute,
// and reconciliation needs the same window to produce the same bytes every
// time, on every machine.

const WINDOW = { fromDay: '2026-08-01', toDay: '2026-08-31' }

const row = (over: Partial<SpendRow> = {}): SpendRow => ({
  usage_day: '2026-08-02',
  tenant_id: 'tenant_alpha',
  task_id: 'task_001',
  cost_center: 'platform',
  surface: 'compress',
  request_count: 3,
  credits_charged: 7,
  input_tokens_estimated: 22_340,
  output_tokens_estimated: 5_733,
  tokens_saved_estimated: 16_607,
  ...over,
})

const FIXTURE: SpendRow[] = [
  row({ usage_day: '2026-08-03', cost_center: 'growth', task_id: 'task_003', credits_charged: 2, tokens_saved_estimated: 5_000 }),
  row({ usage_day: '2026-08-02', cost_center: 'platform', task_id: 'task_001' }),
  row({ usage_day: '2026-08-02', cost_center: 'growth', task_id: 'task_002', credits_charged: 4, tokens_saved_estimated: 9_000 }),
  // The same task on a second day: one task, two rows, summed at export.
  row({ usage_day: '2026-08-04', cost_center: 'platform', task_id: 'task_001', credits_charged: 1, request_count: 1 }),
]

const lines = (csv: string) => csv.trimEnd().split('\r\n')

// ---------------------------------------------------------------------------
// Reproducibility
// ---------------------------------------------------------------------------

test('the same rows in any order produce identical bytes', () => {
  // The failure this prevents: two exports of one period that differ only by
  // row order, so a finance team reconciling them finds a mismatch that is not
  // a mismatch. Query result order is not guaranteed, so this cannot rely on it.
  const forwards = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'task' })
  const backwards = buildChargebackExport({ rows: [...FIXTURE].reverse(), window: WINDOW, granularity: 'task' })
  const shuffled = buildChargebackExport({ rows: [FIXTURE[2], FIXTURE[0], FIXTURE[3], FIXTURE[1]], window: WINDOW, granularity: 'task' })

  assert.equal(forwards.csv, backwards.csv)
  assert.equal(forwards.csv, shuffled.csv)
  assert.equal(forwards.contentHash, backwards.contentHash)
})

test('the content hash is of the bytes and changes when they do', () => {
  const base = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'task' })
  const altered = buildChargebackExport({
    rows: [...FIXTURE.slice(1), row({ usage_day: '2026-08-03', cost_center: 'growth', task_id: 'task_003', credits_charged: 3 })],
    window: WINDOW, granularity: 'task',
  })

  assert.match(base.contentHash, /^sha256:[a-f0-9]{64}$/)
  assert.notEqual(base.contentHash, altered.contentHash)
  // Not embedded in the file it describes, which would be circular.
  assert.ok(!base.csv.includes(base.contentHash))
})

test('ordering does not depend on locale', () => {
  // localeCompare would sort these differently under a different ICU build,
  // making one machine's export disagree with another's for the same period.
  const rows = [
    row({ cost_center: 'Zebra', task_id: 'task_z' }),
    row({ cost_center: 'apple', task_id: 'task_a' }),
    row({ cost_center: 'Apple', task_id: 'task_A' }),
  ]
  const csv = buildChargebackExport({ rows, window: WINDOW, granularity: 'task' }).csv
  const centres = lines(csv).slice(1).map((line) => line.split(',')[2])
  // Code-unit order: uppercase before lowercase, always and everywhere.
  assert.deepEqual(centres, ['Apple', 'Zebra', 'apple'])
})

test('a file ends with a newline so two hashes of one content agree', () => {
  const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW })
  assert.ok(csv.endsWith('\r\n'))
})

// ---------------------------------------------------------------------------
// What the numbers mean
// ---------------------------------------------------------------------------

test('cost-centre rows aggregate across days and count a task once', () => {
  const { csv, rowCount } = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'cost_center' })
  const [header, ...body] = lines(csv)

  assert.equal(header, 'cost_center,tasks,requests,credits_charged,input_tokens_estimated,output_tokens_estimated,tokens_saved_estimated')
  assert.equal(rowCount, 2)
  // growth: two tasks, 2 + 4 credits.
  assert.equal(body[0], 'growth,2,6,6,44680,11466,14000')
  // platform: task_001 appears on two days and is still one task; 7 + 1 credits.
  assert.equal(body[1], 'platform,1,4,8,44680,11466,33214')
})

test('totals cover the window, not the granularity', () => {
  const task = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'task' })
  const centre = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'cost_center' })
  // Same facts, two presentations. Totals that disagreed would mean one view
  // is lying about the period.
  assert.deepEqual(task.totals, centre.totals)
  assert.equal(task.totals.credits, 14)
  assert.equal(task.totals.tokensSaved, 47_214)
})

test('rows outside the window are dropped rather than trusted', () => {
  // The caller queried a window; a stray day would be reconciled against a
  // period that does not contain it.
  const rows = [...FIXTURE, row({ usage_day: '2026-07-31', task_id: 'task_early' }), row({ usage_day: '2026-09-01', task_id: 'task_late' })]
  const { csv, totals } = buildChargebackExport({ rows, window: WINDOW, granularity: 'task' })
  assert.ok(!csv.includes('task_early'))
  assert.ok(!csv.includes('task_late'))
  assert.equal(totals.credits, 14)
})

test('numeric columns arriving as strings from Postgres still add up', () => {
  // numeric(18,0) comes back as a string. Concatenating instead of adding is
  // the classic version of this bug and it inflates an invoice silently.
  const rows = [row({ credits_charged: '7', tokens_saved_estimated: '16607', request_count: '3' })]
  const { totals } = buildChargebackExport({ rows, window: WINDOW })
  assert.equal(totals.credits, 7)
  assert.equal(totals.tokensSaved, 16_607)
  assert.equal(totals.requests, 3)
})

test('an empty window produces a header and nothing else', () => {
  const { csv, rowCount, totals } = buildChargebackExport({ rows: [], window: WINDOW })
  assert.equal(rowCount, 0)
  assert.equal(totals.credits, 0)
  assert.equal(lines(csv).length, 1)
})

// ---------------------------------------------------------------------------
// Money, and the refusal to invent it
// ---------------------------------------------------------------------------

test('no money column exists unless a rate is stated', () => {
  // Two pack prices exist ($0.002 Builder, $0.00167 Scale) and correct
  // valuation needs lot accounting that does not exist. A plausible default
  // would be quoted as the customer's actual cost.
  const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW })
  assert.ok(!csv.includes('cost_usd'))
  assert.ok(!csv.includes('$'))
})

test('a stated rate adds one column, valued at that rate', () => {
  const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity: 'cost_center', creditRateUsd: 0.002 })
  const [header, ...body] = lines(csv)
  assert.ok(header.endsWith(',cost_usd'))
  // growth: 6 credits x $0.002 = $0.012, printed to cents as 0.01.
  assert.ok(body[0].endsWith(',0.01'))
  // platform: 8 credits x $0.002 = $0.016 -> 0.02.
  assert.ok(body[1].endsWith(',0.02'))
})

test('money is fixed to cents rather than printed as a float', () => {
  const { csv } = buildChargebackExport({
    rows: [row({ credits_charged: 3, cost_center: 'a' })], window: WINDOW, granularity: 'cost_center', creditRateUsd: 0.1,
  })
  // 3 * 0.1 is 0.30000000000000004 in binary floating point.
  assert.ok(lines(csv)[1].endsWith(',0.30'), lines(csv)[1])
})

test('a nonsensical rate is treated as no rate at all', () => {
  for (const creditRateUsd of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW, creditRateUsd })
    assert.ok(!csv.includes('cost_usd'), `rate ${creditRateUsd} must not produce a money column`)
  }
})

test('tokens saved is never converted to money', () => {
  // It would need the customer's own model input price. The $3/M reference in
  // the benchmarks is a reference, and printing it on an invoice turns a caveat
  // into a claim.
  const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW, creditRateUsd: 0.002 })
  assert.ok(csv.includes('tokens_saved_estimated'))
  assert.ok(!csv.includes('savings_usd'))
  assert.ok(!csv.includes('value_usd'))
})

// ---------------------------------------------------------------------------
// The file is opened in a spreadsheet
// ---------------------------------------------------------------------------

test('a field a spreadsheet would execute is neutralised', () => {
  // tenant_id is only length-checked in the schema, so a leading '=' can reach
  // here. Excel and Sheets would run it as a formula in a finance workbook.
  const rows = [row({ tenant_id: '=cmd|calc!A1', task_id: 'task_x' })]
  const { csv } = buildChargebackExport({ rows, window: WINDOW, granularity: 'task' })
  assert.ok(csv.includes("'=cmd|calc!A1"), csv)
  assert.ok(!/,=cmd/.test(csv))
})

test('a delimiter or quote inside a field is escaped per RFC 4180', () => {
  const rows = [row({ tenant_id: 'tenant,with"quote', task_id: 'task_x' })]
  const { csv } = buildChargebackExport({ rows, window: WINDOW, granularity: 'task' })
  assert.ok(csv.includes('"tenant,with""quote"'), csv)
  // Still one data row: the embedded comma did not split it.
  assert.equal(lines(csv).length, 2)
})

test('every data row has the same field count as the header', () => {
  // A ragged CSV imports silently and misaligns columns, which is how spend
  // lands against the wrong department without anyone noticing.
  for (const granularity of ['task', 'cost_center'] as const) {
    for (const creditRateUsd of [undefined, 0.002]) {
      const { csv } = buildChargebackExport({ rows: FIXTURE, window: WINDOW, granularity, creditRateUsd })
      const parsed = lines(csv).map(splitCsv)
      const width = parsed[0].length
      for (const [index, fields] of parsed.entries()) {
        assert.equal(fields.length, width, `${granularity} row ${index} has ${fields.length} fields, expected ${width}`)
      }
    }
  }
})

/** Minimal RFC 4180 reader, so the test parses the file rather than trusting it. */
function splitCsv(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') { current += '"'; index += 1 }
      else if (character === '"') quoted = false
      else current += character
    } else if (character === '"') quoted = true
    else if (character === ',') { fields.push(current); current = '' }
    else current += character
  }
  fields.push(current)
  return fields
}
