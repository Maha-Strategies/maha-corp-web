import { decodeChallenge, PAYMENT_REQUIRED_HEADER } from './client.ts'
import { MAHA_PAYEE } from './discovery-payment-recipe.ts'
import { DECLARED_PAYMENT_NETWORKS, usdcNetwork } from './networks.ts'
import { INTENTIONALLY_UNINDEXED_OFFERS } from './merchant-catalog.ts'
import type { X402Offer } from './offers.ts'
import type { IndexSnapshot } from './product-index.ts'
import type { UsageSnapshot } from './product-usage.ts'

export function compareCatalogueSnapshots(previous: IndexSnapshot | null, current: IndexSnapshot) {
  const valid = (value: IndexSnapshot | null) => value && Array.isArray(value.resources)
    && value.resources.every(url => typeof url === 'string') && new Set(value.resources).size === value.resources.length
    && value.resources.length <= 1000
  if (!valid(previous) || !valid(current) || !previous?.available || !previous.complete || !current.available || !current.complete
    || !Number.isFinite(Date.parse(previous.checkedAt)) || !Number.isFinite(Date.parse(current.checkedAt))
    || Date.parse(previous.checkedAt) > Date.parse(current.checkedAt)) {
    return { comparable: false, newlyObserved: null, noLongerObserved: null, automaticRefreshPayments: false }
  }
  return { comparable: true, newlyObserved: current.resources.filter(url => !previous.resources.includes(url)),
    noLongerObserved: previous.resources.filter(url => !current.resources.includes(url)), automaticRefreshPayments: false,
    interpretation: 'Absence from a complete catalogue observation is not proof the endpoint is dead or a reason to pay automatically.' }
}

export async function inspectLiveQuote(offer: X402Offer, response: Response | null) {
  const expectedUrl = `https://www.mahastrategies.com${offer.path}`
  const result = DECLARED_PAYMENT_NETWORKS.map(network => ({ network, status: 'unknown' as 'unknown' | 'not_offered' | 'valid_quote' | 'invalid_quote', reasons: [] as string[] }))
  if (!response) return result.map(row => ({ ...row, reasons: ['probe_unavailable'] }))
  if (response.status !== 402) return result.map(row => ({ ...row, status: 'invalid_quote' as const, reasons: ['no_402_challenge'] }))
  let challenge
  try {
    const header = response.headers.get(PAYMENT_REQUIRED_HEADER)
    if (header && header.length > 65536) throw new Error('oversized_quote')
    challenge = decodeChallenge(header)
    if (challenge.resource.url !== expectedUrl || challenge.accepts.length > 16) throw new Error('unexpected_quote_resource')
  } catch { return result.map(row => ({ ...row, status: 'invalid_quote' as const, reasons: ['malformed_or_wrong_resource_quote'] })) }
  return result.map(row => {
    const accepts = challenge.accepts.filter(term => term.network === row.network)
    if (!accepts.length) return { ...row, status: 'not_offered' as const, reasons: ['network_not_offered'] }
    if (accepts.length !== 1) return { ...row, status: 'invalid_quote' as const, reasons: ['ambiguous_network_quotes'] }
    const term = accepts[0], definition = usdcNetwork(row.network), reasons: string[] = []
    if (term.scheme !== 'exact') reasons.push('unexpected_scheme')
    if (term.amount !== offer.amount) reasons.push('unexpected_price')
    if (typeof term.asset !== 'string' || term.asset.toLowerCase() !== definition.asset.toLowerCase()) reasons.push('wrong_native_usdc_asset')
    if (typeof term.payTo !== 'string' || term.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()) reasons.push('wrong_payee')
    if (!Number.isSafeInteger(term.maxTimeoutSeconds) || term.maxTimeoutSeconds <= 0) reasons.push('invalid_authorization_timeout')
    if (term.extra?.name !== definition.domain.name || term.extra?.version !== definition.domain.version) reasons.push('wrong_eip712_domain')
    return { ...row, status: reasons.length ? 'invalid_quote' as const : 'valid_quote' as const, reasons }
  })
}

export type ProductSettlementObservation = { available: boolean; observedAt: string | null;
  priceMatchingTransfers: number | null; externalIncludingAssisted: number | null; operatorTransfers: number | null }

export async function observeProduct(offer: X402Offer, index: IndexSnapshot, response: Response | null, usage?: UsageSnapshot,
  settlements?: ProductSettlementObservation) {
  const resource = `https://www.mahastrategies.com${offer.path}`, observed = index.resources.includes(resource)
  const listing = observed ? 'observed' : !index.complete || !index.available ? 'unknown'
    : INTENTIONALLY_UNINDEXED_OFFERS.has(offer.id) ? 'not_requested' : 'not_observed'
  const meter = usage?.available ? usage.products[offer.id] : undefined
  const coverage = usage?.available ? usage.coverage[offer.id] : undefined
  const hasRecords = !!coverage?.hasInvocationRecords
  return { offerId: offer.id, resource, listing: { state: listing, catalogueComplete: index.complete, observedAt: index.checkedAt },
    payability: { networks: await inspectLiveQuote(offer, response), paymentsMade: 0, settlementTestPerformed: false },
    settlement: { state: settlements?.available ? 'amount_attributed_transfers' : 'unknown',
      observedAt: settlements?.observedAt ?? null,
      priceMatchingTransfers: settlements?.available ? settlements.priceMatchingTransfers : null,
      externalIncludingAssisted: settlements?.available ? settlements.externalIncludingAssisted : null,
      operatorTransfers: settlements?.available ? settlements.operatorTransfers : null,
      routeOrPurchaseProven: false },
    delivery: { state: !meter || coverage?.invocationSource === 'unavailable' ? 'unknown' : hasRecords ? 'server_responses_recorded' : 'not_recorded',
      successfulResponses: hasRecords && meter ? meter.successfulCalls : null,
      unsuccessfulResponses: hasRecords && meter ? meter.unsuccessfulCalls : null,
      declaredOperatorResponses: hasRecords && meter && coverage?.invocationSource !== 'compiler_meter' ? meter.declaredOperatorCalls : null,
      lastResponseAt: coverage?.lastInvocationAt ?? null, buyerReceiptProven: false },
    automaticRefreshPayments: false, independentCustomerDemandEstablished: false }
}
