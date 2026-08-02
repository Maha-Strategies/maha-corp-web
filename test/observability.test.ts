import assert from 'node:assert/strict'
import test from 'node:test'

import { lowCreditAlertRequired, opsAlertConfig, signOpsAlert } from '../lib/observability/contracts.ts'
import { observabilityReadiness } from '../lib/observability/readiness.ts'
import { opsAlertDeliveryFailure, opsAlertEmail, receiveOpsAlert } from '../lib/observability/receiver.ts'
import { mcpMethodClass } from '../lib/observability/telemetry.ts'
import { scrubSentryPayload, sentryTraceSampleRate } from '../lib/observability/sentry.ts'

const secret = 'a'.repeat(32)

test('operations webhook configuration is HTTPS-only, paired, and bounded', () => {
  assert.equal(opsAlertConfig({}), null)
  assert.throws(() => opsAlertConfig({ MAHA_OPS_WEBHOOK_URL: 'https://alerts.example.test/hook' }), /configured together/)
  assert.throws(() => opsAlertConfig({ MAHA_OPS_WEBHOOK_URL: 'http://alerts.example.test/hook', MAHA_OPS_WEBHOOK_SECRET: secret }), /public HTTPS/)
  assert.throws(() => opsAlertConfig({ MAHA_OPS_WEBHOOK_URL: 'https://localhost/hook', MAHA_OPS_WEBHOOK_SECRET: secret }), /public HTTPS/)
  assert.equal(opsAlertConfig({ MAHA_OPS_WEBHOOK_URL: 'https://alerts.example.test/hook', MAHA_OPS_WEBHOOK_SECRET: secret })?.lowCreditThreshold, 1_000)
})

test('operations webhook signing is deterministic and low-credit threshold is strict', () => {
  assert.equal(signOpsAlert('{"test":true}', secret), signOpsAlert('{"test":true}', secret))
  assert.match(signOpsAlert('{"test":true}', secret), /^sha256=[a-f0-9]{64}$/)
  assert.equal(lowCreditAlertRequired(999, 1_000), true)
  assert.equal(lowCreditAlertRequired(1_000, 1_000), false)
})

test('operations alert receiver authenticates the raw body and rejects replay windows', () => {
  const occurredAt = '2026-08-01T16:30:00.000Z'
  const body = JSON.stringify({
    schema: 'maha.ops-alert.v1', event: 'tenant.low_credit', eventId: `alert_${'b'.repeat(32)}`,
    occurredAt, tenantId: 'tenant_key_canary', data: { remainingCredits: 999, thresholdCredits: 1_000 },
  })
  const headers = new Headers({
    'x-maha-alert-event': 'tenant.low_credit', 'x-maha-alert-id': `alert_${'b'.repeat(32)}`,
    'x-maha-alert-signature': signOpsAlert(body, secret),
  })
  const alert = receiveOpsAlert(body, headers, secret, Date.parse(occurredAt) + 1_000)
  assert.equal(alert.tenantId, 'tenant_key_canary')
  assert.match(opsAlertEmail(alert).subject, /Low tenant credit balance/)
  assert.throws(() => receiveOpsAlert(body, headers, secret, Date.parse(occurredAt) + 16 * 60 * 1_000), /delivery window/)
  headers.set('x-maha-alert-id', `alert_${'c'.repeat(32)}`)
  assert.throws(() => receiveOpsAlert(body, headers, secret, Date.parse(occurredAt)), /headers do not match/)
})

test('operations alert receiver rejects tampering and unbounded detail values', () => {
  const occurredAt = '2026-08-01T16:30:00.000Z'
  const body = JSON.stringify({
    schema: 'maha.ops-alert.v1', event: 'mcp.upstream_connectivity_failure', eventId: `alert_${'d'.repeat(32)}`,
    occurredAt, tenantId: 'tenant_canary', data: { failure: 'timeout' },
  })
  const headers = new Headers({
    'x-maha-alert-event': 'mcp.upstream_connectivity_failure', 'x-maha-alert-id': `alert_${'d'.repeat(32)}`,
    'x-maha-alert-signature': signOpsAlert(`${body} `, secret),
  })
  assert.throws(() => receiveOpsAlert(body, headers, secret, Date.parse(occurredAt)), /signature/)
  const oversized = body.replace('timeout', 'x'.repeat(513))
  headers.set('x-maha-alert-signature', signOpsAlert(oversized, secret))
  assert.throws(() => receiveOpsAlert(oversized, headers, secret, Date.parse(occurredAt)), /invalid value/)
})

test('operations alert delivery failures are reduced to bounded provider categories', () => {
  assert.equal(opsAlertDeliveryFailure({ name: 'validation_error', message: 'The sender domain is not verified.' }), 'sender_domain_unverified')
  assert.equal(opsAlertDeliveryFailure({ name: 'authentication_error', message: 'API key is invalid.' }), 'provider_authentication_failed')
  assert.equal(opsAlertDeliveryFailure({ name: 'rate_limit_exceeded', message: 'Too many requests.' }), 'provider_rate_limited')
  assert.equal(opsAlertDeliveryFailure(new Error('socket closed')), 'provider_request_failed')
})

test('Sentry scrubber removes payload identity and query data while preserving route method', () => {
  const event = scrubSentryPayload({
    event_id: '0123456789abcdef0123456789abcdef', timestamp: 1,
    user: { email: 'private@example.test' }, extra: { apiKey: 'secret' },
    request: { method: 'POST', url: 'https://example.test/api?token=secret', headers: { authorization: 'Bearer secret' }, data: { private: true } },
    exception: { values: [{ type: 'Error', value: 'Bearer secret failed at https://example.test?token=secret' }] },
    breadcrumbs: [{ category: 'fetch', message: 'secret response body', data: { url: 'https://example.test/api?token=secret' } }],
  })
  assert.deepEqual(event.request, { method: 'POST', url: 'https://example.test/api' })
  assert.equal(event.user, undefined)
  assert.equal(event.extra, undefined)
  assert.equal(event.exception?.values?.[0]?.value, 'Application error (details redacted)')
  assert.equal(event.breadcrumbs?.[0]?.message, undefined)
  assert.deepEqual(event.breadcrumbs?.[0]?.data, { url: 'https://example.test/api' })
  assert.equal(sentryTraceSampleRate('2'), 0.1)
})

test('observability readiness and MCP span classification stay credential-safe and low-cardinality', () => {
  const report = observabilityReadiness({ SENTRY_DSN: 'https://public@sentry.example/1', NEXT_PUBLIC_SENTRY_DSN: 'https://public@sentry.example/1', SENTRY_AUTH_TOKEN: 'hidden', SENTRY_ORG: 'maha', SENTRY_PROJECT: 'api', MAHA_OPS_WEBHOOK_URL: 'https://alerts.example.test/hook', MAHA_OPS_WEBHOOK_SECRET: secret })
  assert.equal(report.state, 'ready')
  assert.equal(JSON.stringify(report).includes('hidden'), false)
  assert.equal(mcpMethodClass('tools/list'), 'tools.list')
  assert.equal(mcpMethodClass('customer/arbitrary-high-cardinality-value'), 'custom')
})
