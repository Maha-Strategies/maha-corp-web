import { z } from 'zod'
import { MICRO_INPUT_SCHEMAS, MICRO_PRODUCTS, schemaAccepts, type MicroProductId } from '../x402/micro-contracts.ts'
import { microOutputSchema } from '../x402/micro-output-schemas.ts'
import { parseMicroInput, buildMicroProduct } from '../x402/micro-products.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import type { Domain, HandlerContract } from './types.ts'
import { SECOND_BATCH_PORTS } from './batch2-ports.ts'
import { THIRD_BATCH_PORTS } from './batch3-ports.ts'
import { FOURTH_BATCH_LEGACY_PORTS } from './batch4-ports.ts'

// Existing algorithms, explicit contracts and bounded inputs; not generated placeholder handlers.
export const FIRST_BATCH_PORTS = [
  ['citation-binding-check', 'verify', 'evidence', 'citation-bindings'],
  ['revision-lineage-check', 'verify', 'provenance', 'revision-lineage'],
  ['audit-export-normalizer', 'verify', 'provenance', 'event-export'],
  ['dimensional-consistency-check', 'compute', 'numerics', 'dimensions'],
  ['exact-interpolation-receipt', 'compute', 'numerics', 'interpolation'],
  ['sampled-series-integration', 'compute', 'numerics', 'integration'],
  ['evidence-conflict-comparator', 'context', 'evidence', 'conflicts'],
  ['astrology-experiment-plan-check', 'celestial', 'experiments', 'plan-check'],
  ['celestial-result-compatibility', 'celestial', 'results', 'compatibility'],
  ['evidence-frame-compatibility', 'context', 'evidence', 'frame-compatibility'],
  ['unit-uncertainty-conversion', 'compute', 'numerics', 'unit-uncertainty'],
  ['exact-linear-system', 'compute', 'numerics', 'linear-system'],
  ['bracketed-polynomial-root', 'compute', 'numerics', 'polynomial-root'],
  ['covariance-uncertainty', 'compute', 'numerics', 'covariance'],
  ['policy-version-comparison', 'context', 'policies', 'version-comparison'],
  ['control-evidence-gaps', 'verify', 'evidence', 'control-gaps'],
  ['mcp-contract-compatibility', 'verify', 'tools', 'contract-compatibility'],
  ['tool-permission-diff', 'verify', 'tools', 'permission-diff'],
  ['publication-bundle-consistency', 'verify', 'publications', 'bundle-consistency'],
  ['evidence-scope-check', 'context', 'evidence', 'scope'],
  ['evidence-version-selection-check', 'context', 'evidence', 'version-selection'],
  ['context-manifest-check', 'context', 'evidence', 'manifest'],
  ['biology-dna-rna-composition', 'compute', 'biology', 'sequence-composition'],
  ['chemistry-dilution-calculator', 'compute', 'chemistry', 'dilution'],
  ['materials-thermal-stack-resistance', 'compute', 'materials', 'thermal-stack'],
] as const satisfies readonly (readonly [MicroProductId, Domain, string, string])[]
export const LEGACY_PORTS = [...FIRST_BATCH_PORTS, ...SECOND_BATCH_PORTS, ...THIRD_BATCH_PORTS, ...FOURTH_BATCH_LEGACY_PORTS] as const
export type LegacyPortId = typeof LEGACY_PORTS[number][0]
export const isLegacyPort = (id: string): id is LegacyPortId => LEGACY_PORTS.some(p => p[0] === id)
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/)
export function legacyAdapter(id: LegacyPortId, amount = MICRO_PRODUCTS[id].amount): HandlerContract {
  const resultSchema = microOutputSchema(id).properties!.result!
  const output = z.object({ version: z.literal('maha-legacy-adapter/1'), productId: z.literal(id), inputHash: digest,
    result: z.custom<unknown>(value => schemaAccepts(resultSchema, value)), resultHash: digest,
    sourceContractAmount: z.literal(MICRO_PRODUCTS[id].amount), chargedAmount: z.literal(amount),
    limitations: z.array(z.string().max(1000)).min(1).max(20) }).strict().superRefine((result, ctx) => {
      if (result.resultHash !== demandDigest(result.result)) ctx.addIssue({ code: 'custom', message: 'Result commitment mismatch.' })
    })
  return { input: z.unknown().transform(supplied => parseMicroInput(id, supplied)), output,
    execute: async input => { const legacy = await buildMicroProduct(id, input)
      return output.parse({ version: 'maha-legacy-adapter/1', productId: id, inputHash: demandDigest(input), result: legacy.result,
        resultHash: demandDigest(legacy.result), sourceContractAmount: MICRO_PRODUCTS[id].amount, chargedAmount: amount,
        limitations: [...legacy.boundaries.filter(s => !s.startsWith('Request and result bodies') && !s.startsWith('Stateless delivery')),
          'This modular adapter retains result content for 24 hours and minimal receipt metadata for 90 days; original deadlines do not extend.',
          'Source contract amount is historical metadata. chargedAmount is the modular quote amount. No new scientific certification is claimed.'] }) }
  }
}
export function legacyPortSchemas(id: LegacyPortId, amount: string) {
  const hash = { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' }
  return { input: MICRO_INPUT_SCHEMAS[id], output: { type: 'object', additionalProperties: false,
    required: ['version', 'productId', 'inputHash', 'result', 'resultHash', 'sourceContractAmount', 'chargedAmount', 'limitations'], properties: {
      version: { const: 'maha-legacy-adapter/1' }, productId: { const: id }, inputHash: hash, result: microOutputSchema(id).properties!.result,
      resultHash: hash, sourceContractAmount: { const: MICRO_PRODUCTS[id].amount }, chargedAmount: { const: amount },
      limitations: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', maxLength: 1000 } } } } }
}
