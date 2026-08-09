import assert from 'node:assert/strict'
import test from 'node:test'
import { parseA2AAgentCard, parseA2APaymentPolicy, parseA2ATaskPolicy, parseA2ARequest, evaluateA2ATaskPolicy } from '../lib/a2a/validation.ts'
import { A2AProxyEngine } from '../lib/a2a/proxy.ts'
import type { A2AAgentConfig, A2AJsonRpcRequest } from '../lib/a2a/types.ts'
import { encodeChallengeHeader } from '../lib/x402/protocol.ts'
import { evaluatePaymentIntent, type BuyerPolicy } from '../lib/x402/buyer-policy.ts'

const card = {
  name: 'Reference agent',
  description: 'A real A2A JSON-RPC compatibility fixture.',
  url: 'https://agent.example/a2a',
  protocolVersion: '0.3.0',
  skills: [{ id: 'research.summarize', name: 'Summarize research', description: 'Summarizes supplied text.' }],
}

test('A2A Agent Card and task policy bind calls to discovered skills', () => {
  const parsedCard = parseA2AAgentCard(card)
  const policy = parseA2ATaskPolicy({ allowedMethods: ['message/send', 'tasks/get'], allowedTaskClasses: ['research.summarize'], maxTextBytes: 1_024 }, parsedCard.skills.map((skill) => skill.id))
  const request = parseA2ARequest({ jsonrpc: '2.0', id: 'req-1', method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: 'Summarize this.' }] } } })
  assert.deepEqual(evaluateA2ATaskPolicy(request, 'research.summarize', policy), { allowed: true, taskClass: 'research.summarize', textBytes: 15 })
  assert.equal(evaluateA2ATaskPolicy(request, 'payments.transfer', policy).allowed, false)
  assert.throws(() => parseA2ATaskPolicy({ allowedMethods: ['message/send'], allowedTaskClasses: ['invented.skill'], maxTextBytes: 1_024 }, ['research.summarize']), /validated Agent Card/)
})

test('A2A compatibility profile rejects non-text tasks and push callbacks', () => {
  const policy = parseA2ATaskPolicy({ allowedMethods: ['message/send'], allowedTaskClasses: ['research.summarize'], maxTextBytes: 10 }, ['research.summarize'])
  const file = parseA2ARequest({ jsonrpc: '2.0', id: 1, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'file', file: { uri: 'https://example.test/a' } }] } } })
  assert.equal(evaluateA2ATaskPolicy(file, 'research.summarize', policy).allowed, false)
  const callback = parseA2ARequest({ jsonrpc: '2.0', id: 2, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: 'ok' }] }, configuration: { pushNotificationConfig: { url: 'https://attacker.example' } } } })
  assert.equal(evaluateA2ATaskPolicy(callback, 'research.summarize', policy).allowed, false)
  const oversized = parseA2ARequest({ jsonrpc: '2.0', id: 3, method: 'message/send', params: { message: { role: 'user', parts: [{ kind: 'text', text: 'more than ten bytes' }] } } })
  assert.equal(evaluateA2ATaskPolicy(oversized, 'research.summarize', policy).allowed, false)
})

test('the same pre-signing primitive enforces an A2A upstream x402 ceiling', () => {
  const policy: BuyerPolicy = {
    schemaVersion: '1.0.0', policyId: 'policy:a2a:fixture', policyVersion: '1', approvedSchemes: ['exact'],
    approvedResources: ['https://agent.example/a2a'], approvedPayees: ['0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'],
    assetRules: [{ network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountPerCall: '1000', maxAmountPerTask: '5000' }],
    requireValidatedSchema: false, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: false },
  }
  const base = {
    taskId: 'a2a-task-12345678', requestedResource: 'https://agent.example/a2a', declaredResource: 'https://agent.example/a2a',
    schema: { status: 'not_checked' as const }, authorizationId: 'a2a-auth-12345678',
  }
  const requirement = { scheme: 'exact', network: 'eip155:8453', amount: '1000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28', maxTimeoutSeconds: 60 }
  assert.equal(evaluatePaymentIntent(policy, { ...base, requirement }).allowed, true)
  assert.deepEqual(evaluatePaymentIntent(policy, { ...base, requirement: { ...requirement, amount: '1001' } }), { allowed: false, code: 'call_limit_exceeded', message: 'The payment exceeds the per-call ceiling.' })
  assert.equal(evaluatePaymentIntent(policy, { ...base, requirement: { ...requirement, payTo: '0x1111111111111111111111111111111111111111' } }).allowed, false)
})

test('A2A registration policy must bind the exact discovered RPC URL', () => {
  const value = {
    schemaVersion: '1.0.0', policyId: 'policy:a2a:fixture', policyVersion: '1', approvedSchemes: ['exact'],
    approvedResources: ['https://agent.example/a2a'], approvedPayees: ['0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'],
    assetRules: [{ network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountPerCall: '1000', maxAmountPerTask: '5000' }],
    requireValidatedSchema: false, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: false },
  }
  assert.equal(parseA2APaymentPolicy(value, 'https://agent.example/a2a').policyId, 'policy:a2a:fixture')
  assert.throws(() => parseA2APaymentPolicy(value, 'https://other.example/a2a'), /exact Agent Card RPC URL/)
  assert.throws(() => parseA2APaymentPolicy({ ...value, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true } }, 'https://agent.example/a2a'), /not supported/)
})

test('A2A proxy passes an allowed challenge and blocks an over-ceiling challenge', async () => {
  const paymentPolicy: BuyerPolicy = {
    schemaVersion: '1.0.0', policyId: 'policy:a2a:fixture', policyVersion: '1', approvedSchemes: ['exact'],
    approvedResources: ['https://agent.example/a2a'], approvedPayees: ['0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'],
    assetRules: [{ network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', maxAmountPerCall: '1000', maxAmountPerTask: '5000' }],
    requireValidatedSchema: false, settlement: { requirePaymentResponse: true, requireOnchainConfirmation: false },
  }
  const config: A2AAgentConfig = {
    id: 'a2a_agt_0123456789abcdef', tenantId: 'tenant-1', name: 'Agent', agentCardUrl: 'https://agent.example/.well-known/agent-card.json', rpcUrl: 'https://agent.example/a2a', authType: 'none', status: 'active', createdAt: 1,
    taskPolicy: { allowedMethods: ['message/send'], allowedTaskClasses: ['research.summarize'], maxTextBytes: 1_024 }, paymentPolicy,
    agentCard: { name: 'Agent', description: 'Test', protocolVersion: '0.3.0', rpcUrl: 'https://agent.example/a2a', skills: [{ id: 'research.summarize', name: 'Summarize' }], digest: `sha256:${'a'.repeat(64)}` },
  }
  const request: A2AJsonRpcRequest = { jsonrpc: '2.0', id: 'request-1', method: 'message/send', params: { message: { messageId: 'message-12345678', role: 'user', parts: [{ kind: 'text', text: 'test' }] } } }
  const controls = {
    async getPolicy() { return { requestsPerMinute: 60, timeoutMs: 10_000, failureThreshold: 3, cooldownMs: 30_000 } },
    async beforeRequest() { return { allowed: true, retryAfterSeconds: 0 } },
    async consumeRateLimit() { return { allowed: true, remaining: 59, retryAfterSeconds: 0 } },
    async recordSuccess() {}, async recordFailure() {},
  }
  const challenge = (amount: string) => {
    const body = { x402Version: 2 as const, resource: { url: config.rpcUrl }, accepts: [{ scheme: 'exact' as const, network: 'eip155:8453' as const, amount, payTo: paymentPolicy.approvedPayees[0], maxTimeoutSeconds: 60, asset: paymentPolicy.assetRules[0].asset }], error: 'Payment required.' }
    return new Response(JSON.stringify(body), { status: 402, headers: { 'PAYMENT-REQUIRED': encodeChallengeHeader(body) } })
  }
  const baseOptions = { tenantId: 'tenant-1', traceId: 'trace-12345678', taskClass: 'research.summarize', paymentSignature: null, a2aVersion: '0.3.0', controls, assertPublicHost: async () => {} }
  const allowed = await A2AProxyEngine.dispatch(config, request, { ...baseOptions, fetchImpl: async () => challenge('1000') })
  assert.equal(allowed.status, 402)
  assert.ok(allowed.headers?.['PAYMENT-REQUIRED'])
  const blocked = await A2AProxyEngine.dispatch(config, request, { ...baseOptions, fetchImpl: async () => challenge('1001') })
  assert.equal(blocked.status, 403)

  const payer = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
  const accepted = { scheme: 'exact', network: 'eip155:8453', amount: '1000', payTo: paymentPolicy.approvedPayees[0], maxTimeoutSeconds: 60, asset: paymentPolicy.assetRules[0].asset }
  const paymentSignature = Buffer.from(JSON.stringify({ x402Version: 2, resource: { url: config.rpcUrl }, accepted, payload: { signature: `0x${'1'.repeat(130)}`, authorization: { from: payer } } }), 'utf8').toString('base64')
  const receipt = Buffer.from(JSON.stringify({ success: true, transaction: `0x${'2'.repeat(64)}`, network: 'eip155:8453', payer }), 'utf8').toString('base64')
  const paidFetch = async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { status: { state: 'completed' } } }), { status: 200, headers: { 'PAYMENT-RESPONSE': receipt } })
  const paid = await A2AProxyEngine.dispatch(config, request, { ...baseOptions, paymentSignature, fetchImpl: paidFetch, audit: async () => {} })
  assert.equal(paid.status, 200)
  const missingReceipt = await A2AProxyEngine.dispatch(config, request, { ...baseOptions, paymentSignature, fetchImpl: async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }), { status: 200 }), audit: async () => {} })
  assert.equal(missingReceipt.status, 502)
})
