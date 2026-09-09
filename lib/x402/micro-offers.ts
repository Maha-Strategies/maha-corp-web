import examples from '../../content/discovery/microproduct-examples.json' with { type: 'json' }
import type { X402Offer } from './offers.ts'
import { MICRO_BOUNDARIES, MICRO_IDS, MICRO_INPUT_SCHEMAS, MICRO_MAX_REQUEST_BYTES, MICRO_PRODUCTS, microPath } from './micro-contracts.ts'
import { microOutputSchema } from './micro-output-schemas.ts'
import { MICRO_SAMPLE_INPUTS } from './micro-samples.ts'
import { isReleasedMicro } from './micro-release.ts'

/** Only the explicit owner-authorized cohort can be configured for settlement. */
export const MICRO_OFFERS: readonly X402Offer[] = MICRO_IDS.map(id => ({
  id, method: 'POST', path: microPath(id), amount: MICRO_PRODUCTS[id].amount,
  description: MICRO_PRODUCTS[id].description, concurrencyCap: 4,
  serviceName: MICRO_PRODUCTS[id].title, tags: ['bounded-computation', 'evidence', 'deterministic', 'microproduct'],
  status: isReleasedMicro(id) ? 'available' : 'withheld',
  availability: { payableInProduction: isReleasedMicro(id), blockedBy: isReleasedMicro(id) ? [] : ['Outside the owner-authorized five-product release; settlement remains disabled.'] },
  requiresIdempotency: false, maxRequestBytes: MICRO_MAX_REQUEST_BYTES,
  capabilityBoundaries: [...MICRO_BOUNDARIES, MICRO_PRODUCTS[id].description],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false,
    retainedFields: ['payment transaction', 'payer wallet', 'fixed offer URL', 'amount', 'settlement status', 'coarse invocation counts'],
    note: 'This service does not persist request/result bodies or their digests. No stored-result recovery. Payment binds the resource; the integrity receipt binds the actual input. Do not send confidential data or place input in URLs or payment metadata.' },
  discovery: { input: MICRO_SAMPLE_INPUTS[id], inputSchema: MICRO_INPUT_SCHEMAS[id], output: examples.outputs[id], outputSchema: microOutputSchema(id) },
}))
