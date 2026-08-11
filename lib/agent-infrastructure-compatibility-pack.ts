export const COMPATIBILITY_PACK_VERSION = '1.0.0'
export const COMPATIBILITY_PACK_PRICE = Object.freeze({
  amount: '49000000',
  display: '49.00 USDC',
  asset: 'USDC',
  decimals: 6,
  network: 'eip155:8453',
})

export const COMPATIBILITY_PACK_LIMITATIONS = Object.freeze([
  'Point-in-time compatibility evidence, not continuous monitoring or certification.',
  'JSON-RPC request/response only; SSE, push notifications, file parts and webhooks are not exercised.',
  'One caller-declared non-mutating A2A skill and one caller-declared non-mutating MCP tool are exercised.',
  'Upstream x402 challenges are inspected against policy, but Maha does not hold a buyer key, sign, or settle an upstream payment.',
  'Not a penetration test, vulnerability assessment, legal opinion, compliance certification or uptime guarantee.',
  'Version 1 supports public endpoints and bearer credentials supplied for the run; interactive OAuth and mTLS are out of scope.',
])

const httpsUrl = { type: 'string', format: 'uri', pattern: '^https://', maxLength: 500 } as const
const identifier = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$' } as const
const sha256 = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' } as const
const authorization = {
  type: 'object', additionalProperties: false, required: ['scheme', 'credential'],
  properties: {
    scheme: { const: 'bearer' },
    credential: { type: 'string', minLength: 8, maxLength: 4096, writeOnly: true, description: 'Used only for this run; never returned or retained.' },
  },
} as const

export const COMPATIBILITY_PACK_INPUT_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://www.mahastrategies.com/api/discovery/agent-infrastructure-compatibility-pack#input',
  title: 'Agent Infrastructure Compatibility Pack input',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'clientRequestId', 'targets', 'policy', 'testPlan'],
  properties: {
    version: { const: COMPATIBILITY_PACK_VERSION },
    clientRequestId: identifier,
    targets: {
      type: 'object', additionalProperties: false, required: ['a2a', 'mcp'],
      properties: {
        a2a: {
          type: 'object', additionalProperties: false, required: ['agentCardUrl', 'rpcUrl'],
          properties: { agentCardUrl: httpsUrl, rpcUrl: httpsUrl, authorization },
        },
        mcp: {
          type: 'object', additionalProperties: false, required: ['serverUrl'],
          properties: { serverUrl: httpsUrl, authorization },
        },
      },
    },
    policy: {
      type: 'object', additionalProperties: false,
      required: ['allowedA2AMethods', 'allowedA2ASkills', 'allowedMcpMethods', 'allowedMcpTools', 'timeoutMs', 'payment'],
      properties: {
        allowedA2AMethods: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { enum: ['message/send', 'tasks/get', 'tasks/cancel'] } },
        allowedA2ASkills: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: identifier },
        allowedMcpMethods: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['tools/list', 'tools/call'] } },
        allowedMcpTools: { type: 'array', minItems: 1, maxItems: 50, uniqueItems: true, items: identifier },
        timeoutMs: { type: 'integer', minimum: 1000, maximum: 15000 },
        payment: {
          type: 'object', additionalProperties: false,
          required: ['approvedNetworks', 'approvedAssets', 'approvedPayees', 'maxAmountPerCall', 'maxAmountPerTask'],
          properties: {
            approvedNetworks: { type: 'array', minItems: 1, maxItems: 5, uniqueItems: true, items: { type: 'string', pattern: '^eip155:[1-9][0-9]*$' } },
            approvedAssets: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } },
            approvedPayees: { type: 'array', minItems: 1, maxItems: 20, uniqueItems: true, items: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' } },
            maxAmountPerCall: { type: 'string', pattern: '^[0-9]{1,18}$', description: 'Asset base units.' },
            maxAmountPerTask: { type: 'string', pattern: '^[0-9]{1,18}$', description: 'Cumulative asset base units.' },
          },
        },
      },
    },
    testPlan: {
      type: 'object', additionalProperties: false, required: ['a2a', 'mcp'],
      properties: {
        a2a: {
          type: 'object', additionalProperties: false, required: ['skillId', 'message', 'callerConfirmsNonMutating'],
          properties: { skillId: identifier, message: { type: 'string', minLength: 1, maxLength: 500 }, callerConfirmsNonMutating: { const: true } },
        },
        mcp: {
          type: 'object', additionalProperties: false, required: ['toolName', 'arguments', 'callerConfirmsNonMutating'],
          properties: { toolName: identifier, arguments: { type: 'object', maxProperties: 30 }, callerConfirmsNonMutating: { const: true } },
        },
      },
    },
  },
})

const checkSchema = {
  type: 'object', additionalProperties: false,
  required: ['id', 'layer', 'status', 'severity', 'summary', 'evidence', 'remediation'],
  properties: {
    id: identifier,
    layer: { enum: ['identity', 'protocol', 'policy', 'payment', 'auditability'] },
    status: { enum: ['pass', 'fail', 'not_checked'] },
    severity: { enum: ['info', 'low', 'medium', 'high'] },
    summary: { type: 'string', minLength: 1, maxLength: 500 },
    evidence: {
      type: 'array', maxItems: 10, items: {
        type: 'object', additionalProperties: false, required: ['sourceUrl', 'observedAt', 'digest', 'observation'],
        properties: { sourceUrl: httpsUrl, observedAt: { type: 'string', format: 'date-time' }, digest: sha256, observation: { type: 'string', minLength: 1, maxLength: 500 } },
      },
    },
    remediation: { type: ['string', 'null'], maxLength: 500 },
  },
} as const

export const COMPATIBILITY_PACK_OUTPUT_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://www.mahastrategies.com/api/discovery/agent-infrastructure-compatibility-pack#output',
  title: 'Agent Infrastructure Compatibility Pack report',
  type: 'object', additionalProperties: false,
  required: ['version', 'reportId', 'clientRequestId', 'generatedAt', 'inputHash', 'decision', 'summary', 'checks', 'paymentInspection', 'retention', 'limitations', 'refund'],
  properties: {
    version: { const: COMPATIBILITY_PACK_VERSION },
    reportId: { type: 'string', pattern: '^compat_[a-f0-9]{32}$' },
    clientRequestId: identifier,
    generatedAt: { type: 'string', format: 'date-time' },
    inputHash: sha256,
    decision: { enum: ['compatible', 'conditionally_compatible', 'incompatible', 'inconclusive'] },
    summary: {
      type: 'object', additionalProperties: false, required: ['passed', 'failed', 'notChecked', 'highestSeverity'],
      properties: { passed: { type: 'integer', minimum: 0 }, failed: { type: 'integer', minimum: 0 }, notChecked: { type: 'integer', minimum: 0 }, highestSeverity: { enum: ['none', 'low', 'medium', 'high'] } },
    },
    checks: { type: 'array', minItems: 1, maxItems: 50, items: checkSchema },
    paymentInspection: {
      type: 'object', additionalProperties: false, required: ['challengeObserved', 'termsWithinPolicy', 'upstreamSettlementPerformed', 'reason'],
      properties: { challengeObserved: { type: 'boolean' }, termsWithinPolicy: { type: ['boolean', 'null'] }, upstreamSettlementPerformed: { const: false }, reason: { type: 'string', minLength: 1, maxLength: 500 } },
    },
    retention: {
      type: 'object', additionalProperties: false, required: ['credentialsStored', 'testPayloadsStored', 'retainedFields'],
      properties: { credentialsStored: { const: false }, testPayloadsStored: { const: false }, retainedFields: { type: 'array', uniqueItems: true, items: { type: 'string' } } },
    },
    limitations: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
    refund: {
      type: 'object', additionalProperties: false, required: ['status', 'reason'],
      properties: { status: { enum: ['not_applicable', 'not_eligible', 'initiated', 'completed'] }, reason: { type: 'string', minLength: 1, maxLength: 500 }, transaction: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' } },
    },
  },
})

const exampleHash = (character: string) => `sha256:${character.repeat(64)}`

export const COMPATIBILITY_PACK_SAMPLE_REPORT = Object.freeze({
  version: COMPATIBILITY_PACK_VERSION,
  reportId: 'compat_4e67a6719f6c4e15b34764e2184bd91a',
  clientRequestId: 'compat-demo-2026-08-11',
  generatedAt: '2026-08-11T06:30:00.000Z',
  inputHash: exampleHash('a'),
  decision: 'conditionally_compatible',
  summary: { passed: 2, failed: 1, notChecked: 1, highestSeverity: 'medium' },
  checks: [
    {
      id: 'a2a.agent-card', layer: 'identity', status: 'pass', severity: 'info',
      summary: 'The Agent Card was reachable, parseable and bound the declared skill to the tested RPC URL.',
      evidence: [{ sourceUrl: 'https://agent.example/.well-known/agent-card.json', observedAt: '2026-08-11T06:29:40.000Z', digest: exampleHash('b'), observation: 'HTTP 200; skill governance.echo declared; RPC URL matched the request.' }],
      remediation: null,
    },
    {
      id: 'mcp.tool-allowlist', layer: 'policy', status: 'pass', severity: 'info',
      summary: 'tools/list exposed the declared non-mutating tool and the allowlist admitted only that tool.',
      evidence: [{ sourceUrl: 'https://mcp.example/rpc', observedAt: '2026-08-11T06:29:44.000Z', digest: exampleHash('c'), observation: 'tools/list returned 4 tools; calculateRiskScore was the only tool selected for invocation.' }],
      remediation: null,
    },
    {
      id: 'payment.task-budget', layer: 'payment', status: 'fail', severity: 'medium',
      summary: 'The upstream challenge fit the per-call ceiling but could not be proven against a durable multi-call task budget.',
      evidence: [{ sourceUrl: 'https://agent.example/rpc', observedAt: '2026-08-11T06:29:48.000Z', digest: exampleHash('d'), observation: 'Challenge requested 1000 base units on eip155:8453; no durable task ledger evidence was exposed.' }],
      remediation: 'Bind cumulative settled amount and maximum task budget to a stable A2A task identifier before forwarding later turns.',
    },
    {
      id: 'payment.onchain-receipt', layer: 'payment', status: 'not_checked', severity: 'info',
      summary: 'No upstream payment was signed or settled by this assessment.', evidence: [],
      remediation: 'Run a separately authorized bounded settlement if on-chain receipt behavior must be proven.',
    },
  ],
  paymentInspection: { challengeObserved: true, termsWithinPolicy: true, upstreamSettlementPerformed: false, reason: 'Maha inspected the challenge but never held or used a buyer signing key.' },
  retention: { credentialsStored: false, testPayloadsStored: false, retainedFields: ['target URLs', 'timestamps', 'status codes', 'content hashes', 'bounded findings', 'report hash'] },
  limitations: [...COMPATIBILITY_PACK_LIMITATIONS],
  refund: { status: 'not_applicable', reason: 'A compatibility finding, including incompatibility, is the purchased result and is not a service failure.' },
})

export const COMPATIBILITY_PACK_CONTRACT = Object.freeze({
  id: 'agent-infrastructure-compatibility-pack',
  version: COMPATIBILITY_PACK_VERSION,
  name: 'Agent Infrastructure Compatibility Pack',
  status: 'contract_published_runtime_withheld',
  description: 'A bounded, evidence-backed compatibility assessment for one A2A agent, one MCP server and their declared policy/payment boundary.',
  price: COMPATIBILITY_PACK_PRICE,
  deliveryTarget: 'Within 10 minutes of confirmed payment after the runtime is promoted.',
  purchase: { payableNow: false, reason: 'The public contract is complete; autonomous payment remains disabled until durable report delivery and automatic refund recovery pass Production E2E.' },
  execution: {
    preflight: 'Input validation, endpoint safety checks and credential-format checks occur before any payment challenge.',
    boundedCalls: ['A2A Agent Card fetch', 'A2A message/send', 'A2A tasks/get when a task is returned', 'MCP tools/list', 'MCP tools/call', 'x402 challenge inspection only'],
    sideEffectBoundary: 'The caller must identify one non-mutating skill and tool. Maha does not infer that an action is safe and does not broaden the submitted allowlists.',
  },
  failureAndRefund: {
    noCharge: ['Schema-invalid input', 'unsafe or non-HTTPS target', 'unreachable preflight target', 'unsupported authentication mode'],
    deliveredFindingNoRefund: ['Protocol incompatibility', 'policy rejection', 'target timeout during execution', 'target 4xx/5xx response', 'upstream payment terms outside the submitted policy'],
    fullAutomaticRefund: ['Maha internal failure after settlement', 'no signed report produced within the delivery target', 'durable report write cannot be confirmed'],
    duplicatePolicy: 'The same clientRequestId and input hash return the original report and never settle twice; the same id with different input is rejected before settlement.',
  },
  limitations: COMPATIBILITY_PACK_LIMITATIONS,
  inputSchema: COMPATIBILITY_PACK_INPUT_SCHEMA,
  outputSchema: COMPATIBILITY_PACK_OUTPUT_SCHEMA,
  sampleReportUrl: 'https://www.mahastrategies.com/api/discovery/agent-infrastructure-compatibility-pack/sample',
})
