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

test('SDK preserves legacy string error messages during a deployment transition', async () => {
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Missing required X-Tenant-ID header' }), { status: 400 })
    await assert.rejects(
      () => new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).mcp.registerServer({ name: 'Test', baseUrl: 'https://example.test', authType: 'none' }),
      (error: unknown) => error instanceof MahaApiError && error.status === 400 && error.message === 'Missing required X-Tenant-ID header',
    )
  } finally { globalThis.fetch = originalFetch }
})

test('SDK exposes MCP discovery and tenant SLA controls', async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined })
    if (String(input).endsWith('/discover') || init?.method === 'PATCH') return new Response(JSON.stringify({ server: { serverId: 'mcp_srv_0123456789abcdef', name: 'Modal', baseUrl: 'https://example.test', createdAt: 1, status: 'active', policy: { allowedMethods: ['tools/list'], allowedToolNames: [], mode: 'explicit' }, discovery: { status: 'ready', tools: [] } } }), { status: 200 })
    if (init?.method === 'POST') return new Response(JSON.stringify({ settings: { requestsPerMinute: 90, timeoutMs: 8000, failureThreshold: 4, cooldownMs: 45000 } }), { status: 200 })
    return new Response(JSON.stringify({ settings: { requestsPerMinute: 60, timeoutMs: 10000, failureThreshold: 3, cooldownMs: 30000 } }), { status: 200 })
  }
  try {
    const mcp = new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).mcp
    assert.equal((await mcp.discoverTools('mcp_srv_0123456789abcdef')).discovery.status, 'ready')
    assert.deepEqual((await mcp.updateServerPolicy('mcp_srv_0123456789abcdef', { allowedMethods: ['tools/list'], allowedToolNames: [] })).policy.allowedMethods, ['tools/list'])
    assert.equal((await mcp.getSettings()).timeoutMs, 10000)
    assert.equal((await mcp.updateSettings({ requestsPerMinute: 90, timeoutMs: 8000, failureThreshold: 4, cooldownMs: 45000 })).requestsPerMinute, 90)
    assert.equal(requests[0].url, 'https://example.test/api/v1/mcp/servers/mcp_srv_0123456789abcdef/discover')
    assert.deepEqual(JSON.parse(requests[3].body ?? '{}'), { requestsPerMinute: 90, timeoutMs: 8000, failureThreshold: 4, cooldownMs: 45000 })
  } finally { globalThis.fetch = originalFetch }
})

test('SDK submits and polls the accurately named QUBO/Ising contract', async () => {
  const urls: string[] = []
  let polls = 0
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    urls.push(url)
    if (init?.method === 'POST') {
      const payload = JSON.parse(String(init.body))
      assert.equal(payload.problem.formulation, 'qubo')
      return new Response(JSON.stringify({
        jobId: `job_${'a'.repeat(32)}`, kind: 'qubo-ising', status: 'queued',
        clientRequestId: payload.clientRequestId, inputHash: 'b'.repeat(64),
        acceptedConfiguration: { formulation: 'qubo', problemSize: 2, target: 'gpu' },
        credits: { reserved: 525, charged: null, refunded: 0 }, result: null, diagnostics: null, error: null,
      }), { status: 202 })
    }
    polls += 1
    return new Response(JSON.stringify({
      jobId: `job_${'a'.repeat(32)}`, kind: 'qubo-ising', status: 'completed',
      clientRequestId: 'sdk-qubo-123', inputHash: 'b'.repeat(64),
      acceptedConfiguration: { formulation: 'qubo', problemSize: 2, target: 'gpu' },
      credits: { reserved: 525, charged: 525, refunded: 0 },
      result: { objectiveValue: -2, assignment: [1, 1], bestBound: null, provenOptimal: false },
      diagnostics: { algorithm: 'parallel-update-simulated-annealing-torch-v1', sweepsCompleted: 8, replicas: 8, acceptedMoves: 1, wallClockSeconds: 0.02, deviceClass: 'NVIDIA A10' },
      error: null,
    }), { status: 200 })
  }
  try {
    const client = new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' })
    const result = await client.optimization.solveQuboIsing({
      clientRequestId: 'sdk-qubo-123',
      problem: { formulation: 'qubo', size: 2, terms: [{ i: 0, j: 0, value: -1 }, { i: 1, j: 1, value: -1 }] },
      solver: { maxSweeps: 8, replicas: 8, exactThreshold: 0 },
    }, { pollIntervalMs: 1, timeoutMs: 2_000 })
    assert.equal(result.result?.objectiveValue, -2)
    assert.equal(result.result?.provenOptimal, false)
    assert.equal(polls, 1)
    assert.deepEqual(urls, ['https://example.test/api/v1/jobs/qubo-ising', `https://example.test/api/v1/jobs/job_${'a'.repeat(32)}`])
  } finally { globalThis.fetch = originalFetch }
})

test('SDK submits and polls tensor-network and geometric registration contracts', async () => {
  const posted: string[] = []
  let activeKind: 'tensor-network' | 'geometric-registration' = 'tensor-network'
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (init?.method === 'POST') {
      activeKind = url.endsWith('/tensor-network') ? 'tensor-network' : 'geometric-registration'
      posted.push(url)
      return new Response(JSON.stringify({ jobId: `job_${'c'.repeat(32)}`, kind: activeKind, status: 'queued', clientRequestId: 'restored-1234', inputHash: 'd'.repeat(64), acceptedConfiguration: { formulation: activeKind === 'tensor-network' ? 'qubo' : 'se3-paired-registration', problemSize: 3, target: 'gpu' }, credits: { reserved: 800, charged: null, refunded: 0 }, result: null, diagnostics: null, error: null }), { status: 202 })
    }
    const result = activeKind === 'tensor-network'
      ? { objectiveValue: -2, assignment: [1, 1, 0], bestBound: null, provenOptimal: false }
      : { rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], translation: [2, 3, 4], rmse: 0, maxError: 0, determinant: 1 }
    return new Response(JSON.stringify({ jobId: `job_${'c'.repeat(32)}`, kind: activeKind, status: 'completed', clientRequestId: 'restored-1234', inputHash: 'd'.repeat(64), acceptedConfiguration: { formulation: activeKind === 'tensor-network' ? 'qubo' : 'se3-paired-registration', problemSize: 3, target: 'gpu' }, credits: { reserved: 800, charged: 800, refunded: 0 }, result, diagnostics: null, error: null }), { status: 200 })
  }
  try {
    const optimization = new MahaClient({ apiKey: 'mha_live_test', baseUrl: 'https://example.test' }).optimization
    const tensor = await optimization.solveTensorNetwork({ clientRequestId: 'restored-1234', problem: { formulation: 'qubo', size: 3, terms: [{ i: 0, j: 0, value: -1 }] } }, { pollIntervalMs: 1 })
    assert.equal(tensor.result?.objectiveValue, -2)
    const geometric = await optimization.solveGeometricRegistration({ clientRequestId: 'restored-5678', problem: { sourcePoints: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], targetPoints: [[2, 3, 4], [3, 3, 4], [2, 4, 4]] } }, { pollIntervalMs: 1 })
    assert.equal(geometric.result?.rmse, 0)
    assert.deepEqual(posted, ['https://example.test/api/v1/jobs/tensor-network', 'https://example.test/api/v1/jobs/geometric-registration'])
  } finally { globalThis.fetch = originalFetch }
})
