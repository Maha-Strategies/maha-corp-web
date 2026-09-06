import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { buildBookSectionReceipt, bookSectionDiscovery, type MachineBookId } from '../lib/x402/book-section-product.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { createPaidFetch, type PaymentRequirement, type TypedDataRequest } from '../lib/x402/client.ts'
import {
  BASE_NETWORK,
  BASE_USDC,
  BAZAAR_MERCHANT_URL,
  CANARY_BUYER,
  MAHA_PAYEE,
  verifyPaymentReceipt,
  type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'

const CONFIRMATION = 'PUBLISHER_FUNDED_INDEX_TWO_BOOK_SECTIONS_MAX_0_010_USDC'
const EXPECTED_AMOUNT = '5000'
const MAX_TOTAL_AMOUNT = BigInt(10_000)
const outputPath = process.env.BOOK_INDEXING_CANARY_OUTPUT_PATH?.trim()
const erc20BalanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

export const BOOK_INDEXING_TARGETS = [
  {
    bookId: 'the-imagined-life',
    resource: 'https://www.mahastrategies.com/api/v1/books/the-imagined-life/section',
    offerId: 'book-section-the-imagined-life',
  },
  {
    bookId: 'the-volcanic-engine',
    resource: 'https://www.mahastrategies.com/api/v1/books/the-volcanic-engine/section',
    offerId: 'book-section-the-volcanic-engine',
  },
] as const satisfies ReadonlyArray<{ bookId: MachineBookId; resource: string; offerId: string }>

type Target = (typeof BOOK_INDEXING_TARGETS)[number]
type StepEvidence = {
  offerId: string
  resource: string
  classification: 'publisher-funded-indexing-canary'
  amountBaseUnits: '5000'
  customerDemand: false
  revenueTraction: false
  organicTraffic: false
  responseSha256?: string
  contentSha256?: string
  receiptSha256?: string
  paymentReceiptReported?: boolean
  transaction?: string
  blockNumber?: number
  bazaarIndexed?: boolean
  outcome: 'pending' | 'settled_and_indexed' | 'failed'
  failure?: string
}

type Evidence = {
  schemaVersion: 'maha-book-section-indexing-canary/0.1'
  authorization: typeof CONFIRMATION
  maximumAuthorizedBaseUnits: '10000'
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

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assertRequirement(requirement: PaymentRequirement, target: Target): void {
  if (requirement.scheme !== 'exact') throw new Error('Live challenge scheme is not exact.')
  if (requirement.network !== BASE_NETWORK) throw new Error(`Live challenge network changed to ${requirement.network}.`)
  if (requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()) throw new Error('Live challenge asset changed.')
  if (requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()) throw new Error('Live challenge payee changed.')
  if (requirement.amount !== EXPECTED_AMOUNT) throw new Error(`Live challenge amount changed to ${requirement.amount}.`)
  if (!target.resource.startsWith('https://www.mahastrategies.com/api/v1/books/')) throw new Error('Target escaped the book route boundary.')
}

async function merchantResources(): Promise<BazaarResource[]> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'maha-book-section-indexing-canary/0.1' } })
  if (!response.ok) throw new Error(`Bazaar merchant discovery returned HTTP ${response.status}.`)
  const body = await response.json() as { resources?: unknown }
  if (!Array.isArray(body.resources)) throw new Error('Bazaar merchant discovery omitted resources.')
  return body.resources as BazaarResource[]
}

export function isTargetIndexed(resources: BazaarResource[], target: Target): boolean {
  return resources.some((candidate) => {
    if (candidate.resource !== target.resource) return false
    const requirement = candidate.accepts?.find((item) => item.scheme === 'exact' && item.network === BASE_NETWORK)
    const bazaar = candidate.extensions?.bazaar
    return requirement?.amount === EXPECTED_AMOUNT
      && requirement.payTo.toLowerCase() === MAHA_PAYEE.toLowerCase()
      && requirement.asset.toLowerCase() === BASE_USDC.toLowerCase()
      && Boolean(bazaar && typeof bazaar === 'object')
  })
}

async function waitForBazaar(target: Target): Promise<boolean> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (isTargetIndexed(await merchantResources(), target)) return true
    if (attempt < 29) await delay(10_000)
  }
  return false
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

async function purchase(target: Target, account: ReturnType<typeof loadBuyer>, evidence: Evidence): Promise<void> {
  const step = evidence.steps.find((candidate) => candidate.offerId === target.offerId)!
  const discovery = bookSectionDiscovery(target.bookId)
  let challengeCount = 0
  let signatureCount = 0
  let requirementSeen: PaymentRequirement | null = null
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
      if (context.challenge.resource.url !== target.resource) throw new Error('Live challenge resource differs from the authorized route.')
      assertRequirement(requirement, target)
      requirementSeen = requirement
    },
  })

  const response = await paidFetch(target.resource, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-maha-discovery-source': 'publisher-funded-indexing-canary' },
    body: JSON.stringify(discovery.input),
  })
  if (challengeCount !== 1 || signatureCount !== 1 || !requirementSeen) throw new Error('The purchase did not follow the one-challenge, one-signature path.')
  if (response.status !== 200) throw new Error(`Expected HTTP 200 after settlement; received ${response.status}.`)
  verifyPaymentReceipt(response.x402?.receipt, account.address)
  const receipt = response.x402!.receipt!
  step.paymentReceiptReported = true
  step.transaction = receipt.transaction
  await writeEvidence(evidence)

  const exactBytes = new Uint8Array(await response.arrayBuffer())
  step.responseSha256 = sha256(exactBytes)
  let received: unknown
  try { received = JSON.parse(new TextDecoder().decode(exactBytes)) } catch { throw new Error('Paid response was not valid JSON.') }
  const expected = buildBookSectionReceipt(target.bookId, discovery.input)
  if (canonicalJson(received) !== canonicalJson(expected)) throw new Error('Paid response did not match the deterministic local reconstruction.')
  step.contentSha256 = expected.section.contentSha256
  step.receiptSha256 = expected.receipt.receiptSha256

  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('No Base RPC URL is available.')
  const chain = await confirmSettlement({
    rpcUrl,
    caip2Network: BASE_NETWORK,
    transaction: receipt.transaction!,
    asset: BASE_USDC,
    payer: account.address,
    payTo: MAHA_PAYEE,
    minAmount: EXPECTED_AMOUNT,
    attempts: 18,
    retryDelayMs: 2_500,
    requestTimeoutMs: 4_000,
  })
  if (chain.status !== 'confirmed' || chain.amount !== EXPECTED_AMOUNT) {
    throw new Error(`Settlement was not confirmed exactly: ${chain.status}${'reason' in chain ? `/${chain.reason}` : `/${chain.amount}`}.`)
  }
  step.transaction = chain.transaction
  step.blockNumber = chain.blockNumber
  evidence.actualSettledBaseUnits = String(BigInt(evidence.actualSettledBaseUnits) + BigInt(EXPECTED_AMOUNT))
  await writeEvidence(evidence)

  step.bazaarIndexed = await waitForBazaar(target)
  if (!step.bazaarIndexed) throw new Error('Bazaar did not expose the exact route within the five-minute observation window.')
  step.outcome = 'settled_and_indexed'
  await writeEvidence(evidence)
}

async function run(): Promise<void> {
  if (process.env.BOOK_INDEXING_CANARY_CONFIRMATION !== CONFIRMATION) throw new Error(`Set BOOK_INDEXING_CANARY_CONFIRMATION exactly to ${CONFIRMATION}.`)
  const account = loadBuyer()
  const evidence: Evidence = {
    schemaVersion: 'maha-book-section-indexing-canary/0.1',
    authorization: CONFIRMATION,
    maximumAuthorizedBaseUnits: MAX_TOTAL_AMOUNT.toString() as '10000',
    actualSettledBaseUnits: '0',
    buyer: account.address,
    payee: MAHA_PAYEE,
    network: BASE_NETWORK,
    asset: BASE_USDC,
    startedAt: new Date().toISOString(),
    outcome: 'running',
    classification: 'publisher-funded discovery seeding; not customers, revenue traction, or organic demand',
    steps: BOOK_INDEXING_TARGETS.map((target) => ({
      offerId: target.offerId,
      resource: target.resource,
      classification: 'publisher-funded-indexing-canary',
      amountBaseUnits: EXPECTED_AMOUNT,
      customerDemand: false,
      revenueTraction: false,
      organicTraffic: false,
      outcome: 'pending',
    })),
  }
  await writeEvidence(evidence)

  for (let index = 0; index < BOOK_INDEXING_TARGETS.length; index += 1) {
    const target = BOOK_INDEXING_TARGETS[index]
    try {
      await requireBalance(account, BigInt(BOOK_INDEXING_TARGETS.length - index) * BigInt(EXPECTED_AMOUNT))
      await purchase(target, account, evidence)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      evidence.steps[index].outcome = 'failed'
      evidence.steps[index].failure = message
      evidence.outcome = BigInt(evidence.actualSettledBaseUnits) === BigInt(0) && !evidence.steps[index].paymentReceiptReported
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
    console.error(`Book-section indexing canary stopped: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
