import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { MCPServerConfig, JSONRPCRequest, JSONRPCResponse, MCPProxyContext } from './types';
import { decryptSecret } from './registry';

const redis = Redis.fromEnv();

export class MCPProxyEngine {
  /**
   * Proxies a standard JSON-RPC 2.0 MCP request to the operator's upstream server.
   */
  static async dispatch(
    serverConfig: MCPServerConfig,
    rpcPayload: JSONRPCRequest,
    ctx: MCPProxyContext
  ): Promise<JSONRPCResponse> {
    if (serverConfig.status !== 'active') {
      return {
        jsonrpc: '2.0',
        id: rpcPayload.id,
        error: { code: -32600, message: 'Target MCP Upstream Server is suspended' }
      };
    }

    const targetUrl = new URL(serverConfig.baseUrl.replace(/\/$/, '') + '/rpc');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Maha-Tenant-ID': ctx.tenantId,
      'X-Maha-Trace-ID': ctx.traceId,
      'X-Maha-Proxy-Timestamp': Date.now().toString(),
    };

    // Inject upstream credentials securely
    if (serverConfig.authType === 'bearer' && serverConfig.authSecretEncrypted) {
      const token = decryptSecret(serverConfig.authSecretEncrypted);
      headers['Authorization'] = `Bearer ${token}`;
    } else if (serverConfig.authType === 'hmac' && serverConfig.authSecretEncrypted) {
      const secret = decryptSecret(serverConfig.authSecretEncrypted);
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${ctx.traceId}:${JSON.stringify(rpcPayload)}`)
        .digest('hex');
      headers['X-Maha-HMAC-Signature'] = signature;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(rpcPayload),
        signal: AbortSignal.timeout(10000) // 10-second standard timeout for upstream tools
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          jsonrpc: '2.0',
          id: rpcPayload.id,
          error: {
            code: -32603,
            message: `Upstream MCP HTTP Error (${response.status})`,
            data: errText
          }
        };
      }

      const jsonRpcData: JSONRPCResponse = await response.json();

      // Log invocation to Upstash Redis double-entry audit ledger
      await this.recordMCPUsage(ctx, serverConfig, rpcPayload, Date.now() - startTime);

      return jsonRpcData;

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown proxy error';
      return {
        jsonrpc: '2.0',
        id: rpcPayload.id,
        error: {
          code: -32603,
          message: 'Upstream MCP Gateway Timeout / Connection Refused',
          data: errorMessage
        }
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
    const ledgerKey = `ledger:tenant:${ctx.tenantId}:entries`;
    
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

    await redis.zadd(ledgerKey, { score: timestamp, member: JSON.stringify(entry) });
  }
}