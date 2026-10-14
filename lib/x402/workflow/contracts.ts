import { z } from 'zod'
import { WORKFLOW_DEFINITIONS } from './catalogue.ts'
import { GROWTH_BATCH1_INPUTS, type GrowthBatch1Id } from '../growth-batch1.ts'
import { GROWTH_BATCH1_RESULTS } from '../growth-batch1-results.ts'
import { RESEARCH_INPUTS, RESEARCH_RESULTS, type ResearchId, normalizeDoi } from './research-contracts.ts'
import { WORKFLOW_ROUTES } from './paths.ts'
import { modularRecoveryContract } from '../input-bound-payment.ts'
export const WORKFLOW_VERSION = 'maha-workflow/1.0.0'
export const WORKFLOW_RETAIN_SECONDS = 86400
export const WORKFLOW_MAX_INPUT_BYTES = 262144
export const WORKFLOW_MAX_RESULT_BYTES = 65536
export type WorkflowId = GrowthBatch1Id | ResearchId
export const WORKFLOW_INPUTS = { ...GROWTH_BATCH1_INPUTS, ...RESEARCH_INPUTS } as const
export const WORKFLOW_RESULTS = { ...GROWTH_BATCH1_RESULTS, ...RESEARCH_RESULTS } as const
export const WORKFLOW_IDS = Object.keys(WORKFLOW_INPUTS) as WorkflowId[]
export const workflowPath = (id: WorkflowId) => '/api/v1/' + WORKFLOW_ROUTES[id].join('/')
export const WORKFLOW_PRODUCTS = Object.fromEntries(WORKFLOW_IDS.map(id => {
  const p = WORKFLOW_DEFINITIONS[id]
  return [id, { amount: p.amount, title: p.title, description: p.description, maxRequestBytes: WORKFLOW_MAX_INPUT_BYTES,
    status: 'withheld' as const, productionPayable: false, retainSeconds: WORKFLOW_RETAIN_SECONDS }]
})) as Record<WorkflowId, { amount: string; title: string; description: string; maxRequestBytes: number; status: 'withheld'; productionPayable: false; retainSeconds: number }>
export function parseWorkflowInput(id: WorkflowId, value: unknown) {
  const input = WORKFLOW_INPUTS[id].parse(value)
  if ('dois' in input && new Set(input.dois.map(normalizeDoi)).size !== input.dois.length) throw new Error('duplicate_normalized_doi')
  return input
}
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export function workflowResultSchema(id: WorkflowId) {
  return z.object({ version: z.literal(WORKFLOW_VERSION), productId: z.literal(id), inputHash: hash, resultHash: hash,
    receiptDigest: hash, result: WORKFLOW_RESULTS[id], limitations: z.array(z.string().min(1).max(400)).min(1).max(8) }).strict()
}
export function workflowDiscovery(id: WorkflowId) {
  return { ...WORKFLOW_PRODUCTS[id], path: workflowPath(id), inputSchema: workflowInputJsonSchema(id),
    outputSchema: z.toJSONSchema(workflowResultSchema(id)), paymentEnabled: false,
    recovery: { retentionSeconds: WORKFLOW_RETAIN_SECONDS, modeHeader: 'X-Maha-Recovery-Mode', modeValue: 'retained-result',
      inputHashHeader: 'X-Maha-Input-Hash', privateSecretHeader: 'X-Maha-Recovery-Secret', authorizationBinding: modularRecoveryContract(id),
      automaticRepayment: false, capsulePrivate: true },
    retention: 'Prepared results and hashes only, at most 24 hours. No raw source bodies, supplied table cells, signatures or recovery secrets are stored. Result metadata and short titles may be retained. Hashes are not anonymization.' }
}
/** JSON Schema cannot express all identity/case-folding rules; list those
 * explicitly, and use the same strict Zod+semantic parser in the buyer. */
export function workflowInputJsonSchema(id: WorkflowId): Record<string, unknown> {
  type MutableSchema = Record<string, unknown> & { type?: string; properties?: Record<string, MutableSchema>; items?: MutableSchema }
  const schema = z.toJSONSchema(WORKFLOW_INPUTS[id]) as MutableSchema
  for (const name of ['rows', 'left', 'right', ...(id === 'dataset-export-roundtrip-check' ? ['before', 'after'] : [])]) {
    const item = schema.properties?.[name]?.items
    if (item?.type === 'object') item.maxProperties = 64
  }
  for (const name of ['columns', 'keyFields']) if (schema.properties?.[name]) schema.properties[name].uniqueItems = true
  schema['x-max-request-bytes'] = WORKFLOW_MAX_INPUT_BYTES
  schema['x-semantic-rules'] = id === 'catalogue-price-unit-audit' ? ['Unique quote IDs.', 'Unique (network, case-insensitive asset) metadata keys.']
    : id === 'dataset-schema-evolution-plan' ? ['Unique field names in each before/after declaration.']
    : id === 'research-bibliography-resolution' ? ['Unique DOIs after doi.org-prefix removal and case folding.'] : []
  return schema
}
