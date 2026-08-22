// Transport shim. NOT part of the Maha product.
// Maha's maha-mcp package ships tool definitions and a dispatcher but no
// wire-protocol server, so this binds them to the official SDK's stdio server
// purely so a real third-party client has something to connect to.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { MCP_TOOLS, MCP_SERVER_NAME, MCP_SERVER_VERSION, callMcpTool } from '../../lib/maha-mcp/index.ts'

const server = new Server({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MCP_TOOLS.map((t: (typeof MCP_TOOLS)[number]) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
}))

server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
  const result = await callMcpTool(request.params.name, request.params.arguments ?? {})
  return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: result.ok === false }
})

await server.connect(new StdioServerTransport())
