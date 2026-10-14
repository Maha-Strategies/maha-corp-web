import { z } from 'zod'
import { readMicroBody } from '../x402/micro-body.ts'
import { searchEndpoints, describeById, localDiscovery, searchInput } from './discovery.ts'
import { DOMAINS, type Domain } from './types.ts'
import { apiJson } from './with402Payment.ts'
const describeInput = z.object({ id: z.string().min(1).max(160) }).strict()
const rpc = z.object({ jsonrpc: z.literal('2.0'), id: z.union([z.string().max(120), z.number().int()]).optional(), method: z.string().max(100), params: z.record(z.string(), z.unknown()).optional() }).strict()
const MODERN = '2026-07-28', LEGACY = ['2025-11-25', '2025-06-18', '2025-03-26'], SUPPORTED = [MODERN, ...LEGACY]
function headerName(value: string | null): string | null {
  if (!value || value.length > 2048) return null
  if (value.startsWith('=?base64?') && value.endsWith('?=')) {
    const encoded = value.slice(9, -2)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null
    try { const b = Buffer.from(encoded, 'base64'); if (b.toString('base64') !== encoded) return null; return new TextDecoder('utf-8', { fatal: true }).decode(b) } catch { return null }
  }
  return /^[\x20-\x7e]+$/.test(value) && value.trim() === value ? value : null
}
export async function domainMcp(request: Request, domain: string, options: { local?: boolean } = {}) {
  if (!DOMAINS.includes(domain as Domain)) return apiJson({ error: 'unknown_domain' }, 404)
  const origin = request.headers.get('origin'), local = options.local ?? localDiscovery()
  if (origin && origin !== 'https://www.mahastrategies.com' && !(local && /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(origin))) return apiJson({ error: 'origin_refused' }, 403)
  const protocol = request.headers.get('MCP-Protocol-Version')
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return apiJson({ error: 'json_required' }, 415)
  let m: z.infer<typeof rpc>
  try { m = rpc.parse(await readMicroBody(request)) } catch { return apiJson({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON-RPC request' } }, 400) }
  const error = (code: number, message: string, status = 200, data?: unknown) => apiJson({ jsonrpc: '2.0', ...(m.id === undefined ? {} : { id: m.id }), error: { code, message, ...(data ? { data } : {}) } }, status)
  if (protocol && !SUPPORTED.includes(protocol)) return error(-32022, 'Unsupported protocol version', 400, { supported: SUPPORTED, requested: protocol })
  const meta = m.params?._meta as Record<string, unknown> | undefined
  const bodyVersion = meta?.['io.modelcontextprotocol/protocolVersion']
  if (typeof bodyVersion === 'string' && !SUPPORTED.includes(bodyVersion)) return error(-32022, 'Unsupported protocol version', 400, { supported: SUPPORTED, requested: bodyVersion })
  const modern = protocol === MODERN || meta?.['io.modelcontextprotocol/protocolVersion'] === MODERN
  if (modern) {
    if (!meta || typeof meta !== 'object' || Array.isArray(meta) || typeof bodyVersion !== 'string' || !meta['io.modelcontextprotocol/clientCapabilities']
      || typeof meta['io.modelcontextprotocol/clientCapabilities'] !== 'object' || Array.isArray(meta['io.modelcontextprotocol/clientCapabilities'])) return error(-32602, 'Required client capabilities missing', 400)
    if (protocol !== MODERN || bodyVersion !== protocol || request.headers.get('Mcp-Method') !== m.method
      || m.method === 'tools/call' && headerName(request.headers.get('Mcp-Name')) !== m.params?.name) return error(-32020, 'Header mismatch', 400)
    const accept = request.headers.get('accept') ?? ''
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return error(-32600, 'Required Accept types missing', 400)
  }
  if (m.id === undefined) return new Response(null, { status: 202 })
  const result = (value: Record<string, unknown>) => apiJson({ jsonrpc: '2.0', id: m.id, result: modern ? { ...value, resultType: 'complete',
    _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'maha-' + domain, version: '1.0.0' } } } : value })
  if (m.method === 'server/discover') return result({ supportedVersions: SUPPORTED, capabilities: { tools: {} },
    instructions: 'Search then describe within this domain. Metadata only; no automatic purchases.', ttlMs: 0, cacheScope: 'public' })
  if (m.method === 'initialize' && !modern) return result({ protocolVersion: LEGACY.includes(String(m.params?.protocolVersion)) ? m.params!.protocolVersion : LEGACY[0],
    capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'maha-' + domain, version: '1.0.0' },
    instructions: 'Search this domain, then describe one selected endpoint. Metadata tools cannot make payments. Unreleased products are hidden; use the private buyer/recovery adapter for paid HTTP calls.' })
  if (m.method === 'ping') return result({})
  if (m.method === 'tools/list') return result({ tools: [
    { name: 'search_tools', description: `Find at most ten relevant ${domain} endpoints and their contracts. Free metadata only.`, inputSchema: z.toJSONSchema(searchInput.omit({ domain: true })), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
    { name: 'describe_tool', description: `Read one exact ${domain} endpoint's input/output contract, price and recovery instructions. Does not buy or execute it.`, inputSchema: z.toJSONSchema(describeInput), annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  ] })
  if (m.method !== 'tools/call') return error(-32601, 'Method not found', modern ? 404 : 200)
  try {
    const params = z.object({ name: z.enum(['search_tools', 'describe_tool']), arguments: z.unknown().optional(), _meta: z.record(z.string(), z.unknown()).optional() }).strict().parse(m.params)
    const value = params.name === 'search_tools' ? searchEndpoints({ ...searchInput.omit({ domain: true }).parse(params.arguments ?? {}), domain }, { local })
      : describeById(describeInput.parse(params.arguments).id, local, domain as Domain)
    if (!value) return result({ content: [{ type: 'text', text: 'Endpoint unavailable in this domain. Do not pay.' }], isError: true })
    return result({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: false })
  } catch { return error(-32602, 'Invalid tool arguments') }
}
