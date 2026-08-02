import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from '../app/api/admin/billing-readiness/route.ts'
import { billingConfigurationPresence, billingLedgerFailureCode, billingLedgerTimestampColumns } from '../lib/billing-readiness.ts'
import { authorizeReadiness } from '../lib/readiness-authorization.ts'

const originalRevenueControlToken = process.env.REVENUE_CONTROL_TOKEN
const originalReleaseHealthToken = process.env.RELEASE_HEALTH_TOKEN

test('billing readiness reports configuration presence without returning configuration values', () => {
  const secret = 'do-not-return-this-secret'
  const report = billingConfigurationPresence({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: secret,
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: secret,
    STRIPE_SECRET_KEY: secret,
    STRIPE_API_KEY_WEBHOOK_SECRET: secret,
    STRIPE_API_CREDITS_STARTER_PRICE_ID: 'price_starter',
    STRIPE_API_CREDITS_PRO_PRICE_ID: 'price_pro',
    STRIPE_API_CREDITS_ENTERPRISE_PRICE_ID: 'price_enterprise',
  })
  assert.equal(report.stripeWebhookSecretConfigured, true)
  assert.equal(report.enterprisePriceConfigured, true)
  assert.equal(JSON.stringify(report).includes(secret), false)
})

test('billing readiness turns database failures into safe operator diagnostic codes', () => {
  assert.equal(billingLedgerFailureCode('PGRST205'), 'ledger_migration_missing_or_schema_cache_stale')
  assert.equal(billingLedgerFailureCode('42501'), 'ledger_access_denied')
  assert.equal(billingLedgerFailureCode('unknown'), 'ledger_table_unavailable')
})

test('billing readiness probes each ledger table using its actual timestamp column', () => {
  assert.deepEqual(billingLedgerTimestampColumns, {
    api_credit_checkouts: 'created_at',
    api_credit_stripe_events: 'processed_at',
    api_credit_ledger_entries: 'created_at',
    api_credit_payment_reversals: 'created_at',
  })
})

test('billing readiness operator route rejects a missing or invalid control token before diagnostics run', async () => {
  try {
    process.env.REVENUE_CONTROL_TOKEN = 'operator-secret'
    const missing = await GET(new Request('https://example.test/api/admin/billing-readiness'))
    assert.equal(missing.status, 401)
    assert.deepEqual(await missing.json(), { error: { code: 'unauthorized', message: 'A valid readiness bearer token is required.' } })
    const invalid = await GET(new Request('https://example.test/api/admin/billing-readiness', { headers: { Authorization: 'Bearer incorrect' } }))
    assert.equal(invalid.status, 401)
    assert.equal(JSON.stringify(await invalid.json()).includes('operator-secret'), false)
  } finally {
    if (originalRevenueControlToken === undefined) delete process.env.REVENUE_CONTROL_TOKEN
    else process.env.REVENUE_CONTROL_TOKEN = originalRevenueControlToken
    if (originalReleaseHealthToken === undefined) delete process.env.RELEASE_HEALTH_TOKEN
    else process.env.RELEASE_HEALTH_TOKEN = originalReleaseHealthToken
  }
})

test('billing readiness accepts the dedicated read-only release-health token', async () => {
  try {
    delete process.env.REVENUE_CONTROL_TOKEN
    process.env.RELEASE_HEALTH_TOKEN = 'release-health-read-only-token-1234567890'
    const authorization = authorizeReadiness(new Request('https://example.test/api/admin/billing-readiness', { headers: { Authorization: `Bearer ${process.env.RELEASE_HEALTH_TOKEN}` } }))
    assert.equal(authorization.kind, 'authorized')
  } finally {
    if (originalRevenueControlToken === undefined) delete process.env.REVENUE_CONTROL_TOKEN
    else process.env.REVENUE_CONTROL_TOKEN = originalRevenueControlToken
    if (originalReleaseHealthToken === undefined) delete process.env.RELEASE_HEALTH_TOKEN
    else process.env.RELEASE_HEALTH_TOKEN = originalReleaseHealthToken
  }
})
