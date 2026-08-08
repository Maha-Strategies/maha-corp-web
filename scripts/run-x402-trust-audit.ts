import { createPublicClient, formatUnits, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import {
  createPaidFetch,
  decodeChallenge,
  PAYMENT_REQUIRED_HEADER,
  type PaymentRequirement,
  type TypedDataRequest,
} from '../lib/x402/client.ts'

const SUBJECT = 'https://www.mahastrategies.com/api/v1/compress'
const ORIGIN = 'https://x402.fuchss.app'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const EXPECTED_PAYEE = '0xbBECBE90F28632a9d52ed67b33b43767b8c89285'
const MAX_TOTAL_BASE_UNITS = 30_000n

type Product = {
  name: string
  url: string
  amount: bigint
  body: Record<string, unknown>
}

const products: Product[] = [
  {
    name: 'trust-score',
    url: `${ORIGIN}/v1/x402-trust`,
    amount: 5_000n,
    body: { resource: SUBJECT },
  },
  {
    name: 'better-alternatives',
    url: `${ORIGIN}/v1/similar`,
    amount: 5_000n,
    body: { resource: SUBJECT, limit: 5, minScoreDelta: 5 },
  },
  {
    name: 'observation-history',
    url: `${ORIGIN}/v1/x402-history`,
    amount: 20_000n,
    body: { resource: SUBJECT, days: 30 },
  },
]

function assertRequirement(product: Product, requirement: PaymentRequirement) {
  const failures: string[] = []
  if (requirement.scheme !== 'exact') failures.push(`scheme=${requirement.scheme}`)
  if (requirement.network !== 'eip155:8453') failures.push(`network=${requirement.network}`)
  if (BigInt(requirement.amount) !== product.amount) failures.push(`amount=${requirement.amount}`)
  if (requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()) failures.push(`asset=${requirement.asset}`)
  if (requirement.payTo.toLowerCase() !== EXPECTED_PAYEE.toLowerCase()) failures.push(`payTo=${requirement.payTo}`)
  if (requirement.extra?.name !== 'USD Coin') failures.push(`tokenName=${requirement.extra?.name ?? 'missing'}`)
  if (requirement.extra?.version !== '2') failures.push(`tokenVersion=${requirement.extra?.version ?? 'missing'}`)
  if (!Number.isFinite(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds <= 0 || requirement.maxTimeoutSeconds > 300) {
    failures.push(`maxTimeoutSeconds=${requirement.maxTimeoutSeconds}`)
  }
  if (failures.length > 0) throw new Error(`${product.name}: refused unexpected payment terms: ${failures.join(', ')}`)
}

async function preflight(product: Product) {
  const response = await fetch(product.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product.body),
  })
  if (response.status !== 402) {
    const body = await response.text()
    throw new Error(`${product.name}: expected HTTP 402, received ${response.status}: ${body.slice(0, 500)}`)
  }
  const challenge = decodeChallenge(response.headers.get(PAYMENT_REQUIRED_HEADER))
  const requirement = challenge.accepts.find((item) => item.network === 'eip155:8453' && item.scheme === 'exact')
  if (!requirement) throw new Error(`${product.name}: no exact Base Mainnet requirement was offered.`)
  assertRequirement(product, requirement)

  const declaredUrl = new URL(challenge.resource.url)
  const expectedUrl = new URL(product.url)
  if (declaredUrl.origin !== expectedUrl.origin || declaredUrl.pathname !== expectedUrl.pathname) {
    throw new Error(`${product.name}: challenge resource does not match the requested product.`)
  }
  return requirement
}

const pay = process.argv.includes('--pay')
const quotedTotal = products.reduce((sum, product) => sum + product.amount, 0n)
if (quotedTotal > MAX_TOTAL_BASE_UNITS) throw new Error('Configured products exceed the hard $0.030 spending ceiling.')

console.log('Maha x402 Trust audit')
console.log(`Subject: ${SUBJECT}`)
console.log(`Mode: ${pay ? 'PAY - three bounded settlements authorized' : 'DRY RUN - no signatures or payments'}`)
console.log(`Hard ceiling: ${formatUnits(MAX_TOTAL_BASE_UNITS, 6)} USDC on Base Mainnet\n`)

console.log('Preflighting all three payment declarations...')
for (const product of products) {
  const requirement = await preflight(product)
  console.log(`  PASS ${product.name}: ${formatUnits(BigInt(requirement.amount), 6)} USDC -> ${requirement.payTo}`)
}

if (!pay) {
  console.log('\nDry run complete. Add --pay to execute exactly these three validated purchases.')
  process.exit(0)
}

const privateKey = (process.env.TEST_BUYER_PRIVATE_KEY ?? process.env.X402_BUYER_PRIVATE_KEY)?.trim() as `0x${string}` | undefined
if (!privateKey) throw new Error('Set TEST_BUYER_PRIVATE_KEY (or X402_BUYER_PRIVATE_KEY) in this terminal. Never paste the key into chat or commit it.')

const account = privateKeyToAccount(privateKey)
const publicClient = createPublicClient({ chain: base, transport: http() })
const balance = await publicClient.readContract({
  address: BASE_USDC,
  abi: [{
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  }],
  functionName: 'balanceOf',
  args: [account.address],
})

console.log(`\nBuyer: ${account.address}`)
console.log(`Base USDC balance: ${formatUnits(balance, 6)} USDC`)
if (balance < MAX_TOTAL_BASE_UNITS) throw new Error(`Insufficient Base USDC: need at least ${formatUnits(MAX_TOTAL_BASE_UNITS, 6)} USDC.`)

let currentProduct: Product | undefined
let settledTotal = 0n
const paidFetch = createPaidFetch({
  address: account.address,
  chainId: base.id,
  signTypedData: async (request: TypedDataRequest) => account.signTypedData({
    domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` },
    types: request.types,
    primaryType: request.primaryType,
    message: {
      ...request.message,
      from: request.message.from as `0x${string}`,
      to: request.message.to as `0x${string}`,
      nonce: request.message.nonce as `0x${string}`,
    },
  }),
  onPaymentRequired: (requirement) => {
    if (!currentProduct) throw new Error('Internal guard: no active product.')
    assertRequirement(currentProduct, requirement)
    if (settledTotal + BigInt(requirement.amount) > MAX_TOTAL_BASE_UNITS) {
      throw new Error('Refused payment because it would exceed the aggregate $0.030 ceiling.')
    }
  },
})

const results: Array<Record<string, unknown>> = []
for (const product of products) {
  currentProduct = product
  console.log(`\nPurchasing ${product.name} for ${formatUnits(product.amount, 6)} USDC...`)
  const response = await paidFetch(product.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product.body),
  })
  const receipt = response.x402?.receipt
  if (!receipt?.success || !receipt.transaction) {
    throw new Error(`${product.name}: response omitted a successful settlement receipt; stopping before another purchase.`)
  }
  settledTotal += product.amount
  const body = await response.json()
  const result = {
    product: product.name,
    priceUsdc: formatUnits(product.amount, 6),
    transaction: receipt.transaction,
    response: body,
  }
  results.push(result)
  console.log(JSON.stringify(result, null, 2))
}

console.log('\n=== COMPLETE AUDIT RESULTS ===')
console.log(JSON.stringify({
  subject: SUBJECT,
  buyer: account.address,
  settledTotalUsdc: formatUnits(settledTotal, 6),
  results,
}, null, 2))
