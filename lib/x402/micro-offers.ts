import examples from '../../content/discovery/microproduct-examples.json' with { type: 'json' }
import type { X402Offer } from './offers.ts'
import { MICRO_BOUNDARIES, MICRO_IDS, MICRO_INPUT_SCHEMAS, MICRO_MAX_REQUEST_BYTES, MICRO_PRODUCTS, microPath } from './micro-contracts.ts'
import { microOutputSchema } from './micro-output-schemas.ts'
import { MICRO_SAMPLE_INPUTS } from './micro-samples.ts'

/** Withheld is deliberate: local implementation is not approval to publish or settle. */
export const MICRO_OFFERS: readonly X402Offer[] = MICRO_IDS.map(id => ({
  id, method: 'POST', path: microPath(id), amount: MICRO_PRODUCTS[id].amount,
  description: MICRO_PRODUCTS[id].description, concurrencyCap: 4,
  serviceName: MICRO_PRODUCTS[id].title, tags: ['bounded-computation', 'evidence', 'deterministic', 'microproduct'],
  status: 'withheld', availability: { payableInProduction: false, blockedBy: ['Local implementation only; owner publication approval, Preview verification and paid canaries outstanding.'] },
  requiresIdempotency: false, maxRequestBytes: MICRO_MAX_REQUEST_BYTES,
  capabilityBoundaries: [...MICRO_BOUNDARIES, MICRO_PRODUCTS[id].description],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: false,
    retainedFields: ['payment transaction', 'payer wallet', 'fixed offer URL', 'amount', 'settlement status', 'coarse invocation counts'],
    note: 'This service does not persist request/result bodies or their digests. No stored-result recovery. Payment binds the resource; the integrity receipt binds the actual input. Do not send confidential data or place input in URLs or payment metadata.' },
  discovery: { input: MICRO_SAMPLE_INPUTS[id], inputSchema: MICRO_INPUT_SCHEMAS[id], output: examples.outputs[id], outputSchema: microOutputSchema(id) },
}))
