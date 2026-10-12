/** Read-only native-USDC and finalized-head preflight. No wallet signer. */
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { base, arbitrum } from 'viem/chains'
import { USDC_NETWORKS, networkRpc, type UsdcNetwork } from '../lib/x402/networks.ts'
import { MAHA_PAYEE, CANARY_BUYER } from '../lib/x402/discovery-payment-recipe.ts'
const abi = parseAbi(['function name() view returns (string)', 'function version() view returns (string)', 'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)'])
const results = []
for (const network of Object.keys(USDC_NETWORKS) as UsdcNetwork[]) {
  const definition = USDC_NETWORKS[network]
  const client = createPublicClient({ chain: network === 'eip155:8453' ? base : arbitrum, transport: http(networkRpc(network), { timeout: 15000, retryCount: 1 }) })
  const chainId = await client.getChainId()
  if (chainId !== definition.chainId) throw new Error('wrong_rpc_chain')
  const call = (functionName: 'name' | 'version' | 'decimals') => client.readContract({ address: definition.asset, abi, functionName })
  const name = await call('name'), version = await call('version'), decimals = await call('decimals')
  if (name !== definition.domain.name || version !== definition.domain.version || decimals !== 6) throw new Error('native_usdc_domain_mismatch')
  const block = await client.getBlock({ blockTag: 'finalized' })
  const payeeBalance = await client.readContract({ address: definition.asset, abi, functionName: 'balanceOf', args: [MAHA_PAYEE as `0x${string}`] })
  const buyerBalance = network === 'eip155:8453' ? await client.readContract({ address: definition.asset, abi, functionName: 'balanceOf', args: [CANARY_BUYER as `0x${string}`] }) : null
  results.push({ network, chainId, asset: definition.asset, name, version, decimals, finalizedBlock: String(block.number), blockTime: new Date(Number(block.timestamp)*1000).toISOString(), payeeBalanceUsdc: formatUnits(payeeBalance,6), indexingBalanceUsdc: buyerBalance === null ? null : formatUnits(buyerBalance,6) })
}
console.log(JSON.stringify({ observedAt: new Date().toISOString(), checks: results, payments: 0 }, null, 2))
