import { z } from 'zod'

export const DEMAND6_VERSION = 'maha-demand6/1.0.0'
export const DEMAND6_MAX_REQUEST_BYTES = 32768
export const DEMAND6_MAX_RESPONSE_BYTES = 65536
export const DEMAND6_RETAIN_SECONDS = 86400
export const DEMAND6_PRODUCTS = {
  'csv-import-preflight': { amount: '13500', title: 'CSV Import Preflight', description: 'Check up to 500 supplied CSV records for quoting, column counts, duplicate headers, spreadsheet-formula prefixes and caller-declared scalar types. Return bounded row/column findings and input integrity hashes. No cell execution, automatic repair, PII detection or import-success guarantee.' },
  'live-x402-payment-preflight': { amount: '34900', title: 'Live x402 Payment-Path Preflight', description: 'Fetch one approved public endpoint without payment. Inspect Base, Arbitrum and Polygon native-USDC quotes against caller-declared payee and spending caps, plus bounded discovery-schema observations and latency. A known network may not be offered. No signing, settlement test, paid delivery, uptime guarantee or safety clearance.' },
  'x402-quote-change-report': { amount: '62000', title: 'x402 Quote-Change Report', description: 'Compare stored, dated unpaid observations of one approved endpoint. Report quote, network, schema and reachability changes with sample counts, largest sampling gap and snapshot age. Sparse observations are not continuous uptime, customer calls, settlement or delivery evidence.' },
  'product-catalogue-preflight': { amount: '24500', title: 'Product Catalogue Preflight', description: 'Check up to 250 supplied product records for duplicate SKUs, nonpositive or malformed decimal prices, currency-code shape, and optional GTIN check digits. Return bounded row-level findings. No registry lookup, identifier ownership check, automatic repair or marketplace approval guarantee.' },
  'live-citation-recheck': { amount: '88000', title: 'Live Citation Recheck', description: 'Revisit up to three approved, rights-reviewed public text sources. Check exact quoted passages in versioned extracted text, compare declared prior text hashes and return bounded locators, retrieval times and hashes. No paywall bypass, PDF/JavaScript execution, factual certification or completeness guarantee.' },
  'source-bound-research-microbrief': { amount: '240000', title: 'Source-Bound Research Microbrief', description: 'Retrieve up to three approved, rights-reviewed public text sources for one narrow question. Return a bounded extractive brief with exact short quotes, source links, locators, retrieval hashes and explicit unknowns. No model calls, invented answer, semantic contradiction detection, open-ended research or factual certification.' },
} as const
export type Demand6Id = keyof typeof DEMAND6_PRODUCTS
export const DEMAND6_IDS = Object.keys(DEMAND6_PRODUCTS) as Demand6Id[]
export const demand6Path = (id: Demand6Id) => `/api/v1/demand/${id}`
export const isDemand6 = (id: string): id is Demand6Id => Object.hasOwn(DEMAND6_PRODUCTS, id)
const text = (max = 120) => z.string().min(1).max(max).regex(/^[^\u0000-\u001f\u007f]+$/)
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const stamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
const resource = z.string().min(1).max(1024)
const issue = z.object({ row: z.number().int().min(0).max(501), column: z.number().int().min(0).max(64), code: text(80) }).strict()
const common = { dataClass: z.enum(['public', 'synthetic']) }
export const DEMAND6_INPUTS = {
  'csv-import-preflight': z.object({ ...common, csv: z.string().min(1).max(24000), delimiter: z.enum([',', ';', '\t']),
    columns: z.array(z.object({ name: text(80), type: z.enum(['string', 'integer', 'number', 'boolean', 'date']), required: z.boolean() }).strict()).min(1).max(64) }).strict(),
  'product-catalogue-preflight': z.object({ ...common, expectedCurrency: z.string().regex(/^[A-Z]{3}$/).nullable(), products: z.array(z.object({ sku: text(80), price: z.string().max(24), currency: z.string().max(8), gtin: z.string().max(20).nullable() }).strict()).min(1).max(250) }).strict(),
  'live-x402-payment-preflight': z.object({ ...common, resource, expectedPayee: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    maximumAmountBaseUnits: z.string().regex(/^[1-9][0-9]{0,8}$/), requiredNetworks: z.array(z.enum(['eip155:8453', 'eip155:42161', 'eip155:137'])).min(1).max(3) }).strict(),
  'x402-quote-change-report': z.object({ ...common, resource, fromUtc: stamp, toUtc: stamp }).strict(),
  'live-citation-recheck': z.object({ ...common, citations: z.array(z.object({ sourceId: text(80), url: resource,
    quote: text(400), previousTextHash: hash.nullable() }).strict()).min(1).max(3) }).strict(),
  'source-bound-research-microbrief': z.object({ ...common, question: text(300), sources: z.array(z.object({ sourceId: text(80), url: resource }).strict()).min(1).max(3) }).strict(),
} as const
const no = z.literal(false)
const network = z.object({ network: z.enum(['eip155:8453', 'eip155:42161', 'eip155:137']), state: z.enum(['valid_quote', 'invalid_quote', 'not_offered', 'unknown']),
  amountBaseUnits: z.string().nullable(), reasons: z.array(text(80)).max(16) }).strict()
export const quoteObservationSchema = z.object({ resource, observedAt: stamp, responseStatus: z.number().int().min(100).max(599).nullable(),
  durationMs: z.number().int().min(0).max(30000), challengeState: z.enum(['observed', 'unavailable', 'not_402', 'malformed']),
  challengeDigest: hash.nullable(), schemaDigest: hash.nullable(), schemaState: z.enum(['present_not_validated', 'absent', 'unknown']),
  // Historical two-network observations and retained results remain readable.
  networks: z.array(network).min(2).max(3).refine(rows => new Set(rows.map(row => row.network)).size === rows.length
    && rows.some(row => row.network === 'eip155:8453') && rows.some(row => row.network === 'eip155:42161'), 'unique_network_observations_required') }).strict()
const sourceObservation = z.object({ sourceId: text(80), url: resource, retrievedAt: stamp, rawBytesHash: hash, extractedTextHash: hash,
  extraction: z.literal('maha-public-text/1.0'), rightsBasis: text(160) }).strict()
const citation = z.object({ sourceId: text(80), quote: text(400), startCodePoint: z.number().int().min(0), endCodePoint: z.number().int().min(1), quoteHash: hash }).strict()
export const DEMAND6_RESULTS = {
  'csv-import-preflight': z.object({ recordsChecked: z.number().int().min(0).max(500), columnsObserved: z.number().int().min(0).max(64),
    findings: z.array(issue).max(300), findingsTruncated: z.boolean(), readyUnderDeclaredSchema: z.boolean(), cellsExecuted: no }).strict(),
  'product-catalogue-preflight': z.object({ recordsChecked: z.number().int().min(1).max(250), findings: z.array(issue).max(300),
    findingsTruncated: z.boolean(), structurallyValid: z.boolean(), marketplaceApprovalEstablished: no }).strict(),
  'live-x402-payment-preflight': z.object({ observation: quoteObservationSchema, allRequiredQuotesValid: z.boolean(), paymentsMade: z.literal(0), deliveryTested: no }).strict(),
  'x402-quote-change-report': z.object({ resource, snapshotAt: stamp, snapshotAgeSeconds: z.number().min(0), sampleCount: z.number().int().min(2).max(1000),
    maximumGapSeconds: z.number().min(0), reachabilityChanges: z.number().int().min(0), quoteChanges: z.number().int().min(0), schemaChanges: z.number().int().min(0),
    unknownComparisons: z.number().int().min(0), continuousUptimeEstablished: no, first: quoteObservationSchema, last: quoteObservationSchema }).strict(),
  'live-citation-recheck': z.object({ sources: z.array(sourceObservation).min(1).max(3), checks: z.array(z.object({ sourceId: text(80),
    state: z.enum(['present_unique', 'present_multiple', 'not_found']), occurrenceCount: z.number().int().min(0), locators: z.array(citation).max(8),
    locatorsTruncated: z.boolean(), changedFromDeclaredHash: z.boolean().nullable() }).strict()).min(1).max(3), factualSupportVerified: no }).strict(),
  'source-bound-research-microbrief': z.object({ question: text(300), mode: z.literal('extractive'), briefMarkdown: z.string().max(7000),
    sources: z.array(sourceObservation).min(1).max(3), citations: z.array(citation).max(6), unknowns: z.array(text(240)).min(1).max(10),
    modelCalls: z.literal(0), semanticContradictionDetectionPerformed: no, factualSupportVerified: no }).strict(),
} as const
export type DemandInput<I extends Demand6Id> = z.infer<(typeof DEMAND6_INPUTS)[I]>
export type QuoteObservation = z.infer<typeof quoteObservationSchema>
export function parseDemandInput(id: Demand6Id, value: unknown) {
  const parsed = DEMAND6_INPUTS[id].parse(value)
  if ('columns' in parsed && new Set(parsed.columns.map(c => c.name)).size !== parsed.columns.length) throw new Error('duplicate_schema_columns')
  if ('requiredNetworks' in parsed && new Set(parsed.requiredNetworks).size !== parsed.requiredNetworks.length) throw new Error('duplicate_networks')
  if ('sources' in parsed && (new Set(parsed.sources.map(s => s.sourceId)).size !== parsed.sources.length || new Set(parsed.sources.map(s => s.url)).size !== parsed.sources.length)) throw new Error('duplicate_sources')
  if ('citations' in parsed && new Set(parsed.citations.map(s => s.sourceId)).size !== parsed.citations.length) throw new Error('duplicate_sources')
  if ('fromUtc' in parsed && (!Number.isFinite(Date.parse(parsed.fromUtc)) || !Number.isFinite(Date.parse(parsed.toUtc)) || parsed.fromUtc >= parsed.toUtc
    || Date.parse(parsed.toUtc) - Date.parse(parsed.fromUtc) > 30 * 86400000)) throw new Error('invalid_history_window')
  return parsed
}
export function demandResultSchema(id: Demand6Id) {
  return z.object({ version: z.literal(DEMAND6_VERSION), productId: z.literal(id), inputHash: hash, resultHash: hash,
    receiptDigest: hash, result: DEMAND6_RESULTS[id], limitations: z.array(text(300)).min(1).max(16) }).strict()
}
export const DEMAND6_SAMPLES: Record<Demand6Id, Record<string, unknown>> = {
  'csv-import-preflight': { dataClass: 'synthetic', csv: 'sku,quantity\nitem-a,2\nitem-b,3\n', delimiter: ',', columns: [{ name: 'sku', type: 'string', required: true }, { name: 'quantity', type: 'integer', required: true }] },
  'product-catalogue-preflight': { dataClass: 'synthetic', expectedCurrency: 'USD', products: [{ sku: 'example-a', price: '6.99', currency: 'USD', gtin: '4006381333931' }] },
  'live-x402-payment-preflight': { dataClass: 'public', resource: 'https://www.mahastrategies.com/api/v1/compress', expectedPayee: '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28', maximumAmountBaseUnits: '2000', requiredNetworks: ['eip155:8453', 'eip155:42161'] },
  'x402-quote-change-report': { dataClass: 'public', resource: 'https://www.mahastrategies.com/api/v1/compress', fromUtc: '2026-10-11T00:00:00.000Z', toUtc: '2026-10-12T23:59:59.000Z' },
  'live-citation-recheck': { dataClass: 'public', citations: [{ sourceId: 'context-review', url: 'https://www.mahastrategies.com/tools/context-review', quote: 'Context Review', previousTextHash: null }] },
  'source-bound-research-microbrief': { dataClass: 'public', question: 'What does Context Review do?', sources: [{ sourceId: 'context-review', url: 'https://www.mahastrategies.com/tools/context-review' }] },
}
