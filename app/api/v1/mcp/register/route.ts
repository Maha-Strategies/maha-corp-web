import { NextRequest, NextResponse } from 'next/server';
import { MCPRegistry } from '@/lib/mcp/registry';
import { MCPDiscoveryService } from '@/lib/mcp/discovery';
import type { MCPServerConfig, MCPToolDiscovery } from '@/lib/mcp/types';

async function persistDiscovery(tenantId: string, server: MCPServerConfig, discovery: MCPToolDiscovery) {
  try { return await MCPRegistry.updateDiscovery(tenantId, server.id, discovery) }
  catch (error) {
    console.error('[MCP Discovery Persistence Error]:', error instanceof Error ? error.name : 'unknown_error')
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-maha-tenant-id');
    if (!tenantId) return NextResponse.json({ error: { code: 'api_key_required', message: 'Provide Authorization: Bearer <API_KEY>.' } }, { status: 401 });
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, { status: 415 });

    let body: Record<string, unknown>
    try { body = await req.json() as Record<string, unknown> } catch { return NextResponse.json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }, { status: 400 }) }
    const { name, baseUrl, authType, secret } = body;

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
    const server = await MCPRegistry.registerServer(
      tenantId,
      {
        name: name.trim(),
        baseUrl,
        authType,
        allowedEngines: ['*'],
        status: 'active',
      },
      typeof secret === 'string' ? secret : undefined
    );

    try {
      const discovery = await MCPDiscoveryService.discover(server)
      const updated = await persistDiscovery(tenantId, server, discovery)
      const safeDiscovery = updated ? discovery : { status: 'error' as const, tools: [], discoveredAt: Date.now(), error: 'Tool discovery metadata could not be persisted.' }
      const summary = MCPRegistry.summarize(updated ?? { ...server, discovery: safeDiscovery })
      return NextResponse.json({ ...summary, id: summary.serverId }, { status: 201 });
    } catch (discoveryError) {
      const discovery = {
        status: 'error' as const,
        tools: [],
        discoveredAt: Date.now(),
        error: discoveryError instanceof Error ? discoveryError.message : 'Tool discovery failed.',
      }
      const updated = await persistDiscovery(tenantId, server, discovery)
      const summary = MCPRegistry.summarize(updated ?? { ...server, discovery })
      return NextResponse.json({ ...summary, id: summary.serverId }, { status: 201 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('HTTPS URL') || message.includes('public DNS hostname') || message.includes('non-public network address')) {
      return NextResponse.json({ error: { code: 'invalid_upstream_url', message } }, { status: 400 })
    }
    console.error('[MCP Register Error]:', error);
    return NextResponse.json(
      { error: 'Internal failure registering MCP upstream server' },
      { status: 500 }
    );
  }
}
