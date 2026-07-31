import { NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing required X-Tenant-ID header' }, { status: 400 });
    }

    const body = await req.json();
    const { name, baseUrl, authType, secret, allowedEngines } = body;

    if (!name || !baseUrl || !authType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, baseUrl, and authType' },
        { status: 400 }
      );
    }

    if (authType !== 'none' && authType !== 'bearer' && authType !== 'hmac') {
      return NextResponse.json({ error: 'Invalid authType. Supported: bearer, hmac, none' }, { status: 400 });
    }

    const server = await MCPRegistry.registerServer(
      tenantId,
      {
        name,
        baseUrl,
        authType,
        allowedEngines: allowedEngines || ['*'],
        status: 'active',
      },
      secret
    );

    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error('[MCP Register Error]:', error);
    return NextResponse.json(
      { error: 'Internal failure registering MCP upstream server' },
      { status: 500 }
    );
  }
}