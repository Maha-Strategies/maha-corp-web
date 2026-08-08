import type { PaymentRequirement } from './client.ts'

export const BAZAAR_SEARCH_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/search'
export const BAZAAR_MERCHANT_URL = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant'
export const MAHA_CONTEXT_RESOURCE = 'https://www.mahastrategies.com/api/v1/compress'
export const MAHA_PAYEE = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
export const BASE_NETWORK = 'eip155:8453'
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const EXPECTED_PRICE_BASE_UNITS = BigInt(1_000)
export const SPEND_CEILING_BASE_UNITS = BigInt(5_000)

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
  let amount: bigint
  try { amount = BigInt(requirement.amount) } catch { throw new Error('The payment amount is not an integer.') }

  if (requirement.scheme !== 'exact') throw new Error(`Refusing payment scheme ${requirement.scheme}.`)
  if (requirement.network !== BASE_NETWORK) throw new Error(`Refusing payment network ${requirement.network}.`)
  if (requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()) throw new Error(`Refusing payment asset ${requirement.asset}.`)
  if (requirement.payTo.toLowerCase() !== MAHA_PAYEE) throw new Error(`Refusing unexpected payee ${requirement.payTo}.`)
  if (amount <= BigInt(0) || amount > SPEND_CEILING_BASE_UNITS) {
    throw new Error(`Refusing ${amount} USDC base units; the hard ceiling is ${SPEND_CEILING_BASE_UNITS}.`)
  }
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
