import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateA2AGovernance, evaluateMcpGovernance, governanceResponseHeaders } from '../lib/governance/adapters.ts'
import type { A2AAgentConfig, A2AJsonRpcRequest } from '../lib/a2a/types.ts'
import type { MCPServerConfig } from '../lib/mcp/types.ts'
import type { PaymentAuthorization } from '../lib/x402/buyer-policy.ts'
import { MCPProxyEngine } from '../lib/mcp/proxy.ts'
import { MemoryWorkflowTaskStore } from '../lib/workflows/task-state.ts'

const NOW = new Date('2026-08-18T12:00:00Z')

const a2aConfig: A2AAgentConfig = {
  id: 'a2a_agt_0123456789abcdef', tenantId: 'tenant.test.0001', name: 'Agent',
  agentCardUrl: 'https://agent.example/.well-known/agent-card.json', rpcUrl: 'https://agent.example/a2a',
  authType: 'none', status: 'active', createdAt: 1,
  taskPolicy: { allowedMethods: ['message/send'], allowedTaskClasses: ['research.summarize'], maxTextBytes: 1024 },
  paymentPolicy: {
    schemaVersion: '1.0.0', policyId: 'buyer.test.0001', policyVersion: '1', approvedSchemes: ['exact'],
    approvedResources: ['https://agent.example/a2a'], approvedPayees: ['0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'],
    assetRules: [{ network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountPerCall: '1000', maxAmountPerTask: '5000' }],
    requireValidatedSchema: false, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: false },
  },
  agentCard: { name: 'Agent', description: 'Fixture', protocolVersion: '0.3.0', rpcUrl: 'https://agent.example/a2a', skills: [{ id: 'research.summarize', name: 'Summarize' }], digest: `sha256:${'a'.repeat(64)}` },
}

const a2aRequest: A2AJsonRpcRequest = {
  jsonrpc: '2.0', id: 'request-1', method: 'message/send',
  params: { message: { role: 'user', parts: [{ kind: 'text', text: 'private payload' }] } },
}

const authorization: PaymentAuthorization = {
  allowed: true, code: 'allowed', policyId: 'buyer.test.0001', policyVersion: '1', taskId: 'a2a-task-12345678',
  authorizationId: 'authorization-12345678', resource: 'https://agent.example/a2a', scheme: 'exact', network: 'eip155:8453',
  asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payee: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28', amount: '1000',
}

test('A2A adapter binds the existing task and buyer policies without retaining content', () => {
  const decision = evaluateA2AGovernance({
    config: a2aConfig, request: a2aRequest, tenantId: a2aConfig.tenantId, traceId: 'trace-12345678', taskId: authorization.taskId,
    taskClass: 'research.summarize', inputBytes: 15, timeoutMs: 10_000, paymentAuthorization: authorization, now: NOW,
  })
  assert.equal(decision.outcome, 'proceed')
  assert.equal(decision.evidence.paymentEvaluatedBy, 'maha-x402-buyer-policy')
  assert.equal(JSON.stringify(decision).includes('private payload'), false)
  assert.deepEqual(Object.keys(governanceResponseHeaders(decision)).sort(), [
    'X-Maha-Governance-Evidence', 'X-Maha-Governance-Outcome', 'X-Maha-Governance-Policy',
  ])
})

test('A2A adapter independently fails closed when the existing text ceiling is exceeded', () => {
  const decision = evaluateA2AGovernance({
    config: a2aConfig, request: a2aRequest, tenantId: a2aConfig.tenantId, traceId: 'trace-12345678', taskId: authorization.taskId,
    taskClass: 'research.summarize', inputBytes: 1025, timeoutMs: 10_000, paymentAuthorization: null, now: NOW,
  })
  assert.equal(decision.outcome, 'deny')
  assert.deepEqual(decision.reasonCodes, ['input_limit_exceeded'])
})

const mcpServer: MCPServerConfig = {
  id: 'mcp_srv_0123456789abcdef', tenantId: 'tenant.test.0001', name: 'Server', baseUrl: 'https://mcp.example/rpc',
  authType: 'none', allowedEngines: ['*'], status: 'active', allowedMethods: ['tools/call'], allowedToolNames: ['portfolio.risk'],
  policyMode: 'explicit', createdAt: 1, discovery: { status: 'ready', tools: [] },
}

test('MCP adapter maps the registered tool policy and uses only the supplied body digest', () => {
  const input = {
    server: mcpServer,
    request: { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name: 'portfolio.risk', arguments: { account: 'private-account' } } },
    context: { tenantId: mcpServer.tenantId, serverId: mcpServer.id, traceId: 'trace-12345678', taskId: 'task-12345678', inputSha256: `sha256:${'b'.repeat(64)}`, inputBytes: 200 },
    timeoutMs: 10_000, now: NOW,
  } as const
  const decision = evaluateMcpGovernance(input)
  assert.equal(decision.outcome, 'proceed')
  assert.equal(decision.evidence.paymentEvaluatedBy, 'not_required')
  assert.equal(JSON.stringify(decision).includes('private-account'), false)
  const changed = evaluateMcpGovernance({ ...input, server: { ...mcpServer, allowedToolNames: ['portfolio.risk', 'portfolio.explain'] } })
  assert.notEqual(changed.policy.policyVersion, decision.policy.policyVersion)
  assert.notEqual(changed.policy.policySha256, decision.policy.policySha256)
})

test('MCP adapter fails closed before forwarding an oversized action', () => {
  const decision = evaluateMcpGovernance({
    server: mcpServer, request: { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name: 'portfolio.risk' } },
    context: { tenantId: mcpServer.tenantId, serverId: mcpServer.id, traceId: 'trace-12345678', inputSha256: `sha256:${'b'.repeat(64)}`, inputBytes: 65_537 },
    timeoutMs: 10_000, now: NOW,
  })
  assert.equal(decision.outcome, 'deny')
  assert.deepEqual(decision.reasonCodes, ['input_limit_exceeded'])
})

test('MCP proxy enforces governance before the outbound fetch and returns digest headers', async () => {
  let fetched = false
  const controls = {
    async getPolicy() { return { requestsPerMinute: 60, timeoutMs: 10_000, failureThreshold: 3, cooldownMs: 30_000 } },
    async beforeRequest() { return { allowed: true, retryAfterSeconds: 0 } },
    async consumeRateLimit() { return { allowed: true, remaining: 59, retryAfterSeconds: 0 } },
    async recordSuccess() {}, async recordFailure() {},
  }
  const request = { jsonrpc: '2.0' as const, id: '1', method: 'tools/call', params: { name: 'portfolio.risk' } }
  const workflowTasks = new MemoryWorkflowTaskStore()
  const denied = await MCPProxyEngine.dispatch(mcpServer, request, {
    tenantId: mcpServer.tenantId, serverId: mcpServer.id, traceId: 'trace-12345678', taskId: 'task-denied-12345678', inputSha256: `sha256:${'b'.repeat(64)}`, inputBytes: 65_537,
  }, { controls, workflowTasks, fetchImpl: async () => { fetched = true; throw new Error('must not fetch') } })
  assert.equal(denied.status, 403)
  assert.equal(fetched, false)
  assert.equal(denied.headers?.['X-Maha-Governance-Outcome'], 'deny')
  assert.equal(denied.headers?.['X-Maha-Workflow-State'], 'pending')

  const allowed = await MCPProxyEngine.dispatch(mcpServer, request, {
    tenantId: mcpServer.tenantId, serverId: mcpServer.id, traceId: 'trace-12345678', taskId: 'task-allowed-12345678', inputSha256: `sha256:${'b'.repeat(64)}`, inputBytes: 200,
  }, {
    controls, workflowTasks,
    prepareUpstream: async () => ({ url: mcpServer.baseUrl, headers: { 'Content-Type': 'application/json' } }),
    fetchImpl: async () => { fetched = true; return new Response(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { ok: true } }), { status: 200 }) },
    audit: async () => {},
  })
  assert.equal(allowed.status, 200)
  assert.equal(fetched, true)
  assert.equal(allowed.headers?.['X-Maha-Governance-Outcome'], 'proceed')
  assert.equal(allowed.headers?.['X-Maha-Workflow-State'], 'running')
  assert.equal(allowed.headers?.['X-Maha-Workflow-Version'], '2')
  assert.match(allowed.headers?.['X-Maha-Governance-Evidence'] ?? '', /^sha256:[a-f0-9]{64}$/)
  assert.deepEqual((await workflowTasks.events(mcpServer.tenantId, 'task-allowed-12345678')).map((event) => event.event), ['action_dispatched', 'action_succeeded'])
})
