import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createPublicClient, formatUnits, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import { createPaidFetch, type PaymentRequirement, type TypedDataRequest } from '../lib/x402/client.ts'
import { assertRecoverableSignature } from '../lib/x402/canary-evidence.ts'
import { confirmCanarySettlement, settlementEvidence } from '../lib/x402/canary-settlement-confirmation.ts'
import {
  captureResponseBody,
  parseCapturedJson,
  prepareEvidenceDirectories,
  writeCaptureRecord,
} from '../lib/x402/canary-response-capture.ts'
import { BASE_USDC, CANARY_BUYER } from '../lib/x402/discovery-payment-recipe.ts'

const SUBJECT = '0xec84c1cd6602bbe387bc8e6f0d3c062f2762de28'
const ENDPOINT = `https://x402.nsgoods.org/preflight?address=${SUBJECT}&chain=eip155:8453&role=payee`
const EXPECTED_NETWORK = 'eip155:8453'
const EXPECTED_AMOUNT = '15000'
const EXPECTED_PAYEE = '0xc87a06DEE4c0E85912296002617120BBfd5EF990'
const EXPECTED_ASSET = BASE_USDC
const erc20BalanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

type Settlement = { success?: boolean; transaction?: string; network?: string; payer?: string }

function loadBuyer() {
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('The protected buyer key is missing or malformed.')
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) {
    throw new Error(`Refused unexpected canary buyer ${account.address}; expected ${CANARY_BUYER}.`)
  }
  return account
}

async function balanceOf(address: Address): Promise<bigint> {
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL?.trim() || undefined) })
  return client.readContract({ address: EXPECTED_ASSET as Address, abi: erc20BalanceAbi, functionName: 'balanceOf', args: [address] })
}

function assertRequirement(requirement: PaymentRequirement): void {
  if (requirement.scheme !== 'exact') throw new Error(`Refused payment scheme ${requirement.scheme}.`)
  if (requirement.network !== 'eip155:8453') throw new Error(`Refused network ${requirement.network}.`)
  if (requirement.amount !== EXPECTED_AMOUNT) throw new Error(`Refused amount ${requirement.amount}; authorized ${EXPECTED_AMOUNT}.`)
  if (requirement.asset.toLowerCase() !== EXPECTED_ASSET.toLowerCase()) throw new Error('Refused unexpected payment asset.')
  if (requirement.payTo.toLowerCase() !== EXPECTED_PAYEE.toLowerCase()) throw new Error('Refused unexpected payment recipient.')
}

const account = loadBuyer()
const beforeBalance = await balanceOf(account.address)
if (beforeBalance < BigInt(EXPECTED_AMOUNT)) throw new Error('The dedicated canary wallet has less than 0.015 Base USDC.')
console.log(`Dedicated buyer ${account.address}; Base USDC balance ${formatUnits(beforeBalance, 6)}.`)

if (process.argv.includes('--validate-config')) {
  console.log('Configuration validation passed. No request was made and no payment was signed.')
  process.exit(0)
}

const responsePath = process.env.NSGOODS_PREFLIGHT_RESPONSE_PATH?.trim()
const evidencePath = process.env.NSGOODS_PREFLIGHT_PAYMENT_PATH?.trim()
if (!responsePath || !evidencePath) throw new Error('Both protected output paths are required.')
const capturePath = join(dirname(responsePath), 'response-capture.json')

// Before the money moves. A run that dies during the paid request must still
// leave the artifact upload somewhere to look.
await prepareEvidenceDirectories(responsePath, evidencePath, capturePath)

let challengeCount = 0
let signatureCount = 0
let settlement: Settlement | null = null
const paidFetch = createPaidFetch({
  address: account.address,
  chainId: base.id,
  signTypedData: async (request: TypedDataRequest) => {
    signatureCount += 1
    if (signatureCount !== 1) throw new Error('Refused more than one payment signature in the authorized canary.')
    const signature = await account.signTypedData(request as Parameters<typeof account.signTypedData>[0])
    await assertRecoverableSignature(request, signature, account.address)
    return signature
  },
  onPaymentRequired(requirement, context) {
    challengeCount += 1
    if (challengeCount !== 1) throw new Error('Refused more than one payment challenge in the authorized canary.')
    if (context.challenge.resource.url !== ENDPOINT) throw new Error('The challenged resource differs from the authorized endpoint.')
    assertRequirement(requirement)
  },
  onSettled(receipt) { settlement = receipt },
})

const response = await paidFetch(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } })

// The first thing done with a paid response is to keep it. Every assertion
// below can fail after settlement, and any one of them running before the
// bytes reach disk is a way to pay for an answer and then lose it.
const captured = await captureResponseBody(response, responsePath)
await writeCaptureRecord(captured, capturePath, ENDPOINT)

if (challengeCount !== 1 || signatureCount !== 1) throw new Error('The canary did not perform exactly one challenge and one signature.')
if (captured.status !== 200) throw new Error(`Expected HTTP 200 after settlement; received ${captured.status}.`)
const body = parseCapturedJson(captured)
if (typeof body.request !== 'object' || body.request === null) {
  throw new Error(`The paid response carries no request envelope; its received bytes are preserved at ${captured.path}.`)
}

// Settlement is asynchronous. Reading the balance the instant the response
// arrives is what rejected a good run on 2026-09-02: Base had not produced the
// block yet, so the debit read as zero. The confirmation below waits for the
// declared transaction instead of racing it, and never reports a settlement it
// merely failed to observe as one that did not happen.
const rpcUrl = rpcUrlFor(EXPECTED_NETWORK, process.env.BASE_RPC_URL)
if (!rpcUrl) throw new Error(`No RPC endpoint is configured for ${EXPECTED_NETWORK}.`)
const confirmation = await confirmCanarySettlement({
  receipt: settlement,
  expected: { amountBaseUnits: EXPECTED_AMOUNT },
  balanceBefore: beforeBalance,
  // One attempt per call: the bounded window below owns the waiting, so the
  // shared helper stays the single judge of what a transaction proves.
  confirmTransaction: (transaction) => confirmSettlement({
    rpcUrl, caip2Network: EXPECTED_NETWORK, transaction,
    asset: EXPECTED_ASSET, payer: account.address, payTo: EXPECTED_PAYEE,
    minAmount: EXPECTED_AMOUNT, attempts: 1,
  }),
  readBalance: () => balanceOf(account.address),
  now: () => Date.now(),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
})

// Written before the throw: on a timeout or an unreachable node this is the
// only machine-readable record of what the run did and did not establish.
await writeCaptureRecord(captured, capturePath, ENDPOINT, confirmation)
console.log(`Settlement ${confirmation.state} (${confirmation.reason}) after ${confirmation.elapsedMs}ms.`)
if (!confirmation.passed) throw new Error(`${confirmation.state}: ${confirmation.interpretation}`)
const afterBalance = beforeBalance - BigInt(confirmation.debitedBaseUnits ?? '0')

const evidence = {
  schemaVersion: 'maha-nsgoods-preflight-live-canary/1.1',
  checkedAt: new Date().toISOString(),
  endpoint: ENDPOINT,
  subject: { address: SUBJECT, chain: 'eip155:8453', role: 'payee' },
  payment: {
    network: 'eip155:8453', asset: EXPECTED_ASSET, payTo: EXPECTED_PAYEE,
    amountBaseUnits: EXPECTED_AMOUNT, amountUsdc: '0.015',
    buyer: account.address, balanceBeforeBaseUnits: beforeBalance.toString(),
    balanceAfterBaseUnits: afterBalance.toString(),
    debitedBaseUnits: confirmation.debitedBaseUnits as string,
    transaction: confirmation.transaction as string,
  },
  execution: { challengeCount, signatureCount, paidHttpStatus: captured.status },
  settlement: settlementEvidence(confirmation),
  responseSha256: captured.sha256,
}
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
console.log(`Settled exactly 0.015 USDC in confirmed transaction ${confirmation.transaction}.`)
