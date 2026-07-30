import assert from 'node:assert/strict'
import test from 'node:test'

import { MahaApiError, MahaAuthenticationError, MahaClient } from '../lib/sdk/index.ts'

const originalFetch = globalThis.fetch

test('SDK retries rate limits and returns the successful response', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return calls === 1
      ? new Response(JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down.' } }), { status: 429, headers: { 'Retry-After': '0.001' } })
      : new Response(JSON.stringify({ balance_credits: 123 }), { status: 200 })
  }
  try {
    const started = Date.now()
    const balance = await new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).getBalance()
    assert.deepEqual(balance, { balance_credits: 123 })
    assert.equal(calls, 2)
    assert.ok(Date.now() - started >= 1, 'Retry-After backoff was not applied')
  } finally { globalThis.fetch = originalFetch }
})

test('SDK maps invalid credentials and exhausted credits to typed authentication errors', async () => {
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'invalid_api_key', message: 'Invalid key.' } }), { status: 401 })
    await assert.rejects(() => new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).getBalance(), (error: unknown) => error instanceof MahaAuthenticationError && error.status === 401)

    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'credit_balance_depleted', message: 'No credits.' } }), { status: 402 })
    await assert.rejects(() => new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).getBalance(), (error: unknown) => error instanceof MahaAuthenticationError && error.status === 402)

    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'server_error', message: 'Try again.' } }), { status: 500 })
    await assert.rejects(() => new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).getBalance(), (error: unknown) => error instanceof MahaApiError && error.status === 500)
  } finally { globalThis.fetch = originalFetch }
})
