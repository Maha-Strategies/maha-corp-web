import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { compileContextPack, estimateTokens, parseContextPackRequest, sha256, type ContextPackRequest } from '../context-compiler.ts'

export const WSO2_CONTEXT_INTERCEPTOR_VERSION = '2026-08-16'
export const WSO2_CONTEXT_EXTENSION = 'maha_context'
export const WSO2_CONTEXT_PLACEHOLDER = '{{MAHA_CONTEXT_PACK}}'
export const WSO2_INTERCEPTOR_TOKEN_HEADER = 'x-maha-wso2-interceptor-token'
export const MAX_WSO2_OPENAI_BODY_BYTES = 512_000
/** Below this model-neutral estimate, compiler framing is more likely to add cost than remove it. */
export const WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS = 1_024

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

function replaceContextPlaceholder(messages: unknown[], context: string): unknown[] {
  let occurrences = 0
  const rewritten = messages.map((message) => {
    const record = object(message)
    if (!record || typeof record.content !== 'string') return message
    const count = record.content.split(WSO2_CONTEXT_PLACEHOLDER).length - 1
    occurrences += count
    return count === 0
      ? message
      : { ...record, content: record.content.replaceAll(WSO2_CONTEXT_PLACEHOLDER, context) }
  })
  if (occurrences !== 1) {
    throw new Error(`messages[] must contain ${WSO2_CONTEXT_PLACEHOLDER} exactly once in a string content field.`)
  }
  return rewritten
}

function wholeDocumentContext(request: ContextPackRequest): string {
  return request.documents
    .map((document) => `[${document.id}] ${document.title ?? ''}\n${document.text}`)
    .join('\n\n')
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

  try {
    const request = parseContextPackRequest(upstreamBody[WSO2_CONTEXT_EXTENSION])
    const compilation = compileContextPack(request)
    const originalContext = wholeDocumentContext(request)
    const originalContextTokens = estimateTokens(originalContext)
    const compiledContextTokens = estimateTokens(compilation.context)
    const bypassReason = originalContextTokens < WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS
      ? 'below_minimum_size'
      : compiledContextTokens >= originalContextTokens
        ? 'non_expansion_guard'
        : 'none'
    const bypassApplied = bypassReason !== 'none'
    const selectedContext = bypassApplied ? originalContext : compilation.context
    const selectedTokens = bypassApplied ? originalContextTokens : compiledContextTokens
    const messages = replaceContextPlaceholder(upstreamBody.messages, selectedContext)
    const upstream = { ...upstreamBody }
    delete upstream[WSO2_CONTEXT_EXTENSION]
    const rewritten = JSON.stringify({ ...upstream, messages })

    const evidence = {
      version: WSO2_CONTEXT_INTERCEPTOR_VERSION,
      packId: compilation.packId,
      inputHash: compilation.inputHash,
      outputHash: sha256(selectedContext),
      originalEstimatedTokens: String(originalContextTokens),
      compiledEstimatedTokens: String(selectedTokens),
      tokensSaved: String(Math.max(0, originalContextTokens - selectedTokens)),
      estimatedReductionPercent: String(originalContextTokens === 0 ? 0 : Math.max(0, Number((((originalContextTokens - selectedTokens) / originalContextTokens) * 100).toFixed(1)))),
      sourceCoveragePercent: String(bypassApplied ? 100 : compilation.metrics.sourceCoveragePercent),
      includedPassageCount: String(bypassApplied ? 0 : compilation.includedPassages.length),
      bypassApplied: String(bypassApplied),
      bypassReason,
      minimumCompileTokens: String(WSO2_CONTEXT_MINIMUM_COMPILE_TOKENS),
    }

    return {
      body: Buffer.from(rewritten, 'utf8').toString('base64'),
      headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER, 'content-length'],
      // Request-phase headers are upstream request headers. Evidence belongs
      // in the private policy context until the response phase, otherwise it
      // is disclosed to the model provider rather than returned to the caller.
      interceptorContext: { ...evidence, [EVIDENCE_SEAL_FIELD]: evidenceSeal(evidence, configuredSecret) },
    }
  } catch (error) {
    return directResponse(400, 'context_compilation_rejected', error instanceof Error ? error.message : 'The context request is invalid.')
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
