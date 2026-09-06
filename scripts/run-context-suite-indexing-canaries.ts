import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { buildContextBudgetLadder, buildEvidenceRetentionMatrix } from '../lib/x402/context-product-family.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { createPaidFetch, type PaymentChallenge, type PaymentRequirement, type TypedDataRequest } from '../lib/x402/client.ts'
import {
  BASE_NETWORK,
  BASE_USDC,
  BAZAAR_MERCHANT_URL,
  CANARY_BUYER,
  MAHA_PAYEE,
  verifyPaymentReceipt,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'

const CONFIRMATION = 'PUBLISHER_FUNDED_INDEX_CONTEXT_LADDER_AND_MATRIX_MAX_0_055_USDC'
const MAX_TOTAL_AMOUNT = BigInt(55_000)
const outputPath = process.env.CONTEXT_SUITE_INDEXING_OUTPUT_PATH?.trim()
const erc20BalanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

export const CONTEXT_SUITE_INDEXING_TARGETS = [
  {
    offerId: 'context-budget-ladder',
    resource: 'https://www.mahastrategies.com/api/v1/context/budget-ladder',
    amount: '5000',
    buildExpected: buildContextBudgetLadder,
  },
  {
    offerId: 'evidence-retention-matrix',
    resource: 'https://www.mahastrategies.com/api/v1/context/evidence-matrix',
    amount: '50000',
    buildExpected: buildEvidenceRetentionMatrix,
  },
] as const

type Target = (typeof CONTEXT_SUITE_INDEXING_TARGETS)[number]
type StepEvidence = {
  offerId: string
  resource: string
  classification: 'publisher-funded-indexing-canary'
  amountBaseUnits: string
  customerDemand: false
  revenueTraction: false
  organicTraffic: false
  inputDigest?: string
  responseSha256?: string
  receiptDigest?: string
  paymentReceiptReported?: boolean
  transaction?: string
  blockNumber?: number
  bazaarIndexed?: boolean
  outcome: 'pending' | 'settled_and_indexed' | 'failed'
  failure?: string
}

type Evidence = {
  schemaVersion: 'maha-context-suite-indexing-canary/0.1'
  authorization: typeof CONFIRMATION
  maximumAuthorizedBaseUnits: '55000'
  actualSettledBaseUnits: string
  buyer: string
  payee: string
  network: string
  asset: string
  startedAt: string
  completedAt?: string
  outcome: 'running' | 'complete' | 'stopped_after_first' | 'failed_before_settlement'
  classification: 'publisher-funded discovery seeding; not customers, revenue traction, or organic demand'
  steps: StepEvidence[]
}

const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assertRequirement(requirement: PaymentRequirement, target: Target): void {
  if (requirement.scheme !== 'exact') throw new Error('Live challenge scheme is not exact.')
  if (requirement.network !== BASE_NETWORK) throw new Error(`Live challenge network changed to ${requirement.network}.`)
  if (requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()) throw new Error('Live challenge asset changed.')
  if (requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()) throw new Error('Live challenge payee changed.')
  if (requirement.amount !== target.amount) throw new Error(`Live challenge amount changed to ${requirement.amount}.`)
}

export function isContextSuiteTargetIndexed(resources: BazaarResource[], target: Target): boolean {
  return resources.some((candidate) => {
    if (candidate.resource !== target.resource) return false
    const requirement = candidate.accepts?.find((item) => item.scheme === 'exact' && item.network === BASE_NETWORK)
    return requirement?.amount === target.amount
      && requirement.payTo.toLowerCase() === MAHA_PAYEE.toLowerCase()
      && requirement.asset.toLowerCase() === BASE_USDC.toLowerCase()
      && Boolean(candidate.extensions?.bazaar)
  })
}

async function merchantResources(): Promise<BazaarResource[]> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'maha-context-suite-indexing-canary/0.1' } })
  if (!response.ok) throw new Error(`Bazaar merchant discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  if (!Array.isArray(body.resources)) throw new Error('Bazaar merchant discovery omitted resources.')
  return body.resources as BazaarResource[]
}

async function searchResources(target: Target): Promise<BazaarResource[]> {
  const url = new URL('https://api.cdp.coinbase.com/platform/v2/x402/discovery/search')
  url.searchParams.set('query', `${target.offerId} context evidence`)
  url.searchParams.set('network', BASE_NETWORK)
  url.searchParams.set('asset', BASE_USDC)
  url.searchParams.set('scheme', 'exact')
  url.searchParams.set('maxUsdPrice', '0.06')
  url.searchParams.set('limit', '20')
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'maha-context-suite-indexing-canary/0.1' } })
  if (!response.ok) throw new Error(`Bazaar semantic discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  if (!Array.isArray(body.resources)) throw new Error('Bazaar semantic discovery omitted resources.')
  return body.resources as BazaarResource[]
}

async function waitForBazaar(target: Target): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (isContextSuiteTargetIndexed(await searchResources(target), target)) return true
    if (isContextSuiteTargetIndexed(await merchantResources(), target)) return true
    if (attempt < 29) await delay(10_000)
  }
  return false
}

async function preflight(target: Target): Promise<{ input: unknown; requirement: PaymentRequirement }> {
  const response = await fetch(target.resource, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: '{}',
  })
  if (response.status !== 402) throw new Error(`Expected unpaid HTTP 402 for ${target.offerId}; received ${response.status}.`)
  const challenge = await response.json() as PaymentChallenge
  if (challenge.resource?.url !== target.resource) throw new Error('Live challenge resource differs from the authorized route.')
  if (challenge.accepts.length !== 1) throw new Error(`Expected exactly one payment requirement; received ${challenge.accepts.length}.`)
  const requirement = challenge.accepts[0]!
  assertRequirement(requirement, target)
  const bazaar = challenge.extensions?.bazaar as { info?: { input?: { body?: unknown } } } | undefined
  const input = bazaar?.info?.input?.body
  if (!input || typeof input !== 'object') throw new Error('Live challenge omitted its published input example.')
  target.buildExpected(input)
  return { input, requirement }
}

function loadBuyer() {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('X402_BUYER_PRIVATE_KEY is missing or malformed.')
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) {
    throw new Error(`Refused unexpected buyer ${account.address}; expected ${CANARY_BUYER}.`)
  }
  return account
}

async function writeEvidence(evidence: Evidence): Promise<void> {
  if (!outputPath) return
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
}

async function requireBalance(account: ReturnType<typeof loadBuyer>, amount: bigint): Promise<void> {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL?.trim() || undefined) })
  const balance = await client.readContract({
    address: BASE_USDC as Address,
    abi: erc20BalanceAbi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (balance < amount) throw new Error(`Dedicated buyer balance is below the remaining authorized amount of ${amount} base units.`)
}

async function purchase(
  target: Target,
  input: unknown,
  account: ReturnType<typeof loadBuyer>,
  evidence: Evidence,
): Promise<void> {
  const step = evidence.steps.find((candidate) => candidate.offerId === target.offerId)!
  if (isContextSuiteTargetIndexed(await merchantResources(), target)) {
    throw new Error(`${target.offerId} is already indexed; refusing an unnecessary payment.`)
  }
  let challengeCount = 0
  let signatureCount = 0
  const paidFetch = createPaidFetch({
    address: account.address,
    chainId: base.id,
    async signTypedData(request: TypedDataRequest) {
      signatureCount += 1
      if (signatureCount !== 1) throw new Error(`Refused a second signature for ${target.offerId}.`)
      return account.signTypedData({
        domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` },
        types: request.types,
        primaryType: request.primaryType,
        message: {
          ...request.message,
          from: request.message.from as `0x${string}`,
          to: request.message.to as `0x${string}`,
          nonce: request.message.nonce as `0x${string}`,
        },
      })
    },
    onPaymentRequired(requirement, context) {
      challengeCount += 1
      if (challengeCount !== 1) throw new Error(`Refused a second challenge for ${target.offerId}.`)
      if (context.challenge.resource.url !== target.resource) throw new Error('Paid challenge resource differs from the authorized route.')
      assertRequirement(requirement, target)
    },
  })

  step.inputDigest = `sha256:${sha256(canonicalJson(input))}`
  const response = await paidFetch(target.resource, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-maha-discovery-source': 'publisher-funded-indexing-canary' },
    body: JSON.stringify(input),
  })
  if (challengeCount !== 1 || signatureCount !== 1) throw new Error('The purchase did not follow the one-challenge, one-signature path.')
  if (response.status !== 201) throw new Error(`Expected HTTP 201 after settlement; received ${response.status}.`)
  verifyPaymentReceipt(response.x402?.receipt, account.address)
  const receipt = response.x402!.receipt!
  step.paymentReceiptReported = true
  step.transaction = receipt.transaction
  await writeEvidence(evidence)

  const exactBytes = new Uint8Array(await response.arrayBuffer())
  step.responseSha256 = sha256(exactBytes)
  let received: unknown
  try { received = JSON.parse(new TextDecoder().decode(exactBytes)) } catch { throw new Error('Paid response was not valid JSON.') }
  const expected = target.buildExpected(input)
  if (canonicalJson(received) !== canonicalJson(expected)) throw new Error('Paid response did not match the deterministic local reconstruction.')
  step.receiptDigest = expected.receiptDigest

  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('No Base RPC URL is available.')
  const chain = await confirmSettlement({
    rpcUrl,
    caip2Network: BASE_NETWORK,
    transaction: receipt.transaction,
    asset: BASE_USDC,
    payer: account.address,
    payTo: MAHA_PAYEE,
    minAmount: target.amount,
    attempts: 18,
    retryDelayMs: 2_500,
    requestTimeoutMs: 4_000,
  })
  if (chain.status !== 'confirmed' || chain.amount !== target.amount) {
    throw new Error(`Settlement was not confirmed exactly: ${chain.status}${'reason' in chain ? `/${chain.reason}` : `/${chain.amount}`}.`)
  }
  step.transaction = chain.transaction
  step.blockNumber = chain.blockNumber
  evidence.actualSettledBaseUnits = String(BigInt(evidence.actualSettledBaseUnits) + BigInt(target.amount))
  await writeEvidence(evidence)

  step.bazaarIndexed = await waitForBazaar(target)
  if (!step.bazaarIndexed) throw new Error('Bazaar did not expose the exact route within the five-minute observation window.')
  step.outcome = 'settled_and_indexed'
  await writeEvidence(evidence)
}

async function run(): Promise<void> {
  if (process.env.CONTEXT_SUITE_INDEXING_CONFIRMATION !== CONFIRMATION) {
    throw new Error(`Set CONTEXT_SUITE_INDEXING_CONFIRMATION exactly to ${CONFIRMATION}.`)
  }
  const preflights = []
  for (const target of CONTEXT_SUITE_INDEXING_TARGETS) preflights.push(await preflight(target))
  const account = loadBuyer()
  await requireBalance(account, MAX_TOTAL_AMOUNT)
  const evidence: Evidence = {
    schemaVersion: 'maha-context-suite-indexing-canary/0.1',
    authorization: CONFIRMATION,
    maximumAuthorizedBaseUnits: '55000',
    actualSettledBaseUnits: '0',
    buyer: account.address,
    payee: MAHA_PAYEE,
    network: BASE_NETWORK,
    asset: BASE_USDC,
    startedAt: new Date().toISOString(),
    outcome: 'running',
    classification: 'publisher-funded discovery seeding; not customers, revenue traction, or organic demand',
    steps: CONTEXT_SUITE_INDEXING_TARGETS.map((target) => ({
      offerId: target.offerId,
      resource: target.resource,
      classification: 'publisher-funded-indexing-canary',
      amountBaseUnits: target.amount,
      customerDemand: false,
      revenueTraction: false,
      organicTraffic: false,
      outcome: 'pending',
    })),
  }
  await writeEvidence(evidence)

  for (let index = 0; index < CONTEXT_SUITE_INDEXING_TARGETS.length; index += 1) {
    const target = CONTEXT_SUITE_INDEXING_TARGETS[index]!
    try {
      const remaining = CONTEXT_SUITE_INDEXING_TARGETS.slice(index).reduce((sum, item) => sum + BigInt(item.amount), BigInt(0))
      await requireBalance(account, remaining)
      await purchase(target, preflights[index]!.input, account, evidence)
    } catch (error) {
      const step = evidence.steps[index]!
      step.outcome = 'failed'
      step.failure = error instanceof Error ? error.message : String(error)
      evidence.outcome = BigInt(evidence.actualSettledBaseUnits) === BigInt(0) && !step.paymentReceiptReported
        ? 'failed_before_settlement'
        : 'stopped_after_first'
      evidence.completedAt = new Date().toISOString()
      await writeEvidence(evidence)
      throw error
    }
  }
  if (BigInt(evidence.actualSettledBaseUnits) > MAX_TOTAL_AMOUNT) throw new Error('Settled amount exceeded the authorized maximum.')
  evidence.outcome = 'complete'
  evidence.completedAt = new Date().toISOString()
  await writeEvidence(evidence)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`Context-suite indexing canary stopped: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
