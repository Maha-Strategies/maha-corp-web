import { createHash, timingSafeEqual } from 'node:crypto'

import { compileContextPack, parseContextPackRequest } from '../context-compiler.ts'

export const WSO2_CONTEXT_INTERCEPTOR_VERSION = '2026-08-14'
export const WSO2_CONTEXT_EXTENSION = 'maha_context'
export const WSO2_CONTEXT_PLACEHOLDER = '{{MAHA_CONTEXT_PACK}}'
export const WSO2_INTERCEPTOR_TOKEN_HEADER = 'x-maha-wso2-interceptor-token'
export const MAX_WSO2_OPENAI_BODY_BYTES = 512_000

type StringMap = Record<string, string>

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
    const compilation = compileContextPack(parseContextPackRequest(upstreamBody[WSO2_CONTEXT_EXTENSION]))
    const messages = replaceContextPlaceholder(upstreamBody.messages, compilation.context)
    const upstream = { ...upstreamBody }
    delete upstream[WSO2_CONTEXT_EXTENSION]
    const rewritten = JSON.stringify({ ...upstream, messages })

    const evidence = {
      version: WSO2_CONTEXT_INTERCEPTOR_VERSION,
      packId: compilation.packId,
      inputHash: compilation.inputHash,
      outputHash: compilation.outputHash,
      originalEstimatedTokens: String(compilation.metrics.originalEstimatedTokens),
      compiledEstimatedTokens: String(compilation.metrics.compiledEstimatedTokens),
      tokensSaved: String(compilation.metrics.tokensSaved),
      estimatedReductionPercent: String(compilation.metrics.estimatedReductionPercent),
      sourceCoveragePercent: String(compilation.metrics.sourceCoveragePercent),
      includedPassageCount: String(compilation.includedPassages.length),
    }

    return {
      body: Buffer.from(rewritten, 'utf8').toString('base64'),
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
        'x-maha-zero-data-retention': 'true',
        'x-maha-wso2-contract-version': evidence.version,
      },
      headersToRemove: [WSO2_INTERCEPTOR_TOKEN_HEADER, 'content-length'],
      interceptorContext: evidence,
    }
  } catch (error) {
    return directResponse(400, 'context_compilation_rejected', error instanceof Error ? error.message : 'The context request is invalid.')
  }
}
