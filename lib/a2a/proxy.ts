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
import { evaluateA2AGovernance, governanceResponseHeaders } from '../governance/adapters.ts'
import { governanceDigest, type GovernanceDecision } from '../governance/envelope.ts'
import type { GovernancePolicyLayer } from '../governance/policy-inheritance.ts'
import { APPROVAL_ID_HEADER, APPROVAL_STATE_HEADER, approvalIdFor, UpstashApprovalStore, type ApprovalStore } from '../workflows/approvals.ts'
import { recoveryResponseHeaders, UpstashRecoveryStore, workflowActionIdForExternal, type RecoveryRecord, type RecoveryStore } from '../workflows/recovery.ts'
import { UpstashWorkflowTaskStore, workflowResponseHeaders, workflowTransitionId, type WorkflowTaskState, type WorkflowTaskStore, type WorkflowTransitionEvent } from '../workflows/task-state.ts'
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
  inputBytes: number
  paymentSignature: string | null
  a2aVersion: string | null
  fetchImpl?: typeof fetch
  controls?: GatewayControls
  assertPublicHost?: (url: string) => Promise<void>
  taskBudgets?: A2ATaskBudgetStore
  workflowTasks?: WorkflowTaskStore
  workflowTaskId?: string
  actionId?: string
  approvalId?: string
  policyLayers?: GovernancePolicyLayer[]
  approvals?: ApprovalStore
  recovery?: RecoveryStore
  audit?: (config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions, latencyMs: number, paymentAmount: string | null, governance: GovernanceDecision) => Promise<void>
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

function a2aLifecycleEvent(response: unknown): WorkflowTransitionEvent | null {
  if (!object(response) || !object(response.result) || !object(response.result.status)) return null
  const state = response.result.status.state
  if (state === 'completed') return 'participant_completed'
  if (state === 'failed' || state === 'rejected') return 'participant_failed'
  if (state === 'canceled' || state === 'cancelled') return 'participant_cancelled'
  if (state === 'input-required') return 'input_required'
  if (state === 'auth-required') return 'review_required'
  return null
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

async function recordUsage(config: A2AAgentConfig, request: A2AJsonRpcRequest, options: DispatchOptions, latencyMs: number, paymentAmount: string | null, governance: GovernanceDecision): Promise<void> {
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
    meta: {
      agentId: config.id, method: request.method, taskClass: options.taskClass, latencyMs, upstreamPaymentAmount: paymentAmount,
      governanceOutcome: governance.outcome,
      governanceEvidenceSha256: governance.evidenceSha256,
      governancePolicySha256: governance.policy.policySha256,
    },
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
    const workflowTaskId = options.workflowTaskId ?? durableTaskId

    let signedAmount: string | null = null
    let authorization: PaymentAuthorization | null = null
    let reservation: A2ATaskBudgetReservation | null = null
    let reservationActive = false
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
      const paymentAuthorization = object(parsed.payment.payload.authorization) ? parsed.payment.payload.authorization : null
      if (!paymentAuthorization || typeof paymentAuthorization.from !== 'string') {
        return { status: 403, body: rpcError(request.id, -32021, 'Signed payment was blocked by policy: payer_missing.') }
      }
      authorization = decision
      payer = paymentAuthorization.from
      signedAmount = parsed.payment.accepted.amount
    }

    const governance = evaluateA2AGovernance({
      config,
      request,
      tenantId: options.tenantId,
      traceId: options.traceId,
      taskId: workflowTaskId,
      taskClass: options.taskClass,
      inputBytes: options.inputBytes,
      timeoutMs: policy.timeoutMs,
      paymentAuthorization: authorization,
      policyLayers: options.policyLayers,
    })
    let workflowState: WorkflowTaskState | null = null
    let recoveryRecord: RecoveryRecord | null = null
    let approvalState: string | null = null
    const governed = (result: A2AProxyResult): A2AProxyResult => ({
      ...result,
      headers: { ...governanceResponseHeaders(governance), ...(workflowState ? workflowResponseHeaders(workflowState) : {}), ...(recoveryRecord ? recoveryResponseHeaders(recoveryRecord) : {}), ...(approvalState ? { [APPROVAL_STATE_HEADER]: approvalState } : {}), ...(result.headers ?? {}) },
    })
    const workflowTasks = options.workflowTasks ?? new UpstashWorkflowTaskStore()
    const transition = async (event: WorkflowTransitionEvent) => {
      const result = await workflowTasks.transition({
        tenantId: options.tenantId,
        taskId: workflowTaskId,
        transitionId: workflowTransitionId({ taskId: workflowTaskId, requestId: request.id, targetId: config.id, operation: request.method, event }),
        event,
        actor: { transport: 'a2a', targetId: config.id, operation: request.method },
        evidenceSha256: governance.evidenceSha256,
      })
      workflowState = result.state
      return result.accepted
    }
    const currentWorkflowStatus = (): WorkflowTaskState['status'] | null => workflowState?.status ?? null
    const actionSha256 = governanceDigest({ taskId: workflowTaskId, targetId: config.id, operation: request.method, taskClass: options.taskClass, inputSha256: governanceDigest(request.params ?? {}) })
    const policySha256 = governance.policy.policySha256!
    const actionId = options.actionId ?? workflowActionIdForExternal(options.traceId)
    const recovery = options.recovery ?? new UpstashRecoveryStore()
    if (governance.outcome === 'deny') {
      if (reservationActive && reservation) await taskBudgets.cancel(reservation)
      const accepted = await transition('action_denied')
      if (!accepted) return governed({ status: 409, body: rpcError(request.id, -32032, 'The workflow state does not permit this transition.') })
      return governed({ status: 403, body: rpcError(request.id, -32030, `Maha governance deny: ${governance.reasonCodes.join(',')}`) })
    }
    const existing = await recovery.get(options.tenantId, workflowTaskId, actionId)
    if (existing) {
      recoveryRecord = existing
      if (existing.actionSha256 !== actionSha256 || existing.policySha256 !== policySha256) {
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        return governed({ status: 409, body: rpcError(request.id, -32034, 'The action ID is already bound to a different request or policy.') })
      }
      if (reservationActive && reservation) await taskBudgets.cancel(reservation)
      return governed({ status: 409, body: rpcError(request.id, -32033, `Action already ${existing.status}; upstream dispatch was not repeated.`) })
    }
    if (governance.outcome === 'require_review') {
      const approvals = options.approvals ?? new UpstashApprovalStore()
      const expectedApprovalId = approvalIdFor(actionSha256, policySha256)
      if (!options.approvalId) {
        const record = await approvals.request({ approvalId: expectedApprovalId, tenantId: options.tenantId, taskId: workflowTaskId, actionSha256, policySha256, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() })
        approvalState = record.status
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        const accepted = await transition('review_required')
        if (!accepted) return governed({ status: 409, body: rpcError(request.id, -32032, 'The workflow state does not permit this transition.') })
        return governed({ status: 403, headers: { [APPROVAL_ID_HEADER]: record.approvalId }, body: rpcError(request.id, -32031, 'Maha governance requires a human approval bound to this action and policy.') })
      }
      if (options.approvalId !== expectedApprovalId) {
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        return governed({ status: 403, body: rpcError(request.id, -32035, 'The supplied approval is not bound to this action and policy.') })
      }
      const consumed = await approvals.consume({ tenantId: options.tenantId, taskId: workflowTaskId, approvalId: options.approvalId, actionSha256, policySha256 })
      approvalState = consumed.record?.status ?? consumed.reason
      if (!consumed.consumed) {
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        return governed({ status: 403, headers: { [APPROVAL_ID_HEADER]: options.approvalId }, body: rpcError(request.id, -32035, `Approval cannot be used: ${consumed.reason}.`) })
      }
      if (!await transition('review_approved')) {
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        return governed({ status: 409, body: rpcError(request.id, -32032, 'The workflow is not awaiting review approval.') })
      }
    }

    if (authorization && reservation) {
      const reserved = await taskBudgets.reserve(reservation)
      if (!reserved.reserved) return governed({ status: 403, body: rpcError(request.id, -32024, `Signed payment was blocked by durable task budget: ${reserved.reason}.`) })
      reservationActive = true
    }
    if (authorization && !await transition('payment_authorized')) {
      if (reservationActive && reservation) await taskBudgets.cancel(reservation)
      return governed({ status: 409, body: rpcError(request.id, -32032, 'The workflow is not awaiting this payment authorization.') })
    }
    let dispatched = await transition('action_dispatched')
    if (!dispatched && currentWorkflowStatus() === 'awaiting_input' && request.method === 'message/send') {
      dispatched = await transition('input_received') && await transition('action_dispatched')
    }
    if (!dispatched) {
      if (reservationActive && reservation) await taskBudgets.cancel(reservation)
      return governed({ status: 409, body: rpcError(request.id, -32032, 'The workflow state does not permit dispatch.') })
    }

    const claimed = await recovery.claim({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, actionSha256, policySha256 })
    recoveryRecord = claimed.record
    if (!claimed.execute) {
      if (reservationActive && reservation) await taskBudgets.cancel(reservation)
      return governed({ status: 409, body: rpcError(request.id, -32033, `Action already ${claimed.record.status}; upstream dispatch was not repeated.`) })
    }

    const startedAt = Date.now()
    try {
      await (options.assertPublicHost ?? assertPublicUpstreamHost)(config.rpcUrl)
      const response = await (options.fetchImpl ?? fetch)(config.rpcUrl, {
        method: 'POST', headers: await upstreamHeaders(config, request, options), body: JSON.stringify(request), redirect: 'manual', signal: AbortSignal.timeout(policy.timeoutMs),
      })
      if (response.status === 402) {
        if (reservationActive && reservation) await taskBudgets.cancel(reservation)
        const challengeHeader = response.headers.get(PAYMENT_REQUIRED_HEADER)
        if (!challengeHeader || challengeHeader.length > 16_384) {
          await transition('action_failed')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'failed', responseStatus: 502, responseSha256: governance.evidenceSha256 })
          return governed({ status: 502, body: rpcError(request.id, -32022, 'A2A upstream returned a malformed x402 challenge.') })
        }
        let challenge
        try { challenge = decodeChallenge(challengeHeader) } catch {
          await transition('action_failed')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'failed', responseStatus: 502, responseSha256: governance.evidenceSha256 })
          return governed({ status: 502, body: rpcError(request.id, -32022, 'A2A upstream returned a malformed x402 challenge.') })
        }
        const allowed = []
        for (const requirement of challenge.accepts) {
          const decision = evaluateRequirement(config.paymentPolicy, durableTaskId, config, requirement, challenge.resource.url, `a2a-auth-${crypto.createHash('sha256').update(`${options.traceId}:${requirement.amount}`).digest('hex').slice(0, 32)}`)
          if (!decision.allowed || !config.paymentPolicy) continue
          const maxTaskBudget = maxTaskBudgetFor(decision.network, decision.asset, config.paymentPolicy.assetRules)
          if (!maxTaskBudget) continue
          const available = await taskBudgets.canReserve({ tenantId: options.tenantId, agentId: config.id, taskId: durableTaskId, network: decision.network, asset: decision.asset, amount: decision.amount, maxTaskBudget })
          if (available.allowed) allowed.push(requirement)
        }
        if (allowed.length === 0) {
          await transition('action_denied')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'failed', responseStatus: 403, responseSha256: governance.evidenceSha256 })
          return governed({ status: 403, body: rpcError(request.id, -32020, 'The upstream payment terms are outside the tenant buyer policy.') })
        }
        await transition('payment_required')
        const filtered = { ...challenge, accepts: allowed }
        recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'awaiting_payment', responseStatus: 402, responseSha256: governanceDigest(filtered) })
        return governed({
          status: 402,
          body: filtered,
          headers: { 'Cache-Control': 'no-store', 'X-Maha-Task-ID': workflowTaskId, [PAYMENT_REQUIRED_HEADER]: encodeChallengeHeader(filtered as Parameters<typeof encodeChallengeHeader>[0]) },
        })
      }
      if (reservationActive && reservation && response.status >= 400 && response.status < 500) { await taskBudgets.cancel(reservation); reservationActive = false }
      if (response.status >= 300 && response.status < 400 || response.status >= 500) {
        await controls.recordFailure(options.tenantId, config.id, policy)
        await transition('action_failed')
        recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'failed', responseStatus: 502, responseSha256: governance.evidenceSha256 })
        return governed({ status: 502, body: rpcError(request.id, -32603, `Upstream A2A HTTP Error (${response.status}).`) })
      }
      const { json } = await readBounded(response)
      if (typeof json !== 'object' || json === null || Array.isArray(json) || (json as Record<string, unknown>).jsonrpc !== '2.0' || (json as Record<string, unknown>).id !== request.id) throw new Error('A2A upstream returned an invalid JSON-RPC response.')
      const receiptHeader = response.headers.get(PAYMENT_RESPONSE_HEADER)
      let budgetState: A2ATaskBudgetState | null = null
      if (authorization && payer && config.paymentPolicy) {
        const settlement = verifySettlement({ policy: config.paymentPolicy, authorization, payer, receipt: decodeReceipt(receiptHeader) })
        if (!settlement.verified) {
          await transition('action_failed')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'indeterminate', responseStatus: 502, responseSha256: governance.evidenceSha256 })
          return governed({ status: 502, body: rpcError(request.id, -32023, `Upstream payment receipt failed policy verification: ${settlement.code}.`) })
        }
        if (!reservation) {
          await transition('action_failed')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'indeterminate', responseStatus: 502, responseSha256: governance.evidenceSha256 })
          return governed({ status: 502, body: rpcError(request.id, -32025, 'The verified settlement has no durable task-budget reservation.') })
        }
        const committed = await taskBudgets.settle({ ...reservation, transaction: settlement.transaction })
        if (!committed.settled) {
          await transition('action_failed')
          recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'indeterminate', responseStatus: 502, responseSha256: governance.evidenceSha256, upstreamReferenceSha256: governanceDigest(settlement.transaction) })
          return governed({ status: 502, body: rpcError(request.id, -32025, `The verified settlement could not be committed to the task budget: ${committed.reason}.`) })
        }
        reservationActive = false
        budgetState = committed.state
      }
      const upstreamTaskId = a2aUpstreamTaskId(json)
      if (upstreamTaskId) await taskBudgets.bindUpstreamTask({ tenantId: options.tenantId, agentId: config.id, taskId: durableTaskId, upstreamTaskId: a2aTaskIdForExternal(upstreamTaskId) })
      await controls.recordSuccess(options.tenantId, config.id)
      await (options.audit ?? recordUsage)(config, request, options, Date.now() - startedAt, signedAmount, governance)
      await transition('action_succeeded')
      const lifecycleEvent = a2aLifecycleEvent(json)
      if (lifecycleEvent) await transition(lifecycleEvent)
      const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'X-Maha-Task-ID': workflowTaskId }
      if (budgetState) {
        headers['X-Maha-Task-Spent'] = budgetState.cumulativeSpentBaseUnits
        headers['X-Maha-Task-Budget'] = budgetState.maxTaskBudgetBaseUnits
        headers['X-Maha-Task-Status'] = budgetState.status
      }
      if (receiptHeader) headers[PAYMENT_RESPONSE_HEADER] = receiptHeader
      recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'succeeded', responseStatus: response.status, responseSha256: governanceDigest(json), ...(upstreamTaskId ? { upstreamReferenceSha256: governanceDigest(upstreamTaskId) } : {}) })
      return governed({ status: response.status, body: json, headers })
    } catch (error) {
      try { await controls.recordFailure(options.tenantId, config.id, policy) } catch {}
      try { await transition('action_failed') } catch {}
      const timeout = error instanceof Error && (error.name === 'TimeoutError' || /timed out|aborted/i.test(error.message))
      try { recoveryRecord = await recovery.finish({ tenantId: options.tenantId, taskId: workflowTaskId, actionId, status: 'indeterminate', responseStatus: timeout ? 504 : 502, responseSha256: governance.evidenceSha256 }) } catch {}
      return governed({ status: timeout ? 504 : 502, body: rpcError(request.id, -32603, timeout ? 'Upstream A2A request timed out.' : 'Upstream A2A connection or protocol failure.') })
    }
  }
}
