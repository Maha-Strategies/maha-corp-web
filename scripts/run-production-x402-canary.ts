import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createPublicClient, formatUnits, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { decideBazaarCanary, findContextCompiler } from '../lib/x402/bazaar-canary.ts'
import { createPaidFetch, type TypedDataRequest } from '../lib/x402/client.ts'
import {
  assertSpendPolicy,
  BASE_USDC,
  BAZAAR_MERCHANT_URL,
  EXPECTED_PRICE_BASE_UNITS,
  MAHA_CONTEXT_RESOURCE,
  MAHA_PAYEE,
  verifyPaymentReceipt,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'

const EXPECTED_BUYER = '0x7b7ff44288fADe4A1829abA2584DFCeB952146f2'
const erc20BalanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])
const outputPath = process.env.X402_CANARY_OUTPUT_PATH?.trim()

type CanaryEvidence = {
  checkedAt: string
  resource: string
  decision?: ReturnType<typeof decideBazaarCanary>
  outcome: 'skipped' | 'settled' | 'failed'
  buyer?: string
  transaction?: string
  packId?: string
  metrics?: Record<string, unknown>
  error?: string
}

async function writeEvidence(evidence: CanaryEvidence): Promise<void> {
  if (!outputPath) return
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
}

async function fetchMerchantResources(): Promise<BazaarResource[]> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  url.searchParams.set('offset', '0')
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'maha-production-x402-canary/1.0' },
  })
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`Bazaar merchant discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  if (!Array.isArray(body.resources)) throw new Error('Bazaar merchant discovery omitted its resources array.')
  return body.resources as BazaarResource[]
}

function loadBuyer() {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error('X402_BUYER_PRIVATE_KEY is missing or malformed.')
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  if (account.address.toLowerCase() !== EXPECTED_BUYER.toLowerCase()) {
    throw new Error(`Refused unexpected canary buyer ${account.address}; expected ${EXPECTED_BUYER}.`)
  }
  return account
}

async function run(): Promise<CanaryEvidence> {
  const checkedAt = new Date().toISOString()
  const resources = await fetchMerchantResources()
  const decision = decideBazaarCanary(findContextCompiler(resources), Date.now())

  console.log(`Bazaar canary decision: ${decision.reason}`)
  console.log(`Last settlement: ${decision.lastCalledAt ?? 'not present in Bazaar'}`)
  console.log(`Settlement age: ${decision.ageDays === null ? 'unknown' : `${decision.ageDays} days`}`)
  if (!decision.shouldPay) {
    console.log('No payment needed; organic or prior canary activity is still inside the 21-day window.')
    return { checkedAt, resource: MAHA_CONTEXT_RESOURCE, decision, outcome: 'skipped' }
  }
  if (!process.argv.includes('--pay-if-stale')) {
    console.log('A canary settlement is due, but --pay-if-stale was not supplied. No wallet was loaded.')
    return { checkedAt, resource: MAHA_CONTEXT_RESOURCE, decision, outcome: 'skipped' }
  }

  const account = loadBuyer()
  const rpcUrl = process.env.BASE_RPC_URL?.trim() || undefined
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await publicClient.readContract({
    address: BASE_USDC as Address,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  console.log(`Canary buyer: ${account.address}`)
  console.log(`Base USDC balance: ${formatUnits(balance, 6)} USDC`)
  if (balance < EXPECTED_PRICE_BASE_UNITS) throw new Error('The dedicated canary wallet has less than 0.001 Base USDC.')

  let challenged = false
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
    onPaymentRequired(requirement) {
      assertSpendPolicy(requirement)
      challenged = true
    },
  })

  const response = await paidFetch(MAHA_CONTEXT_RESOURCE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      clientRequestId: `bazaar_canary_${process.env.GITHUB_RUN_ID ?? crypto.randomUUID()}`,
      task: 'Retain the release condition and rollback trigger with source-linked provenance.',
      tokenBudget: 128,
      budgetMode: 'guaranteed',
      scoring: 'bm25',
      provenance: 'compact',
      documents: [
        { id: 'release', title: 'Release condition', text: 'Release after the production canary passes and the security owner approves the evidence.' },
        { id: 'rollback', title: 'Rollback trigger', text: 'Rollback if API errors exceed two percent for five minutes.' },
      ],
    }),
  })
  if (!challenged) throw new Error('The endpoint did not return the expected x402 challenge; no canary payment was authorized.')
  if (response.status !== 201) throw new Error(`Expected HTTP 201 after canary settlement; received ${response.status}.`)
  verifyPaymentReceipt(response.x402?.receipt, account.address)
  const body = await response.json() as {
    packId?: string
    metrics?: Record<string, unknown>
    includedPassages?: unknown[]
  }
  if (!body.packId?.startsWith('ctxpack_') || !Array.isArray(body.includedPassages)) {
    throw new Error('The canary settlement succeeded but the response was not a usable Context Pack.')
  }

  console.log(`Canary settled exactly ${formatUnits(EXPECTED_PRICE_BASE_UNITS, 6)} USDC.`)
  console.log(`Transaction: ${response.x402.receipt.transaction}`)
  return {
    checkedAt,
    resource: MAHA_CONTEXT_RESOURCE,
    decision,
    outcome: 'settled',
    buyer: account.address,
    transaction: response.x402.receipt.transaction,
    packId: body.packId,
    metrics: body.metrics,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run()
    .then(writeEvidence)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error)
      await writeEvidence({
        checkedAt: new Date().toISOString(),
        resource: MAHA_CONTEXT_RESOURCE,
        outcome: 'failed',
        error: message,
      })
      console.error(`Production x402 canary failed: ${message}`)
      process.exitCode = 1
    })
}
