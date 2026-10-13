import type { X402Network } from './protocol.ts'

/** Native Circle USDC only; USDC.e and arbitrary look-alike tokens are not accepted. */
export const USDC_NETWORKS = {
  'eip155:8453': {
    name: 'Base Mainnet', chainId: 8453,
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    rpcUrl: 'https://mainnet.base.org', rpcEnvironment: 'BASE_RPC_URL',
    explorer: 'https://basescan.org/tx/', domain: { name: 'USD Coin', version: '2' },
  },
  'eip155:42161': {
    name: 'Arbitrum One', chainId: 42161,
    asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    rpcUrl: 'https://arb1.arbitrum.io/rpc', rpcEnvironment: 'ARBITRUM_RPC_URL',
    explorer: 'https://arbiscan.io/tx/', domain: { name: 'USD Coin', version: '2' },
  },
  'eip155:137': {
    name: 'Polygon PoS', chainId: 137,
    // Circle-issued native USDC, not the bridged USDC.e contract.
    asset: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    // Anonymous PublicNode and dRPC rejected bounded historical log queries.
    // This public default is best-effort; production still requires an explicit RPC.
    rpcUrl: 'https://tenderly.rpc.polygon.community', rpcEnvironment: 'POLYGON_RPC_URL',
    explorer: 'https://polygonscan.com/tx/', domain: { name: 'USD Coin', version: '2' },
  },
} as const
export type UsdcNetwork = keyof typeof USDC_NETWORKS
/** Approved public configuration, not an assertion of deployment liveness. */
export const DECLARED_PAYMENT_NETWORKS: UsdcNetwork[] = ['eip155:8453', 'eip155:42161', 'eip155:137']
export const ADDITIONAL_NETWORK_CONFIGURATION = {
  'eip155:42161': { enabled: 'X402_ARBITRUM_ENABLED', fromBlock: 'X402_ARBITRUM_FROM_BLOCK', missingSeed: 'arbitrum_start_block_required' },
  'eip155:137': { enabled: 'X402_POLYGON_ENABLED', fromBlock: 'X402_POLYGON_FROM_BLOCK', missingSeed: 'polygon_start_block_required' },
} as const
export type PaymentNetworkConfig = {
  network: X402Network; payTo: string; asset: string
  assetEip712: { name: string; version: string }; chainRpcUrl: string | null
}
export function usdcNetwork(network: string) {
  if (!Object.hasOwn(USDC_NETWORKS, network)) throw new Error('unsupported_settlement_network')
  return USDC_NETWORKS[network as UsdcNetwork]
}
export function networkRpc(network: UsdcNetwork, environment: Record<string, string | undefined> = process.env) {
  const definition = usdcNetwork(network)
  const value = environment[definition.rpcEnvironment]?.trim() || definition.rpcUrl
  if (new URL(value).protocol !== 'https:') throw new Error('settlement_rpc_must_be_https')
  return value
}
export function settlementNetworks(environment: Record<string, string | undefined> = process.env): UsdcNetwork[] {
  return ['eip155:8453', ...(Object.keys(ADDITIONAL_NETWORK_CONFIGURATION) as (keyof typeof ADDITIONAL_NETWORK_CONFIGURATION)[])
    .filter(network => environment[ADDITIONAL_NETWORK_CONFIGURATION[network].enabled] === 'true')]
}
