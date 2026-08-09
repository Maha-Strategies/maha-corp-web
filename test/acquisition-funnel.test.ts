import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAcquisitionFunnel, trailingWindow, type FunnelWindow } from '../lib/acquisition-funnel.ts'

// The failure this funnel exists to avoid is reporting a confident zero for a
// stage nobody is measuring. A zero says the thing did not happen; unavailable
// says nobody knows, and an operator acts on those differently -- one prompts
// "fix the product", the other prompts "fix the meter".

const WINDOW: FunnelWindow = { fromDay: '2026-08-01', toDay: '2026-08-09' }

type Row = Record<string, unknown>

/** Minimal stand-in for the ledger's query surface. */
function ledgerOf(tables: Record<string, Row[] | 'error'>) {
  return {
    from: (table: string) => ({
      select: () => ({
        gte: () => ({
          lte: async () => {
            const value = tables[table]
            if (value === undefined) return { data: [], error: null }
            if (value === 'error') return { data: null, error: { message: 'boom' } }
            return { data: value, error: null }
          },
        }),
      }),
    }),
  }
}

const usage = (credential: string, day: string, statusClass = '2xx', accessMode = 'api_key', count = 1) =>
  ({ usage_day: day, access_mode: accessMode, credential_id: credential, status_class: statusClass, request_count: count })

test('a missing meter is unavailable, never zero', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    agent_discovery_usage_daily: 'error',
    context_compiler_usage_daily: 'error',
  }), WINDOW)

  assert.equal(report.stages.discovery.available, false)
  assert.equal(report.stages.activated.available, false)
  if (!report.stages.activated.available) assert.match(report.stages.activated.reason, /unreadable/)
  // The distinction that matters: no number is reported at all, rather than 0.
  assert.ok(!('count' in report.stages.discovery))
})

test('no ledger at all yields a fully unavailable report rather than an empty funnel', async () => {
  const report = await buildAcquisitionFunnel(null, WINDOW)
  for (const stage of Object.values(report.stages)) assert.equal(stage.available, false)
  assert.equal(report.ratios.credentialToActivated, null)
})

test('activation counts credentials that succeeded, not credentials that were issued', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    agent_client_credentials: [{ public_id: 'a' }, { public_id: 'b' }, { public_id: 'c' }],
    context_compiler_usage_daily: [usage('a', '2026-08-02'), usage('b', '2026-08-02')],
  }), WINDOW)

  assert.deepEqual(report.stages.credentialsCreated, { available: true, count: 3 })
  // 'c' was issued and never used. That gap is the point of the stage.
  assert.deepEqual(report.stages.activated, { available: true, count: 2 })
  assert.equal(report.ratios.credentialToActivated, 0.6667)
})

test('a failed call does not count as activation', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    context_compiler_usage_daily: [usage('a', '2026-08-02', '4xx'), usage('b', '2026-08-02', '5xx')],
  }), WINDOW)
  assert.deepEqual(report.stages.activated, { available: true, count: 0 })
})

test('repeat use means a second day, not a second call', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    context_compiler_usage_daily: [
      // Twelve calls in one sitting is one evaluation.
      usage('burst', '2026-08-02', '2xx', 'api_key', 12),
      // Two separate days is the retention signal.
      usage('returner', '2026-08-02'), usage('returner', '2026-08-05'),
    ],
  }), WINDOW)

  assert.deepEqual(report.stages.activated, { available: true, count: 2 })
  assert.deepEqual(report.stages.repeated, { available: true, count: 1 })
})

test('anonymous and x402 traffic never inflates credential activation', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    context_compiler_usage_daily: [
      usage('', '2026-08-02', '2xx', 'anonymous', 40),
      usage('', '2026-08-03', '2xx', 'x402', 5),
      usage('a', '2026-08-02'),
    ],
  }), WINDOW)

  // Credentialless rows share the empty-string key and must not collapse into
  // a phantom credential.
  assert.deepEqual(report.stages.activated, { available: true, count: 1 })
  assert.deepEqual(report.stages.anonymousSuccess, { available: true, count: 40 })
})

test('paid autonomous counts distinct payers, case-insensitively', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    x402_payments: [{ payer: '0xABC' }, { payer: '0xabc' }, { payer: '0xDEF' }],
  }), WINDOW)
  // One wallet writing its address two ways is one buyer, and the difference
  // decides whether the endpoint looks like it has traction.
  assert.deepEqual(report.stages.paidAutonomous, { available: true, count: 2 })
})

test('a ratio is null rather than infinite or zero when the denominator is empty', async () => {
  const report = await buildAcquisitionFunnel(ledgerOf({
    agent_discovery_usage_daily: [],
    agent_client_credentials: [{ public_id: 'a' }],
  }), WINDOW)
  assert.equal(report.ratios.discoveryToCredential, null)
})

test('every report states that its ratios are cohorts, not journeys', async () => {
  const report = await buildAcquisitionFunnel(null, WINDOW)
  // Carried on the report itself so a consumer cannot render the numbers
  // without the caveat that makes them honest.
  assert.match(report.interpretation, /not tracked journeys/i)
  assert.match(report.interpretation, /no visitor identifier/i)
})

test('the trailing window is inclusive of today and the requested span', () => {
  const window = trailingWindow(7, new Date('2026-08-09T12:00:00Z'))
  assert.equal(window.toDay, '2026-08-09')
  assert.equal(window.fromDay, '2026-08-03')
})
