import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import type { MCPServerConfig, JSONRPCRequest, JSONRPCResponse, MCPProxyContext } from './types.ts';
import { scopedRedisKey } from '../redis-namespace.ts';
import { MCPControls } from './controls.ts';
import { prepareMcpUpstream, readBoundedUpstreamJson } from './upstream.ts';
import { captureOperationalError, mcpMethodClass, traceMcpUpstream, traceRedisQuery } from '../observability/telemetry.ts';
import { evaluateMcpGovernance, governanceResponseHeaders } from '../governance/adapters.ts';
import { governanceDigest, type GovernanceDecision } from '../governance/envelope.ts';
import type { GovernancePolicyLayer } from '../governance/policy-inheritance.ts';
import { APPROVAL_ID_HEADER, APPROVAL_STATE_HEADER, approvalIdFor, UpstashApprovalStore, type ApprovalStore } from '../workflows/approvals.ts';
import { recoveryResponseHeaders, UpstashRecoveryStore, workflowActionIdForExternal, type RecoveryRecord, type RecoveryStore } from '../workflows/recovery.ts';
import { UpstashWorkflowTaskStore, workflowResponseHeaders, workflowTransitionId, type WorkflowTaskState, type WorkflowTaskStore, type WorkflowTransitionEvent } from '../workflows/task-state.ts';

const redis = Redis.fromEnv();

type MCPProxyResult = {
  body: JSONRPCResponse
  status: number
  headers?: Record<string, string>
  retryAfterSeconds?: number
  connectivityFailure?: { failure: string; status?: number }
}

type MCPGatewayControls = {
  getPolicy(tenantId: string): Promise<{ requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }>
  beforeRequest(tenantId: string, serverId: string, policy: { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }): Promise<{ allowed: boolean; retryAfterSeconds: number }>
  consumeRateLimit(tenantId: string, limit: number): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }>
  recordSuccess(tenantId: string, serverId: string): Promise<void>
  recordFailure(tenantId: string, serverId: string, policy: { requestsPerMinute: number; timeoutMs: number; failureThreshold: number; cooldownMs: number }): Promise<void>
}

type MCPDispatchDependencies = {
  controls?: MCPGatewayControls
  prepareUpstream?: typeof prepareMcpUpstream
  readUpstreamJson?: typeof readBoundedUpstreamJson
  fetchImpl?: typeof fetch
  audit?: (ctx: MCPProxyContext, server: MCPServerConfig, request: JSONRPCRequest, latencyMs: number, governance: GovernanceDecision) => Promise<void>
  workflowTasks?: WorkflowTaskStore
  policyLayers?: GovernancePolicyLayer[]
  approvals?: ApprovalStore
  recovery?: RecoveryStore
}

export class MCPProxyEngine {
  /**
   * Proxies a standard JSON-RPC 2.0 MCP request to the operator's upstream server.
   */
  static async dispatch(
    serverConfig: MCPServerConfig,
    rpcPayload: JSONRPCRequest,
    ctx: MCPProxyContext,
    dependencies: MCPDispatchDependencies = {},
  ): Promise<MCPProxyResult> {
    if (serverConfig.status !== 'active') {
      return {
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32004, message: 'Target MCP Upstream Server is suspended' } },
      };
    }

    const startTime = Date.now();
    let phase: 'controls' | 'transport' | 'audit' = 'controls'
    let governance: GovernanceDecision | null = null
    let workflowState: WorkflowTaskState | null = null
    let recoveryRecord: RecoveryRecord | null = null
    let approvalState: string | null = null
    const governed = (result: MCPProxyResult): MCPProxyResult => governance
      ? { ...result, headers: { ...governanceResponseHeaders(governance), ...(workflowState ? workflowResponseHeaders(workflowState) : {}), ...(recoveryRecord ? recoveryResponseHeaders(recoveryRecord) : {}), ...(approvalState ? { [APPROVAL_STATE_HEADER]: approvalState } : {}), ...(result.headers ?? {}) } }
      : result

    try {
      const controls = dependencies.controls ?? MCPControls
      const policy = await controls.getPolicy(ctx.tenantId)
      const circuit = await controls.beforeRequest(ctx.tenantId, serverConfig.id, policy)
      if (!circuit.allowed) return {
        status: 503,
        retryAfterSeconds: circuit.retryAfterSeconds,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32003, message: 'Upstream circuit breaker is open' } },
      }
      const rate = await controls.consumeRateLimit(ctx.tenantId, policy.requestsPerMinute)
      if (!rate.allowed) return {
        status: 429,
        retryAfterSeconds: rate.retryAfterSeconds,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32002, message: 'Tenant MCP request limit reached' } },
      }
      governance = evaluateMcpGovernance({ server: serverConfig, request: rpcPayload, context: ctx, timeoutMs: policy.timeoutMs, policyLayers: dependencies.policyLayers })
      const workflowTasks = dependencies.workflowTasks ?? new UpstashWorkflowTaskStore()
      const transition = async (event: WorkflowTransitionEvent) => {
        if (!ctx.taskId) return true
        const result = await workflowTasks.transition({
          tenantId: ctx.tenantId,
          taskId: ctx.taskId,
          transitionId: workflowTransitionId({ taskId: ctx.taskId, requestId: rpcPayload.id, targetId: serverConfig.id, operation: rpcPayload.method, event }),
          event,
          actor: { transport: 'mcp', targetId: serverConfig.id, operation: rpcPayload.method },
          evidenceSha256: governance!.evidenceSha256,
        })
        workflowState = result.state
        return result.accepted
      }
      const actionSha256 = governanceDigest({ taskId: ctx.taskId ?? governance.request.taskId, targetId: serverConfig.id, operation: rpcPayload.method, capability: rpcPayload.method === 'tools/call' ? rpcPayload.params?.name ?? null : null, inputSha256: ctx.inputSha256 ?? governanceDigest(rpcPayload) })
      const policySha256 = governance.policy.policySha256!
      const actionId = ctx.actionId ?? workflowActionIdForExternal(ctx.traceId)
      const recovery = dependencies.recovery ?? new UpstashRecoveryStore()
      if (governance.outcome === 'deny') {
        const accepted = await transition('action_denied')
        if (!accepted) return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32032, message: 'The workflow state does not permit this transition.' } } })
        return governed({ status: 403, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32030, message: `Maha governance deny: ${governance.reasonCodes.join(',')}` } } })
      }
      if (ctx.taskId) {
        const existing = await recovery.get(ctx.tenantId, ctx.taskId, actionId)
        if (existing) {
          recoveryRecord = existing
          if (existing.actionSha256 !== actionSha256 || existing.policySha256 !== policySha256) return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32034, message: 'The action ID is already bound to a different request or policy.' } } })
          return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32033, message: `Action already ${existing.status}; upstream dispatch was not repeated.` } } })
        }
      }
      if (governance.outcome === 'require_review') {
        if (!ctx.taskId) return governed({ status: 403, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32031, message: 'Human review requires X-Maha-Task-ID and X-Maha-Action-ID.' } } })
        const approvals = dependencies.approvals ?? new UpstashApprovalStore()
        const expectedApprovalId = approvalIdFor(actionSha256, policySha256)
        if (!ctx.approvalId) {
          const record = await approvals.request({ approvalId: expectedApprovalId, tenantId: ctx.tenantId, taskId: ctx.taskId, actionSha256, policySha256, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() })
          approvalState = record.status
          const accepted = await transition('review_required')
          if (!accepted) return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32032, message: 'The workflow state does not permit this transition.' } } })
          return governed({ status: 403, headers: { [APPROVAL_ID_HEADER]: record.approvalId }, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32031, message: 'Maha governance requires a human approval bound to this action and policy.' } } })
        }
        if (ctx.approvalId !== expectedApprovalId) return governed({ status: 403, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32035, message: 'The supplied approval is not bound to this action and policy.' } } })
        const consumed = await approvals.consume({ tenantId: ctx.tenantId, taskId: ctx.taskId, approvalId: ctx.approvalId, actionSha256, policySha256 })
        approvalState = consumed.record?.status ?? consumed.reason
        if (!consumed.consumed) return governed({ status: 403, headers: { [APPROVAL_ID_HEADER]: ctx.approvalId }, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32035, message: `Approval cannot be used: ${consumed.reason}.` } } })
        if (!await transition('review_approved')) return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32032, message: 'The workflow is not awaiting review approval.' } } })
      }
      if (!await transition('action_dispatched')) return governed({
        status: 409,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32032, message: 'The workflow state does not permit dispatch.' } },
      })
      if (ctx.taskId) {
        const claimed = await recovery.claim({ tenantId: ctx.tenantId, taskId: ctx.taskId, actionId, actionSha256, policySha256 })
        recoveryRecord = claimed.record
        if (!claimed.execute) return governed({ status: 409, body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32033, message: `Action already ${claimed.record.status}; upstream dispatch was not repeated.` } } })
      }
      phase = 'transport'
      const upstream = await (dependencies.prepareUpstream ?? prepareMcpUpstream)(serverConfig, rpcPayload, ctx)
      const response = await traceMcpUpstream(rpcPayload.method, new URL(upstream.url).hostname, async (span) => {
        const result = await (dependencies.fetchImpl ?? fetch)(upstream.url, {
          method: 'POST', headers: upstream.headers, body: JSON.stringify(rpcPayload),
          signal: AbortSignal.timeout(policy.timeoutMs), redirect: 'manual',
        })
        span.setAttribute('http.response.status_code', result.status)
        span.setStatus(result.ok ? { code: 1, message: 'ok' } : { code: 2, message: result.status >= 500 ? 'unavailable' : 'invalid_argument' })
        return result
      });

      if (!response.ok) {
        if (response.status >= 500 || response.status >= 300 && response.status < 400) await controls.recordFailure(ctx.tenantId, serverConfig.id, policy)
        else await controls.recordSuccess(ctx.tenantId, serverConfig.id)
        if (response.status >= 500 || response.status >= 300 && response.status < 400) captureOperationalError(new Error(`MCP upstream returned HTTP ${response.status}.`), 'mcp-upstream', mcpMethodClass(rpcPayload.method))
        await transition('action_failed')
        if (ctx.taskId) recoveryRecord = await recovery.finish({ tenantId: ctx.tenantId, taskId: ctx.taskId, actionId, status: 'failed', responseStatus: 502, responseSha256: governance.evidenceSha256 })
        return governed({
          status: 502,
          ...(response.status >= 500 || response.status >= 300 && response.status < 400 ? { connectivityFailure: { failure: response.status >= 500 ? 'upstream_5xx' : 'redirect_blocked', status: response.status } } : {}),
          body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32603, message: `Upstream MCP HTTP Error (${response.status})` } },
        });
      }

      const jsonRpcData = await (dependencies.readUpstreamJson ?? readBoundedUpstreamJson)(response) as JSONRPCResponse;
      if (!jsonRpcData || jsonRpcData.jsonrpc !== '2.0' || jsonRpcData.id !== rpcPayload.id) throw new Error('Upstream returned an invalid JSON-RPC response.')
      await controls.recordSuccess(ctx.tenantId, serverConfig.id)
      await transition('action_succeeded')
      if (ctx.taskId) recoveryRecord = await recovery.finish({ tenantId: ctx.tenantId, taskId: ctx.taskId, actionId, status: 'succeeded', responseStatus: 200, responseSha256: governanceDigest(jsonRpcData) })
      phase = 'audit'

      // Log invocation to Upstash Redis double-entry audit ledger
      await (dependencies.audit ?? this.recordMCPUsage)(ctx, serverConfig, rpcPayload, Date.now() - startTime, governance);

      return governed({ body: jsonRpcData, status: 200 });

    } catch (err: unknown) {
      if (phase === 'transport') {
        captureOperationalError(err, 'mcp-upstream', mcpMethodClass(rpcPayload.method))
        try {
          const controls = dependencies.controls ?? MCPControls
          const policy = await controls.getPolicy(ctx.tenantId)
          await controls.recordFailure(ctx.tenantId, serverConfig.id, policy)
        } catch (controlError) {
          console.error('[MCP Circuit State Error]:', controlError instanceof Error ? controlError.name : 'unknown_error')
        }
      }
      if (phase === 'transport' && governance && ctx.taskId) {
        try {
          const workflowTasks = dependencies.workflowTasks ?? new UpstashWorkflowTaskStore()
          const result = await workflowTasks.transition({
            tenantId: ctx.tenantId,
            taskId: ctx.taskId,
            transitionId: workflowTransitionId({ taskId: ctx.taskId, requestId: rpcPayload.id, targetId: serverConfig.id, operation: rpcPayload.method, event: 'action_failed' }),
            event: 'action_failed', actor: { transport: 'mcp', targetId: serverConfig.id, operation: rpcPayload.method }, evidenceSha256: governance.evidenceSha256,
          })
          workflowState = result.state
        } catch {}
        try {
          const recovery = dependencies.recovery ?? new UpstashRecoveryStore()
          recoveryRecord = await recovery.finish({ tenantId: ctx.tenantId, taskId: ctx.taskId, actionId: ctx.actionId ?? workflowActionIdForExternal(ctx.traceId), status: 'indeterminate', responseStatus: null, responseSha256: governance.evidenceSha256 })
        } catch {}
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown proxy error';
      if (phase === 'controls') return governed({
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32005, message: 'MCP SLA controls are temporarily unavailable' } },
      })
      if (phase === 'audit') return governed({
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32006, message: 'MCP usage audit could not be committed' } },
      })
      return governed({
        status: errorMessage.includes('timed out') || errorMessage.includes('aborted') ? 504 : 502,
        connectivityFailure: { failure: errorMessage.includes('timed out') || errorMessage.includes('aborted') ? 'timeout' : 'connection_or_protocol_error' },
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32603, message: 'Upstream MCP Gateway Timeout / Connection Refused' } },
      });
    }
  }

  /**
   * Appends MCP proxy execution event to Upstash Redis ledger for billing/audit.
   */
  private static async recordMCPUsage(
    ctx: MCPProxyContext,
    server: MCPServerConfig,
    req: JSONRPCRequest,
    latencyMs: number,
    governance: GovernanceDecision,
  ): Promise<void> {
    const timestamp = Date.now();
    const ledgerKey = scopedRedisKey(`ledger:tenant:${ctx.tenantId}:entries`);
    
    const entry = {
      id: `mcp_tx_${crypto.randomBytes(6).toString('hex')}`,
      tenantId: ctx.tenantId,
      jobId: ctx.traceId,
      engine: 'mcp-gateway',
      timestamp,
      creditDelta: -1, // Fixed nominal charge per tool invocation
      entryType: 'DEBIT',
      hmacSignature: crypto.createHash('sha256').update(`${ctx.traceId}:${req.method}`).digest('hex'),
      inputHash: crypto.createHash('sha256').update(JSON.stringify(req.params || {})).digest('hex'),
      outputHash: 'mcp-invoked',
      status: 'COMPLETED',
      meta: {
        serverId: server.id,
        method: req.method,
        toolName: req.method === 'tools/call' && typeof req.params?.name === 'string' ? req.params.name : null,
        latencyMs,
        governanceOutcome: governance.outcome,
        governanceEvidenceSha256: governance.evidenceSha256,
        governancePolicySha256: governance.policy.policySha256,
      }
    };

    await traceRedisQuery('ZADD', () => redis.zadd(ledgerKey, { score: timestamp, member: JSON.stringify(entry) }));
  }
}
