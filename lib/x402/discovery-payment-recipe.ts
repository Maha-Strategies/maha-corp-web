import type { PaymentRequirement } from './client.ts'
import {
  BUYER_POLICY_SCHEMA_VERSION,
  evaluatePaymentIntent,
  type BuyerPolicy,
} from './buyer-policy.ts'

export const BAZAAR_SEARCH_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/search'
export const BAZAAR_MERCHANT_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant'
export const MAHA_CONTEXT_RESOURCE = 'https://www.mahastrategies.com/api/v1/compress'
export const MAHA_PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
export const BASE_NETWORK = 'eip155:8453'
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
/**
 * Wallets this operator controls, which must never be counted as demand.
 *
 * One list, because two would drift. The bounded Bazaar canary pays from the
 * first of these and converts by construction; a settlement watch that excluded
 * a slightly different address would report our own traffic as a customer, and
 * that is the single most flattering mistake this platform could make.
 */
export const OPERATOR_WALLETS = ['0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'] as const
export const CANARY_BUYER = OPERATOR_WALLETS[0]
export const EXPECTED_PRICE_BASE_UNITS = BigInt(1_000)
export const SPEND_CEILING_BASE_UNITS = BigInt(5_000)

export const BAZAAR_DISCOVERY_QUERY =
  'compress documents to an LLM token budget while preserving source-linked citations'
/**
 * The recipe's own ceiling, which is a buyer policy rather than a site-wide
 * one: this recipe buys the $0.001 Context Compression offer and refuses
 * anything dearer.
 *
 * It therefore also filters out Deep Context Evaluation at $0.01. That is
 * correct for the recipe and a trap for anything reusing this helper to ask
 * "is offer X discoverable" -- the offer is indexed and returned at rank 1 for
 * `evidence retention`, but only once the ceiling is raised above its price.
 */
export const BAZAAR_MAX_USD_PRICE = '0.005'

/** Bazaar answers a larger `limit` with HTTP 400, not a truncated page. */
export const BAZAAR_MAX_SEARCH_LIMIT = 20

/**
 * Builds a Bazaar semantic search that actually filters.
 *
 * The `asset` parameter takes a contract address, not a symbol. Sending `usdc`
 * matched nothing and returned an empty result set -- not an error, which is
 * why it survived: an empty page from a discovery API is indistinguishable
 * from "the index has not caught up yet", and the recipe has a documented
 * merchant-lookup fallback that quietly rescued every run. The recipe kept
 * working while the filter it advertises did nothing.
 *
 * Constructed here rather than inline in the script so the parameters can be
 * asserted without a network call.
 */
export function bazaarSearchUrl(options: {
  query?: string
  maxUsdPrice?: string
  limit?: number
} = {}): URL {
  const limit = options.limit ?? BAZAAR_MAX_SEARCH_LIMIT
  // Caught locally rather than as a remote 400, because the remote failure is
  // the same shape as the asset bug -- a request that looks broader and
  // returns less.
  if (!Number.isInteger(limit) || limit < 1 || limit > BAZAAR_MAX_SEARCH_LIMIT) {
    throw new Error(`Bazaar accepts a limit from 1 through ${BAZAAR_MAX_SEARCH_LIMIT}; got ${limit}.`)
  }
  const search = new URL(BAZAAR_SEARCH_URL)
  search.searchParams.set('query', options.query ?? BAZAAR_DISCOVERY_QUERY)
  search.searchParams.set('network', BASE_NETWORK)
  search.searchParams.set('asset', BASE_USDC)
  search.searchParams.set('scheme', 'exact')
  search.searchParams.set('maxUsdPrice', options.maxUsdPrice ?? BAZAAR_MAX_USD_PRICE)
  search.searchParams.set('limit', String(limit))
  return search
}

export const MAHA_BUYER_POLICY: BuyerPolicy = {
  schemaVersion: BUYER_POLICY_SCHEMA_VERSION,
  policyId: 'maha-bazaar-recipe-policy',
  policyVersion: '2026-08-09',
  approvedSchemes: ['exact'],
  approvedResources: [MAHA_CONTEXT_RESOURCE],
  approvedPayees: [MAHA_PAYEE],
  assetRules: [{
    network: BASE_NETWORK,
    asset: BASE_USDC,
    maxAmountPerCall: SPEND_CEILING_BASE_UNITS.toString(),
    maxAmountPerTask: SPEND_CEILING_BASE_UNITS.toString(),
  }],
  requireValidatedSchema: true,
  settlement: { requirePaymentResponse: true, requireOnchainConfirmation: true },
}

export type BazaarResource = {
  resource?: string
  description?: string
  accepts?: PaymentRequirement[]
  extensions?: Record<string, unknown>
  quality?: {
    l30DaysTotalCalls?: number
    l30DaysUniquePayers?: number
    lastCalledAt?: string
  }
}

export type BazaarContract = {
  resource: string
  description: string
  requirement: PaymentRequirement
  inputExample: Record<string, unknown>
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Bazaar metadata is missing ${label}.`)
  }
  return value as Record<string, unknown>
}

function nested(root: Record<string, unknown>, path: string[]): unknown {
  let value: unknown = root
  const traversed: string[] = []
  for (const part of path) {
    value = record(value, traversed.join('.') || 'metadata')[part]
    traversed.push(part)
  }
  return value
}

export function selectMahaResource(resources: BazaarResource[]): BazaarResource | null {
  return resources.find((candidate) => candidate.resource === MAHA_CONTEXT_RESOURCE)
    ?? resources.find((candidate) => candidate.accepts?.some((requirement) => requirement.payTo.toLowerCase() === MAHA_PAYEE))
    ?? null
}

export function inspectBazaarContract(resource: BazaarResource): BazaarContract {
  if (resource.resource !== MAHA_CONTEXT_RESOURCE) throw new Error(`Unexpected Bazaar resource: ${resource.resource ?? 'missing URL'}.`)
  const requirement = resource.accepts?.find((candidate) =>
    candidate.scheme === 'exact'
    && candidate.network === BASE_NETWORK
    && candidate.asset.toLowerCase() === BASE_USDC.toLowerCase(),
  )
  if (!requirement) throw new Error('Bazaar does not advertise a compatible Base USDC exact-payment requirement.')

  assertSpendPolicy(requirement)
  const extensions = record(resource.extensions, 'extensions')
  const inputExample = record(nested(extensions, ['bazaar', 'info', 'input', 'body']), 'extensions.bazaar.info.input.body')
  const inputSchema = record(nested(extensions, ['bazaar', 'schema', 'properties', 'input', 'properties', 'body']), 'Bazaar input JSON Schema')
  const outputSchema = record(nested(extensions, ['bazaar', 'schema', 'properties', 'output', 'properties', 'example']), 'Bazaar output JSON Schema')

  const required = Array.isArray(inputSchema.required) ? inputSchema.required : []
  for (const property of required) {
    if (typeof property !== 'string' || !(property in inputExample)) {
      throw new Error(`Bazaar input example does not contain required property ${String(property)}.`)
    }
  }

  return {
    resource: resource.resource,
    description: resource.description ?? '',
    requirement,
    inputExample,
    inputSchema,
    outputSchema,
  }
}

/**
 * The wallet prompt is the last line of defence, not the first. Both the
 * catalog terms and the live 402 challenge must pass this policy independently.
 */
export function assertSpendPolicy(requirement: PaymentRequirement): void {
  const decision = evaluatePaymentIntent(MAHA_BUYER_POLICY, {
    taskId: 'catalog-inspection-0001',
    authorizationId: 'catalog-inspection-authorization-0001',
    requestedResource: MAHA_CONTEXT_RESOURCE,
    declaredResource: MAHA_CONTEXT_RESOURCE,
    requirement,
    schema: { status: 'valid' },
  })
  if (!decision.allowed) throw new Error(`${decision.code}: ${decision.message}`)
  const amount = BigInt(requirement.amount)
  if (amount !== EXPECTED_PRICE_BASE_UNITS) {
    throw new Error(`Refusing changed Maha price ${amount}; this recipe expects exactly ${EXPECTED_PRICE_BASE_UNITS} base units.`)
  }
}

export function verifyPaymentReceipt(
  receipt: { success: boolean; transaction?: string; network?: string; payer?: string } | null | undefined,
  payer: string,
): asserts receipt is { success: true; transaction: string; network: string; payer: string } {
  if (!receipt) throw new Error('The paid response omitted PAYMENT-RESPONSE.')
  if (receipt.success !== true) throw new Error('PAYMENT-RESPONSE did not report a successful settlement.')
  if (!/^0x[a-fA-F0-9]{64}$/.test(receipt.transaction ?? '')) throw new Error('PAYMENT-RESPONSE omitted a valid transaction hash.')
  if (receipt.network !== BASE_NETWORK) throw new Error(`PAYMENT-RESPONSE reported unexpected network ${receipt.network ?? 'missing'}.`)
  if (receipt.payer?.toLowerCase() !== payer.toLowerCase()) throw new Error('PAYMENT-RESPONSE payer does not match the signing wallet.')
}
