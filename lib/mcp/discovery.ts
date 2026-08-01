import crypto from 'node:crypto'
import { MCPControls } from './controls'
import { prepareMcpUpstream, readBoundedUpstreamJson } from './upstream'
import type { JSONRPCRequest, MCPServerConfig, MCPToolDefinition, MCPToolDiscovery } from './types'
import { parseToolsListResponse } from './validation'

const MAX_DISCOVERED_TOOLS = 256
const MAX_DISCOVERY_PAGES = 8

export class MCPDiscoveryService {
  static async discover(server: MCPServerConfig): Promise<MCPToolDiscovery> {
    const policy = await MCPControls.getPolicy(server.tenantId)
    const circuit = await MCPControls.beforeRequest(server.tenantId, server.id, policy)
    if (!circuit.allowed) throw new Error(`Circuit breaker is open. Retry in ${circuit.retryAfterSeconds} seconds.`)
    const allTools: MCPToolDefinition[] = []
    const toolNames = new Set<string>()
    let cursor: string | undefined
    let outboundStarted = false
    try {
      for (let page = 0; page < MAX_DISCOVERY_PAGES; page += 1) {
        outboundStarted = false
        const rate = await MCPControls.consumeRateLimit(server.tenantId, policy.requestsPerMinute)
        if (!rate.allowed) throw new Error(`MCP rate limit reached. Retry in ${rate.retryAfterSeconds} seconds.`)
        outboundStarted = true
        const id = `discover_${crypto.randomBytes(8).toString('hex')}`
        const payload: JSONRPCRequest = { jsonrpc: '2.0', id, method: 'tools/list', ...(cursor ? { params: { cursor } } : {}) }
        const context = { tenantId: server.tenantId, serverId: server.id, traceId: `trc_${crypto.randomBytes(8).toString('hex')}` }
        const upstream = await prepareMcpUpstream(server, payload, context)
        const response = await fetch(upstream.url, { method: 'POST', headers: upstream.headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(policy.timeoutMs), redirect: 'manual' })
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) outboundStarted = false
          throw new Error(`Upstream tools/list returned HTTP ${response.status}.`)
        }
        const parsed = parseToolsListResponse(await readBoundedUpstreamJson(response), id)
        if (parsed.tools.some((tool) => toolNames.has(tool.name))) throw new Error('Upstream tools/list contains duplicate tool names across pages.')
        parsed.tools.forEach((tool) => toolNames.add(tool.name))
        allTools.push(...parsed.tools)
        if (allTools.length > MAX_DISCOVERED_TOOLS) throw new Error(`Upstream exposes more than ${MAX_DISCOVERED_TOOLS} tools.`)
        if (!parsed.nextCursor) {
          await MCPControls.recordSuccess(server.tenantId, server.id)
          return { status: 'ready', tools: allTools, discoveredAt: Date.now() }
        }
        cursor = parsed.nextCursor
      }
      throw new Error('Upstream tools/list pagination exceeded the page limit.')
    } catch (error) {
      if (outboundStarted) await MCPControls.recordFailure(server.tenantId, server.id, policy)
      throw error
    }
  }
}
