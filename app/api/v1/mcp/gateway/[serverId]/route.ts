import { NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';
import { MCPProxyEngine } from '@/lib/mcp/proxy';
import { JSONRPCRequest } from '@/lib/mcp/types';
import crypto from 'crypto';
import { MAX_MCP_GATEWAY_BODY_BYTES } from '@/lib/mcp-gateway';

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

    const traceId = `trc_${crypto.randomBytes(8).toString('hex')}`;
    const result = await MCPProxyEngine.dispatch(serverConfig, body, {
      tenantId,
      serverId,
      traceId
    });

    const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
    if (result.retryAfterSeconds) headers['Retry-After'] = String(result.retryAfterSeconds)
    return NextResponse.json(result.body, { status: result.status, headers });

  } catch (error) {
    console.error('[MCP Gateway Error]:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal MCP Gateway Processing Failure' } },
      { status: 500 }
    );
  }
}
