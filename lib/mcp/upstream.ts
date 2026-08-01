import crypto from 'node:crypto'
import { MAX_UPSTREAM_RESPONSE_BYTES, assertPublicUpstreamHost } from '../mcp-gateway'
import { decryptSecret } from './registry'
import type { JSONRPCRequest, MCPProxyContext, MCPServerConfig } from './types'

export async function prepareMcpUpstream(
  server: MCPServerConfig,
  payload: JSONRPCRequest,
  context: MCPProxyContext,
): Promise<{ url: string; headers: Record<string, string> }> {
  await assertPublicUpstreamHost(server.baseUrl)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Maha-Tenant-ID': context.tenantId,
    'X-Maha-Trace-ID': context.traceId,
    'X-Maha-Proxy-Timestamp': Date.now().toString(),
  }
  if (server.authType === 'bearer' && server.authSecretEncrypted) {
    headers.Authorization = `Bearer ${decryptSecret(server.authSecretEncrypted)}`
  } else if (server.authType === 'hmac' && server.authSecretEncrypted) {
    const secret = decryptSecret(server.authSecretEncrypted)
    headers['X-Maha-HMAC-Signature'] = crypto.createHmac('sha256', secret).update(`${context.traceId}:${JSON.stringify(payload)}`).digest('hex')
  }
  return { url: new URL(server.baseUrl).toString(), headers }
}

export async function readBoundedUpstreamJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('Upstream MCP response exceeds the 1 MB limit.')
  if (!response.body) throw new Error('Upstream MCP response body is empty.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_UPSTREAM_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('Upstream MCP response exceeds the 1 MB limit.')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const text = new TextDecoder().decode(bytes)
  try { return JSON.parse(text) } catch { throw new Error('Upstream MCP response is not valid JSON.') }
}
