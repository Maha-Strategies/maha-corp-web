import { bazaarResourceServerExtension, declareDiscoveryExtension, validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { compactExample, compactSchema } from '../x402/declaration-compaction.ts'
import { releaseExample } from './production-release.ts'
import { handlerFor } from './handlers.ts'
import type { Endpoint } from './types.ts'
const cache = new Map<string, Record<string, unknown>>()
const SINGLE_EPOCH_EXAMPLES = new Set(['orbital-records-timestamp-order-audit', 'ephemeris-snapshots-timestamp-order-audit', 'planetary-measurements-timestamp-order-audit'])
const BOUNDED_OUTPUT_EXAMPLES = new Set(['ephemeris-snapshots-condition-coverage-map', 'planetary-measurements-condition-coverage-map'])
export function modularServiceMetadata(e: Endpoint) {
  return { serviceName: e.name.replace(/[^\x20-\x7e]/g, '-').slice(0, 32),
    tags: [...new Set(e.tags.filter(tag => /^[\x20-\x7e]{1,32}$/.test(tag)))].slice(0, 5) }
}
export function modularDescription(e: Endpoint) {
  if (Buffer.byteLength(e.description) <= 480) return e.description
  const sentence = e.description.split(/(?<=\.)\s+/)[0]
  const short = Buffer.from(sentence).subarray(0, 370).toString('utf8').replace(/\uFFFD$/, '').replace(/\s+\S*$/, '')
  return short + ' Supplied-record analysis, not independent certification. Full contract at the free describe URL.'
}
export function modularBazaar(e: Endpoint): Record<string, unknown> {
  const t = releaseExample(e.id)
  if (!t) return {}
  const cached = cache.get(e.id); if (cached) return cached
  const output = { success: true, data: t.output, proof: { settlement_id: '0x' + '0'.repeat(64) } }
  let input = t.input as Record<string, unknown>
  // These new source-frame examples repeat many required pins. A single epoch
  // is a valid callable input; the paid indexing request still uses the full
  // two-epoch fixture. Never truncate strings, hashes or required fields.
  if (SINGLE_EPOCH_EXAMPLES.has(e.id) && Array.isArray(input.rows) && input.rows.length > 1) {
    input = { ...input, rows: input.rows.slice(0, 1) }
    handlerFor(e.id, e.amount)!.input.parse(input)
  }
  // These newly released frame-heavy inputs need the stricter output profile
  // to fit ordinary clients' 8 KB response-header limit. Inputs and full hosted
  // schemas/examples stay unchanged; only already-collapsed output detail is omitted.
  const declared = declareDiscoveryExtension({ bodyType: 'json', input,
    inputSchema: compactSchema(e.schema.input), output: { example: compactExample(output, 0, e.schema.output,
      BOUNDED_OUTPUT_EXAMPLES.has(e.id) ? 1 : Infinity), schema: compactSchema(e.schema.output) } })
  const enriched = bazaarResourceServerExtension.enrichDeclaration?.(declared.bazaar, {
    method: e.method, path: e.path, adapter: { getPath: () => e.path },
  } as Parameters<NonNullable<typeof bazaarResourceServerExtension.enrichDeclaration>>[1]) as Record<string, unknown>
  if (!validateDiscoveryExtensionSpec(enriched).valid || !validateDiscoveryExtension(enriched as unknown as Parameters<typeof validateDiscoveryExtension>[0]).valid) throw Error('invalid_modular_bazaar:' + e.id)
  const extensions = { bazaar: enriched, 'maha-modular-contract': { info: { id: e.id, contractHash: t.contractHash,
    declarationUrl: 'https://www.mahastrategies.com/api/v1/discovery/describe?id=' + encodeURIComponent(e.id),
    requiresBuyerRecoveryAdapter: true }, schema: { type: 'object' } } }
  cache.set(e.id, extensions); return extensions
}
