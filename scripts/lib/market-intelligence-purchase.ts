export const MARKET_ORIGIN = 'https://x402-bazaar-rank.x402-bazaar-rank-worker.workers.dev'
export const MARKET_PAYEE = '0xECa891e34b3E5873181Fb779672564E198C55354'
export const MARKET_ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const MARKET_BUYER = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
export const MARKET_CONFIRMATION = 'BUY_MARKET_DATASET_REPORT_ONCE_0_05125_USDC'
export const MARKET_PURCHASES = [
  { id: 'dataset', url: `${MARKET_ORIGIN}/dataset`, amount: '31250' },
  { id: 'report', url: `${MARKET_ORIGIN}/report`, amount: '20000' },
] as const
export const MARKET_BATCH_CAP = 51250n
export const USER_SPEND_CAP = 1000000n

export type MarketPurchase = typeof MARKET_PURCHASES[number]
export type MarketRequirement = {
  scheme: 'exact'; network: 'base'; asset: string; payTo: string;
  resource: string; maxAmountRequired: string; maxTimeoutSeconds: number;
  extra: { name: 'USD Coin'; version: '2' }
}

const equal = (left: unknown, right: string) => typeof left === 'string' && left.toLowerCase() === right.toLowerCase()

/** Remote payment instructions are untrusted: this exact allowlist owns consent. */
export function validateMarketChallenge(body: unknown, purchase: MarketPurchase): MarketRequirement {
  const challenge = body as { x402Version?: unknown; accepts?: unknown }
  if (!challenge || challenge.x402Version !== 1 || !Array.isArray(challenge.accepts) || challenge.accepts.length !== 1) {
    throw new Error('Unexpected market payment protocol or number of offers.')
  }
  const requirement = challenge.accepts[0] as MarketRequirement
  if (!requirement || requirement.scheme !== 'exact' || requirement.network !== 'base'
    || !equal(requirement.asset, MARKET_ASSET) || !equal(requirement.payTo, MARKET_PAYEE)
    || requirement.resource !== purchase.url || requirement.maxAmountRequired !== purchase.amount
    || requirement.maxTimeoutSeconds !== 300 || requirement.extra?.name !== 'USD Coin'
    || requirement.extra?.version !== '2') throw new Error('Market quote differs from the approved contract.')
  return requirement
}

/** Standard USDC ERC-3009 authorization, pinned independently of server fields. */
export function marketTypedData(purchase: MarketPurchase, nonce: `0x${string}`, now: number) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(nonce) || !Number.isSafeInteger(now)) throw new Error('Invalid authorization nonce or time.')
  return {
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: MARKET_ASSET as `0x${string}` },
    types: { TransferWithAuthorization: [
      { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
    ] },
    primaryType: 'TransferWithAuthorization' as const,
    message: { from: MARKET_BUYER as `0x${string}`, to: MARKET_PAYEE as `0x${string}`,
      value: BigInt(purchase.amount), validAfter: BigInt(now - 600), validBefore: BigInt(now + 300), nonce },
  }
}

export function validateMarketDelivery(id: string, body: unknown): void {
  const value = body as Record<string, unknown>
  if (!value || typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt))) {
    throw new Error('Market delivery has no valid snapshot timestamp.')
  }
  if (id === 'dataset') {
    if (!Number.isSafeInteger(value.count) || (value.count as number) < 1 || !value.fields
      || !Array.isArray(value.services) || value.services.length !== value.count) {
      throw new Error('Market dataset is incomplete or has an unexpected schema.')
    }
  } else if (id === 'report') {
    if (!Number.isSafeInteger(value.catalogSize) || !Array.isArray(value.categories) || !Array.isArray(value.topServices)) {
      throw new Error('Market report has an unexpected schema.')
    }
  } else throw new Error('Unapproved product.')
}
