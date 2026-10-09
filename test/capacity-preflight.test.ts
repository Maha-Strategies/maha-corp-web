import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { capacityPreflight } from '../lib/capacity-preflight.ts'
import { capacityScenarios } from '../lib/capacity-slo.ts'

const scenarios = capacityScenarios({ CAPACITY_API_KEY: 'synthetic-api', CAPACITY_RELEASE_HEALTH_TOKEN: 'synthetic-release-token-long-enough' }, 'control-plane')

test('capacity preflight probes readiness only and keeps tokens out of diagnostics', async () => {
  const requests: string[] = []
  const probes = await capacityPreflight({ baseUrl: 'https://preview.example.test', timeoutMs: 1_000, scenarios,
    fetcher: async (url, init) => {
      requests.push(String(url)); assert.equal(init?.redirect, 'manual')
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-release-token-long-enough')
      return new Response('private upstream details', { status: 401 })
    } })
  assert.equal(requests.length, 2)
  assert.ok(probes.every((probe) => probe.failure?.includes('exact Preview deployment')))
  assert.ok(!JSON.stringify(probes).includes('synthetic-release'))
  assert.ok(!JSON.stringify(probes).includes('private upstream'))
})

test('capacity preflight fails closed on transport errors, redirects and readiness failures', async () => {
  for (const status of [0, 302, 403, 503]) {
    const probes = await capacityPreflight({ baseUrl: 'https://preview.example.test', timeoutMs: 1_000, scenarios,
      fetcher: async () => { if (!status) throw new Error('private network detail'); return new Response(null, { status }) } })
    assert.ok(probes.every((probe) => probe.failure && probe.status === status))
  }
})

test('capacity preflight passes readiness but never invokes paid MCP scenarios', async () => {
  assert.ok((await capacityPreflight({ baseUrl: 'https://preview.example.test', timeoutMs: 1_000, scenarios,
    fetcher: async () => new Response(null, { status: 200 }) })).every((probe) => !probe.failure))
  assert.deepEqual(await capacityPreflight({ baseUrl: 'https://preview.example.test', timeoutMs: 1_000,
    scenarios: [{ name: 'mcp-controlled-upstream', path: '/api/v1/mcp/gateway/test', method: 'POST' }],
    fetcher: async () => { throw new Error('Must not invoke paid operation') } }), [])
})

test('capacity CLI writes blocked evidence and does not start load batches on 401', async () => {
  const paths: string[] = []
  const server = createServer((request, response) => { paths.push(request.url ?? ''); response.writeHead(401); response.end('private detail') })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const output = join(await mkdtemp(join(tmpdir(), 'maha-capacity-test-')), 'report.json')
    const child = spawn(process.execPath, ['--experimental-strip-types', resolve('scripts/run-capacity-test.ts')], {
      env: { ...process.env, NODE_ENV: 'test', CAPACITY_BASE_URL: `http://127.0.0.1:${address.port}`,
        CAPACITY_PROFILE: 'control-plane', CAPACITY_API_KEY: 'synthetic-api',
        CAPACITY_RELEASE_HEALTH_TOKEN: 'synthetic-release-token-long-enough', CAPACITY_OUTPUT_PATH: output,
        VERCEL_AUTOMATION_BYPASS_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    child.stdout.on('data', (data) => { stdout += data })
    child.stderr.resume()
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
    assert.equal(code, 1)
    const report = JSON.parse(await readFile(output, 'utf8'))
    assert.equal(report.state, 'blocked')
    assert.deepEqual(report.reports, [])
    assert.deepEqual(paths, ['/api/admin/billing-readiness', '/api/admin/observability-readiness'])
    assert.ok(!stdout.includes('synthetic-release-token'))
    assert.ok(!stdout.includes('private detail'))
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())) }
})
