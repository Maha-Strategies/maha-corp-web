import { evaluateContextPack, parseContextEvaluationRequest, type ContextEvaluationRequest } from './context-pack-evaluator.ts'
import { DEEP_CONTEXT_EVALUATION_OFFER } from './x402/offers.ts'

// The public response envelope for the Deep Context Evaluation offer.
//
// Extracted from the route rather than written inside it so the shape can be
// asserted directly -- in particular that the retention metric is described as
// exact span matching everywhere it appears. A claim that drifts from "this
// span survived selection" toward "this answer is correct" is the single
// failure mode that would make this product dishonest, and it is much easier
// to catch in a unit test than in a route test that needs a request pipeline.
//
// The credential-protected /api/context-pack-evaluations route is deliberately
// untouched. It shares `evaluateContextPack`, which is unchanged; nothing here
// reaches back into it.

/**
 * The x402 offer accepts the enterprise-tier payload ceiling.
 *
 * Deliberately larger than MAX_CONTEXT_EVALUATION_BYTES, which is the 128 KB
 * limit the credential route publishes and which stays exactly as it is. This
 * offer is priced ten times the entry tier and buys the larger envelope.
 */
export const MAX_X402_EVALUATION_BYTES = 1_050_000

export const MIN_DOCUMENTS = 1
export const MAX_DOCUMENTS = 8
export const MIN_REQUIRED_EVIDENCE = 1
export const MAX_REQUIRED_EVIDENCE = 32

export type DeepContextEvaluation = ReturnType<typeof buildDeepContextEvaluation>

/**
 * Parses and validates, or throws with a caller-actionable message.
 *
 * The document and evidence bounds are enforced by the shared parser; they are
 * re-checked here only where the parser's message would not name the limit the
 * offer publishes.
 */
export function parseDeepContextRequest(value: unknown): ContextEvaluationRequest {
  const request = parseContextEvaluationRequest(value)
  if (request.documents.length < MIN_DOCUMENTS || request.documents.length > MAX_DOCUMENTS) {
    throw new Error(`documents must contain ${MIN_DOCUMENTS}-${MAX_DOCUMENTS} source documents.`)
  }
  if (request.requiredEvidence.length < MIN_REQUIRED_EVIDENCE || request.requiredEvidence.length > MAX_REQUIRED_EVIDENCE) {
    throw new Error(`requiredEvidence must contain ${MIN_REQUIRED_EVIDENCE}-${MAX_REQUIRED_EVIDENCE} evidence spans.`)
  }
  return request
}

export function buildDeepContextEvaluation(request: ContextEvaluationRequest) {
  const result = evaluateContextPack(request)

  return {
    version: '0.1.0' as const,
    offerId: DEEP_CONTEXT_EVALUATION_OFFER.id,
    evaluationId: result.evaluationId,
    clientRequestId: result.clientRequestId,
    contextPack: result.contextPack,
    // Source-linked per span: which document it came from, its hash, and
    // whether the exact text survived. The span text itself is not echoed --
    // the caller already has it, and returning it would put source text in
    // every log that captures a response body.
    evidence: result.evidence,
    metrics: result.metrics,
    inputHash: result.inputHash,
    outputHash: result.outputHash,
    warnings: result.warnings,
    // Machine-readable, because an autonomous buyer does not read prose. The
    // last code is the one that matters commercially: it says in a field an
    // agent can branch on that the headline percentage is span retention and
    // not accuracy.
    warningCodes: [
      'model_neutral_token_estimates',
      'extractive_selection_not_verification',
      'exact_span_retention_not_accuracy',
    ] as const,
    retentionBoundaries: {
      ...result.contextPack.retentionBoundaries,
      evidenceRetentionMeasurement: 'exact_span_match' as const,
      factualAccuracyAssessed: false as const,
      answerQualityAssessed: false as const,
    },
    sourceTextStored: false as const,
    compiledContextStored: false as const,
    requiredEvidenceTextStored: false as const,
  }
}
