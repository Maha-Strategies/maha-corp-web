import assert from 'node:assert/strict'
import test from 'node:test'

import { REVENUE_PATHS, findSuspectedTypos, getRevenueReadiness, inspectRevenuePath } from '../lib/revenue-readiness.ts'

const path = (id: string) => {
  const found = REVENUE_PATHS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`unknown path ${id}`)
  return found
}

const books = path('books')
const preflight = path('mps_preflight')
const tenantBilling = path('tenant_billing')

const wiredBooks = {
  STRIPE_SECRET_KEY: 'sk_live_x',
  STRIPE_BOOKS_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_BOOK_PRICE_MAP: '{"price_A":"the-imagined-life"}',
}

test('a fully wired and enabled path is ready', () => {
  const result = inspectRevenuePath(books, { ...wiredBooks, BOOK_CHECKOUT_ENABLED: 'true' })
  assert.equal(result.state, 'ready')
  assert.deepEqual(result.missing, [])
})

test('a deliberately dark path is disabled, not a fault', () => {
  // The shared Stripe key is set because other paths need it. That must not be
  // read as evidence that book checkout was being wired.
  const result = inspectRevenuePath(books, { STRIPE_SECRET_KEY: 'sk_live_x', BOOK_CHECKOUT_ENABLED: 'false' })
  assert.equal(result.state, 'disabled')
  assert.equal(getRevenueReadiness({ STRIPE_SECRET_KEY: 'sk_live_x', BOOK_CHECKOUT_ENABLED: 'false' }).faults.includes('books'), false)
})

test('a path wired but never switched on is reported without being a fault', () => {
  const result = inspectRevenuePath(books, { ...wiredBooks, BOOK_CHECKOUT_ENABLED: 'false' })
  assert.equal(result.state, 'configured_not_enabled')
  assert.equal(result.enabled, false)
})

test('a half-wired path is a fault even while switched off', () => {
  const result = inspectRevenuePath(books, { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_BOOKS_WEBHOOK_SECRET: 'whsec_x', BOOK_CHECKOUT_ENABLED: 'false' })
  assert.equal(result.state, 'incomplete')
  assert.deepEqual(result.missing, ['STRIPE_BOOK_PRICE_MAP'])
})

test('a path switched on with variables missing cannot transact', () => {
  const result = inspectRevenuePath(books, { STRIPE_SECRET_KEY: 'sk_live_x', BOOK_CHECKOUT_ENABLED: 'true' })
  assert.equal(result.state, 'enabled_incomplete')
  assert.deepEqual(result.missing, ['STRIPE_BOOKS_WEBHOOK_SECRET', 'STRIPE_BOOK_PRICE_MAP'])
})

test('a flagless path is live once configured and a fault when partial', () => {
  const complete = {
    STRIPE_SECRET_KEY: 'sk', STRIPE_MPS_PREFLIGHT_PRICE_ID: 'price_A', STRIPE_WEBHOOK_SECRET: 'whsec',
    ANTHROPIC_API_KEY: 'sk-ant',
  }
  assert.equal(inspectRevenuePath(preflight, complete).state, 'ready')
  assert.equal(inspectRevenuePath(preflight, complete).enabled, null)
  assert.equal(inspectRevenuePath(preflight, { ...complete, ANTHROPIC_API_KEY: undefined }).state, 'incomplete')
})

test('Preflight email delivery configuration is optional for transaction readiness', () => {
  const complete = {
    STRIPE_SECRET_KEY: 'sk', STRIPE_MPS_PREFLIGHT_PRICE_ID: 'price_A', STRIPE_WEBHOOK_SECRET: 'whsec',
    ANTHROPIC_API_KEY: 'sk-ant', RESEND_API_KEY: undefined, MPS_PREFLIGHT_FROM_EMAIL: undefined,
  }
  const result = inspectRevenuePath(preflight, complete)
  assert.equal(result.state, 'ready')
  assert.deepEqual(result.missing, [])
})

test('tenant subscriptions and automatic top-ups require every Stripe price and the shared webhook', () => {
  const complete = {
    STRIPE_SECRET_KEY: 'sk', STRIPE_API_KEY_WEBHOOK_SECRET: 'whsec',
    STRIPE_TENANT_BUILDER_PRICE_ID: 'price_builder', STRIPE_TENANT_SCALE_PRICE_ID: 'price_scale',
    STRIPE_TENANT_AUTO_TOPUP_PRICE_ID: 'price_topup',
  }
  assert.equal(inspectRevenuePath(tenantBilling, complete).state, 'ready')

  const incomplete = inspectRevenuePath(tenantBilling, { ...complete, STRIPE_TENANT_AUTO_TOPUP_PRICE_ID: undefined })
  assert.equal(incomplete.state, 'incomplete')
  assert.deepEqual(incomplete.missing, ['STRIPE_TENANT_AUTO_TOPUP_PRICE_ID'])
})

test('a near-miss variable name is surfaced against the name it should have been', () => {
  const typos = findSuspectedTypos(['STRIPE_MPS_PREFLIGHT_PRICE_ID'], { STRIPE_MPS_PREFLIGHT_PRICE_I: 'price_A' })
  assert.deepEqual(typos, [{ expected: 'STRIPE_MPS_PREFLIGHT_PRICE_ID', found: 'STRIPE_MPS_PREFLIGHT_PRICE_I' }])
})

test('typo detection ignores unrelated and unset variables', () => {
  assert.deepEqual(findSuspectedTypos(['STRIPE_BOOK_PRICE_MAP'], { PATH: '/usr/bin', HOME: '/root' }), [])
  // Present under the correct name for another path, so not a near miss of this one.
  assert.deepEqual(findSuspectedTypos(['STRIPE_BOOKS_WEBHOOK_SECRET'], { STRIPE_SECRET_KEY: 'sk' }), [])
  // Declared but empty is the same as absent and must not be offered as a fix.
  assert.deepEqual(findSuspectedTypos(['STRIPE_MPS_PREFLIGHT_PRICE_ID'], { STRIPE_MPS_PREFLIGHT_PRICE_I: '   ' }), [])
})

test('the report degrades only on genuine faults and never reports a value', () => {
  const clean = getRevenueReadiness({ STRIPE_SECRET_KEY: 'sk', BOOK_CHECKOUT_ENABLED: 'false', MPS_AUDIT_CREDIT_CHECKOUT_ENABLED: 'false', UTILITY_CHECKOUT_ENABLED: 'false' })
  assert.equal(clean.paths.length, REVENUE_PATHS.length)
  assert.equal(clean.readOnly, true)

  const faulty = getRevenueReadiness({ STRIPE_SECRET_KEY: 'sk', STRIPE_BOOKS_WEBHOOK_SECRET: 'whsec_secret_value', BOOK_CHECKOUT_ENABLED: 'false' })
  assert.equal(faulty.state, 'degraded')
  assert.ok(faulty.faults.includes('books'))
  assert.equal(JSON.stringify(faulty).includes('whsec_secret_value'), false)
  assert.equal(JSON.stringify(faulty).includes('sk'), false)
})

test('every declared path separates its own variables from shared credentials', () => {
  for (const candidate of REVENUE_PATHS) {
    assert.ok(candidate.specific.length > 0, `${candidate.id} has no path-specific variable`)
    assert.equal(candidate.specific.some((name) => candidate.shared.includes(name)), false, `${candidate.id} lists a variable as both`)
  }
})
