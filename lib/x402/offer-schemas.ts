// Per-offer input and output contracts, published to Bazaar and OpenAPI.
//
// Discovery support used to be hard-coded for /api/v1/compress: one schema
// pair, one module-level cache variable, one `if pathPrefix !== ...` guard.
// That shape does not extend to three offers -- the single cache would serve
// the compress declaration for whichever offer asked first.
//
// So the schemas live here, keyed by offer, and the cache in discovery.ts is
// keyed by offer id. An offer with no entry here is published with no Bazaar
// declaration at all, which stays the deliberate default: a vague or incorrect
// schema is worse than no listing, because a Bazaar agent can spend money
// against it without a human noticing the mismatch.

export type JsonSchema = Record<string, unknown>

export type OfferDiscoveryContract = {
  /** Example request body. Must validate against `inputSchema`. */
  input: Record<string, unknown>
  inputSchema: JsonSchema
  /** Example success body. Must validate against `outputSchema`. */
  output: Record<string, unknown>
  outputSchema: JsonSchema
  /**
   * Headers a payer must send, and how to compute them.
   *
   * Separate from `inputSchema` because that is a JSON Schema for the body: an
   * unrecognised keyword there documents nothing and breaks validation of the
   * example beside it. Optional, because only offers with a pre-settlement
   * claim need one.
   *
   * Published because it was not. A required header whose computation lives
   * only in server code is not a contract -- a payer cannot derive it, and on
   * the MPS audit getting it wrong cost a full settlement with no job.
   */
  requiredHeaders?: Record<string, {
    /** Exactly what is hashed, in the payer's terms. */
    preimage: string
    algorithm: string
    format: string
    notes?: string
  }>
}

const SHA256_PATTERN = '^sha256:[a-f0-9]{64}$'
const SOURCE_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
const PASSAGE_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}:[1-9][0-9]*$'
const EVIDENCE_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

/**
 * The compiled Context Pack, which both compression offers return.
 *
 * Factored rather than copied. The deep offer nests this object under
 * `contextPack`; the entry offer returns it at the top level. Two hand-written
 * copies would drift the first time a metric is added, and the drift would
 * only surface as a Bazaar example that fails validation on one offer.
 */
function contextPackSchema(): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1.0' },
      packId: { type: 'string', pattern: '^ctxpack_[a-f0-9]{32}$' },
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
      task: { type: 'string' },
      tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 },
      context: { type: 'string' },
      metrics: compilationMetricsSchema(),
      includedPassages: includedPassagesSchema(),
      sources: sourcesSchema(),
      warnings: { type: 'array', items: { type: 'string' }, description: 'Human-readable limitations.' },
      warningCodes: warningCodesSchema(),
      retentionBoundaries: retentionBoundariesSchema(),
      inputHash: { type: 'string', pattern: SHA256_PATTERN },
      outputHash: { type: 'string', pattern: SHA256_PATTERN },
    },
    required: ['version', 'packId', 'clientRequestId', 'task', 'tokenBudget', 'context', 'metrics', 'includedPassages', 'sources', 'warnings', 'warningCodes', 'retentionBoundaries', 'inputHash', 'outputHash'],
  }
}

function compilationMetricsSchema(): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      originalBytes: { type: 'integer', minimum: 0, description: 'Source UTF-8 bytes.' },
      compiledBytes: { type: 'integer', minimum: 0, description: 'Output UTF-8 bytes.' },
      originalEstimatedTokens: { type: 'integer', minimum: 0, description: 'Source token estimate.' },
      compiledEstimatedTokens: { type: 'integer', minimum: 0, description: 'Output token estimate.' },
      tokensSaved: { type: 'integer', minimum: 0, description: 'Estimated input tokens avoided. Multiply by your own model input price to obtain a cost saving; this service does not know your model and does not compute a dollar figure.' },
      estimatedReductionPercent: { type: 'number', minimum: 0, maximum: 100, description: 'Estimated token reduction; not provider billing.' },
      sourceCount: { type: 'integer', minimum: 1, maximum: 8, description: 'Input source count.' },
      sourceCoveragePercent: { type: 'number', minimum: 0, maximum: 100, description: 'Sources with selected passages; not evidence recall.' },
      duplicatePassagesRemoved: { type: 'integer', minimum: 0, description: 'Exact duplicates removed.' },
    },
    required: ['originalBytes', 'compiledBytes', 'originalEstimatedTokens', 'compiledEstimatedTokens', 'tokensSaved', 'estimatedReductionPercent', 'sourceCount', 'sourceCoveragePercent', 'duplicatePassagesRemoved'],
  }
}

function includedPassagesSchema(): JsonSchema {
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN },
        passageId: { type: 'string', pattern: PASSAGE_ID_PATTERN },
        passageHash: { type: 'string', pattern: SHA256_PATTERN },
        text: { type: 'string', minLength: 1 },
      },
      required: ['sourceId', 'passageId', 'passageHash', 'text'],
    },
  }
}

function sourcesSchema(): JsonSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: 8,
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN },
        title: { type: 'string' },
        sourceHash: { type: 'string', pattern: SHA256_PATTERN },
        originalEstimatedTokens: { type: 'integer', minimum: 0 },
        passageCount: { type: 'integer', minimum: 1 },
        includedPassageIds: { type: 'array', items: { type: 'string', pattern: PASSAGE_ID_PATTERN } },
        includedEstimatedTokens: { type: 'integer', minimum: 0 },
      },
      required: ['sourceId', 'title', 'sourceHash', 'originalEstimatedTokens', 'passageCount', 'includedPassageIds', 'includedEstimatedTokens'],
    },
  }
}

function warningCodesSchema(): JsonSchema {
  return {
    type: 'array',
    items: { type: 'string', enum: ['model_neutral_token_estimates', 'extractive_selection_not_verification', 'no_passage_fit_budget'] },
    description: 'Machine-readable limitations.',
  }
}

function retentionBoundariesSchema(): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      selectionType: { type: 'string', const: 'extractive' },
      evidenceRetention: { type: 'string', const: 'best_effort' },
      claimVerificationPerformed: { type: 'boolean', const: false },
      completenessGuaranteed: { type: 'boolean', const: false },
      hallucinationPreventionGuaranteed: { type: 'boolean', const: false },
      tokenCountType: { type: 'string', const: 'model_neutral_estimate' },
    },
    required: ['selectionType', 'evidenceRetention', 'claimVerificationPerformed', 'completenessGuaranteed', 'hallucinationPreventionGuaranteed', 'tokenCountType'],
  }
}

/** The document array both compression offers accept. */
function documentsSchema(): JsonSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: 8,
    description: 'Sources to rank and deduplicate.',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', pattern: SOURCE_ID_PATTERN, description: 'Stable source ID.' },
        title: { type: 'string', minLength: 1, maxLength: 160, description: 'Source title.' },
        text: { type: 'string', minLength: 1, description: 'Transient source text.' },
      },
      required: ['id', 'text'],
    },
  }
}

function compilationInputProperties(): Record<string, JsonSchema> {
  return {
    clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller trace ID.' },
    task: { type: 'string', minLength: 8, maxLength: 1200, description: 'Task used to rank passages.' },
    tokenBudget: { type: 'integer', minimum: 64, maximum: 16000, description: 'Model-neutral output budget.' },
    documents: documentsSchema(),
    provenance: { type: 'string', enum: ['full', 'compact', 'none'], default: 'full', description: 'Inline citation style.' },
    scoring: { type: 'string', enum: ['bm25', 'keyword'], default: 'bm25', description: 'Passage ranker.' },
    budgetMode: { type: 'string', enum: ['guaranteed', 'estimated'], default: 'guaranteed', description: 'Budget enforcement mode.' },
  }
}

// ---------------------------------------------------------------------------
// Offer 1 -- Entry Context (unchanged contract)
// ---------------------------------------------------------------------------

// Verbatim from the shipped declaration. This offer has settled payments
// against it, so the example and the schema are frozen rather than tidied.
const COMPRESSION_INPUT = {
  clientRequestId: 'req_rag_release_001',
  task: 'Find the release condition and rollback trigger while removing duplicate operational background.',
  tokenBudget: 128,
  documents: [
    { id: 'release-notes', title: 'Release notes', text: 'Release may proceed after the security owner attaches credential-rotation evidence. The production canary passed in every region.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
    { id: 'rollback-runbook', title: 'Rollback runbook', text: 'Rollback if API errors exceed 2 percent for five minutes or payment failures breach the alert threshold. Restore the last-known-good deployment before reopening traffic.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
  ],
  provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
}

const COMPRESSION_OUTPUT = {
  version: '0.1.0',
  packId: 'ctxpack_6a5464df2ce14e9b9e16571c7d814821',
  clientRequestId: 'req_rag_release_001',
  task: COMPRESSION_INPUT.task,
  tokenBudget: 128,
  context: '# Context Pack\n\nTask: Find the release condition and rollback trigger while removing duplicate operational background.\n\n[release-notes:1] Release may proceed after the security owner attaches credential-rotation evidence. The production canary passed in every region.\n\n[rollback-runbook:1] Rollback if API errors exceed 2 percent for five minutes or payment failures breach the alert threshold. Restore the last-known-good deployment before reopening traffic.',
  metrics: {
    originalBytes: 606,
    compiledBytes: 461,
    originalEstimatedTokens: 97,
    compiledEstimatedTokens: 83,
    tokensSaved: 14,
    estimatedReductionPercent: 14.4,
    sourceCount: 2,
    sourceCoveragePercent: 100,
    duplicatePassagesRemoved: 1,
  },
  includedPassages: [
    { sourceId: 'release-notes', passageId: 'release-notes:1', passageHash: 'sha256:4d5e66efdcf5f8dba63a89b40af6ce17f3f42948c48b731732e47f5dc2e7740c', text: 'Release may proceed after the security owner attaches credential-rotation evidence. The production canary passed in every region.' },
    { sourceId: 'rollback-runbook', passageId: 'rollback-runbook:1', passageHash: 'sha256:6ac9d2eec09e0d9b0233f51d845f0ecbd1beca34fceab3ee44370b352644e2b5', text: 'Rollback if API errors exceed 2 percent for five minutes or payment failures breach the alert threshold. Restore the last-known-good deployment before reopening traffic.' },
  ],
  sources: [
    { sourceId: 'release-notes', title: 'Release notes', sourceHash: 'sha256:288ded29ae161d3d11effd7161edf7c51ef1320e7ba0a8d2feaaed7abccec607', originalEstimatedTokens: 44, passageCount: 2, includedPassageIds: ['release-notes:1'], includedEstimatedTokens: 21 },
    { sourceId: 'rollback-runbook', title: 'Rollback runbook', sourceHash: 'sha256:29fca10dd4c87bee562ed5b22b42dfcc970e0dc4768591b0983fe463646f38ca', originalEstimatedTokens: 53, passageCount: 2, includedPassageIds: ['rollback-runbook:1'], includedEstimatedTokens: 30 },
  ],
  warnings: [
    'Token counts are model-neutral estimates, not provider tokenizer or billing counts.',
    'This compiler ranks and deduplicates text; it does not verify claims, guarantee completeness, or prevent hallucination.',
  ],
  warningCodes: ['model_neutral_token_estimates', 'extractive_selection_not_verification'],
  retentionBoundaries: {
    selectionType: 'extractive',
    evidenceRetention: 'best_effort',
    claimVerificationPerformed: false,
    completenessGuaranteed: false,
    hallucinationPreventionGuaranteed: false,
    tokenCountType: 'model_neutral_estimate',
  },
  inputHash: 'sha256:288dd5cacd92158f9460346ba6e931f6d0d52f2598bd55e748fc30a186fbdc34',
  outputHash: 'sha256:80a337617475688482476a469f9fa7b489ef3e1ad15b4a9756fdc1aa716ed089',
  sourceTextStored: false,
  compiledContextStored: false,
}

export const CONTEXT_COMPRESSION_DISCOVERY: OfferDiscoveryContract = {
  input: COMPRESSION_INPUT,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: compilationInputProperties(),
    required: ['clientRequestId', 'task', 'tokenBudget', 'documents'],
  },
  output: COMPRESSION_OUTPUT,
  outputSchema: (() => {
    const pack = contextPackSchema()
    const properties = { ...(pack.properties as Record<string, JsonSchema>) }
    properties.sourceTextStored = { type: 'boolean', const: false }
    properties.compiledContextStored = { type: 'boolean', const: false }
    return {
      ...pack,
      properties,
      required: [...(pack.required as string[]), 'sourceTextStored', 'compiledContextStored'],
    }
  })(),
}

// ---------------------------------------------------------------------------
// Offer 2 -- Deep Context Evaluation
// ---------------------------------------------------------------------------

// Placeholders replaced below by the generated fixture. Keeping the literal
// values in a generated file rather than hand-writing them is what makes the
// "every example validates against its schema" test meaningful: a hand-written
// example is a second implementation of the compiler, and it is the one that
// will be wrong.
import {
  DEEP_CONTEXT_EXAMPLE_INPUT,
  DEEP_CONTEXT_EXAMPLE_OUTPUT,
  MPS_AUDIT_EXAMPLE_INPUT,
  MPS_AUDIT_EXAMPLE_OUTPUT,
  RESEARCH_INTAKE_EXAMPLE_INPUT,
  RESEARCH_INTAKE_EXAMPLE_OUTPUT,
} from './offer-examples.ts'

function evidenceSchema(): JsonSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: 32,
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        evidenceId: { type: 'string', pattern: EVIDENCE_ID_PATTERN, description: 'Caller label for this span.' },
        sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN, description: 'Document the span was taken from.' },
        evidenceHash: { type: 'string', pattern: SHA256_PATTERN, description: 'Hash of the normalised span. The span text itself is not retained.' },
        status: { type: 'string', enum: ['retained', 'omitted'], description: 'Whether the exact span survived selection. Not a truth judgement.' },
      },
      required: ['evidenceId', 'sourceId', 'evidenceHash', 'status'],
    },
  }
}

export const DEEP_CONTEXT_EVALUATION_DISCOVERY: OfferDiscoveryContract = {
  input: DEEP_CONTEXT_EXAMPLE_INPUT,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...compilationInputProperties(),
      requiredEvidence: {
        type: 'array',
        minItems: 1,
        maxItems: 32,
        description: 'Spans you require the compiled pack to retain. Each must be an exact substring of its declared source document.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            evidenceId: { type: 'string', pattern: EVIDENCE_ID_PATTERN, description: 'Your label for this span; unique within the request.' },
            sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN, description: 'ID of the document this span comes from.' },
            text: { type: 'string', minLength: 3, maxLength: 4000, description: 'Exact span text. Transient; only its hash is returned.' },
          },
          required: ['evidenceId', 'sourceId', 'text'],
        },
      },
    },
    required: ['clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence'],
  },
  output: DEEP_CONTEXT_EXAMPLE_OUTPUT,
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1.0' },
      offerId: { type: 'string', const: 'deep-context-evaluation' },
      evaluationId: { type: 'string', pattern: '^ctxeval_[a-f0-9]{32}$' },
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
      contextPack: contextPackSchema(),
      evidence: evidenceSchema(),
      metrics: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...(compilationMetricsSchema().properties as Record<string, JsonSchema>),
          requiredEvidenceCount: { type: 'integer', minimum: 1, maximum: 32, description: 'Spans you asked to be retained.' },
          retainedEvidenceCount: { type: 'integer', minimum: 0, maximum: 32, description: 'Spans present verbatim in the compiled pack.' },
          requiredEvidenceRetentionPercent: { type: 'number', minimum: 0, maximum: 100, description: 'Exact span retention rate. Not factual accuracy, answer quality, verification, or hallucination prevention.' },
        },
        required: [
          ...(compilationMetricsSchema().required as string[]),
          'requiredEvidenceCount', 'retainedEvidenceCount', 'requiredEvidenceRetentionPercent',
        ],
      },
      inputHash: { type: 'string', pattern: SHA256_PATTERN },
      outputHash: { type: 'string', pattern: SHA256_PATTERN },
      warnings: { type: 'array', items: { type: 'string' }, description: 'Human-readable limitations.' },
      warningCodes: {
        type: 'array',
        items: { type: 'string', enum: ['model_neutral_token_estimates', 'extractive_selection_not_verification', 'no_passage_fit_budget', 'exact_span_retention_not_accuracy'] },
        description: 'Machine-readable limitations.',
      },
      retentionBoundaries: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...(retentionBoundariesSchema().properties as Record<string, JsonSchema>),
          evidenceRetentionMeasurement: { type: 'string', const: 'exact_span_match' },
          factualAccuracyAssessed: { type: 'boolean', const: false },
          answerQualityAssessed: { type: 'boolean', const: false },
        },
        required: [
          ...(retentionBoundariesSchema().required as string[]),
          'evidenceRetentionMeasurement', 'factualAccuracyAssessed', 'answerQualityAssessed',
        ],
      },
      sourceTextStored: { type: 'boolean', const: false },
      compiledContextStored: { type: 'boolean', const: false },
      requiredEvidenceTextStored: { type: 'boolean', const: false },
    },
    required: ['version', 'offerId', 'evaluationId', 'clientRequestId', 'contextPack', 'evidence', 'metrics', 'inputHash', 'outputHash', 'warnings', 'warningCodes', 'retentionBoundaries', 'sourceTextStored', 'compiledContextStored', 'requiredEvidenceTextStored'],
  },
}

// ---------------------------------------------------------------------------
// Offer 3 -- Autonomous MPS Audit
// ---------------------------------------------------------------------------

export const MPS_AUTONOMOUS_AUDIT_DISCOVERY: OfferDiscoveryContract = {
  // The preimage, published because it was not.
  //
  // A payer must send x-maha-input-hash, the admission claim is taken against
  // it *before* the body is read, and the route then refuses a body that does
  // not reproduce it -- after settlement. So a payer who hashed the wrong
  // thing paid in full and received nothing, and could not have known what to
  // hash: the preimage lived only in server code. That is what happened on
  // 2026-08-12. A required header whose computation is unpublished is not a
  // contract.
  // The preimage, published because it was not.
  //
  // A payer must send x-maha-input-hash, the admission claim is taken against
  // it *before* the body is read, and the route then refuses a body that does
  // not reproduce it -- after settlement. So a payer who hashed the wrong thing
  // paid in full and received nothing, and could not have known what to hash:
  // the preimage lived only in server code. That is what happened on
  // 2026-08-12. A required header whose computation is unpublished is not a
  // contract.
  //
  // A sibling of inputSchema rather than a key inside it: inputSchema is a JSON
  // Schema, and an unrecognised keyword there does not document a header, it
  // breaks validation of the very example it sits beside.
  requiredHeaders: {
    'x-maha-input-hash': {
      preimage: 'the text field alone, UTF-8, exactly as sent',
      algorithm: 'sha256',
      format: 'sha256:<64 lowercase hex>',
      notes: 'Not the request body, not the JSON envelope, not text plus clientRequestId. Hash the passage string and nothing else.',
    },
  },
  input: MPS_AUDIT_EXAMPLE_INPUT,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller trace ID. Replaying it returns the same audit rather than charging again.' },
      text: { type: 'string', minLength: 1, maxLength: 6000, description: 'Nonfiction passage to triage. Transient; only its hash is retained. The x-maha-input-hash header is sha256 of THIS FIELD ALONE, not of the request body: "sha256:" + hex(sha256(utf8(text))).' },
    },
    required: ['clientRequestId', 'text'],

  },
  output: MPS_AUDIT_EXAMPLE_OUTPUT,
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1' },
      offerId: { type: 'string', const: 'mps-autonomous-audit' },
      auditId: { type: 'string', pattern: '^audit_[a-f0-9]{32}$' },
      /**
       * The retrieval credential, returned once. A paid job must be
       * recoverable after a timeout, and a guessable ID is not a
       * capability -- see app/api/v1/mps/audit/route.ts.
       */
      retrievalToken: { type: 'string', pattern: '^mpsrt_[A-Za-z0-9_-]{43}$', description: 'High-entropy credential for GET retrieval of this result. Returned once; store it.' },
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
      inputHash: { type: 'string', pattern: SHA256_PATTERN },
      status: { type: 'string', enum: ['completed', 'processing', 'failed'] },
      idempotentReplay: { type: 'boolean', description: 'True when this response replays an audit already paid for.' },
      audit: {
        type: 'object',
        additionalProperties: false,
        properties: {
          version: { type: 'string', const: '0.1' },
          claims: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                excerpt: { type: 'string', minLength: 1, description: 'Verbatim span from the submitted passage.' },
                tag: { type: 'string', enum: ['VERIFIED', 'SOURCED', 'BOUNDARY', 'ILLUSTRATIVE', 'UNVERIFIED'], description: 'Model-assigned provenance status. Triage, not certification.' },
                rationale: { type: 'string', minLength: 1, maxLength: 1000 },
                action: { type: 'string', enum: ['none', 'verify', 'cite', 'reword', 'remove'] },
              },
              required: ['excerpt', 'tag', 'rationale', 'action'],
            },
          },
          counts: {
            type: 'object',
            additionalProperties: { type: 'integer', minimum: 0 },
            description: 'Claim count per provenance status.',
          },
        },
        required: ['version', 'claims', 'counts'],
      },
      warnings: { type: 'array', items: { type: 'string' }, description: 'Human-readable limitations.' },
      warningCodes: {
        type: 'array',
        items: { type: 'string', enum: ['automated_triage_not_certification', 'not_legal_advice', 'not_human_verification', 'model_assigned_status'] },
        description: 'Machine-readable limitations.',
      },
      retentionBoundaries: {
        type: 'object',
        additionalProperties: false,
        properties: {
          // The complete passage is never stored; short verbatim claim
          // excerpts are, because an audit that cannot quote the claim it
          // tagged is unusable. Both facts are published, because publishing
          // only the flattering one is what made the earlier claim false.
          fullPassageStored: { type: 'boolean', const: false },
          verbatimExcerptsRetained: { type: 'boolean', const: true },
          claimVerificationPerformed: { type: 'boolean', const: false },
          legalAdviceProvided: { type: 'boolean', const: false },
          humanReviewPerformed: { type: 'boolean', const: false },
        },
        required: ['fullPassageStored', 'verbatimExcerptsRetained', 'claimVerificationPerformed', 'legalAdviceProvided', 'humanReviewPerformed'],
      },
      fullPassageStored: { type: 'boolean', const: false },
      verbatimExcerptsRetained: { type: 'boolean', const: true },
      retentionNote: { type: 'string' },
    },
    required: ['version', 'offerId', 'auditId', 'retrievalToken', 'clientRequestId', 'inputHash', 'status', 'idempotentReplay', 'warnings', 'warningCodes', 'retentionBoundaries', 'fullPassageStored', 'verbatimExcerptsRetained'],
  },
}

// ---------------------------------------------------------------------------
// Offer 4 -- Research Intake Evidence Pack
// ---------------------------------------------------------------------------

const mpsClaimSchema = (): JsonSchema => ({
  type: 'object', additionalProperties: false,
  properties: {
    excerpt: { type: 'string', minLength: 1 },
    tag: { type: 'string', enum: ['VERIFIED', 'SOURCED', 'BOUNDARY', 'ILLUSTRATIVE', 'UNVERIFIED'] },
    rationale: { type: 'string', minLength: 1, maxLength: 1000 },
    action: { type: 'string', enum: ['none', 'verify', 'cite', 'reword', 'remove'] },
  },
  required: ['excerpt', 'tag', 'rationale', 'action'],
})

export const RESEARCH_INTAKE_EVIDENCE_PACK_DISCOVERY: OfferDiscoveryContract = {
  requiredHeaders: {
    'x-maha-input-hash': {
      preimage: 'Maha canonical JSON v1 of {question, sections, intendedAudience?, intendedDecision?, deadline?}; keys sorted, strings NFC-normalized, undefined fields omitted',
      algorithm: 'sha256',
      format: 'sha256:<64 lowercase hex>',
      notes: 'clientRequestId is excluded. Parse and normalize the request using the published input schema before hashing.',
    },
  },
  input: RESEARCH_INTAKE_EXAMPLE_INPUT,
  inputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
      question: { type: 'string', minLength: 8, maxLength: 1000 },
      sections: {
        type: 'array', minItems: 1, maxItems: 10,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN },
            sectionId: { type: 'string', pattern: SOURCE_ID_PATTERN },
            title: { type: 'string', minLength: 1, maxLength: 200 },
            text: { type: 'string', minLength: 1, maxLength: 6000 },
          },
          required: ['sourceId', 'sectionId', 'text'],
        },
      },
      intendedAudience: { type: 'string', minLength: 1, maxLength: 240 },
      intendedDecision: { type: 'string', minLength: 1, maxLength: 500 },
      deadline: { type: 'string', minLength: 1, maxLength: 80 },
    },
    required: ['clientRequestId', 'question', 'sections'],
  },
  output: RESEARCH_INTAKE_EXAMPLE_OUTPUT,
  outputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      packId: { type: 'string', pattern: '^intake_[a-f0-9]{32}$' },
      retrievalToken: { type: 'string', pattern: '^rirt_[A-Za-z0-9_-]{43}$' },
      clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
      inputHash: { type: 'string', pattern: SHA256_PATTERN },
      status: { type: 'string', enum: ['completed', 'processing', 'failed'] },
      idempotentReplay: { type: 'boolean' },
      retrievalPath: { type: 'string', pattern: '^/api/v1/research/intake/intake_[a-f0-9]{32}$' },
      progress: {
        type: 'object', additionalProperties: false,
        properties: {
          sectionCount: { type: 'integer', minimum: 1, maximum: 10 },
          sectionsCompleted: { type: 'integer', minimum: 0, maximum: 10 },
          sectionsFailed: { type: 'integer', minimum: 0, maximum: 10 },
          totalModelCalls: { type: 'integer', minimum: 0, maximum: 30 },
        },
        required: ['sectionCount', 'sectionsCompleted', 'sectionsFailed', 'totalModelCalls'],
      },
      pack: {
        type: 'object', additionalProperties: false,
        properties: {
          version: { type: 'string', const: '0.1' },
          offerId: { type: 'string', const: 'research-intake-evidence-pack' },
          clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
          inputHash: { type: 'string', pattern: SHA256_PATTERN },
          economicBasis: {
            type: 'object', additionalProperties: false,
            properties: {
              priceBaseUnits: { type: 'string', const: '1000000' }, asset: { type: 'string', const: 'USDC' },
              decimals: { type: 'integer', const: 6 }, includedSectionAuditCapacity: { type: 'integer', const: 10 },
              sectionAuditReferencePriceBaseUnits: { type: 'string', const: '100000' },
              auditsPerformed: { type: 'integer', minimum: 1, maximum: 10 }, unusedCapacity: { type: 'integer', minimum: 0, maximum: 9 },
            },
            required: ['priceBaseUnits', 'asset', 'decimals', 'includedSectionAuditCapacity', 'sectionAuditReferencePriceBaseUnits', 'auditsPerformed', 'unusedCapacity'],
          },
          question: { type: 'string' },
          intakeContext: {
            type: 'object', additionalProperties: false,
            properties: { intendedAudience: { type: ['string', 'null'] }, intendedDecision: { type: ['string', 'null'] }, deadline: { type: ['string', 'null'] } },
            required: ['intendedAudience', 'intendedDecision', 'deadline'],
          },
          orderedSourceSectionManifest: {
            type: 'array', minItems: 1, maxItems: 10,
            items: { type: 'object', additionalProperties: false, properties: { order: { type: 'integer', minimum: 1, maximum: 10 }, sourceId: { type: 'string' }, sectionId: { type: 'string' }, title: { type: 'string' }, sourceSectionHash: { type: 'string', pattern: SHA256_PATTERN }, characterCount: { type: 'integer', minimum: 1, maximum: 6000 } }, required: ['order', 'sourceId', 'sectionId', 'sourceSectionHash', 'characterCount'] },
          },
          manifestDigest: { type: 'string', pattern: SHA256_PATTERN },
          sectionAudits: {
            type: 'array', minItems: 1, maxItems: 10,
            items: { type: 'object', additionalProperties: false, properties: { sourceId: { type: 'string' }, sectionId: { type: 'string' }, order: { type: 'integer' }, inputHash: { type: 'string', pattern: SHA256_PATTERN }, claims: { type: 'array', items: mpsClaimSchema() } }, required: ['sourceId', 'sectionId', 'order', 'inputHash', 'claims'] },
          },
          consolidatedClaimInventory: {
            type: 'array', items: { type: 'object', additionalProperties: false, properties: { claimId: { type: 'string', pattern: '^claim_[a-f0-9]{16}$' }, sourceId: { type: 'string' }, sectionId: { type: 'string' }, sectionOrder: { type: 'integer' }, ...(mpsClaimSchema().properties as Record<string, JsonSchema>) }, required: ['claimId', 'sourceId', 'sectionId', 'sectionOrder', 'excerpt', 'tag', 'rationale', 'action'] },
          },
          citationGaps: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { claimId: { type: 'string' }, sourceId: { type: 'string' }, sectionId: { type: 'string' }, tag: { type: 'string' }, action: { type: 'string' } }, required: ['claimId', 'sourceId', 'sectionId', 'tag', 'action'] } },
          potentialConflicts: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { conflictId: { type: 'string' }, claimIds: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string' } }, reason: { type: 'string' } }, required: ['conflictId', 'claimIds', 'reason'] } },
          boundaries: { type: 'array', minItems: 4, items: { type: 'string' } },
          unresolvedQuestions: { type: 'array', items: { type: 'string' } },
          proposedHumanResearchScope: { type: 'object', additionalProperties: false, properties: { objective: { type: 'string' }, analystTasks: { type: 'array', items: { type: 'string' } }, suppliedSectionCount: { type: 'integer' }, claimCount: { type: 'integer' }, excluded: { type: 'array', items: { type: 'string' } } }, required: ['objective', 'analystTasks', 'suppliedSectionCount', 'claimCount', 'excluded'] },
          retentionBoundaries: { type: 'object', additionalProperties: false, properties: { fullSourceSectionsStored: { type: 'boolean', const: false }, verbatimClaimExcerptsRetained: { type: 'boolean', const: true }, suppliedMetadataRetained: { type: 'boolean', const: true } }, required: ['fullSourceSectionsStored', 'verbatimClaimExcerptsRetained', 'suppliedMetadataRetained'] },
          receiptDigest: { type: 'string', pattern: SHA256_PATTERN },
        },
        required: ['version', 'offerId', 'clientRequestId', 'inputHash', 'economicBasis', 'question', 'intakeContext', 'orderedSourceSectionManifest', 'manifestDigest', 'sectionAudits', 'consolidatedClaimInventory', 'citationGaps', 'potentialConflicts', 'boundaries', 'unresolvedQuestions', 'proposedHumanResearchScope', 'retentionBoundaries', 'receiptDigest'],
      },
    },
    required: ['packId', 'retrievalToken', 'clientRequestId', 'inputHash', 'status', 'idempotentReplay', 'retrievalPath', 'progress', 'pack'],
  },
}
