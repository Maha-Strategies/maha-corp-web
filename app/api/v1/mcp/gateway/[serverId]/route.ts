import { NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';
import { MCPProxyEngine } from '@/lib/mcp/proxy';
import { JSONRPCRequest } from '@/lib/mcp/types';
import crypto from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params;

    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Missing X-Tenant-ID Header' } },
        { status: 400 }
      );
    }

    const serverConfig = await MCPRegistry.getServer(tenantId, serverId);

    if (!serverConfig) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: null, error: { code: -32601, message: 'Target MCP Server not registered for this tenant' } },
        { status: 404 }
      );
    }

    const body: JSONRPCRequest = await req.json();

    if (!body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
      return NextResponse.json(
        { jsonrpc: '2.0', id: body.id || null, error: { code: -32600, message: 'Invalid JSON-RPC 2.0 payload' } },
        { status: 400 }
      );
    }

    const traceId = `trc_${crypto.randomBytes(8).toString('hex')}`;
    const response = await MCPProxyEngine.dispatch(serverConfig, body, {
      tenantId,
      serverId,
      traceId
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[MCP Gateway Error]:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal MCP Gateway Processing Failure' } },
      { status: 500 }
    );
  }
}