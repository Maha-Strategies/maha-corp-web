import { SPECS as evidence, buildEvidenceExpansion } from './expansion-evidence.ts'
import { SPECS as commerce, buildCommerceExpansion } from './expansion-commerce.ts'
import { SPECS as physicalNeural, buildPhysicalNeuralExpansion } from './expansion-physical-neural.ts'
import { SPECS as researchContent, buildResearchContentExpansion } from './expansion-research-content.ts'
import { SPECS as readingPack, buildBookPackExpansion } from './expansion-book-pack.ts'
import { objectSchema, type MicroSchema } from './micro-schema.ts'

export const EXPANSION_IDS = [
  'passage-hash-validation',
  'claim-citation-coverage',
  'citation-locator-conversion',
  'provenance-graph-integrity',
  'retrieval-recovery-regression',
  'paper-cluster-retrieval-comparison',
  'packing-displacement-analysis',
  'evidence-budget-allocation',
  'source-coverage-drift',
  'exact-quote-alignment',
  'extraction-consistency',
  'reproducibility-manifest-builder',
  'tool-argument-validation',
  'workflow-dependency-validation',
  'buyer-spending-policy-check',
  'signed-receipt-verification',
  'x402-challenge-sanity',
  'settlement-delivery-reconciliation',
  'idempotency-trace-audit',
  'machine-license-permission-match',
  'toy-grid-path-dry-run',
  'digital-twin-config-diff',
  'weighted-calibration-fit',
  'sampling-aliasing-check',
  'assembly-critical-path',
  'manufacturing-yield-sensitivity',
  'inspection-station-selection',
  'material-cut-list-consolidation',
  'feature-distribution-drift',
  'intention-threshold-sweep',
  'dwell-release-comparison',
  'synthetic-artifact-test-pack',
  'confidence-calibration-report',
  'fictional-decision-debrief',
  'spatial-adjacency-check',
  'experiment-plan-completeness',
  'partnership-milestone-review',
  'research-opportunity-comparison',
  'evidence-brief-export',
  'public-amendment-lineage',
  'spending-variance-bridge',
  'transparency-hash-chain-verification',
  'public-filing-amendment-resolver',
  'angular-separation-batch',
  'observing-window-planner',
  'terrain-profile-arithmetic',
  'volcano-concept-evidence-pack',
  'edition-locator-alignment',
  'manuscript-release-diff',
  'cross-book-concept-pack',
  'book-reading-pack-the-maha-principle',
] as const
export type ExpansionProductId = typeof EXPANSION_IDS[number]
type ExpansionSpec = { amount: string; title: string; description: string; category: string; inputSchema: MicroSchema; resultSchema: MicroSchema; sample: Record<string, unknown>; paidContent?: boolean }
const allSpecs: Record<string, ExpansionSpec> = { ...evidence, ...commerce, ...physicalNeural, ...researchContent, ...readingPack }
if (Object.keys(allSpecs).length !== EXPANSION_IDS.length || EXPANSION_IDS.some(id => !Object.hasOwn(allSpecs, id))) throw new Error('expansion-spec-id-mismatch')
export const EXPANSION_SPECS = Object.fromEntries(EXPANSION_IDS.map(id => [id, allSpecs[id]])) as Record<ExpansionProductId, ExpansionSpec>
export const isExpansionProduct = (id: string): id is ExpansionProductId => Object.hasOwn(EXPANSION_SPECS, id)
export const EXPANSION_PRODUCTS = Object.fromEntries(EXPANSION_IDS.map(id => {
  const { amount, title, description } = EXPANSION_SPECS[id]
  return [id, { amount, title, description }]
})) as { [K in ExpansionProductId]: { amount: string; title: string; description: string } }
export const EXPANSION_INPUT_SCHEMAS = Object.fromEntries(EXPANSION_IDS.map(id => [id, EXPANSION_SPECS[id].inputSchema])) as Record<ExpansionProductId, MicroSchema>
export const EXPANSION_RESULT_SCHEMAS = Object.fromEntries(EXPANSION_IDS.map(id => [id, EXPANSION_SPECS[id].resultSchema])) as Record<ExpansionProductId, MicroSchema>
export const EXPANSION_SAMPLES = Object.fromEntries(EXPANSION_IDS.map(id => [id, EXPANSION_SPECS[id].sample])) as Record<ExpansionProductId, Record<string, unknown>>
// Five previously withheld computations substitute for the five unindexed
// higher-priced offers. Existing book purchases remain operational unchanged.
export const EXPANSION_UTILITY_IDS = [
  'dimensional-consistency-check', 'exact-interpolation-receipt',
  'sampled-series-integration', 'evidence-conflict-comparator',
  'astrology-experiment-plan-check',
] as const
export const EXPANSION_INDEXING_IDS = [...EXPANSION_IDS, ...EXPANSION_UTILITY_IDS] as const
export const EXPANSION_MAX_SERVICE_BASE_UNITS = '2735500'
export const CONTRACT_ONLY_EXAMPLE = { exampleOnly: true, note: 'Licensed text omitted from free discovery. Inspect the input schema and edition digest; the full bounded result requires payment.' }
export const CONTRACT_ONLY_SCHEMA = objectSchema({ exampleOnly: { type: 'boolean', enum: [true] }, note: { type: 'string', minLength: 1, maxLength: 300 } })
export function expansionPaidContent(id: string): boolean {
  if (!isExpansionProduct(id)) return false
  const spec = EXPANSION_SPECS[id]
  return 'paidContent' in spec && spec.paidContent === true
}
export function buildExpansionProduct(id: ExpansionProductId, input: Record<string, unknown>): Record<string, unknown> {
  for (const build of [buildEvidenceExpansion, buildCommerceExpansion, buildPhysicalNeuralExpansion, buildResearchContentExpansion, buildBookPackExpansion]) {
    const result = build(id, input)
    if (result !== null) return result
  }
  throw new Error('unsupported-expansion-product')
}
