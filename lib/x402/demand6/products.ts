import canonicalize from 'canonicalize'
import { DEMAND6_INPUTS, DEMAND6_RESULTS, DEMAND6_VERSION, DEMAND6_MAX_RESPONSE_BYTES, parseDemandInput, quoteObservationSchema,
  type Demand6Id, type DemandInput, type QuoteObservation, demandResultSchema } from './contracts.ts'
import { csvPreflight, cataloguePreflight } from './validators.ts'
import { createPublicReader, type PublicRead, type PublicTarget } from './public-fetch.ts'
import { DEMAND6_SOURCE_REGISTRY, extractedPublicText, textHash, quoteLocations, extractiveBrief, type SourceRegistration, type AcquiredSource } from './sources.ts'
import { DECLARED_PAYMENT_NETWORKS, usdcNetwork } from '../networks.ts'
import historyJSON from '../../../content/x402/demand6/quote-history.json' with { type: 'json' }

export const demandDigest = (value: unknown) => textHash(canonicalize(value) ?? (() => { throw new Error('non_json_result') })())
export type QuoteHistory = { schemaVersion: 'maha-quote-history/1.0'; snapshotAt: string; observations: QuoteObservation[] }
export type DemandDependencies = { now?: () => number; read?: (url: string) => Promise<PublicRead>;
  sources?: readonly SourceRegistration[]; endpoints?: readonly PublicTarget[]; history?: QuoteHistory }

export async function defaultEndpoints(): Promise<PublicTarget[]> {
  // Only released first-party routes. Adding outside providers requires an operator-reviewed registry.
  const { payableOffers } = await import('../offers.ts')
  return payableOffers().map(offer => ({ url: 'https://www.mahastrategies.com' + offer.path, method: 'POST' as const, body: '{}' }))
}
export function inspectQuote(resource: string, response: PublicRead | null, expectedPayee: string, maximumAmount: string, observedAt: string): QuoteObservation {
  const networks = DECLARED_PAYMENT_NETWORKS.map(network => ({ network, state: 'unknown' as QuoteObservation['networks'][number]['state'], amountBaseUnits: null as string | null, reasons: [] as string[] }))
  const base = { resource, observedAt, responseStatus: response?.status ?? null, durationMs: response?.durationMs ?? 0,
    challengeDigest: null as string | null, schemaDigest: null as string | null, schemaState: 'unknown' as QuoteObservation['schemaState'], networks }
  if (!response) return { ...base, challengeState: 'unavailable', networks: networks.map(row => ({ ...row, reasons: ['probe_unavailable'] })) }
  if (response.status !== 402) return { ...base, challengeState: 'not_402', networks: networks.map(row => ({ ...row, reasons: ['no_payment_challenge'] })) }
  try {
    const header = response.headers['payment-required']
    if (!header || header.length > 16384) throw new Error()
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as { x402Version?: number; resource?: { url?: string }; accepts?: Record<string, unknown>[]; extensions?: { bazaar?: unknown } }
    if (decoded.x402Version !== 2 || decoded.resource?.url !== resource || !Array.isArray(decoded.accepts) || !decoded.accepts.length || decoded.accepts.length > 16) throw new Error()
    base.challengeDigest = demandDigest({ resource: decoded.resource, accepts: decoded.accepts })
    base.schemaState = decoded.extensions?.bazaar ? 'present_not_validated' : 'absent'
    base.schemaDigest = decoded.extensions?.bazaar ? demandDigest(decoded.extensions.bazaar) : null
    const checked = networks.map(row => {
      const terms = decoded.accepts!.filter(term => term.network === row.network)
      if (!terms.length) return { ...row, state: 'not_offered' as const, reasons: ['network_not_offered'] }
      if (terms.length !== 1) return { ...row, state: 'invalid_quote' as const, reasons: ['ambiguous_network_quote'] }
      const term = terms[0], definition = usdcNetwork(row.network), reasons: string[] = []
      const amount = typeof term.amount === 'string' && /^[1-9]\d{0,8}$/.test(term.amount) ? term.amount : null
      if (term.scheme !== 'exact') reasons.push('wrong_scheme')
      if (!amount || BigInt(amount) > BigInt(maximumAmount)) reasons.push('amount_exceeds_declared_cap_or_invalid')
      if (typeof term.asset !== 'string' || term.asset.toLowerCase() !== definition.asset.toLowerCase()) reasons.push('wrong_native_usdc_asset')
      if (typeof term.payTo !== 'string' || term.payTo.toLowerCase() !== expectedPayee.toLowerCase()) reasons.push('wrong_declared_payee')
      const extra = term.extra as { name?: unknown; version?: unknown } | null
      if (extra?.name !== definition.domain.name || extra?.version !== definition.domain.version) reasons.push('wrong_eip712_domain')
      if (!Number.isInteger(term.maxTimeoutSeconds) || Number(term.maxTimeoutSeconds) < 1 || Number(term.maxTimeoutSeconds) > 300) reasons.push('invalid_timeout')
      return { ...row, amountBaseUnits: amount, state: reasons.length ? 'invalid_quote' as const : 'valid_quote' as const, reasons }
    })
    return quoteObservationSchema.parse({ ...base, challengeState: 'observed', networks: checked })
  } catch { return { ...base, challengeDigest: null, schemaDigest: null, schemaState: 'unknown', challengeState: 'malformed',
    networks: networks.map(row => ({ ...row, reasons: ['malformed_quote'] })) } }
}
export function quoteHistoryReport(input: DemandInput<'x402-quote-change-report'>, history: QuoteHistory, nowMs: number) {
  if (history.schemaVersion !== 'maha-quote-history/1.0' || !Number.isFinite(Date.parse(history.snapshotAt)) || Date.parse(history.snapshotAt) > nowMs + 300000
    || history.observations.length > 1000) throw new Error('invalid_quote_history')
  const rows = history.observations.map(value => quoteObservationSchema.parse(value)).filter(row => row.resource === input.resource && row.observedAt >= input.fromUtc && row.observedAt <= input.toUtc)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
  if (rows.length < 2) throw new Error('insufficient_quote_history')
  if (new Set(rows.map(row => row.observedAt)).size !== rows.length || rows.some(row => !Number.isFinite(Date.parse(row.observedAt)) || row.observedAt > history.snapshotAt)) throw new Error('invalid_quote_history')
  let maximumGapSeconds = 0, reachabilityChanges = 0, quoteChanges = 0, schemaChanges = 0, unknownComparisons = 0
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1], current = rows[i]
    maximumGapSeconds = Math.max(maximumGapSeconds, (Date.parse(current.observedAt) - Date.parse(previous.observedAt)) / 1000)
    if (previous.challengeState !== current.challengeState) reachabilityChanges++
    if (!previous.challengeDigest || !current.challengeDigest || previous.schemaState === 'unknown' || current.schemaState === 'unknown') unknownComparisons++
    else if (previous.challengeDigest !== current.challengeDigest) quoteChanges++
    if (previous.schemaState !== 'unknown' && current.schemaState !== 'unknown' && previous.schemaDigest !== current.schemaDigest) schemaChanges++
  }
  return { resource: input.resource, snapshotAt: history.snapshotAt, snapshotAgeSeconds: Math.max(0, nowMs - Date.parse(history.snapshotAt)) / 1000,
    sampleCount: rows.length, maximumGapSeconds, reachabilityChanges, quoteChanges, schemaChanges, unknownComparisons,
    continuousUptimeEstablished: false as const, first: rows[0], last: rows.at(-1)! }
}
export const DEMAND6_LIMITATIONS = [
  'Public or synthetic input only. Caller labels do not detect sensitive data.',
  'No payment is made to an observed provider. A valid challenge is not settlement, execution, delivery or a security clearance.',
  'Approved targets only; no credentials, redirects, IP-literal targets, private DNS or IPv6 connections. New sources require a reviewed reuse basis.',
  'Static prose extraction excludes forms, code, navigation and scripts. No JavaScript, PDFs or browser visibility checks. Quotes use extracted-text code points, not raw HTML offsets.',
  'No model calls, semantic contradiction detection, factual certification or completeness guarantee.',
  'Prepared result retention is bounded to 24 hours; save the result and original authorization. Missing recovery or unknown payment outcomes need operator review, never automatic repayment.',
] as const
export async function buildDemandProduct(id: Demand6Id, value: unknown, dependencies: DemandDependencies = {}) {
  const input = parseDemandInput(id, value), now = dependencies.now ?? Date.now
  const registry = dependencies.sources ?? DEMAND6_SOURCE_REGISTRY
  const endpoints = dependencies.endpoints ?? (id === 'live-x402-payment-preflight' || id === 'x402-quote-change-report' ? await defaultEndpoints() : [])
  const sourceTargets = registry.map(source => ({ url: source.url, method: 'GET' as const }))
  const reads = dependencies.read ?? createPublicReader([...endpoints, ...sourceTargets])
  const approvedEndpoint = (url: string) => { if (!endpoints.some(target => target.url === url)) throw new Error('public_target_not_allowed') }
  const acquire = async (source: { sourceId: string; url: string }): Promise<AcquiredSource> => {
    const registration = registry.find(row => row.url === source.url)
    if (!registration || !registration.rightsBasis.trim()) throw new Error('source_rights_not_reviewed')
    const response = await reads(source.url), text = extractedPublicText(response)
    return { sourceId: source.sourceId, text, metadata: { sourceId: source.sourceId, url: source.url, retrievedAt: new Date(now()).toISOString(),
      rawBytesHash: textHash(response.body), extractedTextHash: textHash(text), extraction: 'maha-public-text/1.0', rightsBasis: registration.rightsBasis } }
  }
  let result: unknown
  if (id === 'csv-import-preflight') result = csvPreflight(DEMAND6_INPUTS[id].parse(input))
  else if (id === 'product-catalogue-preflight') result = cataloguePreflight(DEMAND6_INPUTS[id].parse(input))
  else if (id === 'live-x402-payment-preflight') {
    const parsed = DEMAND6_INPUTS[id].parse(input); approvedEndpoint(parsed.resource)
    let observation: QuoteObservation
    try { observation = inspectQuote(parsed.resource, await reads(parsed.resource), parsed.expectedPayee, parsed.maximumAmountBaseUnits, new Date(now()).toISOString()) }
    catch { throw new Error('public_probe_unavailable') } // Unavailable work is not charged.
    result = { observation, allRequiredQuotesValid: parsed.requiredNetworks.every(network => observation.networks.some(row => row.network === network && row.state === 'valid_quote')), paymentsMade: 0, deliveryTested: false }
  } else if (id === 'x402-quote-change-report') {
    const parsed = DEMAND6_INPUTS[id].parse(input); approvedEndpoint(parsed.resource)
    result = quoteHistoryReport(parsed, dependencies.history ?? historyJSON as QuoteHistory, now())
  } else if (id === 'live-citation-recheck') {
    const parsed = DEMAND6_INPUTS[id].parse(input)
    // Review all targets before starting any source reads.
    if (parsed.citations.some(citation => !registry.some(source => source.url === citation.url))) throw new Error('source_rights_not_reviewed')
    const sources = await Promise.all(parsed.citations.map(acquire))
    result = { sources: sources.map(source => source.metadata), checks: parsed.citations.map((citation, i) => {
      const { count, locators } = quoteLocations(citation.sourceId, sources[i].text, citation.quote)
      return { sourceId: citation.sourceId, state: count === 0 ? 'not_found' : count === 1 ? 'present_unique' : 'present_multiple', occurrenceCount: count,
        locators, locatorsTruncated: count > 8, changedFromDeclaredHash: citation.previousTextHash ? citation.previousTextHash !== sources[i].metadata.extractedTextHash : null }
    }), factualSupportVerified: false }
  } else {
    const parsed = DEMAND6_INPUTS['source-bound-research-microbrief'].parse(input)
    if (parsed.sources.some(source => !registry.some(registration => registration.url === source.url))) throw new Error('source_rights_not_reviewed')
    result = extractiveBrief(parsed.question, await Promise.all(parsed.sources.map(acquire)))
  }
  result = DEMAND6_RESULTS[id].parse(result)
  const inputHash = demandDigest(input), resultHash = demandDigest(result)
  const receiptDigest = demandDigest({ version: DEMAND6_VERSION, productId: id, inputHash, resultHash })
  const product = demandResultSchema(id).parse({ version: DEMAND6_VERSION, productId: id, inputHash, resultHash, receiptDigest, result, limitations: [...DEMAND6_LIMITATIONS] })
  if (Buffer.byteLength(JSON.stringify(product)) > DEMAND6_MAX_RESPONSE_BYTES) throw new Error('demand_result_too_large')
  return product
}
