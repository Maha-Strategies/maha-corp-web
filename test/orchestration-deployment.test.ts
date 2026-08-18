import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeWorkflowControl, workflowTenantId } from '../lib/workflows/control.ts'
import { privateDeploymentPathDecision } from '../lib/workflows/deployment-boundary.ts'
import { orchestrationDeploymentConfig, workflowRetentionSeconds } from '../lib/workflows/deployment.ts'

const storage = { UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'redis-token' }
const TOKEN_A = 'hosted-control-token-000000000001'
const TOKEN_B = 'hosted-control-token-000000000002'

test('hosted configuration binds unique strong credentials to tenants without returning raw tokens', () => {
  const config = orchestrationDeploymentConfig({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'hosted', ORCHESTRATION_TENANT_TOKENS: JSON.stringify([{ tenantId: 'tenant.hosted.0001', token: TOKEN_A }, { tenantId: 'tenant.hosted.0002', token: TOKEN_B }]) })
  assert.equal(config.ready, true); assert.equal(config.authReady, true); assert.equal(config.credentials.length, 2)
  assert.equal(JSON.stringify(config).includes(TOKEN_A), false)
})

test('private configuration binds one installation tenant and validates retention', () => {
  const config = orchestrationDeploymentConfig({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'private', ORCHESTRATION_PRIVATE_TENANT_ID: 'tenant.private.0001', WORKFLOW_CONTROL_TOKEN: TOKEN_A, ORCHESTRATION_RETENTION_DAYS: '90' })
  assert.equal(config.ready, true); assert.equal(config.mode, 'private'); assert.equal(config.retentionDays, 90)
  assert.equal(workflowRetentionSeconds({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'private', ORCHESTRATION_PRIVATE_TENANT_ID: 'tenant.private.0001', WORKFLOW_CONTROL_TOKEN: TOKEN_A, ORCHESTRATION_RETENTION_DAYS: '90' }), 90 * 86_400)
})

test('packaged modes fail closed on weak, duplicate, malformed or incomplete configuration', () => {
  assert.equal(orchestrationDeploymentConfig({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'private', ORCHESTRATION_PRIVATE_TENANT_ID: 'bad tenant', WORKFLOW_CONTROL_TOKEN: 'weak' }).ready, false)
  assert.equal(orchestrationDeploymentConfig({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'hosted', ORCHESTRATION_TENANT_TOKENS: JSON.stringify([{ tenantId: 'tenant.same.0001', token: TOKEN_A }, { tenantId: 'tenant.same.0001', token: TOKEN_B }]) }).ready, false)
  assert.equal(orchestrationDeploymentConfig({ ORCHESTRATION_DEPLOYMENT_MODE: 'hosted', ORCHESTRATION_TENANT_TOKENS: 'not-json' }).ready, false)
  assert.equal(orchestrationDeploymentConfig({ ...storage, ORCHESTRATION_DEPLOYMENT_MODE: 'unknown', WORKFLOW_CONTROL_TOKEN: TOKEN_A }).authReady, false)
})

test('hosted authorization derives tenancy from the bearer and refuses header switching', () => {
  const previous = { mode: process.env.ORCHESTRATION_DEPLOYMENT_MODE, tokens: process.env.ORCHESTRATION_TENANT_TOKENS, url: process.env.UPSTASH_REDIS_REST_URL, redis: process.env.UPSTASH_REDIS_REST_TOKEN }
  try {
    process.env.ORCHESTRATION_DEPLOYMENT_MODE = 'hosted'; process.env.ORCHESTRATION_TENANT_TOKENS = JSON.stringify([{ tenantId: 'tenant.hosted.0001', token: TOKEN_A }]); process.env.UPSTASH_REDIS_REST_URL = storage.UPSTASH_REDIS_REST_URL; process.env.UPSTASH_REDIS_REST_TOKEN = storage.UPSTASH_REDIS_REST_TOKEN
    const request = new Request('https://maha.example/control', { headers: { authorization: `Bearer ${TOKEN_A}` } }); const auth = authorizeWorkflowControl(request)
    assert.equal(auth.ok, true); assert.equal(workflowTenantId(request, auth), 'tenant.hosted.0001')
    assert.equal(workflowTenantId(new Request('https://maha.example/control', { headers: { authorization: `Bearer ${TOKEN_A}`, 'x-maha-tenant-id': 'tenant.hosted.0002' } }), auth), null)
  } finally {
    restore('ORCHESTRATION_DEPLOYMENT_MODE', previous.mode); restore('ORCHESTRATION_TENANT_TOKENS', previous.tokens); restore('UPSTASH_REDIS_REST_URL', previous.url); restore('UPSTASH_REDIS_REST_TOKEN', previous.redis)
  }
})

test('private deployment route boundary exposes only the console and its control APIs', () => {
  assert.equal(privateDeploymentPathDecision('/', 'private'), 'redirect_console')
  assert.equal(privateDeploymentPathDecision('/admin/orchestration', 'private'), 'allow')
  assert.equal(privateDeploymentPathDecision('/api/v1/orchestration/tasks', 'private'), 'allow')
  assert.equal(privateDeploymentPathDecision('/api/v1/compress', 'private'), 'deny')
  assert.equal(privateDeploymentPathDecision('/knowledge', 'private'), 'deny')
  assert.equal(privateDeploymentPathDecision('/knowledge', 'hosted'), 'allow')
})

function restore(key: string, value: string | undefined) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
