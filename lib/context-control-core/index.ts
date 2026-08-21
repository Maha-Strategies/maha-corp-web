/**
 * @mahastrategies/context-control-core
 *
 * The gateway-neutral half of Maha's context-control middleware contract:
 * envelope validation, the compile-decision interface, deterministic header
 * construction, secret verification, the fail-closed error model, idempotence,
 * and the payload/timeout boundaries.
 *
 * What this package deliberately is not: a compiler. `CompileContextFn` is the
 * shape an integrator supplies; no implementation ships here, and nothing in
 * this entry point pulls the Context Compiler or any application dependency
 * into a consumer's tree. A packed tarball is asserted to contain neither.
 */
export {
  // Contract identity
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  GATEWAY_CONTEXT_EXTENSION,
  GATEWAY_CONTEXT_PLACEHOLDER,
  GATEWAY_INTERCEPTOR_TOKEN_HEADER,
  GATEWAY_COMPILED_HEADER,

  // Boundaries, overridable per deployment
  GATEWAY_DEFAULT_MAX_BODY_BYTES,
  GATEWAY_DEFAULT_TIMEOUT_MS,
  GATEWAY_DEFAULT_MINIMUM_COMPILE_TOKENS,
  GATEWAY_MINIMUM_SECRET_LENGTH,
  gatewayLimitsFrom,

  // Secret verification
  gatewaySecretFrom,
  secureEqual,

  // Envelope validation and the pre-compile gate
  gateContextRequest,
  objectOrNull,
  replaceContextPlaceholder,
  wholeDocumentContext,

  // Deterministic metadata construction
  evidenceHeaders,
} from '../integrations/gateway-context-gate.ts'

export type {
  CompileContextFn,
  GateOutcome,
  GatewayBypassReason,
  GatewayCompileInput,
  GatewayCompileResult,
  GatewayEvidence,
  GatewayLimits,
  GatewayRejectionCode,
} from '../integrations/gateway-context-gate.ts'
