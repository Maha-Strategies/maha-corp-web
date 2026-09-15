export const GPT_6_ASTRA_MODEL = 'gpt-6-astra' as const

export type OpenAiEndpoint = 'responses' | 'chat-completions'
export type AstraReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type AstraReadinessIssueCode =
  | 'model-not-selected'
  | 'responses-required-for-tools'
  | 'unsupported-parameter'
  | 'unsupported-reasoning-effort'
  | 'async-tool-missing-flag'

export type AstraReadinessIssue = {
  code: AstraReadinessIssueCode
  path: string
  message: string
}

export type AstraRequestReadiness = {
  compatible: boolean
  endpoint: OpenAiEndpoint
  issues: AstraReadinessIssue[]
}

const ASTRA_REASONING_EFFORTS = new Set<AstraReasoningEffort>(['low', 'medium', 'high', 'xhigh', 'max'])
const COMMON_UNSUPPORTED_PARAMETERS = ['temperature', 'top_p', 'top_logprobs'] as const

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function selectedReasoningEffort(payload: Record<string, unknown>, endpoint: OpenAiEndpoint): unknown {
  if (endpoint === 'chat-completions') return payload.reasoning_effort
  return objectRecord(payload.reasoning)?.effort
}

/**
 * Pure, secret-free compatibility check for the GPT-6 Astra request surface.
 * This deliberately does not infer account access or call OpenAI.
 */
export function assessAstraRequest(
  endpoint: OpenAiEndpoint,
  request: unknown,
): AstraRequestReadiness {
  const payload = objectRecord(request) ?? {}
  const issues: AstraReadinessIssue[] = []

  if (payload.model !== GPT_6_ASTRA_MODEL) {
    issues.push({
      code: 'model-not-selected',
      path: 'model',
      message: `The request must select ${GPT_6_ASTRA_MODEL}.`,
    })
  }

  for (const parameter of COMMON_UNSUPPORTED_PARAMETERS) {
    if (parameter in payload) {
      issues.push({
        code: 'unsupported-parameter',
        path: parameter,
        message: `${parameter} is not supported by GPT-6 Astra.`,
      })
    }
  }

  if (endpoint === 'chat-completions' && 'logprobs' in payload) {
    issues.push({
      code: 'unsupported-parameter',
      path: 'logprobs',
      message: 'logprobs is not supported by GPT-6 Astra in Chat Completions.',
    })
  }

  if (endpoint === 'responses' && Array.isArray(payload.include) && payload.include.includes('message.output_text.logprobs')) {
    issues.push({
      code: 'unsupported-parameter',
      path: 'include',
      message: 'message.output_text.logprobs is not supported by GPT-6 Astra.',
    })
  }

  const reasoningEffort = selectedReasoningEffort(payload, endpoint)
  if (reasoningEffort !== undefined && !ASTRA_REASONING_EFFORTS.has(reasoningEffort as AstraReasoningEffort)) {
    issues.push({
      code: 'unsupported-reasoning-effort',
      path: endpoint === 'responses' ? 'reasoning.effort' : 'reasoning_effort',
      message: 'GPT-6 Astra reasoning effort must be low, medium, high, xhigh, or max.',
    })
  }

  const tools = Array.isArray(payload.tools) ? payload.tools : []
  if (endpoint === 'chat-completions' && tools.length > 0) {
    issues.push({
      code: 'responses-required-for-tools',
      path: 'tools',
      message: 'GPT-6 Astra tool calling must use the Responses API.',
    })
  }

  if (endpoint === 'responses') {
    tools.forEach((tool, index) => {
      const typedTool = objectRecord(tool)
      if (typedTool?.async === false) {
        issues.push({
          code: 'async-tool-missing-flag',
          path: `tools.${index}.async`,
          message: 'An Astra tool declared for asynchronous execution must set async to true.',
        })
      }
    })
  }

  return { compatible: issues.length === 0, endpoint, issues }
}

export type AstraRolloutDecision =
  | { action: 'hold-current-model'; reason: 'access-unconfirmed' | 'canary-disabled' | 'request-incompatible' }
  | { action: 'run-astra-canary'; model: typeof GPT_6_ASTRA_MODEL }

export function decideAstraRollout(input: {
  accessConfirmed: boolean
  canaryEnabled: boolean
  readiness: AstraRequestReadiness
}): AstraRolloutDecision {
  if (!input.accessConfirmed) return { action: 'hold-current-model', reason: 'access-unconfirmed' }
  if (!input.canaryEnabled) return { action: 'hold-current-model', reason: 'canary-disabled' }
  if (!input.readiness.compatible) return { action: 'hold-current-model', reason: 'request-incompatible' }
  return { action: 'run-astra-canary', model: GPT_6_ASTRA_MODEL }
}

/**
 * Automatic fallback is safe only before a side-effectful tool dispatch. Once a
 * side effect may have occurred, retrying under another model risks duplication.
 */
export function mayAutomaticallyFallback(input: {
  sideEffectfulToolDispatched: boolean
  failure: 'model-unavailable' | 'permission-denied' | 'rate-limited' | 'provider-error'
}): boolean {
  return !input.sideEffectfulToolDispatched
    && (input.failure === 'model-unavailable' || input.failure === 'permission-denied')
}

export const ASTRA_EVALUATION_LANES = [
  'evidence-preflight-boundary-fidelity',
  'canonical-release-and-revision-binding',
  'mcp-tool-entitlement-and-side-effect-bounds',
  'federated-knowledge-graph-retrieval',
  'async-tool-lifecycle-and-replay-protection',
  'mid-turn-steering-without-work-loss',
  'privacy-and-private-corpus-non-disclosure',
  'cost-latency-token-and-schema-regression',
] as const
