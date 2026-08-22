/**
 * The only shape this module needs from a context-pack request.
 *
 * Structural rather than imported, so the published core package carries no
 * declaration reference back into the application's compiler module. The
 * compiler's own `ContextPackRequest` satisfies it.
 */
export type ContextDocuments = {
    documents: {
        id: string;
        title?: string;
        text: string;
    }[];
};
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
export declare const GATEWAY_CONTRACT_VERSION = "1.0.0";
/** The policy version reported in evidence. Bump when the decision changes. */
export declare const GATEWAY_POLICY_VERSION = "2026-08-16";
export declare const GATEWAY_CONTEXT_EXTENSION = "maha_context";
export declare const GATEWAY_CONTEXT_PLACEHOLDER = "{{MAHA_CONTEXT_PACK}}";
/** Provider-neutral credential header. WSO2 keeps its own name for compatibility. */
export declare const GATEWAY_INTERCEPTOR_TOKEN_HEADER = "x-maha-interceptor-token";
/** Set on a rewritten request so a second hop cannot compile it again. */
export declare const GATEWAY_COMPILED_HEADER = "x-maha-compiled";
/**
 * Defaults, overridable per deployment.
 *
 * These are starting points, not tuned production values: the right payload
 * cap depends on the gateway's own body-buffer limit and the right timeout on
 * where the compiler runs relative to the gateway. Both are stated in the
 * operator docs as things to set deliberately.
 */
export declare const GATEWAY_DEFAULT_MAX_BODY_BYTES = 512000;
export declare const GATEWAY_DEFAULT_TIMEOUT_MS = 3000;
/** Below this model-neutral estimate, compiler framing is more likely to add cost than remove it. */
export declare const GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS = 1024;
/** A shared secret shorter than this is treated as unconfigured rather than weak. */
export declare const GATEWAY_MINIMUM_SECRET_LENGTH = 32;
export type GatewayLimits = {
    maxBodyBytes: number;
    minimumCompileTokens: number;
    timeoutMs: number;
};
export declare function gatewayLimitsFrom(environment?: NodeJS.ProcessEnv): GatewayLimits;
/**
 * The configured secret, from either variable.
 *
 * WSO2's name is accepted so an existing deployment keeps working unchanged;
 * the neutral name is preferred for everything else. Neither value is ever
 * returned, compared non-constant-time, or included in a result.
 */
export declare function gatewaySecretFrom(environment?: NodeJS.ProcessEnv): string | undefined;
export type GatewayEvidence = {
    policyVersion: string;
    packId: string;
    inputHash: string;
    outputHash: string;
    tokenBudget: number;
    retainedPassages: number;
    sourceCoverageBps: number;
    originalEstimatedTokens: number;
    compiledEstimatedTokens: number;
    tokensSaved: number;
    estimatedReductionPercent: number;
    bypassApplied: boolean;
    bypassReason: GatewayBypassReason;
    minimumCompileTokens: number;
};
export type GatewayBypassReason = 'none' | 'below_minimum_size' | 'non_expansion_guard';
export type GatewayRejectionCode = 'interceptor_not_configured' | 'invalid_interceptor_credential' | 'invalid_envelope' | 'payload_too_large' | 'unsupported_media_type' | 'invalid_llm_request' | 'context_compilation_rejected' | 'invalid_compiler_output';
export type GatewayCompileResult = {
    outcome: 'compiled';
    body: Record<string, unknown>;
    headers: Record<string, string>;
    evidence: GatewayEvidence;
} | {
    outcome: 'passthrough';
    reason: 'no_context_extension' | 'already_compiled';
} | {
    outcome: 'rejected';
    status: number;
    code: GatewayRejectionCode;
    message: string;
};
export type GatewayCompileInput = {
    /** The parsed LLM request body. */
    body: unknown;
    /** Byte length of the body as it arrived, for the payload cap. */
    bodyBytes: number;
    /** Credential presented by the gateway, not by the end user. */
    suppliedSecret: string | null | undefined;
    configuredSecret: string | undefined;
    contentType: string | null | undefined;
    /** True when an upstream hop already compiled this request. */
    alreadyCompiled: boolean;
    limits?: Partial<GatewayLimits>;
};
export declare function objectOrNull(value: unknown): Record<string, unknown> | null;
/** Constant-time over digests, so length never leaks through timing. */
export declare function secureEqual(left: string, right: string): boolean;
/** The context as the caller would have sent it, had the policy not been attached. */
export declare function wholeDocumentContext(request: ContextDocuments): string;
export declare function replaceContextPlaceholder(messages: unknown[], context: string): unknown[];
/**
 * Evidence as headers.
 *
 * Only the fields a reviewer can act on, and only values derived from
 * measurements. No task, no document identifier from caller content, no
 * passage text, no secret. Coverage is basis points because a header is a
 * string and an integer round-trips without a locale deciding what a decimal
 * separator is.
 */
export declare function evidenceHeaders(evidence: GatewayEvidence): Record<string, string>;
export type GateOutcome = {
    outcome: 'proceed';
    body: Record<string, unknown>;
    limits: GatewayLimits;
} | {
    outcome: 'passthrough';
    reason: 'no_context_extension' | 'already_compiled';
} | {
    outcome: 'rejected';
    status: number;
    code: GatewayRejectionCode;
    message: string;
};
/**
 * Every check that happens before the compiler is consulted.
 *
 * Order is deliberate: configuration, then credential, then payload size, then
 * shape. A caller must not be able to learn whether a secret is correct by
 * sending a large body, and an unconfigured deployment must not report a
 * credential problem it never checked.
 */
export declare function gateContextRequest(input: GatewayCompileInput): GateOutcome;
/**
 * The compile step an integrator supplies.
 *
 * The core package defines the shape and never ships an implementation:
 * hosting a compiler is the application's job, not a client library's.
 */
export type CompileContextFn = (body: Record<string, unknown>, limits: Pick<GatewayLimits, 'minimumCompileTokens'>) => GatewayCompileResult;
//# sourceMappingURL=gateway-context-gate.d.ts.map