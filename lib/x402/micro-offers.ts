import examples from '../../content/discovery/microproduct-examples.json' with { type: 'json' }
import scienceExamplesJSON from './science/examples-json.ts'
import { isScienceProduct, SCIENCE_TAGS, SCIENCE_BOUNDARIES } from './science/contracts.ts'
import { MICRO_PURCHASE_HEADERS, MICRO_RECOVERY_RETENTION } from './micro-recovery-contract.ts'
import type { X402Offer } from './offers.ts'
import { MICRO_BOUNDARIES, MICRO_IDS, MICRO_INPUT_SCHEMAS, MICRO_MAX_REQUEST_BYTES, MICRO_PRODUCTS, microPath } from './micro-contracts.ts'
import { microOutputSchema } from './micro-output-schemas.ts'
import { MICRO_SAMPLE_INPUTS } from './micro-samples.ts'
import { isReleasedMicro } from './micro-release.ts'
import { isCompatibilityProduct } from './compatibility-contracts.ts'
import { BAZAAR_LAUNCH_COPY } from './bazaar-launch.ts'
import { isPlanningProduct, PLANNING_TAGS } from './micro-planning-contracts.ts'
import { isExpansionProduct, EXPANSION_SPECS, expansionPaidContent, CONTRACT_ONLY_EXAMPLE, CONTRACT_ONLY_SCHEMA } from './expansion-registry.ts'
const scienceExamples = JSON.parse(scienceExamplesJSON) as { inputs: Record<string, Record<string, unknown>>; outputs: Record<string, Record<string, unknown>> }

/** Only the explicit owner-authorized cohort can be configured for settlement. */
export const MICRO_OFFERS: readonly X402Offer[] = MICRO_IDS.map(id => ({
  id, method: 'POST', path: microPath(id), amount: MICRO_PRODUCTS[id].amount,
  description: BAZAAR_LAUNCH_COPY[id] ?? MICRO_PRODUCTS[id].description, concurrencyCap: 4,
  serviceName: MICRO_PRODUCTS[id].title, tags: ['bounded-computation', 'evidence', 'deterministic', 'microproduct', ...(isScienceProduct(id) ? SCIENCE_TAGS[id] : []), ...(isPlanningProduct(id) ? PLANNING_TAGS[id] : []), ...(isExpansionProduct(id) ? ['expansion-20261011', EXPANSION_SPECS[id].category] : [])],
  status: isReleasedMicro(id) ? 'available' : 'withheld',
  availability: { payableInProduction: isReleasedMicro(id), blockedBy: isReleasedMicro(id) ? [] : [isCompatibilityProduct(id) ? 'Exact price and draft rule-set release approval pending; settlement disabled.' : 'Outside the owner-authorized release; settlement remains disabled.'] },
  requiresIdempotency: isScienceProduct(id), maxRequestBytes: MICRO_MAX_REQUEST_BYTES,
  capabilityBoundaries: [...MICRO_BOUNDARIES, ...(isScienceProduct(id) ? SCIENCE_BOUNDARIES : []), MICRO_PRODUCTS[id].description],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false,
    retainedFields: ['payment transaction', 'payer wallet', 'fixed offer URL', 'amount', 'settlement status', 'coarse invocation counts', ...(isScienceProduct(id) ? ['purchase ID', 'salted input hash', 'recovery secret hash', 'prepared response digest', 'purchase creation timestamp', 'authorization fingerprint', 'settlement network'] : [])],
    note: isScienceProduct(id) ? `No request/result bodies or raw recovery secrets are stored. ${MICRO_RECOVERY_RETENTION.metadataRetention} ${MICRO_RECOVERY_RETENTION.recovery}` : 'This service does not persist request/result bodies or their digests. No stored-result recovery. Payment binds the resource; the integrity receipt binds the actual input. Do not send confidential data or place input in URLs or payment metadata.' },
  discovery: { ...(isScienceProduct(id) ? { requiredHeaders: MICRO_PURCHASE_HEADERS } : {}), input: isScienceProduct(id) ? scienceExamples.inputs[id] : MICRO_SAMPLE_INPUTS[id], inputSchema: MICRO_INPUT_SCHEMAS[id], output: isScienceProduct(id) ? scienceExamples.outputs[id] : expansionPaidContent(id) ? CONTRACT_ONLY_EXAMPLE : (examples.outputs as Record<string, Record<string, unknown>>)[id], outputSchema: expansionPaidContent(id) ? { oneOf: [CONTRACT_ONLY_SCHEMA, microOutputSchema(id)] } : microOutputSchema(id) },
}))
