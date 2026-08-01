import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { MCPServerConfig, JSONRPCRequest, JSONRPCResponse, MCPProxyContext } from './types';
import { scopedRedisKey } from '../redis-namespace';
import { MCPControls } from './controls';
import { prepareMcpUpstream, readBoundedUpstreamJson } from './upstream';
import { captureOperationalError, mcpMethodClass, traceMcpUpstream, traceRedisQuery } from '../observability/telemetry';

const redis = Redis.fromEnv();

export class MCPProxyEngine {
  /**
   * Proxies a standard JSON-RPC 2.0 MCP request to the operator's upstream server.
   */
  static async dispatch(
    serverConfig: MCPServerConfig,
    rpcPayload: JSONRPCRequest,
    ctx: MCPProxyContext
  ): Promise<{ body: JSONRPCResponse; status: number; retryAfterSeconds?: number; connectivityFailure?: { failure: string; status?: number } }> {
    if (serverConfig.status !== 'active') {
      return {
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32004, message: 'Target MCP Upstream Server is suspended' } },
      };
    }

    const startTime = Date.now();
    let phase: 'controls' | 'transport' | 'audit' = 'controls'

    try {
      const policy = await MCPControls.getPolicy(ctx.tenantId)
      const circuit = await MCPControls.beforeRequest(ctx.tenantId, serverConfig.id, policy)
      if (!circuit.allowed) return {
        status: 503,
        retryAfterSeconds: circuit.retryAfterSeconds,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32003, message: 'Upstream circuit breaker is open' } },
      }
      const rate = await MCPControls.consumeRateLimit(ctx.tenantId, policy.requestsPerMinute)
      if (!rate.allowed) return {
        status: 429,
        retryAfterSeconds: rate.retryAfterSeconds,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32002, message: 'Tenant MCP request limit reached' } },
      }
      phase = 'transport'
      const upstream = await prepareMcpUpstream(serverConfig, rpcPayload, ctx)
      const response = await traceMcpUpstream(rpcPayload.method, new URL(upstream.url).hostname, async (span) => {
        const result = await fetch(upstream.url, {
          method: 'POST', headers: upstream.headers, body: JSON.stringify(rpcPayload),
          signal: AbortSignal.timeout(policy.timeoutMs), redirect: 'manual',
        })
        span.setAttribute('http.response.status_code', result.status)
        span.setStatus(result.ok ? { code: 1, message: 'ok' } : { code: 2, message: result.status >= 500 ? 'unavailable' : 'invalid_argument' })
        return result
      });

      if (!response.ok) {
        if (response.status >= 500 || response.status >= 300 && response.status < 400) await MCPControls.recordFailure(ctx.tenantId, serverConfig.id, policy)
        else await MCPControls.recordSuccess(ctx.tenantId, serverConfig.id)
        if (response.status >= 500 || response.status >= 300 && response.status < 400) captureOperationalError(new Error(`MCP upstream returned HTTP ${response.status}.`), 'mcp-upstream', mcpMethodClass(rpcPayload.method))
        return {
          status: 502,
          ...(response.status >= 500 || response.status >= 300 && response.status < 400 ? { connectivityFailure: { failure: response.status >= 500 ? 'upstream_5xx' : 'redirect_blocked', status: response.status } } : {}),
          body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32603, message: `Upstream MCP HTTP Error (${response.status})` } },
        };
      }

      const jsonRpcData = await readBoundedUpstreamJson(response) as JSONRPCResponse;
      if (!jsonRpcData || jsonRpcData.jsonrpc !== '2.0' || jsonRpcData.id !== rpcPayload.id) throw new Error('Upstream returned an invalid JSON-RPC response.')
      await MCPControls.recordSuccess(ctx.tenantId, serverConfig.id)
      phase = 'audit'

      // Log invocation to Upstash Redis double-entry audit ledger
      await this.recordMCPUsage(ctx, serverConfig, rpcPayload, Date.now() - startTime);

      return { body: jsonRpcData, status: 200 };

    } catch (err: unknown) {
      if (phase === 'transport') {
        captureOperationalError(err, 'mcp-upstream', mcpMethodClass(rpcPayload.method))
        try {
          const policy = await MCPControls.getPolicy(ctx.tenantId)
          await MCPControls.recordFailure(ctx.tenantId, serverConfig.id, policy)
        } catch (controlError) {
          console.error('[MCP Circuit State Error]:', controlError instanceof Error ? controlError.name : 'unknown_error')
        }
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown proxy error';
      if (phase === 'controls') return {
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32005, message: 'MCP SLA controls are temporarily unavailable' } },
      }
      if (phase === 'audit') return {
        status: 503,
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32006, message: 'MCP usage audit could not be committed' } },
      }
      return {
        status: errorMessage.includes('timed out') || errorMessage.includes('aborted') ? 504 : 502,
        connectivityFailure: { failure: errorMessage.includes('timed out') || errorMessage.includes('aborted') ? 'timeout' : 'connection_or_protocol_error' },
        body: { jsonrpc: '2.0', id: rpcPayload.id, error: { code: -32603, message: 'Upstream MCP Gateway Timeout / Connection Refused' } },
      };
    }
  }

  /**
   * Appends MCP proxy execution event to Upstash Redis ledger for billing/audit.
   */
  private static async recordMCPUsage(
    ctx: MCPProxyContext,
    server: MCPServerConfig,
    req: JSONRPCRequest,
    latencyMs: number
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
        latencyMs
      }
    };

    await traceRedisQuery('ZADD', () => redis.zadd(ledgerKey, { score: timestamp, member: JSON.stringify(entry) }));
  }
}
