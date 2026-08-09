import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COST_CENTER_HEADER,
  TASK_ID_HEADER,
  UNALLOCATED,
  isAttributable,
  resolveTaskAttribution,
} from '../lib/agent-task-attribution.ts'
import { recordAgentTaskSpend } from '../lib/agent-task-spend.ts'

// Cost centre and task identifier are supplied by the caller, so the whole
// surface is untrusted input feeding an invoice. The failure that matters is
// not a missing row -- it is a row attributed to the wrong department, which is
// wrong rather than merely incomplete, and which nobody notices until finance
// disputes it.

const headers = (values: Record<string, string>) => new Headers(values)

test('a call with no attribution headers is unallocated, not broken', () => {
  const attribution = resolveTaskAttribution(headers({}))
  assert.equal(attribution.taskId, null)
  assert.equal(attribution.costCenter, UNALLOCATED)
  assert.equal(attribution.rejectedTaskId, false)
  assert.equal(attribution.rejectedCostCenter, false)
})

test('the request header wins over the credential default', () => {
  // One agent serving several departments is the case this exists for.
  const attribution = resolveTaskAttribution(
    headers({ [TASK_ID_HEADER]: 'task_9f2', [COST_CENTER_HEADER]: 'growth' }),
    'platform',
  )
  assert.equal(attribution.costCenter, 'growth')
})

test('the credential default applies when no header is sent', () => {
  const attribution = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: 'task_9f2' }), 'platform')
  assert.equal(attribution.costCenter, 'platform')
})

test('a malformed cost centre falls through instead of becoming a bucket', () => {
  // The failure prevented: a typo silently creating a department, or worse,
  // landing spend on a different one. Falling through to the credential default
  // is incomplete; inventing a bucket is wrong.
  const attribution = resolveTaskAttribution(
    headers({ [TASK_ID_HEADER]: 'task_9f2', [COST_CENTER_HEADER]: 'growth team; drop table' }),
    'platform',
  )
  assert.equal(attribution.costCenter, 'platform')
  assert.equal(attribution.rejectedCostCenter, true)
})

test('a malformed credential default is refused too', () => {
  const attribution = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: 'task_9f2' }), 'not a cost centre!')
  assert.equal(attribution.costCenter, UNALLOCATED)
})

test('rejection is reported separately from absence', () => {
  // A customer whose identifiers are being dropped has to be able to find out.
  // Absent and malformed lead to the same fallback but to different
  // conversations.
  const absent = resolveTaskAttribution(headers({}))
  const malformed = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: 'has spaces' }))
  assert.equal(absent.rejectedTaskId, false)
  assert.equal(malformed.rejectedTaskId, true)
  assert.equal(malformed.taskId, null)
})

test('identifiers are constrained to what the column will accept', () => {
  // These mirror the check constraints in 20260809000300_agent_task_spend.sql.
  // A value accepted here and rejected by Postgres would be a silently lost row.
  const accepted = ['a', 'task_9f2', 'run-2026.08.09', 'trace:abc.def-1', 'A'.repeat(128)]
  for (const value of accepted) {
    assert.equal(resolveTaskAttribution(headers({ [TASK_ID_HEADER]: value })).taskId, value, value)
  }

  const refused = ['', ' ', '_leading', '-leading', '.leading', 'has space', 'quote"', "quote'", 'semi;colon', 'a'.repeat(129)]
  for (const value of refused) {
    const attribution = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: value }))
    assert.equal(attribution.taskId, null, `expected ${JSON.stringify(value)} to be refused`)
  }
})

test('non-Latin-1 and control characters cannot reach the resolver at all', () => {
  // Header values are ByteStrings, so an emoji or a newline is refused by the
  // transport before any of this runs. Worth pinning: it means the charset
  // check is a second line of defence rather than the only one, and that no
  // caller can smuggle a line break into a CSV export through this header.
  for (const value of ['emoji🧠', 'new\nline', 'carriage\rreturn']) {
    assert.throws(() => headers({ [TASK_ID_HEADER]: value }), `expected ${JSON.stringify(value)} to be refused by Headers`)
  }
})

test('a cost centre is held to a shorter bound than a task', () => {
  assert.equal(resolveTaskAttribution(headers({ [COST_CENTER_HEADER]: 'c'.repeat(64) })).costCenter, 'c'.repeat(64))
  assert.equal(resolveTaskAttribution(headers({ [COST_CENTER_HEADER]: 'c'.repeat(65) })).costCenter, UNALLOCATED)
})

test('surrounding whitespace is trimmed rather than making a second bucket', () => {
  // ' growth' and 'growth' billing separately would split one department's
  // spend across two lines for no reason a customer could see.
  const padded = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: '  task_9f2  ', [COST_CENTER_HEADER]: ' growth ' }))
  assert.equal(padded.taskId, 'task_9f2')
  assert.equal(padded.costCenter, 'growth')
})

test('a call without a task identifier writes no row', () => {
  // A row keyed on the tenant alone duplicates the existing daily meter and
  // puts a line on an invoice nobody can act on.
  assert.equal(isAttributable(resolveTaskAttribution(headers({})), 'tenant_1'), false)
  assert.equal(isAttributable(resolveTaskAttribution(headers({ [TASK_ID_HEADER]: 'task_1' })), 'tenant_1'), true)
})

test('a task without a tenant writes no row either', () => {
  const attribution = resolveTaskAttribution(headers({ [TASK_ID_HEADER]: 'task_1' }))
  for (const tenant of [null, undefined, '', '   ']) {
    assert.equal(isAttributable(attribution, tenant), false)
  }
})

// ---------------------------------------------------------------------------
// The write itself
// ---------------------------------------------------------------------------

function ledgerSpy(behaviour: 'ok' | 'error' | 'throw' = 'ok') {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  return {
    calls,
    ledger: {
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args })
        if (behaviour === 'throw') throw new Error('ledger exploded')
        return Promise.resolve({ error: behaviour === 'error' ? { message: 'boom' } : null })
      },
    },
  }
}

const spend = {
  tenantId: 'tenant_1', taskId: 'task_9f2', costCenter: 'growth', surface: 'compress' as const,
  creditsCharged: 4, inputTokens: 22_340, outputTokens: 5_733, tokensSaved: 16_607,
}

test('a spend row carries the figures the export will sum', async () => {
  const spy = ledgerSpy()
  await recordAgentTaskSpend({ ...spend, ledger: spy.ledger })

  assert.equal(spy.calls.length, 1)
  assert.equal(spy.calls[0].name, 'record_agent_task_spend')
  assert.deepEqual(spy.calls[0].args, {
    p_tenant_id: 'tenant_1', p_task_id: 'task_9f2', p_cost_center: 'growth', p_surface: 'compress',
    p_credits_charged: 4, p_input_tokens: 22_340, p_output_tokens: 5_733, p_tokens_saved: 16_607,
  })
})

test('a ledger failure is swallowed, because a report is not worth a failed request', async () => {
  for (const behaviour of ['error', 'throw'] as const) {
    const spy = ledgerSpy(behaviour)
    await assert.doesNotReject(() => recordAgentTaskSpend({ ...spend, ledger: spy.ledger }))
  }
  // No ledger configured at all is also survivable.
  await assert.doesNotReject(() => recordAgentTaskSpend({ ...spend, ledger: null }))
})

test('an unattributable row is refused before the round trip', async () => {
  const spy = ledgerSpy()
  await recordAgentTaskSpend({ ...spend, tenantId: '  ', ledger: spy.ledger })
  await recordAgentTaskSpend({ ...spend, taskId: '', ledger: spy.ledger })
  assert.equal(spy.calls.length, 0)
})

test('negative and fractional volumes are normalized rather than stored', async () => {
  // numeric(18,0) columns with >= 0 checks. A fractional token count would be
  // rounded by Postgres anyway; a negative one would be rejected and lose the
  // whole row, so it is clamped here where the loss is visible in one test.
  const spy = ledgerSpy()
  await recordAgentTaskSpend({ ...spend, creditsCharged: -5, tokensSaved: 1.6, ledger: spy.ledger })
  assert.equal(spy.calls[0].args.p_credits_charged, 0)
  assert.equal(spy.calls[0].args.p_tokens_saved, 2)
})
