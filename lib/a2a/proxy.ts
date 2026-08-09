import crypto from 'node:crypto'
import { Redis } from '@upstash/redis'
import { MCPControls } from '../mcp/controls.ts'
import { decryptSecret } from '../mcp/registry.ts'
import { assertPublicUpstreamHost, MAX_UPSTREAM_RESPONSE_BYTES } from '../mcp-gateway.ts'
import { scopedRedisKey } from '../redis-namespace.ts'
import { traceRedisQuery } from '../observability/telemetry.ts'
import { decodeChallenge, decodeReceipt } from '../x402/client.ts'
import { encodeChallengeHeader, parsePaymentHeader, paymentId, PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER, PAYMENT_SIGNATURE_HEADER } from '../x402/protocol.ts'
import { evaluatePaymentIntent, verifySettlement, type BuyerPolicy, type PaymentAuthorization, type PaymentRequirementLike } from '../x402/buyer-policy.ts'
import { a2aTaskId, a2aTaskIdForExternal, a2aUpstreamTaskId, maxTaskBudgetFor, UpstashA2ATaskBudgetStore, type A2ATaskBudgetReservation, type A2ATaskBudgetState, type A2ATaskBudgetStore } from './task-budget.ts'
import type { A2AAgentConfig, A2AJsonRpcRequest, A2AJsonRpcResponse } from './types.ts'

export type A2AProxyResult = {
  status: number
  body: A2AJsonRpcResponse | unknown
  headers?: Record<string, string>
  retryAfterSeconds?: number
}

type DispatchOptions = {
  tenantId: string
  traceId: string
  taskClass: string | null
  paymentSignature: string | null
  a2aVersion: string | null
  fetchImpl?: typeof fetch
  controls?: GatewayControls
  assertPublicHost?: (url: string) => Promise<void>
  taskBudgets?: A2ATaskBudgetStore
  audit?: (config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions, latencyMs: number, paymentAmount: string | null) => Promise<void>
}

type GatewayControls = {
  getPolicy(tenantId: string): Promise<{ requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }>
  beforeRequest(tenantId: string, serverId: string, policy: { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }): Promise<{ allowed: boolean; retryAfterSeconds: number }>
  consumeRateLimit(tenantId: string, limit: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>
  recordSuccess(tenantId: string, serverId: string): Promise<void>
  recordFailure(tenantId: string, serverId: string, policy: { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }): Promise<void>
}

function rpcError(id: string | number | null, code: number, message: string): A2AJsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function evaluateRequirement(policy: BuyerPolicy | undefined, taskId: string, config: A2AAgentConfig, requirement: PaymentRequirementLike, declaredResource: string, authorizationId: string) {
  if (!policy) return { allowed: false as const, code: 'payment_policy_missing', message: 'This upstream requested payment, but the tenant has no buyer policy for it.' }
  return evaluatePaymentIntent(policy, {
    taskId,
    requestedResource: config.rpcUrl,
    declaredResource,
    requirement,
    schema: { status: 'not_checked', digest: config.agentCard.digest },
    authorizationId,
  })
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBounded(response: Response): Promise<{ text: string; json: unknown }> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('A2A upstream response exceeds 1 MB.')
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('A2A upstream response exceeds 1 MB.')
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new Error('A2A upstream response is not valid JSON.') }
  return { text, json }
}

async function upstreamHeaders(config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Maha-Tenant-ID': options.tenantId,
    'X-Maha-Trace-ID': options.traceId,
  }
  if (options.a2aVersion) headers['A2A-Version'] = options.a2aVersion
  if (options.paymentSignature) headers[PAYMENT_SIGNATURE_HEADER] = options.paymentSignature
  if (config.authType !== 'none' && config.authSecretEncrypted) {
    const secret = decryptSecret(config.authSecretEncrypted)
    if (config.authType === 'bearer') headers.Authorization = `Bearer ${secret}`
    if (config.authType === 'hmac') headers['X-Maha-HMAC-Signature'] = crypto.createHmac('sha256', secret).update(`${options.traceId}:${JSON.stringify(request)}`).digest('hex')
  }
  return headers
}

async function recordUsage(config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions, latencyMs: number, paymentAmount: string | null): Promise<void> {
  const timestamp = Date.now()
  const entry = {
    id: `a2a_tx_${crypto.randomBytes(6).toString('hex')}`,
    tenantId: options.tenantId,
    jobId: options.traceId,
    engine: 'a2a-gateway',
    timestamp,
    creditDelta: -1,
    entryType: 'DEBIT',
    hmacSignature: crypto.createHash('sha256').update(`${options.traceId}:${request.method}`).digest('hex'),
    inputHash: crypto.createHash('sha256').update(JSON.stringify(request.params ?? {})).digest('hex'),
    outputHash: 'a2a-invoked',
    status: 'COMPLETED',
    meta: { agentId: config.id, method: request.method, taskClass: options.taskClass, latencyMs, upstreamPaymentAmount: paymentAmount },
  }
  const redis = Redis.fromEnv()
  await traceRedisQuery('ZADD', () => redis.zadd(scopedRedisKey(`ledger:tenant:${options.tenantId}:entries`), { score: timestamp, member: JSON.stringify(entry) }))
}

export class A2AProxyEngine {
  static async dispatch(config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions): Promise<A2AProxyResult> {
    if (config.status !== 'active') return { status: 503, body: rpcError(request.id, -32004, 'Target A2A agent is suspended.') }
    const controls = options.controls ?? MCPControls
    const policy = await controls.getPolicy(options.tenantId)
    const circuit = await controls.beforeRequest(options.tenantId, config.id, policy)
    if (!circuit.allowed) return { status: 503, retryAfterSeconds: circuit.retryAfterSeconds, body: rpcError(request.id, -32003, 'Upstream circuit breaker is open.') }
    const rate = await controls.consumeRateLimit(options.tenantId, policy.requestsPerMinute)
    if (!rate.allowed) return { status: 429, retryAfterSeconds: rate.retryAfterSeconds, body: rpcError(request.id, -32002, 'Tenant agent-gateway request limit reached.') }

    const taskBudgets = options.taskBudgets ?? new UpstashA2ATaskBudgetStore()
    const requestedTaskId = a2aTaskId(request)
    const durableTaskId = await taskBudgets.resolveTaskId({ tenantId: options.tenantId, agentId: config.id, taskId: requestedTaskId })

    let signedAmount: string | null = null
    let authorization: PaymentAuthorization | null = null
    let reservation: A2ATaskBudgetReservation | null = null
    let payer: string | null = null
    if (options.paymentSignature) {
      const parsed = parsePaymentHeader(options.paymentSignature)
      if (!parsed.ok) return { status: 403, body: rpcError(request.id, -32021, `Signed payment was blocked by policy: ${parsed.reason}.`) }
      const authorizationId = await paymentId(parsed.payment)
      const decision = evaluateRequirement(config.paymentPolicy, durableTaskId, config, parsed.payment.accepted, parsed.payment.resource?.url ?? '', authorizationId)
      if (!decision.allowed) return { status: 403, body: rpcError(request.id, -32021, `Signed payment was blocked by policy: ${decision.code}.`) }
      const maxTaskBudget = config.paymentPolicy ? maxTaskBudgetFor(decision.network, decision.asset, config.paymentPolicy.assetRules) : null
      if (!maxTaskBudget) return { status: 403, body: rpcError(request.id, -32021, 'Signed payment was blocked by policy: task_budget_missing.') }
      reservation = { tenantId: options.tenantId, agentId: config.id, taskId: durableTaskId, authorizationId, network: decision.network, asset: decision.asset, amount: decision.amount, maxTaskBudget }
      const reserved = await taskBudgets.reserve(reservation)
      if (!reserved.reserved) return { status: 403, body: rpcError(request.id, -32024, `Signed payment was blocked by durable task budget: ${reserved.reason}.`) }
      const paymentAuthorization = object(parsed.payment.payload.authorization) ? parsed.payment.payload.authorization : null
      if (!paymentAuthorization || typeof paymentAuthorization.from !== 'string') {
        await taskBudgets.cancel(reservation)
        return { status: 403, body: rpcError(request.id, -32021, 'Signed payment was blocked by policy: payer_missing.') }
      }
      authorization = decision
      payer = paymentAuthorization.from
      signedAmount = parsed.payment.accepted.amount
    }

    const startedAt = Date.now()
    try {
      await (options.assertPublicHost ?? assertPublicUpstreamHost)(config.rpcUrl)
      const response = await (options.fetchImpl ?? fetch)(config.rpcUrl, {
        method: 'POST', headers: await upstreamHeaders(config, request, options), body: JSON.stringify(request), redirect: 'manual', signal: AbortSignal.timeout(policy.timeoutMs),
      })
      if (response.status === 402) {
        if (reservation) await taskBudgets.cancel(reservation)
        const challengeHeader = response.headers.get(PAYMENT_REQUIRED_HEADER)
        if (!challengeHeader || challengeHeader.length > 16_384) return { status: 502, body: rpcError(request.id, -32022, 'A2A upstream returned a malformed x402 challenge.') }
        let challenge
        try { challenge = decodeChallenge(challengeHeader) } catch { return { status: 502, body: rpcError(request.id, -32022, 'A2A upstream returned a malformed x402 challenge.') } }
        const allowed = []
        for (const requirement of challenge.accepts) {
          const decision = evaluateRequirement(config.paymentPolicy, durableTaskId, config, requirement, challenge.resource.url, `a2a-auth-${crypto.createHash('sha256').update(`${options.traceId}:${requirement.amount}`).digest('hex').slice(0, 32)}`)
          if (!decision.allowed || !config.paymentPolicy) continue
          const maxTaskBudget = maxTaskBudgetFor(decision.network, decision.asset, config.paymentPolicy.assetRules)
          if (!maxTaskBudget) continue
          const available = await taskBudgets.canReserve({ tenantId: options.tenantId, agentId: config.id, taskId: durableTaskId, network: decision.network, asset: decision.asset, amount: decision.amount, maxTaskBudget })
          if (available.allowed) allowed.push(requirement)
        }
        if (allowed.length === 0) return { status: 403, body: rpcError(request.id, -32020, 'The upstream payment terms are outside the tenant buyer policy.') }
        const filtered = { ...challenge, accepts: allowed }
        return {
          status: 402,
          body: filtered,
          headers: { 'Cache-Control': 'no-store', 'X-Maha-Task-ID': durableTaskId, [PAYMENT_REQUIRED_HEADER]: encodeChallengeHeader(filtered as Parameters<typeof encodeChallengeHeader>[0]) },
        }
      }
      if (reservation && response.status >= 400 && response.status < 500) await taskBudgets.cancel(reservation)
      if (response.status >= 300 && response.status < 400 || response.status >= 500) {
        await controls.recordFailure(options.tenantId, config.id, policy)
        return { status: 502, body: rpcError(request.id, -32603, `Upstream A2A HTTP Error (${response.status}).`) }
      }
      const { json } = await readBounded(response)
      if (typeof json !== 'object' || json === null || Array.isArray(json) || (json as Record<string, unknown>).jsonrpc !== '2.0' || (json as Record<string, unknown>).id !== request.id) throw new Error('A2A upstream returned an invalid JSON-RPC response.')
      const receiptHeader = response.headers.get(PAYMENT_RESPONSE_HEADER)
      let budgetState: A2ATaskBudgetState | null = null
      if (authorization && payer && config.paymentPolicy) {
        const settlement = verifySettlement({ policy: config.paymentPolicy, authorization, payer, receipt: decodeReceipt(receiptHeader) })
        if (!settlement.verified) return { status: 502, body: rpcError(request.id, -32023, `Upstream payment receipt failed policy verification: ${settlement.code}.`) }
        if (!reservation) return { status: 502, body: rpcError(request.id, -32025, 'The verified settlement has no durable task-budget reservation.') }
        const committed = await taskBudgets.settle({ ...reservation, transaction: settlement.transaction })
        if (!committed.settled) return { status: 502, body: rpcError(request.id, -32025, `The verified settlement could not be committed to the task budget: ${committed.reason}.`) }
        budgetState = committed.state
      }
      const upstreamTaskId = a2aUpstreamTaskId(json)
      if (upstreamTaskId) await taskBudgets.bindUpstreamTask({ tenantId: options.tenantId, agentId: config.id, taskId: durableTaskId, upstreamTaskId: a2aTaskIdForExternal(upstreamTaskId) })
      await controls.recordSuccess(options.tenantId, config.id)
      await (options.audit ?? recordUsage)(config, request, options, Date.now() - startedAt, signedAmount)
      const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'X-Maha-Task-ID': durableTaskId }
      if (budgetState) {
        headers['X-Maha-Task-Spent'] = budgetState.cumulativeSpentBaseUnits
        headers['X-Maha-Task-Budget'] = budgetState.maxTaskBudgetBaseUnits
        headers['X-Maha-Task-Status'] = budgetState.status
      }
      if (receiptHeader) headers[PAYMENT_RESPONSE_HEADER] = receiptHeader
      return { status: response.status, body: json, headers }
    } catch (error) {
      try { await controls.recordFailure(options.tenantId, config.id, policy) } catch {}
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || /timed out|aborted/i.test(error.message))
      return { status: timeout ? 504 : 502, body: rpcError(request.id, -32603, timeout ? 'Upstream A2A request timed out.' : 'Upstream A2A connection or protocol failure.') }
    }
  }
}
