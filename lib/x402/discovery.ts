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

export function resourceInfoFor(resource: PricedResource, resourceUrl: string): ResourceInfo {
  const isContextCompiler = resource.pathPrefix === '/api/v1/compress'
  return {
    url: resourceUrl,
    description: resource.description,
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

  const declared = declareDiscoveryExtension({
    bodyType: 'json',
    input: {
      clientRequestId: 'req_agent_context_001',
      task: 'Extract the evidence most relevant to the deployment decision.',
      tokenBudget: 1024,
      documents: [{
        id: 'deployment-notes',
        title: 'Deployment notes',
        text: 'The production canary passed. The rollback rehearsal remains pending.',
      }],
      provenance: 'compact',
      scoring: 'bm25',
      budgetMode: 'guaranteed',
    },
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        clientRequestId: { type: 'string', minLength: 8, maxLength: 120, description: 'Caller-supplied idempotency and trace identifier.' },
        task: { type: 'string', minLength: 8, maxLength: 1200, description: 'The question or task the returned context should support.' },
        tokenBudget: { type: 'integer', minimum: 64, maximum: 16000, description: 'Maximum model-neutral token estimate for the compiled context pack.' },
        documents: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          description: 'Source documents to rank, deduplicate, and compress.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', minLength: 1, maxLength: 80 },
              title: { type: 'string', minLength: 1, maxLength: 160 },
              text: { type: 'string', minLength: 1 },
            },
            required: ['id', 'text'],
          },
        },
        provenance: { type: 'string', enum: ['full', 'compact', 'none'], default: 'full' },
        scoring: { type: 'string', enum: ['bm25', 'keyword'], default: 'bm25' },
        budgetMode: { type: 'string', enum: ['guaranteed', 'estimated'], default: 'guaranteed' },
      },
      required: ['clientRequestId', 'task', 'tokenBudget', 'documents'],
    },
    output: {
      example: {
        version: '0.1.0',
        packId: 'ctxpack_example',
        clientRequestId: 'req_agent_context_001',
        context: '# Context Pack\n\n[deployment-notes:1] The production canary passed.',
        metrics: { originalEstimatedTokens: 12, compiledEstimatedTokens: 8, sourceCoveragePercent: 100 },
        sources: [{ sourceId: 'deployment-notes', includedPassageIds: ['deployment-notes:1'] }],
        warnings: ['Token counts are model-neutral estimates.'],
        inputHash: 'sha256:…',
        outputHash: 'sha256:…',
        sourceTextStored: false,
        compiledContextStored: false,
      },
      schema: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          packId: { type: 'string' },
          clientRequestId: { type: 'string' },
          task: { type: 'string' },
          tokenBudget: { type: 'integer' },
          context: { type: 'string' },
          metrics: { type: 'object' },
          includedPassages: { type: 'array', items: { type: 'object' } },
          sources: { type: 'array', items: { type: 'object' } },
          warnings: { type: 'array', items: { type: 'string' } },
          inputHash: { type: 'string' },
          outputHash: { type: 'string' },
          sourceTextStored: { type: 'boolean', const: false },
          compiledContextStored: { type: 'boolean', const: false },
        },
        required: ['version', 'packId', 'context', 'metrics', 'sources', 'warnings', 'inputHash', 'outputHash'],
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

  return { bazaar: enriched }
}
