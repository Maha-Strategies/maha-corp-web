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

export const MCP_SERVER_NAME = 'maha-context-control'
export const MCP_SERVER_VERSION = '0.1.0'

export type McpToolName =
  | 'context_control.describe'
  | 'context_control.validate_request'
  | 'context_control.compile_sanitized'
  | 'context_control.verify_evidence'
  | 'context_control.gateway_status'

/** The complete dispatch table. There is no sixth entry, hidden or otherwise. */
export const MCP_TOOLS: readonly {
  name: McpToolName
  description: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
}[] = [
  {
    name: 'context_control.describe',
    description: 'Describe the context-control contract: version, extension name, placeholder, headers and boundaries. Takes no input and reads nothing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
  },
  {
    name: 'context_control.validate_request',
    description: 'Validate an LLM request envelope against the contract without compiling it. Returns the gate outcome only.',
    inputSchema: {
      type: 'object',
      properties: {
        body: { type: 'object', description: 'The LLM request body, including maha_context.' },
        contentType: { type: 'string', default: 'application/json' },
        alreadyCompiled: { type: 'boolean', default: false },
      },
      required: ['body'],
      additionalProperties: false,
    },
    readOnly: true,
  },
  {
    name: 'context_control.compile_sanitized',
    description: 'Compile a sanitized fixture against a configured local or test endpoint and return evidence metadata. Never returns the compiled prompt or any source text.',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: 'Path to a sanitized JSON fixture on the local filesystem.' },
        outputPath: { type: 'string', description: 'Path the sanitized evidence record is written to.' },
      },
      required: ['inputPath', 'outputPath'],
      additionalProperties: false,
    },
    readOnly: false,
  },
  {
    name: 'context_control.verify_evidence',
    description: 'Verify an evidence record structurally. Reports what is checkable locally versus trusted pass-through.',
    inputSchema: {
      type: 'object',
      properties: { evidence: { type: 'object', description: 'An evidence record.' } },
      required: ['evidence'],
      additionalProperties: false,
    },
    readOnly: true,
  },
  {
    name: 'context_control.gateway_status',
    description: 'Statically validate a gateway adapter artifact. Deploys nothing and contacts no gateway.',
    inputSchema: {
      type: 'object',
      properties: { gateway: { type: 'string', enum: [...GATEWAY_NAMES] } },
      required: ['gateway'],
      additionalProperties: false,
    },
    readOnly: true,
  },
] as const

/** Attached to every response, so a caller never has to infer the boundary. */
export const EVIDENCE_BOUNDARY = {
  sourceTextReturned: false,
  credentialsAccepted: false,
  credentialsReturned: false,
  providerCallsMade: 0,
  limitations: [
    'Token counts are model-neutral estimates, not provider tokenizer counts.',
    'Selection is extractive ranking and de-duplication. It does not verify claims.',
    'Structural verification checks format and consistency, not that a hash commits to bytes this tool never saw.',
    'Gateway status is static artifact validation, not a deployment check.',
  ],
} as const

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
