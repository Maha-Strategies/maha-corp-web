import { pathToFileURL } from 'node:url'

import { createPublicClient, formatUnits, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  BASE_NETWORK,
  BASE_USDC,
  BAZAAR_MERCHANT_URL,
  BAZAAR_SEARCH_URL,
  EXPECTED_PRICE_BASE_UNITS,
  MAHA_CONTEXT_RESOURCE,
  MAHA_PAYEE,
  SPEND_CEILING_BASE_UNITS,
  assertSpendPolicy,
  inspectBazaarContract,
  selectMahaResource,
  verifyPaymentReceipt,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'
import { createPaidFetch, type TypedDataRequest } from '../lib/x402/client.ts'

type WalletMode = 'viem' | 'cdp'
type RecipeWallet = {
  address: string
  signTypedData: (request: TypedDataRequest) => Promise<string>
}

type ContextPack = {
  packId: string
  task: string
  context: string
  metrics: {
    originalEstimatedTokens: number
    compiledEstimatedTokens: number
    estimatedReductionPercent: number
    sourceCoveragePercent: number
  }
  includedPassages: Array<{ sourceId: string; passageId: string; passageHash: string; text: string }>
  warnings: string[]
}

const query = 'compress documents to an LLM token budget while preserving source-linked citations'
const erc20BalanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

function parseArgs(argv: string[]): { pay: boolean; wallet: WalletMode } {
  const walletArgument = argv.find((argument) => argument.startsWith('--wallet='))?.slice('--wallet='.length) ?? 'viem'
  if (walletArgument !== 'viem' && walletArgument !== 'cdp') throw new Error('--wallet must be viem or cdp.')
  return { pay: argv.includes('--pay'), wallet: walletArgument }
}

async function getJson(url: URL): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'maha-discovery-payment-recipe/1.0' } })
  if (!response.ok) throw new Error(`Bazaar returned HTTP ${response.status} for ${url.pathname}.`)
  return await response.json() as Record<string, unknown>
}

async function discover(): Promise<{ resource: BazaarResource; method: string }> {
  const search = new URL(BAZAAR_SEARCH_URL)
  search.searchParams.set('query', query)
  search.searchParams.set('network', BASE_NETWORK)
  search.searchParams.set('asset', 'usdc')
  search.searchParams.set('scheme', 'exact')
  search.searchParams.set('maxUsdPrice', '0.005')
  search.searchParams.set('limit', '20')
  const searched = await getJson(search)
  const semanticResources = Array.isArray(searched.resources) ? searched.resources as BazaarResource[] : []
  const semanticMatch = selectMahaResource(semanticResources)
  if (semanticMatch) return { resource: semanticMatch, method: `semantic ${String(searched.searchMethod ?? 'search')}` }

  // Search indexing is asynchronous. Merchant discovery is the documented,
  // exact Bazaar fallback and still returns the indexed schemas and terms.
  const merchant = new URL(BAZAAR_MERCHANT_URL)
  merchant.searchParams.set('payTo', MAHA_PAYEE)
  merchant.searchParams.set('limit', '100')
  const lookedUp = await getJson(merchant)
  const merchantResources = Array.isArray(lookedUp.resources) ? lookedUp.resources as BazaarResource[] : []
  const merchantMatch = selectMahaResource(merchantResources)
  if (!merchantMatch) throw new Error('Maha Context Compiler was not found in Bazaar search or merchant discovery.')
  return { resource: merchantMatch, method: 'semantic search → merchant-index fallback' }
}

async function loadWallet(mode: WalletMode): Promise<RecipeWallet> {
  if (mode === 'viem') {
    const privateKey = process.env.X402_BUYER_PRIVATE_KEY
    if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      throw new Error('Set X402_BUYER_PRIVATE_KEY to a dedicated Base wallet private key.')
    }
    const account = privateKeyToAccount(privateKey as `0x${string}`)
    return {
      address: account.address,
      signTypedData: (request) => account.signTypedData(request as Parameters<typeof account.signTypedData>[0]),
    }
  }

  const accountName = process.env.CDP_ACCOUNT_NAME
  if (!accountName) throw new Error('Set CDP_ACCOUNT_NAME to the funded CDP Server Wallet account name.')
  const { CdpClient } = await import('@coinbase/cdp-sdk')
  const cdp = new CdpClient()
  const account = await cdp.evm.getOrCreateAccount({ name: accountName })
  return {
    address: account.address,
    signTypedData: (request) => account.signTypedData(request as Parameters<typeof account.signTypedData>[0]),
  }
}

async function requireFundedBaseUsdcWallet(wallet: RecipeWallet): Promise<void> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL),
  })
  let balance: bigint
  try {
    balance = await publicClient.readContract({
      address: BASE_USDC as Address,
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [wallet.address as Address],
    })
  } catch (error) {
    throw new Error(`Could not verify Base USDC balance for ${wallet.address}. Set BASE_RPC_URL to a working Base Mainnet RPC and retry.`, { cause: error })
  }

  console.log(`   wallet=${wallet.address}`)
  console.log(`   Base USDC balance=${formatUnits(balance, 6)} USDC`)
  if (balance < EXPECTED_PRICE_BASE_UNITS) {
    throw new Error(`Wallet ${wallet.address} has insufficient Base USDC. Fund this CDP account with at least 0.001 USDC, then retry.`)
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  console.log('\nMaha Bazaar discovery-to-payment recipe')
  console.log('1. Searching Bazaar with maxUsdPrice=0.005…')
  const discovered = await discover()
  const contract = inspectBazaarContract(discovered.resource)
  console.log(`   Found via ${discovered.method}: ${contract.resource}`)

  const inputProperties = Object.keys((contract.inputSchema.properties ?? {}) as Record<string, unknown>)
  const outputProperties = Object.keys((contract.outputSchema.properties ?? {}) as Record<string, unknown>)
  console.log('2. Inspected Bazaar JSON Schema')
  console.log(`   Required input: ${(contract.inputSchema.required as string[]).join(', ')}`)
  console.log(`   Input fields: ${inputProperties.join(', ')}`)
  console.log(`   Output fields: ${outputProperties.join(', ')}`)

  console.log('3. Enforced policy before signing')
  console.log(`   price=${contract.requirement.amount} base units (${Number(EXPECTED_PRICE_BASE_UNITS) / 1_000_000} USDC)`)
  console.log(`   ceiling=${SPEND_CEILING_BASE_UNITS} base units ($0.005), network=${BASE_NETWORK}, asset=${BASE_USDC}`)
  console.log(`   payee=${MAHA_PAYEE}`)
  if (!args.pay) {
    console.log('\nDry run complete. No wallet loaded and no payment made.')
    console.log('Add --pay --wallet=viem or --pay --wallet=cdp to execute one bounded purchase.\n')
    return
  }

  const wallet = await loadWallet(args.wallet)
  await requireFundedBaseUsdcWallet(wallet)
  const body = { ...contract.inputExample, clientRequestId: `bazaar_recipe_${crypto.randomUUID()}` }
  let challenged = false
  const paidFetch = createPaidFetch({
    address: wallet.address,
    chainId: 8453,
    signTypedData: wallet.signTypedData,
    onPaymentRequired(requirement) {
      // Re-check the live 402 independently of the catalog result. No wallet
      // signature is produced if any term drifted since discovery.
      assertSpendPolicy(requirement)
      challenged = true
      console.log(`4. Live challenge accepted; signing exactly ${requirement.amount} base units with ${args.wallet}.`)
    },
  })

  const response = await paidFetch(MAHA_CONTEXT_RESOURCE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!challenged) throw new Error('The endpoint did not return the expected x402 payment challenge.')
  if (response.status !== 201) throw new Error(`Expected HTTP 201 after settlement; received ${response.status}.`)
  verifyPaymentReceipt(response.x402?.receipt, wallet.address)
  console.log('5. Verified PAYMENT-RESPONSE')
  console.log(`   payer=${response.x402.receipt.payer}`)
  console.log(`   transaction=https://basescan.org/tx/${response.x402.receipt.transaction}`)

  const pack = await response.json() as ContextPack
  if (!pack.packId?.startsWith('ctxpack_') || !pack.context || !Array.isArray(pack.includedPassages)) {
    throw new Error('The paid response was not a usable Context Pack.')
  }
  const downstreamMessage = `Use only the source-linked Context Pack below to answer this task. Preserve passage citations.\n\nTask: ${pack.task}\n\n${pack.context}`
  console.log('6. Context Pack ready for the downstream model')
  console.log(`   pack=${pack.packId}`)
  console.log(`   reduction=${pack.metrics.estimatedReductionPercent}% sourceCoverage=${pack.metrics.sourceCoveragePercent}% passages=${pack.includedPassages.length}`)
  console.log(`\nDownstream prompt preview:\n${downstreamMessage.slice(0, 700)}${downstreamMessage.length > 700 ? '\n…' : ''}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`\nRecipe failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
