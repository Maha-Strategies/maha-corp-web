export const MCP_SERVER_NAME = 'maha-context-control'
export const MCP_SERVER_VERSION = '0.1.0'

export type McpToolName =
  | 'context_control.describe'
  | 'context_control.validate_request'
  | 'context_control.compile_sanitized'
  | 'context_control.verify_evidence'
  | 'context_control.gateway_status'

/** Static public description; importing it never pulls the operator CLI into a route bundle. */
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
      properties: { gateway: { type: 'string', enum: ['wso2', 'kong', 'apigee', 'cloudflare'] } },
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
