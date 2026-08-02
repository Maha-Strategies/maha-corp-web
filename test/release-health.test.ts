import assert from 'node:assert/strict'
import test from 'node:test'

import { checkProductionRelease, createProductionReleaseManifest, parseProductionDeployment, parseProductionReleaseManifest, prepareRollbackRehearsal } from '../lib/release-health.ts'

const deployment = { id: 'dpl_Abc123', name: 'maha-corp-web', url: 'maha-corp-abc123-mayonerajans-projects.vercel.app', target: 'production', readyState: 'READY', createdAt: 1_785_643_210_605, projectId: 'prj_test' }

test('release health accepts only the ready Maha Production deployment', () => {
  assert.equal(parseProductionDeployment(deployment, 'prj_test').id, 'dpl_Abc123')
  assert.throws(() => parseProductionDeployment({ ...deployment, target: 'preview' }, 'prj_test'), /not a ready/)
  assert.throws(() => parseProductionDeployment({ ...deployment, projectId: 'prj_foreign' }, 'prj_test'), /different project/)
})

test('release health checks canonical public and protected readiness surfaces', async () => {
  const fetcher = async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname
    if (path === '/') return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
    if (path === '/api/docs/openapi') return Response.json({ openapi: '3.1.0' })
    return Response.json({ state: 'ready', readOnly: true })
  }
  const result = await checkProductionRelease({ baseUrl: 'https://www.mahastrategies.com', releaseHealthToken: 'x'.repeat(32), fetcher })
  assert.equal(result.state, 'ready')
  assert.equal(result.checks.length, 4)
  assert.equal(result.checks.every((check) => check.status === 200), true)
})

test('release health fails closed without leaking a dependency response', async () => {
  const fetcher = async (input: string | URL | Request) => new Response(String(input).includes('billing-readiness') ? 'secret database error' : '{}', { status: 503, headers: { 'content-type': 'application/json' } })
  const result = await checkProductionRelease({ baseUrl: 'https://www.mahastrategies.com', releaseHealthToken: 'x'.repeat(32), fetcher })
  assert.equal(result.state, 'unhealthy')
  assert.equal(JSON.stringify(result).includes('secret database error'), false)
})

test('last-known-good manifests require four healthy checks and expire', () => {
  const checks = ['homepage', 'openapi', 'billing_readiness', 'observability_readiness'].map((name) => ({ name, path: '/', status: 200, latencyMs: 1, state: 'ready', code: 'ready' }))
  const manifest = createProductionReleaseManifest({
    canonicalUrl: 'https://www.mahastrategies.com', deployment: parseProductionDeployment(deployment, 'prj_test'), checks: checks as Parameters<typeof createProductionReleaseManifest>[0]['checks'],
    repository: 'Maha-Strategies/maha-corp-web', workflowRunId: '12345', commitSha: 'a'.repeat(40), generatedAt: '2026-08-02T00:00:00.000Z',
  })
  process.env.VERCEL_PROJECT_ID = 'prj_test'
  assert.equal(parseProductionReleaseManifest(manifest, Date.parse('2026-08-03T00:00:00.000Z')).deployment.id, 'dpl_Abc123')
  assert.throws(() => parseProductionReleaseManifest(manifest, Date.parse('2026-08-20T00:00:00.000Z')), /recovery window/)
  delete process.env.VERCEL_PROJECT_ID
})

test('rollback rehearsal requires a distinct inspected target bound to the requested health run', () => {
  const now = Date.parse('2026-08-02T06:00:00.000Z')
  const inspected = (id: string, url: string) => ({ id, name: 'maha-corp-web', url, target: 'production', readyState: 'READY', createdAt: now - 1_000, projectId: 'prj_test' })
  const checks = ['homepage', 'openapi', 'billing_readiness', 'observability_readiness'].map((name) => ({ name, path: `/${name}`, status: 200, latencyMs: 1, state: 'ready', code: `${name}_ready` })) as Parameters<typeof createProductionReleaseManifest>[0]['checks']
  const target = inspected('dpl_Target123', 'maha-corp-target123-mayonerajans-projects.vercel.app')
  const manifest = createProductionReleaseManifest({
    canonicalUrl: 'https://www.mahastrategies.com', deployment: parseProductionDeployment(target, 'prj_test'), checks,
    repository: 'Maha-Strategies/maha-corp-web', workflowRunId: '12345', commitSha: 'a'.repeat(40), generatedAt: new Date(now).toISOString(),
  })
  const original = inspected('dpl_Current123', 'maha-corp-current123-mayonerajans-projects.vercel.app')
  const targetWorkflowRun = { id: 12345, status: 'completed', conclusion: 'success', head_branch: 'main', head_sha: 'a'.repeat(40), path: '.github/workflows/production-release-health.yml', repository: { full_name: 'Maha-Strategies/maha-corp-web' } }
  const input = { originalDeployment: original, targetDeployment: target, targetManifest: manifest, targetWorkflowRun, targetReleaseHealthRunId: '12345', projectId: 'prj_test', repository: 'Maha-Strategies/maha-corp-web', now }
  const prepared = prepareRollbackRehearsal(input)
  assert.equal(prepared.target.id, 'dpl_Target123')
  assert.equal(prepared.original.id, 'dpl_Current123')
  assert.throws(() => prepareRollbackRehearsal({ ...input, originalDeployment: target }), /must differ/)
  assert.throws(() => prepareRollbackRehearsal({ ...input, targetReleaseHealthRunId: '99999' }), /Target run is not/)
  assert.throws(() => prepareRollbackRehearsal({ ...input, targetWorkflowRun: { ...targetWorkflowRun, path: '.github/workflows/quality.yml' } }), /Target run is not/)
})
