import { after, NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';
import { MCPProxyEngine } from '@/lib/mcp/proxy';
import { JSONRPCRequest } from '@/lib/mcp/types';
import crypto from 'crypto';
import { MAX_MCP_GATEWAY_BODY_BYTES } from '@/lib/mcp-gateway';
import { sendMcpConnectivityAlert } from '@/lib/observability/alerts';
import { evaluateMcpServerPolicy } from '@/lib/mcp/validation';
import { isAttributable, resolveTaskAttribution, resolveTenantId } from '@/lib/agent-task-attribution';
import { recordAgentTaskSpend } from '@/lib/agent-task-spend';
import { workflowTaskIdForExternal } from '@/lib/workflows/task-state';
import { workflowActionIdForExternal } from '@/lib/workflows/recovery';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;
    if (!/^mcp_srv_[a-f0-9]{16}$/.test(serverId)) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid MCP server ID' } }, { status: 400 });

    const tenantId = req.headers.get('x-maha-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const serverConfig = await MCPRegistry.getServer(tenantId, serverId);

    if (!serverConfig) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32601, message: 'Target MCP Server not registered for this tenant' } },
        { status: 404 }
      );
    }

    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Content-Type must be application/json' } }, { status: 415 });
    const declaredLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_GATEWAY_BODY_BYTES) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'MCP request exceeds 64 KB' } }, { status: 413 });
    const text = await req.text()
    if (new TextEncoder().encode(text).byteLength > MAX_MCP_GATEWAY_BODY_BYTES) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'MCP request exceeds 64 KB' } }, { status: 413 });
    let body: JSONRPCRequest
    try { body = JSON.parse(text) as JSONRPCRequest } catch { return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }, { status: 400 }); }

    if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !body.method || body.method.length > 256 || (typeof body.id !== 'string' && typeof body.id !== 'number') || (body.params !== undefined && (typeof body.params !== 'object' || body.params === null || Array.isArray(body.params)))) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: body.id || null, error: { code: -32600, message: 'Invalid JSON-RPC 2.0 payload' } },
        { status: 400 }
      );
    }

    const policy = evaluateMcpServerPolicy(body, serverConfig)
    if (!policy.allowed) return NextResponse.json(
      { jsonrpc: '2.0', id: body.id, error: { code: policy.code, message: policy.message } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )

    const traceId = `trc_${crypto.randomBytes(8).toString('hex')}`;
    const attribution = resolveTaskAttribution(req.headers)
    const externalActionId = req.headers.get('x-maha-action-id')
    if (externalActionId && !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(externalActionId)) return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32600, message: 'Invalid X-Maha-Action-ID' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    const result = await MCPProxyEngine.dispatch(serverConfig, body, {
      tenantId,
      serverId,
      traceId,
      ...(attribution.taskId ? { taskId: workflowTaskIdForExternal(attribution.taskId) } : {}),
      actionId: workflowActionIdForExternal(externalActionId ?? traceId),
      approvalId: req.headers.get('x-maha-approval-id') ?? undefined,
      inputSha256: `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`,
      inputBytes: new TextEncoder().encode(text).byteLength,
    });

    const headers: Record<string, string> = { 'Cache-Control': 'no-store', ...(result.headers ?? {}) }
    if (result.retryAfterSeconds) headers['Retry-After'] = String(result.retryAfterSeconds)
    if (result.connectivityFailure) {
      const alert = result.connectivityFailure
      after(() => sendMcpConnectivityAlert({ tenantId, serverId, hostname: new URL(serverConfig.baseUrl).hostname, failure: alert.failure, status: alert.status }).then(() => undefined))
    }
    // One proxied call is one credit, taken at the proxy before this route ran.
    // Recorded after the response exists and through `after`, so attribution
    // adds nothing to the latency of a call that is already proxying to a
    // third-party server.
    // The gateway already authenticated `tenantId` above from the same header
    // this resolves, so they agree; resolved through the shared function so a
    // future change to the header name cannot leave one surface behind.
    if (isAttributable(attribution, resolveTenantId(req.headers) ?? tenantId)) {
      after(() => recordAgentTaskSpend({
        tenantId,
        taskId: attribution.taskId!,
        costCenter: attribution.costCenter,
        surface: 'gateway',
        creditsCharged: 1,
      }))
    }

    return NextResponse.json(result.body, { status: result.status, headers });

  } catch (error) {
    console.error('[MCP Gateway Error]:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal MCP Gateway Processing Failure' } },
      { status: 500 }
    );
  }
}
