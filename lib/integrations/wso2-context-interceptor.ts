import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import {
  GATEWAY_CONTEXT_EXTENSION,
  GATEWAY_CONTEXT_PLACEHOLDER,
  GATEWAY_DEFAULT_MAX_BODY_BYTES,
  GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS,
  GATEWAY_POLICY_VERSION,
  compileContextDecision,
} from './gateway-context-contract.ts'

export const WSO2_CONTEXT_INTERCEPTOR_VERSION = GATEWAY_POLICY_VERSION
export const WSO2_CONTEXT_EXTENSION = GATEWAY_CONTEXT_EXTENSION
export const WSO2_CONTEXT_PLACEHOLDER = GATEWAY_CONTEXT_PLACEHOLDER
export const WSO2_INTERCEPTOR_TOKEN_HEADER = 'x-maha-wso2-interceptor-token'
export const MAX_WSO2_OPENAI_BODY_BYTES = GATEWAY_DEFAULT_MAX_BODY_BYTES
/** Below this model-neutral estimate, compiler framing is more likely to add cost than remove it. */
export const WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS = GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS

type StringMap = Record<string, string>

const EVIDENCE_FIELDS = [
  'version',
  'packId',
  'inputHash',
  'outputHash',
  'originalEstimatedTokens',
  'compiledEstimatedTokens',
  'tokensSaved',
  'estimatedReductionPercent',
  'sourceCoveragePercent',
  'includedPassageCount',
  'bypassApplied',
  'bypassReason',
  'minimumCompileTokens',
] as const

const EVIDENCE_SEAL_FIELD = 'evidenceSeal'

export type Wso2RequestHandlerResponse = {
  directRespond?: boolean
  responseCode?: number
  headersToAdd?: StringMap
  headersToReplace?: StringMap
  headersToRemove?: string[]
  body?: string
  interceptorContext?: StringMap
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringMap(value: unknown): StringMap | null {
  const record = object(value)
  if (!record || Object.values(record).some((item) => typeof item !== 'string')) return null
  return record as StringMap
}

function headerValue(headers: StringMap, name: string): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return entry?.[1] ?? null
}

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function evidencePayload(evidence: StringMap): string {
  return EVIDENCE_FIELDS.map((field) => `${field}:${evidence[field] ?? ''}`).join('\n')
}

function evidenceSeal(evidence: StringMap, secret: string): string {
  return createHmac('sha256', secret).update(evidencePayload(evidence)).digest('hex')
}

function validEvidence(value: unknown, secret: string): StringMap | null {
  const context = stringMap(value)
  if (!context || !EVIDENCE_FIELDS.every((field) => context[field]?.length > 0)) return null
  const supplied = context[EVIDENCE_SEAL_FIELD]
  if (!supplied || !secureEqual(supplied, evidenceSeal(context, secret))) return null
  return context
}

function encodeBody(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

function decodeBody(value: string): string {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('requestBody must be canonical base64.')
  }
  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) throw new Error('requestBody must be canonical base64.')
  if (bytes.byteLength > MAX_WSO2_OPENAI_BODY_BYTES) {
    throw new RangeError(`Decoded request body exceeds ${MAX_WSO2_OPENAI_BODY_BYTES} bytes.`)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function directResponse(status: number, code: string, message: string): Wso2RequestHandlerResponse {
  return {
    directRespond: true,
    responseCode: status,
    headersToAdd: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER, 'content-length'],
    body: encodeBody({ error: { code, message } }),
  }
}

/**
 * Apply Maha's Context Compiler to an exact WSO2 Interceptor Service v1 request.
 *
 * Authentication is carried in the original request-header map because the
 * WSO2 interceptor policy has no independent call-auth parameter. The header
 * must be inserted by a gateway policy, never supplied by the end user, and is
 * always removed before the request continues upstream.
 */
export function handleWso2ContextRequest(
  value: unknown,
  configuredSecret: string | undefined,
): Wso2RequestHandlerResponse {
  const envelope = object(value)
  if (!envelope) return directResponse(400, 'invalid_interceptor_envelope', 'The WSO2 interceptor request must be a JSON object.')

  if (!configuredSecret || configuredSecret.length < 32) {
    return directResponse(503, 'interceptor_not_configured', 'The Maha WSO2 interceptor is not configured.')
  }

  const requestHeaders = stringMap(envelope.requestHeaders)
  if (!requestHeaders) return directResponse(400, 'invalid_interceptor_headers', 'requestHeaders must be a string-to-string object.')
  const suppliedSecret = headerValue(requestHeaders, WSO2_INTERCEPTOR_TOKEN_HEADER)
  if (!suppliedSecret || !secureEqual(suppliedSecret, configuredSecret)) {
    return directResponse(401, 'invalid_interceptor_credential', 'The WSO2 interceptor credential is missing or invalid.')
  }

  if (typeof envelope.requestBody !== 'string') {
    return directResponse(400, 'invalid_interceptor_body', 'requestBody must be a base64-encoded JSON string.')
  }

  let upstreamBody: Record<string, unknown>
  try {
    const decoded = object(JSON.parse(decodeBody(envelope.requestBody)))
    if (!decoded) throw new Error('Decoded request body must be a JSON object.')
    upstreamBody = decoded
  } catch (error) {
    if (error instanceof RangeError) return directResponse(413, 'payload_too_large', error.message)
    return directResponse(400, 'invalid_interceptor_body', error instanceof Error ? error.message : 'The request body is invalid.')
  }

  // The policy may safely be attached to a broader OpenAI-compatible API.
  // Requests that do not opt in are left byte-for-byte untouched, except that
  // the gateway-only credential is still stripped before upstream forwarding.
  if (upstreamBody[WSO2_CONTEXT_EXTENSION] === undefined) {
    return { headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER] }
  }

  const contentType = headerValue(requestHeaders, 'content-type')
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    return directResponse(415, 'unsupported_media_type', 'Context compilation requires an application/json request.')
  }
  if (!Array.isArray(upstreamBody.messages)) {
    return directResponse(400, 'invalid_openai_request', 'An OpenAI-compatible messages[] array is required.')
  }

  // The compile-and-measure decision is the shared gateway core, so WSO2 and
  // the neutral adapters cannot disagree about the budget, the bypass rule or
  // the hashes. Everything above and below this call is WSO2 envelope
  // handling, which no other gateway shares.
  const decision = compileContextDecision(upstreamBody, { minimumCompileTokens: WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS })
  if (decision.outcome === 'rejected') {
    return directResponse(decision.status, decision.code === 'invalid_compiler_output' ? 'invalid_compiler_output' : 'context_compilation_rejected', decision.message)
  }
  if (decision.outcome !== 'compiled') {
    return { headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER] }
  }

  const rewritten = JSON.stringify(decision.body)
  const core = decision.evidence
  const evidence = {
    version: WSO2_CONTEXT_INTERCEPTOR_VERSION,
    packId: core.packId,
    inputHash: core.inputHash,
    outputHash: core.outputHash,
    originalEstimatedTokens: String(core.originalEstimatedTokens),
    compiledEstimatedTokens: String(core.compiledEstimatedTokens),
    tokensSaved: String(core.tokensSaved),
    estimatedReductionPercent: String(core.estimatedReductionPercent),
    // WSO2's published contract reports percent; the neutral adapters report
    // basis points. Both come from the same measurement.
    sourceCoveragePercent: String(core.sourceCoverageBps / 100),
    includedPassageCount: String(core.retainedPassages),
    bypassApplied: String(core.bypassApplied),
    bypassReason: core.bypassReason,
    minimumCompileTokens: String(core.minimumCompileTokens),
  }

  return {
    body: Buffer.from(rewritten, 'utf8').toString('base64'),
    headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER, 'content-length'],
    // Request-phase headers are upstream request headers. Evidence belongs
    // in the private policy context until the response phase, otherwise it
    // is disclosed to the model provider rather than returned to the caller.
    interceptorContext: { ...evidence, [EVIDENCE_SEAL_FIELD]: evidenceSeal(evidence, configuredSecret) },
  }
}

/**
 * Convert the sealed request-phase evidence into downstream response headers.
 * No model request or response body is included in this phase.
 */
export function handleWso2ContextResponse(
  value: unknown,
  configuredSecret: string | undefined,
): Wso2RequestHandlerResponse {
  if (!configuredSecret || configuredSecret.length < 32) {
    return directResponse(503, 'interceptor_not_configured', 'The Maha WSO2 interceptor is not configured.')
  }
  const envelope = object(value)
  const evidence = validEvidence(envelope?.interceptorContext, configuredSecret)
  if (!evidence) {
    return directResponse(500, 'invalid_interceptor_evidence', 'The request-phase context evidence is missing or invalid.')
  }

  return {
    headersToAdd: {
      'x-maha-context-pack-id': evidence.packId,
      'x-maha-context-input-hash': evidence.inputHash,
      'x-maha-context-output-hash': evidence.outputHash,
      'x-maha-original-estimated-tokens': evidence.originalEstimatedTokens,
      'x-maha-compiled-estimated-tokens': evidence.compiledEstimatedTokens,
      'x-maha-saved-estimated-tokens': evidence.tokensSaved,
      'x-maha-estimated-reduction-percent': evidence.estimatedReductionPercent,
      'x-maha-source-coverage-percent': evidence.sourceCoveragePercent,
      'x-maha-included-passage-count': evidence.includedPassageCount,
      'x-maha-context-bypassed': evidence.bypassApplied,
      'x-maha-context-bypass-reason': evidence.bypassReason,
      'x-maha-minimum-compile-tokens': evidence.minimumCompileTokens,
      'x-maha-zero-data-retention': 'true',
      'x-maha-wso2-contract-version': evidence.version,
    },
  }
}
