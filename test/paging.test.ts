import assert from 'node:assert/strict'
import test from 'node:test'

import { dedupKey, deliverPagingEvent, isRecovery, pagingEvent } from '../lib/observability/paging.ts'
import type { ReceivedOpsAlert } from '../lib/observability/receiver.ts'

const alert = (overrides: Partial<ReceivedOpsAlert> = {}): ReceivedOpsAlert => ({
  schema: 'maha.ops-alert.v1',
  event: 'release.health_failure',
  eventId: `alert_${'a'.repeat(32)}`,
  occurredAt: '2026-08-03T05:00:00.000Z',
  tenantId: 'tenant_1',
  data: { stage: 'health=failure' },
  ...overrides,
})

test('a failure and its recovery share a deduplication key', () => {
  // Otherwise the recovery opens a second incident instead of closing the
  // first. The event ID cannot serve: it differs between the two.
  assert.equal(dedupKey(alert({ event: 'release.health_failure' })), dedupKey(alert({ event: 'release.health_recovered' })))
  assert.equal(dedupKey(alert({ event: 'release.recovery_drill_failure' })), dedupKey(alert({ event: 'release.recovery_drill_recovered' })))
})

test('distinct incident streams never share a key', () => {
  const keys = new Set([
    dedupKey(alert({ event: 'release.health_failure' })),
    dedupKey(alert({ event: 'release.recovery_drill_failure' })),
    dedupKey(alert({ event: 'tenant.low_credit' })),
    dedupKey(alert({ event: 'mcp.upstream_connectivity_failure' })),
  ])
  assert.equal(keys.size, 4)
})

test('tenant-scoped alerts key per tenant so one cannot mask another', () => {
  const a = dedupKey(alert({ event: 'tenant.low_credit', tenantId: 'tenant_a' }))
  const b = dedupKey(alert({ event: 'tenant.low_credit', tenantId: 'tenant_b' }))
  assert.notEqual(a, b)
})

test('a recovery resolves rather than triggers, and carries no payload', () => {
  const event = pagingEvent(alert({ event: 'release.health_recovered' }), 'rk')
  assert.equal(event.event_action, 'resolve')
  assert.equal(event.payload, undefined)
  assert.equal(isRecovery(alert({ event: 'release.health_recovered' })), true)
  assert.equal(isRecovery(alert({ event: 'release.health_failure' })), false)
})

test('a failure triggers with severity matched to consequence', () => {
  const event = pagingEvent(alert({ event: 'release.health_failure' }), 'rk')
  assert.equal(event.event_action, 'trigger')
  assert.equal(event.payload?.severity, 'critical')
  assert.equal(event.payload?.component, 'release.health_failure')
  assert.equal(event.payload?.timestamp, '2026-08-03T05:00:00.000Z')
  assert.equal(pagingEvent(alert({ event: 'tenant.low_credit' }), 'rk').payload?.severity, 'warning')
  assert.equal(pagingEvent(alert({ event: 'mcp.upstream_connectivity_failure' }), 'rk').payload?.severity, 'error')
})

test('only the bounded alert data is forwarded to the paging provider', () => {
  const event = pagingEvent(alert({ data: { stage: 'health=failure', attempts: 3, controlledTest: true } }), 'rk')
  assert.deepEqual(event.payload?.custom_details, { stage: 'health=failure', attempts: 3, controlledTest: true })
})

test('an unconfigured routing key is reported rather than treated as failure', async () => {
  assert.equal(await deliverPagingEvent(alert(), undefined), 'not_configured')
  assert.equal(await deliverPagingEvent(alert(), '   '), 'not_configured')
})

test('delivery reports success, rejection, and transport failure distinctly', async () => {
  const ok = async () => new Response('', { status: 202 })
  assert.equal(await deliverPagingEvent(alert(), 'rk', ok as typeof fetch), 'delivered')

  const rejected = async () => new Response('bad routing key', { status: 400 })
  assert.equal(await deliverPagingEvent(alert(), 'rk', rejected as typeof fetch), 'failed')

  const thrown = async () => { throw new Error('network down') }
  assert.equal(await deliverPagingEvent(alert(), 'rk', thrown as typeof fetch), 'failed')
})

test('the routing key is sent to PagerDuty and never placed in the summary', async () => {
  let sent = ''
  const capture = async (_url: unknown, init?: RequestInit) => { sent = String(init?.body); return new Response('', { status: 202 }) }
  await deliverPagingEvent(alert(), 'super-secret-routing-key', capture as typeof fetch)
  const body = JSON.parse(sent) as { routing_key: string; payload: { summary: string } }
  assert.equal(body.routing_key, 'super-secret-routing-key')
  assert.equal(body.payload.summary.includes('super-secret-routing-key'), false)
})
