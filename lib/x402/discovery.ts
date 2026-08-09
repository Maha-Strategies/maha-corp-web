import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
  validateDiscoveryExtension,
  validateDiscoveryExtensionSpec,
} from '@x402/extensions/bazaar'

import type { PricedResource } from './config.ts'
import type { ResourceInfo } from './protocol.ts'

const SERVICE_NAME = 'Maha Context Compiler'
const ICON_URL = 'https://www.mahastrategies.com/icon.png'
// Written to be verifiable rather than persuasive. A router selects on fit,
// and stating where the tool does not fit is what makes the rest credible --
// an agent that tries this on a SQL dump and gets a larger payload back will
// not come again. Breakeven is given as a formula because it depends on the
// caller's model price and on the reduction their payload shape actually
// achieves, neither of which this service knows.
export const CONTEXT_COMPILER_DESCRIPTION = 'Compress long documents and RAG inputs into token-budgeted, deduplicated context packs with source-linked provenance. '
  + 'Returns measured original and compiled token counts so the caller can verify the saving against its own model price. '
  + 'Cost is net-positive above N = fee / (r x p) input tokens, where r is the reduction achieved on your payload and p your model input price per token: '
  + 'about 630 tokens for retrieval-shaped payloads at $2.50/M, about 2,030 for long agent traces. '
  + 'Selection is extractive and budget-bound, so a pack can omit evidence; check includedPassages before relying on it. '
  + 'Ranking works across Latin, Cyrillic, Greek, Arabic and CJK scripts; CJK is indexed as character bigrams rather than segmented words, so ranking there is coarser. '
  + 'Not suitable for tabular or heavily-structured payloads, where per-passage framing can exceed the reduction.'
const SHA256_PATTERN = '^sha256:[a-f0-9]{64}$'
const SOURCE_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
const PASSAGE_ID_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}:[1-9][0-9]*$'
let cachedContextCompilerDiscovery: Record<string, unknown> | undefined

const DISCOVERY_INPUT = {
  clientRequestId: 'req_rag_release_001',
  task: 'Find the release condition and rollback trigger while removing duplicate operational background.',
  tokenBudget: 128,
  documents: [
    { id: 'release-notes', title: 'Release notes', text: 'Release may proceed after the security owner attaches credential-rotation evidence. The production canary passed in every region.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
    { id: 'rollback-runbook', title: 'Rollback runbook', text: 'Rollback if API errors exceed 2 percent for five minutes or payment failures breach the alert threshold. Restore the last-known-good deployment before reopening traffic.\n\nRoutine notes cover staffing, dashboards, meeting cadence, maintenance calendars, regional handoffs, historical capacity, and documentation formatting.' },
  ],
  provenance: 'compact', scoring: 'bm25', budgetMode: 'guaranteed',
}

const DISCOVERY_OUTPUT = {
  version: '0.1.0',
  packId: 'ctxpack_6a5464df2ce14e9b9e16571c7d814821',
  clientRequestId: 'req_rag_release_001',
  task: DISCOVERY_INPUT.task,
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

export function resourceInfoFor(resource: PricedResource, resourceUrl: string): ResourceInfo {
  const isContextCompiler = resource.pathPrefix === '/api/v1/compress'
  return {
    url: resourceUrl,
    description: isContextCompiler ? CONTEXT_COMPILER_DESCRIPTION : resource.description,
    mimeType: 'application/json',
    ...(isContextCompiler
      ? {
          serviceName: SERVICE_NAME,
          tags: ['ai', 'context-compression', 'llm', 'rag', 'provenance'],
          iconUrl: ICON_URL,
        }
      : {}),
  }
}

/**
 * Bazaar catalog metadata for routes whose public contract is stable enough
 * for an autonomous buyer to call without reading prose documentation.
 *
 * Unknown priced routes intentionally receive no discovery declaration. A
 * vague or incorrect schema is worse than no listing: Bazaar agents can spend
 * money against it without a human noticing the mismatch.
 */
export function discoveryExtensionsFor(resource: PricedResource): Record<string, unknown> | undefined {
  if (resource.pathPrefix !== '/api/v1/compress') return undefined
  // The declaration is immutable deployment metadata. Rebuilding and
  // validating its full input/output schema on every unpaid probe adds work to
  // the exact 402 path catalogs measure. Cache the validated object for the
  // lifetime of the warm instance; a new deployment naturally rebuilds it.
  if (cachedContextCompilerDiscovery) return cachedContextCompilerDiscovery

  const declared = declareDiscoveryExtension({
    bodyType: 'json',
    input: DISCOVERY_INPUT,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller trace ID.' },
        task: { type: 'string', minLength: 8, maxLength: 1200, description: 'Task used to rank passages.' },
        tokenBudget: { type: 'integer', minimum: 64, maximum: 16000, description: 'Model-neutral output budget.' },
        documents: {
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
        },
        provenance: { type: 'string', enum: ['full', 'compact', 'none'], default: 'full', description: 'Inline citation style.' },
        scoring: { type: 'string', enum: ['bm25', 'keyword'], default: 'bm25', description: 'Passage ranker.' },
        budgetMode: { type: 'string', enum: ['guaranteed', 'estimated'], default: 'guaranteed', description: 'Budget enforcement mode.' },
      },
      required: ['clientRequestId', 'task', 'tokenBudget', 'documents'],
    },
    output: {
      example: DISCOVERY_OUTPUT,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          version: { type: 'string', const: '0.1.0' },
          packId: { type: 'string', pattern: '^ctxpack_[a-f0-9]{32}$' },
          clientRequestId: { type: 'string', minLength: 8, maxLength: 120 },
          task: { type: 'string' },
          tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 },
          context: { type: 'string' },
          metrics: {
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
          },
          includedPassages: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                sourceId: { type: 'string', pattern: SOURCE_ID_PATTERN },
                passageId: { type: 'string', pattern: PASSAGE_ID_PATTERN },
                passageHash: { type: 'string', pattern: SHA256_PATTERN },
                text: { type: 'string', minLength: 1 },
              },
              required: ['sourceId', 'passageId', 'passageHash', 'text'],
            },
          },
          sources: {
            type: 'array', minItems: 1, maxItems: 8,
            items: {
              type: 'object', additionalProperties: false,
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
          },
          warnings: { type: 'array', items: { type: 'string' }, description: 'Human-readable limitations.' },
          warningCodes: { type: 'array', items: { type: 'string', enum: ['model_neutral_token_estimates', 'extractive_selection_not_verification', 'no_passage_fit_budget'] }, description: 'Machine-readable limitations.' },
          retentionBoundaries: {
            type: 'object', additionalProperties: false,
            properties: {
              selectionType: { type: 'string', const: 'extractive' },
              evidenceRetention: { type: 'string', const: 'best_effort' },
              claimVerificationPerformed: { type: 'boolean', const: false },
              completenessGuaranteed: { type: 'boolean', const: false },
              hallucinationPreventionGuaranteed: { type: 'boolean', const: false },
              tokenCountType: { type: 'string', const: 'model_neutral_estimate' },
            },
            required: ['selectionType', 'evidenceRetention', 'claimVerificationPerformed', 'completenessGuaranteed', 'hallucinationPreventionGuaranteed', 'tokenCountType'],
          },
          inputHash: { type: 'string', pattern: SHA256_PATTERN },
          outputHash: { type: 'string', pattern: SHA256_PATTERN },
          sourceTextStored: { type: 'boolean', const: false },
          compiledContextStored: { type: 'boolean', const: false },
        },
        required: ['version', 'packId', 'clientRequestId', 'task', 'tokenBudget', 'context', 'metrics', 'includedPassages', 'sources', 'warnings', 'warningCodes', 'retentionBoundaries', 'inputHash', 'outputHash', 'sourceTextStored', 'compiledContextStored'],
      },
    },
  })

  const enriched = bazaarResourceServerExtension.enrichDeclaration?.(declared.bazaar, {
    method: 'POST',
    path: resource.pathPrefix,
    adapter: { getPath: () => resource.pathPrefix },
  }) as Record<string, unknown>

  const validation = validateDiscoveryExtensionSpec(enriched)
  if (!validation.valid) {
    throw new Error(`Invalid Bazaar discovery declaration: ${validation.errors?.join('; ') ?? 'unknown error'}`)
  }
  const dataValidation = validateDiscoveryExtension(enriched as unknown as Parameters<typeof validateDiscoveryExtension>[0])
  if (!dataValidation.valid) {
    throw new Error(`Bazaar discovery example does not satisfy its schema: ${dataValidation.errors?.join('; ') ?? 'unknown error'}`)
  }

  cachedContextCompilerDiscovery = Object.freeze({ bazaar: enriched })
  return cachedContextCompilerDiscovery
}
