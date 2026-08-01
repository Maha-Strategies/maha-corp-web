import { NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-maha-tenant-id');
    if (!tenantId) return NextResponse.json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, { status: 401 });
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 });

    const body = await req.json();
    const { name, baseUrl, authType, secret, allowedEngines } = body;

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 160 || typeof baseUrl !== 'string' || !authType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, baseUrl, and authType' },
        { status: 400 }
      );
    }

    if (authType !== 'none' && authType !== 'bearer' && authType !== 'hmac') {
      return NextResponse.json({ error: 'Invalid authType. Supported: bearer, hmac, none' }, { status: 400 });
    }
    if (authType === 'none' && secret !== undefined) return NextResponse.json({ error: 'authType none must not include a secret' }, { status: 400 });
    if (authType !== 'none' && (typeof secret !== 'string' || secret.length < 1 || secret.length > 4_096)) return NextResponse.json({ error: 'A bounded secret is required for bearer or hmac authentication' }, { status: 400 });
    const validEngines = new Set(['tensor-opt', 'geometric-ai', 'qec-compiler', 'landscape-opt', '*'])
    if (allowedEngines !== undefined && (!Array.isArray(allowedEngines) || allowedEngines.length < 1 || allowedEngines.length > validEngines.size || allowedEngines.some((engine) => typeof engine !== 'string' || !validEngines.has(engine)) || new Set(allowedEngines).size !== allowedEngines.length)) {
      return NextResponse.json({ error: 'allowedEngines must be a non-empty, duplicate-free list of supported engines.' }, { status: 400 });
    }

    const server = await MCPRegistry.registerServer(
      tenantId,
      {
        name: name.trim(),
        baseUrl,
        authType,
        allowedEngines: allowedEngines ?? ['*'],
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
