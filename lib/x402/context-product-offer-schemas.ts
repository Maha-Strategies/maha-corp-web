import {
  buildContextBudgetLadder,
  buildEvidenceRetentionMatrix,
  buildGovernedContextVerificationPack,
} from './context-product-family.ts'
import {
  compilationInputProperties,
  compilationMetricsSchema,
  contextPackSchema,
  evidenceSchema,
  type JsonSchema,
  type OfferDiscoveryContract,
} from './offer-schemas.ts'

const SHA = '^sha256:[a-f0-9]{64}$'
const budgetsSchema = { type: 'array', minItems: 5, maxItems: 5, items: { type: 'integer', minimum: 64, maximum: 16000 } }
const requiredEvidenceInputSchema = {
  type: 'array', minItems: 1, maxItems: 32,
  items: {
    type: 'object', additionalProperties: false,
    properties: { evidenceId: { type: 'string' }, sourceId: { type: 'string' }, text: { type: 'string', minLength: 3, maxLength: 4000 } },
    required: ['evidenceId', 'sourceId', 'text'],
  },
}

const documents = [
  { id: 'release', title: 'Release rule', text: 'The release may proceed only after the security owner approves the evidence packet.\n\nThe rollback begins when the error rate exceeds two percent for five minutes.\n\nRoutine status notes describe staffing and meeting schedules.' },
  { id: 'operations', title: 'Operations note', text: 'The operator must preserve the request digest and approval identity.\n\nRoutine status notes describe staffing and meeting schedules.' },
]

export const CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT = {
  clientRequestId: 'req_budget_ladder_001',
  task: 'Preserve the release authority and rollback condition.',
  tokenBudgets: [64, 96, 128, 192, 256],
  documents,
  provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
}

export const EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT = {
  ...CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT,
  clientRequestId: 'req_evidence_matrix_001',
  requiredEvidence: [
    { evidenceId: 'release-authority', sourceId: 'release', text: 'The release may proceed only after the security owner approves the evidence packet.' },
    { evidenceId: 'rollback', sourceId: 'release', text: 'The rollback begins when the error rate exceeds two percent for five minutes.' },
  ],
}

export const GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT = {
  clientRequestId: 'req_governed_context_001',
  task: CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT.task,
  tokenBudget: 128,
  documents,
  requiredEvidence: EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT.requiredEvidence,
  provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
}

const economicBasisSchema = (componentOfferId: string, componentPrice: string, price: string): JsonSchema => ({
  type: 'object', additionalProperties: false,
  properties: {
    componentOfferId: { type: 'string', const: componentOfferId }, componentRuns: { type: 'integer', const: 5 },
    componentPriceBaseUnits: { type: 'string', const: componentPrice }, priceBaseUnits: { type: 'string', const: price },
  },
  required: ['componentOfferId', 'componentRuns', 'componentPriceBaseUnits', 'priceBaseUnits'],
})

const evaluationMetricsSchema = (): JsonSchema => {
  const compilation = compilationMetricsSchema()
  const compilationProperties = compilation.properties as Record<string, JsonSchema>
  const compilationRequired = compilation.required as string[]
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...compilationProperties,
      requiredEvidenceCount: { type: 'integer', minimum: 1, maximum: 32 },
      retainedEvidenceCount: { type: 'integer', minimum: 0, maximum: 32 },
      requiredEvidenceRetentionPercent: { type: 'number', minimum: 0, maximum: 100 },
    },
    required: [
      ...compilationRequired,
      'requiredEvidenceCount',
      'retainedEvidenceCount',
      'requiredEvidenceRetentionPercent',
    ],
  }
}

const commonInput = () => {
  const properties = compilationInputProperties()
  delete properties.tokenBudget
  return { ...properties, tokenBudgets: budgetsSchema }
}

export const CONTEXT_BUDGET_LADDER_DISCOVERY: OfferDiscoveryContract = {
  input: CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT,
  inputSchema: { type: 'object', additionalProperties: false, properties: commonInput(), required: ['clientRequestId', 'task', 'tokenBudgets', 'documents'] },
  output: buildContextBudgetLadder(CONTEXT_BUDGET_LADDER_EXAMPLE_INPUT),
  outputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1' }, offerId: { type: 'string', const: 'context-budget-ladder' },
      clientRequestId: { type: 'string' }, inputDigest: { type: 'string', pattern: SHA },
      economicBasis: economicBasisSchema('context-compression', '1000', '5000'),
      runs: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', additionalProperties: false, properties: { tokenBudget: { type: 'integer' }, contextPack: contextPackSchema() }, required: ['tokenBudget', 'contextPack'] } },
      comparison: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', additionalProperties: false, properties: { tokenBudget: { type: 'integer' }, compiledEstimatedTokens: { type: 'integer' }, tokensSaved: { type: 'integer' }, sourceCoveragePercent: { type: 'number' }, includedPassageIds: { type: 'array', items: { type: 'string' } }, outputHash: { type: 'string', pattern: SHA } }, required: ['tokenBudget', 'compiledEstimatedTokens', 'tokensSaved', 'sourceCoveragePercent', 'includedPassageIds', 'outputHash'] } },
      boundaries: { type: 'array', items: { type: 'string' } }, sourceTextStored: { type: 'boolean', const: false }, compiledContextStored: { type: 'boolean', const: false }, receiptDigest: { type: 'string', pattern: SHA },
    },
    required: ['version', 'offerId', 'clientRequestId', 'inputDigest', 'economicBasis', 'runs', 'comparison', 'boundaries', 'sourceTextStored', 'compiledContextStored', 'receiptDigest'],
  },
}

export const EVIDENCE_RETENTION_MATRIX_DISCOVERY: OfferDiscoveryContract = {
  input: EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT,
  inputSchema: { type: 'object', additionalProperties: false, properties: { ...commonInput(), requiredEvidence: requiredEvidenceInputSchema }, required: ['clientRequestId', 'task', 'tokenBudgets', 'documents', 'requiredEvidence'] },
  output: buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT),
  outputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1' }, offerId: { type: 'string', const: 'evidence-retention-matrix' }, clientRequestId: { type: 'string' }, inputDigest: { type: 'string', pattern: SHA },
      economicBasis: economicBasisSchema('deep-context-evaluation', '10000', '50000'),
      runs: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', additionalProperties: false, properties: { tokenBudget: { type: 'integer' }, evaluationId: { type: 'string' }, contextPack: contextPackSchema(), evidence: evidenceSchema(), metrics: evaluationMetricsSchema(), outputHash: { type: 'string', pattern: SHA }, runDigest: { type: 'string', pattern: SHA } }, required: ['tokenBudget', 'evaluationId', 'contextPack', 'evidence', 'metrics', 'outputHash', 'runDigest'] } },
      evidenceFrontier: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { evidenceId: { type: 'string' }, sourceId: { type: 'string' }, evidenceHash: { type: 'string', pattern: SHA }, retainedAtBudgets: { type: 'array', items: { type: 'integer' } }, firstRetainedBudget: { type: ['integer', 'null'] }, retainedInEveryRun: { type: 'boolean' } }, required: ['evidenceId', 'sourceId', 'evidenceHash', 'retainedAtBudgets', 'firstRetainedBudget', 'retainedInEveryRun'] } },
      boundaries: { type: 'array', items: { type: 'string' } }, sourceTextStored: { type: 'boolean', const: false }, compiledContextStored: { type: 'boolean', const: false }, requiredEvidenceTextStored: { type: 'boolean', const: false }, receiptDigest: { type: 'string', pattern: SHA },
    },
    required: ['version', 'offerId', 'clientRequestId', 'inputDigest', 'economicBasis', 'runs', 'evidenceFrontier', 'boundaries', 'sourceTextStored', 'compiledContextStored', 'requiredEvidenceTextStored', 'receiptDigest'],
  },
}

export const GOVERNED_CONTEXT_VERIFICATION_DISCOVERY: OfferDiscoveryContract = {
  input: GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT,
  inputSchema: { type: 'object', additionalProperties: false, properties: { ...compilationInputProperties(), requiredEvidence: requiredEvidenceInputSchema }, required: ['clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence'] },
  output: buildGovernedContextVerificationPack(GOVERNED_CONTEXT_VERIFICATION_EXAMPLE_INPUT),
  outputSchema: {
    type: 'object', additionalProperties: false,
    properties: {
      version: { type: 'string', const: '0.1' }, offerId: { type: 'string', const: 'governed-context-verification-pack' }, clientRequestId: { type: 'string' },
      deliverable: {
        type: 'object', additionalProperties: false,
        properties: {
          evaluationId: { type: 'string' }, contextPack: contextPackSchema(), evidence: evidenceSchema(), metrics: evaluationMetricsSchema(),
          policy: {
            type: 'object', additionalProperties: false,
            properties: {
              policyVersion: { type: 'string', const: 'governed-context-verification-policy/0.1' }, decision: { type: 'string', const: 'accepted' },
              limits: { type: 'object', additionalProperties: false, properties: { maxDocuments: { type: 'integer', const: 8 }, maxRequiredEvidence: { type: 'integer', const: 32 }, maxTokenBudget: { type: 'integer', const: 16000 } }, required: ['maxDocuments', 'maxRequiredEvidence', 'maxTokenBudget'] },
              observed: { type: 'object', additionalProperties: false, properties: { documentCount: { type: 'integer', minimum: 1, maximum: 8 }, requiredEvidenceCount: { type: 'integer', minimum: 1, maximum: 32 }, requestedTokenBudget: { type: 'integer', minimum: 64, maximum: 16000 }, compiledEstimatedTokens: { type: 'integer', minimum: 0 } }, required: ['documentCount', 'requiredEvidenceCount', 'requestedTokenBudget', 'compiledEstimatedTokens'] },
              budgetSatisfied: { type: 'boolean' },
            }, required: ['policyVersion', 'decision', 'limits', 'observed', 'budgetSatisfied'],
          },
          integrity: { type: 'object', additionalProperties: false, properties: { requestHash: { type: 'string', pattern: SHA }, contextInputHash: { type: 'string', pattern: SHA }, contextOutputHash: { type: 'string', pattern: SHA }, evaluationOutputHash: { type: 'string', pattern: SHA } }, required: ['requestHash', 'contextInputHash', 'contextOutputHash', 'evaluationOutputHash'] },
        }, required: ['evaluationId', 'contextPack', 'evidence', 'metrics', 'policy', 'integrity'],
      },
      limitations: { type: 'array', items: { type: 'string' } }, sourceTextStored: { type: 'boolean', const: false }, compiledContextStored: { type: 'boolean', const: false }, requiredEvidenceTextStored: { type: 'boolean', const: false }, receiptDigest: { type: 'string', pattern: SHA },
    },
    required: ['version', 'offerId', 'clientRequestId', 'deliverable', 'limitations', 'sourceTextStored', 'compiledContextStored', 'requiredEvidenceTextStored', 'receiptDigest'],
  },
}
