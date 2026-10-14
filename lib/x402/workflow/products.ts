import { buildGrowthBatch1, GROWTH_BATCH1_IDS, type GrowthBatch1Id } from '../growth-batch1.ts'
import { demandDigest } from '../demand6/digest.ts'
import { buildResearchResult, type ResearchDependencies } from './research.ts'
import type { ResearchId } from './research-contracts.ts'
import { parseWorkflowInput, WORKFLOW_VERSION, WORKFLOW_RESULTS, workflowResultSchema, WORKFLOW_MAX_RESULT_BYTES, type WorkflowId } from './contracts.ts'
export async function buildWorkflowProduct(id: WorkflowId, supplied: unknown, dependencies: ResearchDependencies = {}) {
  const input = parseWorkflowInput(id, supplied), inputHash = demandDigest(input)
  const raw = GROWTH_BATCH1_IDS.includes(id as GrowthBatch1Id) ? buildGrowthBatch1(id as GrowthBatch1Id, input).result
    : await buildResearchResult(id as ResearchId, input, dependencies)
  const result = WORKFLOW_RESULTS[id].parse(raw), resultHash = demandDigest(result)
  const output = workflowResultSchema(id).parse({ version: WORKFLOW_VERSION, productId: id, inputHash, resultHash,
    receiptDigest: demandDigest({ version: WORKFLOW_VERSION, productId: id, inputHash, resultHash }), result,
    limitations: ['Schema and integrity checks do not certify scientific truth, completeness or engineering/medical/legal suitability.',
      'Public or synthetic records only. No private-data detection, model calls, automatic repair or external file execution.',
      'Source-backed results retain metadata only. Abstracts, raw source bodies, personal contacts and full text are excluded.'] })
  if (Buffer.byteLength(JSON.stringify(output)) > WORKFLOW_MAX_RESULT_BYTES) throw new Error('workflow_result_too_large')
  return output
}
