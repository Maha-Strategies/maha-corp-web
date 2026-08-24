import assert from 'node:assert/strict'
import test from 'node:test'

import { ISOLATION_POLICY, auditEnvironmentIsolation, tierFor, type EnvironmentVariable } from '../lib/environment-isolation.ts'

// One Vercel record covering both environments is one value used by both.
const both = (key: string): EnvironmentVariable => ({ key, targets: ['production', 'preview'] })
const prodOnly = (key: string): EnvironmentVariable => ({ key, targets: ['production'] })
const previewOnly = (key: string): EnvironmentVariable => ({ key, targets: ['preview'] })
// Two separate records are two values.
const isolatedPair = (key: string): EnvironmentVariable[] => [prodOnly(key), previewOnly(key)]

test('a credential defined once for both environments is a violation', () => {
  const report = auditEnvironmentIsolation([both('SUPABASE_SERVICE_ROLE_KEY'), both('MPS_OPERATIONS_TOKEN')])
  assert.equal(report.ok, false)
  assert.deepEqual(report.violations.map((f) => f.key).sort(), ['MPS_OPERATIONS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY'])
  assert.equal(report.violations.every((f) => f.state === 'shared'), true)
})

test('a credential defined separately per environment passes', () => {
  const report = auditEnvironmentIsolation(isolatedPair('SUPABASE_SERVICE_ROLE_KEY'))
  assert.equal(report.ok, true)
  assert.deepEqual(report.violations, [])
  assert.deepEqual(report.isolated, ['SUPABASE_SERVICE_ROLE_KEY'])
})

test('metered third-party keys warn rather than fail', () => {
  // Sharing bills Production for Preview usage but grants no access to
  // Production's own data, so it should not block.
  const report = auditEnvironmentIsolation([both('ANTHROPIC_API_KEY')])
  assert.equal(report.ok, true)
  assert.deepEqual(report.warnings.map((f) => f.key), ['ANTHROPIC_API_KEY'])
})

test('a credential unset in Preview warns but is not treated as a leak', () => {
  const report = auditEnvironmentIsolation([prodOnly('PAGERDUTY_ROUTING_KEY')])
  assert.equal(report.ok, true)
  assert.deepEqual(report.warnings.map((f) => [f.key, f.state]), [['PAGERDUTY_ROUTING_KEY', 'missing_preview']])
})

test('a credential present only in Preview is reported too', () => {
  const report = auditEnvironmentIsolation([previewOnly('MCP_ENCRYPTION_KEY')])
  assert.deepEqual(report.warnings.map((f) => [f.key, f.state]), [['MCP_ENCRYPTION_KEY', 'missing_production']])
})

test('unlisted variables are treated as configuration and only reported', () => {
  const report = auditEnvironmentIsolation([both('SENTRY_ORG'), both('SOME_NEW_FLAG')])
  assert.equal(report.ok, true)
  assert.deepEqual(report.violations, [])
  assert.deepEqual(report.unclassified.sort(), ['SENTRY_ORG', 'SOME_NEW_FLAG'])
})

test('the report carries names and verdicts only, never a value', () => {
  // The audit never receives a value, so none can escape. This holds the
  // property in place if the input type is ever widened.
  const report = auditEnvironmentIsolation([both('STRIPE_SECRET_KEY'), ...isolatedPair('RESEND_API_KEY')])
  const serialized = JSON.stringify(report)
  assert.equal(serialized.includes('sk_'), false)
  assert.equal(serialized.includes('STRIPE_SECRET_KEY'), true)
  assert.deepEqual(Object.keys(report.violations[0]).sort(), ['key', 'state', 'tier'])
})

test('the policy classifies the credentials this platform actually holds', () => {
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'CDP_API_KEY_SECRET', 'MAHA_WORKER_TOKEN', 'MCP_ENCRYPTION_KEY', 'PAGERDUTY_ROUTING_KEY', 'REVENUE_CONTROL_TOKEN', 'PRACTITIONER_REVIEW_TOKEN', 'CELESTIAL_REGISTRY_TOKEN', 'EPISTEMIC_OPERATIONS_TOKEN']) {
    assert.equal(tierFor(key), 'must_differ', `${key} must be isolated`)
  }
  // Vercel manages one bypass secret per project; demanding two would be wrong.
  assert.equal(tierFor('VERCEL_AUTOMATION_BYPASS_SECRET'), 'may_share')
  // Telemetry configuration is not a credential to this system.
  assert.equal(tierFor('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'), 'may_share')
})

test('every policy entry names a real variable convention', () => {
  for (const key of Object.keys(ISOLATION_POLICY)) {
    assert.match(key, /^[A-Z][A-Z0-9_]*$/, `${key} is not an environment variable name`)
  }
})
