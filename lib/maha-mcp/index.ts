/**
 * @mahastrategies/maha-mcp
 *
 * An MCP surface exposing read-only context-control evaluation tools.
 *
 * The safety property is structural, not configurational: the five tools below
 * are the complete set this module can dispatch, and nothing that deploys,
 * pays, registers, or reaches a model provider exists here to be enabled. A
 * hidden dangerous tool is one flag away from being a live one; an absent
 * dangerous tool is not.
 */
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_CONTEXT_EXTENSION,
  GATEWAY_CONTEXT_PLACEHOLDER,
  GATEWAY_POLICY_VERSION,
  gateContextRequest,
  type GatewayLimits,
} from '../integrations/gateway-context-gate.ts'
import { compile, gatewayValidate, verify, GATEWAY_NAMES, type GatewayName } from '../context-control-cli/index.ts'
import {
  EVIDENCE_BOUNDARY,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOLS,
  type McpToolName,
} from './public-contract.ts'

export { EVIDENCE_BOUNDARY, MCP_SERVER_NAME, MCP_SERVER_VERSION, MCP_TOOLS }
export type { McpToolName }

export type McpToolResult = { ok: true; tool: McpToolName; result: unknown; boundary: typeof EVIDENCE_BOUNDARY }
  | { ok: false; tool: McpToolName; error: { code: string; message: string }; boundary: typeof EVIDENCE_BOUNDARY }

const fail = (tool: McpToolName, code: string, message: string): McpToolResult =>
  ({ ok: false, tool, error: { code, message }, boundary: EVIDENCE_BOUNDARY })

const succeed = (tool: McpToolName, result: unknown): McpToolResult =>
  ({ ok: true, tool, result, boundary: EVIDENCE_BOUNDARY })

/**
 * Dispatch one tool call.
 *
 * A credential is never an argument: `compile_sanitized` reads the secret from
 * the environment, so a model driving this surface cannot supply, learn, or
 * exfiltrate one through a tool call.
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown> = {},
  options: { environment?: NodeJS.ProcessEnv; root?: string } = {},
): Promise<McpToolResult> {
  const tool = MCP_TOOLS.find((entry) => entry.name === name)
  if (!tool) return fail(name as McpToolName, 'unknown_tool', `No such tool. Available: ${MCP_TOOLS.map((entry) => entry.name).join(', ')}`)

  // Defence in depth: even a mis-specified schema must not let a credential in.
  for (const key of Object.keys(args)) {
    if (/secret|token|credential|password|api[_-]?key|authorization/i.test(key)) {
      return fail(tool.name, 'credential_rejected', 'This surface never accepts credentials as tool arguments.')
    }
  }

  switch (tool.name) {
    case 'context_control.describe':
      return succeed(tool.name, {
        server: MCP_SERVER_NAME,
        serverVersion: MCP_SERVER_VERSION,
        contractVersion: GATEWAY_CONTRACT_VERSION,
        policyVersion: GATEWAY_POLICY_VERSION,
        extension: GATEWAY_CONTEXT_EXTENSION,
        placeholder: GATEWAY_CONTEXT_PLACEHOLDER,
        evidenceHeaders: [
          'x-maha-compiled', 'x-maha-input-hash', 'x-maha-output-hash', 'x-maha-token-budget',
          'x-maha-retained-passages', 'x-maha-source-coverage-bps', 'x-maha-policy-version',
        ],
        tools: MCP_TOOLS.map((entry) => ({ name: entry.name, readOnly: entry.readOnly })),
      })

    case 'context_control.validate_request': {
      const body = args.body
      // A placeholder secret: the gate needs one to reach the shape checks, and
      // validation must not require the caller to hold the real credential.
      const placeholder = 'v'.repeat(32)
      const gated = gateContextRequest({
        body,
        bodyBytes: Buffer.byteLength(JSON.stringify(body ?? null), 'utf8'),
        suppliedSecret: placeholder,
        configuredSecret: placeholder,
        contentType: typeof args.contentType === 'string' ? args.contentType : 'application/json',
        alreadyCompiled: args.alreadyCompiled === true,
      })
      return succeed(tool.name, gated.outcome === 'proceed'
        ? { outcome: 'proceed', limits: gated.limits satisfies GatewayLimits }
        : gated)
    }

    case 'context_control.compile_sanitized': {
      if (typeof args.inputPath !== 'string' || typeof args.outputPath !== 'string') {
        return fail(tool.name, 'invalid_arguments', 'inputPath and outputPath are required.')
      }
      try {
        const record = await compile({
          inputPath: args.inputPath,
          outputPath: args.outputPath,
          environment: options.environment,
        })
        return succeed(tool.name, record)
      } catch (error) {
        return fail(tool.name, 'compile_failed', error instanceof Error ? error.message : 'compile failed')
      }
    }

    case 'context_control.verify_evidence':
      return succeed(tool.name, verify(args.evidence))

    case 'context_control.gateway_status': {
      const gateway = args.gateway
      if (typeof gateway !== 'string' || !GATEWAY_NAMES.includes(gateway as GatewayName)) {
        return fail(tool.name, 'invalid_arguments', `gateway must be one of ${GATEWAY_NAMES.join(', ')}`)
      }
      return succeed(tool.name, gatewayValidate(gateway as GatewayName, options.root ?? process.cwd()))
    }
  }
}

/** The manifest an MCP client reads. */
export function mcpManifest(): Record<string, unknown> {
  return {
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
    description: 'Read-only context-control evaluation tools. No credentials, no provider calls, no deployment.',
    contractVersion: GATEWAY_CONTRACT_VERSION,
    tools: MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly },
    })),
    boundary: EVIDENCE_BOUNDARY,
  }
}
