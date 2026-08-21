/**
 * The compiler-free half of the gateway contract.
 *
 * Split out so an external integrator can depend on the envelope rules, the
 * header construction and the fail-closed error model without taking the
 * Context Compiler -- and its application dependencies -- along with it. This
 * module imports no runtime value from the compiler; only a type.
 *
 * `lib/integrations/gateway-context-contract.ts` adds the compile step on top
 * and remains the in-application entry point.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * The only shape this module needs from a context-pack request.
 *
 * Structural rather than imported, so the published core package carries no
 * declaration reference back into the application's compiler module. The
 * compiler's own `ContextPackRequest` satisfies it.
 */
export type ContextDocuments = {
  documents: { id: string; title?: string; text: string }[]
}

/**
 * The gateway-neutral middleware contract.
 *
 * Four gateways need the same decision made the same way. This is that
 * decision, extracted from the WSO2 interceptor rather than reimplemented, so
 * there is one compiler and one bypass rule rather than four that drift.
 *
 * What each adapter owns is transport: how its gateway hands over a request,
 * how it returns a rewritten body, and how it carries headers. What no adapter
 * owns is whether to compile, how to compile, what the budget is, or what the
 * evidence says.
 *
 * Everything here is a pure function. No network call, no clock, no storage,
 * no logging. A timeout is something an adapter applies to *calling* this, and
 * is expressed in the transport layer where the call actually happens.
 */
export const GATEWAY_CONTRACT_VERSION = '1.0.0'

/** The policy version reported in evidence. Bump when the decision changes. */
export const GATEWAY_POLICY_VERSION = '2026-08-16'

export const GATEWAY_CONTEXT_EXTENSION = 'maha_context'
export const GATEWAY_CONTEXT_PLACEHOLDER = '{{MAHA_CONTEXT_PACK}}'

/** Provider-neutral credential header. WSO2 keeps its own name for compatibility. */
export const GATEWAY_INTERCEPTOR_TOKEN_HEADER = 'x-maha-interceptor-token'

/** Set on a rewritten request so a second hop cannot compile it again. */
export const GATEWAY_COMPILED_HEADER = 'x-maha-compiled'

/**
 * Defaults, overridable per deployment.
 *
 * These are starting points, not tuned production values: the right payload
 * cap depends on the gateway's own body-buffer limit and the right timeout on
 * where the compiler runs relative to the gateway. Both are stated in the
 * operator docs as things to set deliberately.
 */
export const GATEWAY_DEFAULT_MAX_BODY_BYTES = 512_000
export const GATEWAY_DEFAULT_TIMEOUT_MS = 3_000
/** Below this model-neutral estimate, compiler framing is more likely to add cost than remove it. */
export const GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS = 1_024
/** A shared secret shorter than this is treated as unconfigured rather than weak. */
export const GATEWAY_MINIMUM_SECRET_LENGTH = 32

export type GatewayLimits = {
  maxBodyBytes: number
  minimumCompileTokens: number
  timeoutMs: number
}

export function gatewayLimitsFrom(environment: NodeJS.ProcessEnv = process.env): GatewayLimits {
  const integer = (name: string, fallback: number): number => {
    const raw = environment[name]?.trim()
    if (!raw) return fallback
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  }
  return {
    maxBodyBytes: integer('MAHA_GATEWAY_MAX_BODY_BYTES', GATEWAY_DEFAULT_MAX_BODY_BYTES),
    minimumCompileTokens: integer('MAHA_GATEWAY_MINIMUM_COMPILE_TOKENS', GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS),
    timeoutMs: integer('MAHA_GATEWAY_TIMEOUT_MS', GATEWAY_DEFAULT_TIMEOUT_MS),
  }
}

/**
 * The configured secret, from either variable.
 *
 * WSO2's name is accepted so an existing deployment keeps working unchanged;
 * the neutral name is preferred for everything else. Neither value is ever
 * returned, compared non-constant-time, or included in a result.
 */
export function gatewaySecretFrom(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const neutral = environment.MAHA_CONTEXT_INTERCEPTOR_SECRET?.trim()
  if (neutral) return neutral
  return environment.WSO2_CONTEXT_INTERCEPTOR_SECRET?.trim() || undefined
}

export type GatewayEvidence = {
  policyVersion: string
  packId: string
  inputHash: string
  outputHash: string
  tokenBudget: number
  retainedPassages: number
  sourceCoverageBps: number
  originalEstimatedTokens: number
  compiledEstimatedTokens: number
  tokensSaved: number
  estimatedReductionPercent: number
  bypassApplied: boolean
  bypassReason: GatewayBypassReason
  minimumCompileTokens: number
}

export type GatewayBypassReason = 'none' | 'below_minimum_size' | 'non_expansion_guard'

export type GatewayRejectionCode =
  | 'interceptor_not_configured'
  | 'invalid_interceptor_credential'
  | 'invalid_envelope'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'invalid_llm_request'
  | 'context_compilation_rejected'
  | 'invalid_compiler_output'

export type GatewayCompileResult =
  | { outcome: 'compiled'; body: Record<string, unknown>; headers: Record<string, string>; evidence: GatewayEvidence }
  | { outcome: 'passthrough'; reason: 'no_context_extension' | 'already_compiled' }
  | { outcome: 'rejected'; status: number; code: GatewayRejectionCode; message: string }

export type GatewayCompileInput = {
  /** The parsed LLM request body. */
  body: unknown
  /** Byte length of the body as it arrived, for the payload cap. */
  bodyBytes: number
  /** Credential presented by the gateway, not by the end user. */
  suppliedSecret: string | null | undefined
  configuredSecret: string | undefined
  contentType: string | null | undefined
  /** True when an upstream hop already compiled this request. */
  alreadyCompiled: boolean
  limits?: Partial<GatewayLimits>
}

export function objectOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Constant-time over digests, so length never leaks through timing. */
export function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function reject(status: number, code: GatewayRejectionCode, message: string): GatewayCompileResult {
  return { outcome: 'rejected', status, code, message }
}

/** The context as the caller would have sent it, had the policy not been attached. */
export function wholeDocumentContext(request: ContextDocuments): string {
  return request.documents
    .map((document) => `[${document.id}] ${document.title ?? ''}\n${document.text}`)
    .join('\n\n')
}

export function replaceContextPlaceholder(messages: unknown[], context: string): unknown[] {
  let occurrences = 0
  const rewritten = messages.map((message) => {
    const record = objectOrNull(message)
    if (!record || typeof record.content !== 'string') return message
    const count = record.content.split(GATEWAY_CONTEXT_PLACEHOLDER).length - 1
    occurrences += count
    return count === 0 ? message : { ...record, content: record.content.replaceAll(GATEWAY_CONTEXT_PLACEHOLDER, context) }
  })
  if (occurrences !== 1) {
    throw new Error(`messages[] must contain ${GATEWAY_CONTEXT_PLACEHOLDER} exactly once in a string content field.`)
  }
  return rewritten
}

/**
 * Evidence as headers.
 *
 * Only the fields a reviewer can act on, and only values derived from
 * measurements. No task, no document identifier from caller content, no
 * passage text, no secret. Coverage is basis points because a header is a
 * string and an integer round-trips without a locale deciding what a decimal
 * separator is.
 */
export function evidenceHeaders(evidence: GatewayEvidence): Record<string, string> {
  return {
    [GATEWAY_COMPILED_HEADER]: 'true',
    'x-maha-input-hash': evidence.inputHash,
    'x-maha-output-hash': evidence.outputHash,
    'x-maha-token-budget': String(evidence.tokenBudget),
    'x-maha-retained-passages': String(evidence.retainedPassages),
    'x-maha-source-coverage-bps': String(evidence.sourceCoverageBps),
    'x-maha-policy-version': evidence.policyVersion,
  }
}


export type GateOutcome =
  | { outcome: 'proceed'; body: Record<string, unknown>; limits: GatewayLimits }
  | { outcome: 'passthrough'; reason: 'no_context_extension' | 'already_compiled' }
  | { outcome: 'rejected'; status: number; code: GatewayRejectionCode; message: string }

/**
 * Every check that happens before the compiler is consulted.
 *
 * Order is deliberate: configuration, then credential, then payload size, then
 * shape. A caller must not be able to learn whether a secret is correct by
 * sending a large body, and an unconfigured deployment must not report a
 * credential problem it never checked.
 */
export function gateContextRequest(input: GatewayCompileInput): GateOutcome {
  const limits: GatewayLimits = {
    maxBodyBytes: input.limits?.maxBodyBytes ?? GATEWAY_DEFAULT_MAX_BODY_BYTES,
    minimumCompileTokens: input.limits?.minimumCompileTokens ?? GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS,
    timeoutMs: input.limits?.timeoutMs ?? GATEWAY_DEFAULT_TIMEOUT_MS,
  }

  if (!input.configuredSecret || input.configuredSecret.length < GATEWAY_MINIMUM_SECRET_LENGTH) {
    return { outcome: 'rejected', status: 503, code: 'interceptor_not_configured', message: 'The Maha context interceptor is not configured.' }
  }
  if (!input.suppliedSecret || !secureEqual(input.suppliedSecret, input.configuredSecret)) {
    return { outcome: 'rejected', status: 401, code: 'invalid_interceptor_credential', message: 'The interceptor credential is missing or invalid.' }
  }
  if (!Number.isFinite(input.bodyBytes) || input.bodyBytes < 0) {
    return { outcome: 'rejected', status: 400, code: 'invalid_envelope', message: 'The request body size is unknown.' }
  }
  if (input.bodyBytes > limits.maxBodyBytes) {
    return { outcome: 'rejected', status: 413, code: 'payload_too_large', message: `Request body exceeds ${limits.maxBodyBytes} bytes.` }
  }

  const body = objectOrNull(input.body)
  if (!body) return { outcome: 'rejected', status: 400, code: 'invalid_envelope', message: 'The request body must be a JSON object.' }

  // Idempotence. Compiling twice would rewrite an already-rewritten prompt and
  // emit evidence describing the wrong input.
  if (input.alreadyCompiled) return { outcome: 'passthrough', reason: 'already_compiled' }
  if (body[GATEWAY_CONTEXT_EXTENSION] === undefined) return { outcome: 'passthrough', reason: 'no_context_extension' }

  if (!input.contentType?.toLowerCase().startsWith('application/json')) {
    return { outcome: 'rejected', status: 415, code: 'unsupported_media_type', message: 'Context compilation requires an application/json request.' }
  }
  if (!Array.isArray(body.messages)) {
    return { outcome: 'rejected', status: 400, code: 'invalid_llm_request', message: 'An OpenAI-compatible messages[] array is required.' }
  }
  return { outcome: 'proceed', body, limits }
}

/**
 * The compile step an integrator supplies.
 *
 * The core package defines the shape and never ships an implementation:
 * hosting a compiler is the application's job, not a client library's.
 */
export type CompileContextFn = (body: Record<string, unknown>, limits: Pick<GatewayLimits, 'minimumCompileTokens'>) => GatewayCompileResult
