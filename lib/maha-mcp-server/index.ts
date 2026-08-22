import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { EVIDENCE_BOUNDARY, MCP_SERVER_NAME, MCP_SERVER_VERSION, MCP_TOOLS, callMcpTool } from '../maha-mcp/index.ts'
import { boundaryStatement, findCredentialFields, findUnboundedResponseStrings, type VerificationGrade } from '../maha-transport/boundary.ts'

/**
 * An executable MCP server over stdio.
 *
 * This exists because the dispatcher alone was not runnable: evaluating it
 * previously meant writing a transport shim first, which is a strange thing to
 * ask of someone deciding whether to evaluate you. The tool table and dispatch
 * are unchanged — this adds the wire and nothing else.
 *
 * stdio only. There is no listening socket, so there is no exposure to bind
 * wrongly and no port to leave open.
 */

/** Per-tool verification grades. Stated, never inferred by the caller. */
const TOOL_VERIFICATION: Record<string, Record<string, VerificationGrade>> = {
  'context_control.describe': {
    contractVersion: 'locally_verified', headerNames: 'locally_verified', boundaries: 'locally_verified',
  },
  'context_control.validate_request': {
    envelopeStructure: 'locally_verified', gateDecision: 'locally_verified',
    documentContents: 'trusted_pass_through', documentAuthenticity: 'not_established',
  },
  'context_control.compile_sanitized': {
    inputStructure: 'locally_verified', selection: 'locally_verified',
    sourceBytes: 'trusted_pass_through', factualAccuracy: 'not_established',
  },
  'context_control.verify_evidence': {
    digestFormat: 'locally_verified', internalConsistency: 'locally_verified',
    digestCommitsToRealBytes: 'not_established',
  },
  'context_control.gateway_status': {
    artifactStructure: 'locally_verified', deploymentState: 'not_established',
  },
}

export type McpServerOptions = {
  /** Overridable for tests; defaults to the process environment. */
  environment?: NodeJS.ProcessEnv
  root?: string
}

export function createMahaMcpServer(options: McpServerOptions = {}): Server {
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name
    const args = (request.params.arguments ?? {}) as Record<string, unknown>

    // Refuse an inbound credential loudly. A caller who believed one was
    // required needs to find out here, not by having it quietly dropped.
    const offending = findCredentialFields(args, 'arguments')
    if (offending.length > 0) {
      return errorResult(name, 'credential_rejected', `This server never accepts credentials. Remove: ${offending.join(', ')}.`)
    }

    const result = await callMcpTool(name, args, { environment: options.environment, root: options.root })

    const payload = {
      ...result,
      boundary: {
        ...EVIDENCE_BOUNDARY,
        ...boundaryStatement({
          kind: 'stdio',
          verification: TOOL_VERIFICATION[name] ?? { result: 'not_established' },
        }),
      },
    }

    // Nothing long enough to be document text may leave, whatever produced it.
    const unbounded = findUnboundedResponseStrings(payload)
    if (unbounded.length > 0) {
      return errorResult(name, 'response_not_metadata', `Refused to return an unbounded string at ${unbounded[0].path}.`)
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      isError: result.ok === false,
    }
  })

  return server
}

function errorResult(tool: string, code: string, message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        ok: false, tool, error: { code, message },
        boundary: boundaryStatement({ kind: 'stdio', verification: { request: 'locally_verified' } }),
      }),
    }],
    isError: true,
  }
}

/** Starts the server on stdio. Returns when the transport closes. */
export async function startMahaMcpStdioServer(options: McpServerOptions = {}): Promise<void> {
  const server = createMahaMcpServer(options)
  await server.connect(new StdioServerTransport())
}
