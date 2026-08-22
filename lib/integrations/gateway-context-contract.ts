/**
 * The gateway middleware contract, with the compile step attached.
 *
 * The compiler-free half lives in ./gateway-context-gate.ts so an external
 * package can depend on the envelope rules and the error model without taking
 * the Context Compiler with it. Everything that module exports is re-exported
 * here, so existing importers of this file are unaffected.
 */
import { compileContextPack, estimateTokens, parseContextPackRequest, sha256 } from '../context-compiler.ts'

import {
  GATEWAY_CONTEXT_EXTENSION,
  GATEWAY_POLICY_VERSION,
  evidenceHeaders,
  gateContextRequest,
  replaceContextPlaceholder,
  wholeDocumentContext,
  type GatewayBypassReason,
  type GatewayCompileInput,
  type GatewayCompileResult,
  type GatewayEvidence,
  type GatewayLimits,
  type GatewayRejectionCode,
} from './gateway-context-gate.ts'

export * from './gateway-context-gate.ts'

function reject(status: number, code: GatewayRejectionCode, message: string): GatewayCompileResult {
  return { outcome: 'rejected', status, code, message }
}

/**
 * The whole decision, for every gateway: the pre-compile gate, then the
 * compile-and-measure step.
 */
export function compileGatewayContext(input: GatewayCompileInput): GatewayCompileResult {
  const gated = gateContextRequest(input)
  if (gated.outcome !== 'proceed') return gated
  return compileContextDecision(gated.body, gated.limits)
}

/**
 * The compile-and-measure step, with authentication and opt-in already
 * decided by the caller.
 *
 * Exposed separately because WSO2's Interceptor Service envelope does its own
 * credential and base64 handling before this point, and making it re-run those
 * checks would mean two places deciding the same thing. This is the one place
 * that decides *how* to compile.
 */
export function compileContextDecision(
  body: Record<string, unknown>,
  limits: Pick<GatewayLimits, 'minimumCompileTokens'>,
): GatewayCompileResult {
  try {
    const request = parseContextPackRequest(body[GATEWAY_CONTEXT_EXTENSION])
    const compilation = compileContextPack(request)

    // The compiler is trusted to be correct, not to be present. A build that
    // returned a malformed pack must fail closed rather than forward a prompt
    // assembled from an unusable result.
    if (typeof compilation.context !== 'string' || typeof compilation.inputHash !== 'string' || !compilation.packId) {
      return reject(502, 'invalid_compiler_output', 'The compiler returned an unusable result.')
    }

    const originalContext = wholeDocumentContext(request)
    const originalTokens = estimateTokens(originalContext)
    const compiledTokens = estimateTokens(compilation.context)
    const bypassReason: GatewayBypassReason = originalTokens < limits.minimumCompileTokens
      ? 'below_minimum_size'
      : compiledTokens >= originalTokens
        ? 'non_expansion_guard'
        : 'none'
    const bypassApplied = bypassReason !== 'none'
    const selectedContext = bypassApplied ? originalContext : compilation.context
    const selectedTokens = bypassApplied ? originalTokens : compiledTokens

    const messages = replaceContextPlaceholder(body.messages as unknown[], selectedContext)
    const upstream = { ...body }
    delete upstream[GATEWAY_CONTEXT_EXTENSION]

    const evidence: GatewayEvidence = {
      policyVersion: GATEWAY_POLICY_VERSION,
      packId: compilation.packId,
      inputHash: compilation.inputHash,
      outputHash: sha256(selectedContext),
      tokenBudget: request.tokenBudget,
      retainedPassages: bypassApplied ? 0 : compilation.includedPassages.length,
      // Basis points, from the compiler's own percentage. Bypass forwards the
      // whole source, which is total coverage by definition.
      sourceCoverageBps: bypassApplied ? 10_000 : Math.round(compilation.metrics.sourceCoveragePercent * 100),
      originalEstimatedTokens: originalTokens,
      compiledEstimatedTokens: selectedTokens,
      tokensSaved: Math.max(0, originalTokens - selectedTokens),
      estimatedReductionPercent: originalTokens === 0
        ? 0
        : Math.max(0, Number((((originalTokens - selectedTokens) / originalTokens) * 100).toFixed(1))),
      bypassApplied,
      bypassReason,
      minimumCompileTokens: limits.minimumCompileTokens,
    }

    return { outcome: 'compiled', body: { ...upstream, messages }, headers: evidenceHeaders(evidence), evidence }
  } catch (error) {
    return reject(400, 'context_compilation_rejected', error instanceof Error ? error.message : 'The context request is invalid.')
  }
}
