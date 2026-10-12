import { z } from 'zod'
import type { X402Offer } from '../offers.ts'
import { DEMAND6_IDS, DEMAND6_PRODUCTS, DEMAND6_INPUTS, DEMAND6_SAMPLES, DEMAND6_MAX_REQUEST_BYTES,
  demand6Path, demandResultSchema, type Demand6Id } from './contracts.ts'
import examplesJSON from '../../../content/x402/demand6/examples.json' with { type: 'json' }
const examples = examplesJSON as Record<Demand6Id, Record<string, unknown>>
const jsonSchema = (schema: z.ZodType) => { const result = z.toJSONSchema(schema); delete result.$schema; return result }
const TASK_TAGS: Record<Demand6Id, string[]> = {
  'csv-import-preflight': ['csv-validation', 'data-quality', 'import-preflight'],
  'product-catalogue-preflight': ['catalogue-validation', 'sku-validation', 'gtin'],
  'live-x402-payment-preflight': ['payment-path-check', 'endpoint-reliability', 'usdc'],
  'x402-quote-change-report': ['quote-history', 'endpoint-reliability', 'payment-diagnostics'],
  'live-citation-recheck': ['citation-check', 'exact-quotes', 'source-evidence'],
  'source-bound-research-microbrief': ['research-brief', 'extractive-research', 'source-evidence'],
}
export const DEMAND6_OFFERS: readonly X402Offer[] = DEMAND6_IDS.map(id => ({
  id, method: 'POST', path: demand6Path(id), amount: DEMAND6_PRODUCTS[id].amount,
  serviceName: DEMAND6_PRODUCTS[id].title, description: DEMAND6_PRODUCTS[id].description, concurrencyCap: 2,
  tags: ['demand-20261012', ...TASK_TAGS[id], 'x402'],
  status: 'available', availability: { payableInProduction: true, blockedBy: [] },
  requiresIdempotency: false, maxRequestBytes: DEMAND6_MAX_REQUEST_BYTES,
  capabilityBoundaries: ['Approved public targets and reviewed source rights only. No private-input detection, credentials, redirects, IPv6 or browser/PDF execution.',
    'Version 1 accepts native-USDC EOA authorizations on Base or Arbitrum only; smart-contract-wallet signatures are not supported.',
    'Quote checks do not establish settlement or delivery. Stored samples are not continuous uptime or independent demand.',
    'Extractive research only: no model calls, semantic contradiction detection, factual certification or completeness guarantee.',
    'Malformed input, unsupported, unavailable or unretainable work is refused before settlement. A supported negative finding is a result, not approval.',
    'Original synthetic discovery examples are not live observations. Do not put private data in this public/synthetic service.'],
  retention: { fullSourceTextStored: false, verbatimExcerptsRetained: id === 'source-bound-research-microbrief' || id === 'live-citation-recheck',
    retainedFields: ['prepared result up to 64 KiB', 'input hash', 'canonical payment fingerprint', 'payer', 'network', 'creation timestamp', 'settlement receipt'],
    note: 'Prepared results are retained for at most 24 hours for input-bound same-authorization recovery. Source bodies, CSV cells, raw payment signatures and raw recovery secrets are not stored. Short source quotations may be retained in results. Hashes are not anonymization.' },
  discovery: { input: { ...DEMAND6_SAMPLES[id], dataClass: 'synthetic' }, inputSchema: jsonSchema(DEMAND6_INPUTS[id]),
    output: examples[id], outputSchema: jsonSchema(demandResultSchema(id)), requiredHeaders: {
      'X-Maha-Input-Hash': { algorithm: 'sha256', preimage: 'RFC 8785 canonical JSON of the exact request body', format: 'sha256:<64 lowercase hex>', notes: 'The body and nonce binding are checked before work or settlement.' },
      'X-Maha-Recovery-Secret': { algorithm: 'cryptographically random 32 bytes', preimage: 'Generated privately by the buyer before signing; never included in the payment payload.', format: '64 lowercase hex',
        notes: 'EIP-3009 nonce = 0x + SHA256(canonical JSON {version:"maha-demand6/1.0.0",productId,inputHash,recoverySecret}). Use demandPurchaseTypedData and preserve these private headers for recovery.' },
    } },
}))
