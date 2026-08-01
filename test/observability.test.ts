import assert from 'node:assert/strict'
import test from 'node:test'

import { lowCreditAlertRequired, opsAlertConfig, signOpsAlert } from '../lib/observability/contracts.ts'
import { observabilityReadiness } from '../lib/observability/readiness.ts'
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
