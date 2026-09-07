import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'
import {
  createPaidFetch,
  decodeChallenge,
  PAYMENT_REQUIRED_HEADER,
  type PaymentRequirement,
  type TypedDataRequest,
} from '../lib/x402/client.ts'
import { captureResponseBody, parseCapturedJson, prepareEvidenceDirectories } from '../lib/x402/canary-response-capture.ts'

const CONFIRMATION = 'PURCHASE_FUCHSS_CLAIM_TRIAGE_REPORT_MAX_0_005_USDC'
const SUBJECT = 'https://www.mahastrategies.com/api/v1/mps/audit'
const ENDPOINT = `https://x402.fuchss.app/v1/x402-trust?resource=${encodeURIComponent(SUBJECT)}`
const NETWORK = 'eip155:8453'
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PAYEE = '0xbBECBE90F28632a9d52ed67b33b43767b8c89285'
const AMOUNT = '5000'

const outputDirectory = process.env.X402_TRUST_REPORT_OUTPUT_DIRECTORY?.trim()
  || join(process.cwd(), 'artifacts', 'x402-trust-report-canary')
const responsePath = join(outputDirectory, 'claim-triage-trust-report.json')
const evidencePath = join(outputDirectory, 'purchase-evidence.json')

function assertRequirement(requirement: PaymentRequirement): void {
  const failures: string[] = []
  if (requirement.scheme !== 'exact') failures.push(`scheme=${requirement.scheme}`)
  if (requirement.network !== NETWORK) failures.push(`network=${requirement.network}`)
  if (requirement.amount !== AMOUNT) failures.push(`amount=${requirement.amount}`)
  if (requirement.asset.toLowerCase() !== ASSET.toLowerCase()) failures.push(`asset=${requirement.asset}`)
  if (requirement.payTo.toLowerCase() !== PAYEE.toLowerCase()) failures.push(`payTo=${requirement.payTo}`)
  if (failures.length > 0) throw new Error(`Refused unexpected payment terms: ${failures.join(', ')}`)
}

async function writeEvidence(value: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(evidencePath), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

if (process.env.X402_TRUST_REPORT_CONFIRMATION !== CONFIRMATION) {
  throw new Error(`Refused: X402_TRUST_REPORT_CONFIRMATION must equal ${CONFIRMATION}.`)
}

await prepareEvidenceDirectories(responsePath, evidencePath)
const startedAt = new Date().toISOString()
await writeEvidence({
  schemaVersion: 'maha-x402-trust-report-canary/0.1',
  state: 'preflight',
  classification: 'publisher-funded diagnostic; not a customer, organic demand, or revenue traction',
  subject: SUBJECT,
  endpoint: ENDPOINT,
  maximumAuthorizedBaseUnits: AMOUNT,
  startedAt,
})

const request = {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ resource: SUBJECT }),
} as const
const challenged = await fetch(ENDPOINT, request)
if (challenged.status !== 402) throw new Error(`Expected preflight HTTP 402; received ${challenged.status}.`)
const challenge = decodeChallenge(challenged.headers.get(PAYMENT_REQUIRED_HEADER))
if (challenge.resource.url !== ENDPOINT) throw new Error('The challenge resource differs from the authorized endpoint.')
const expected = challenge.accepts.find((candidate) => candidate.scheme === 'exact' && candidate.network === NETWORK)
if (!expected) throw new Error('No exact Base Mainnet payment requirement was offered.')
assertRequirement(expected)

const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim()
if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) throw new Error('X402_BUYER_PRIVATE_KEY is missing or malformed.')
const account = privateKeyToAccount(privateKey as `0x${string}`)
let challengeCount = 0
let signatureCount = 0
const paidFetch = createPaidFetch({
  address: account.address,
  chainId: base.id,
  async signTypedData(typedData: TypedDataRequest) {
    signatureCount += 1
    if (signatureCount !== 1) throw new Error('Refused a second signature.')
    return account.signTypedData({
      domain: { ...typedData.domain, verifyingContract: typedData.domain.verifyingContract as `0x${string}` },
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: {
        ...typedData.message,
        from: typedData.message.from as `0x${string}`,
        to: typedData.message.to as `0x${string}`,
        nonce: typedData.message.nonce as `0x${string}`,
      },
    })
  },
  onPaymentRequired(requirement, context) {
    challengeCount += 1
    if (challengeCount !== 1) throw new Error('Refused a second payment challenge.')
    if (context.challenge.resource.url !== ENDPOINT) throw new Error('Payment resource changed before signing.')
    assertRequirement(requirement)
  },
})

const response = await paidFetch(ENDPOINT, request)
const captured = await captureResponseBody(response, responsePath)
const receipt = response.x402?.receipt
if (challengeCount !== 1 || signatureCount !== 1) throw new Error('Purchase did not use exactly one challenge and one signature.')
if (response.status !== 200) throw new Error(`Paid response returned HTTP ${response.status}; bytes were preserved.`)
if (!receipt?.success || !receipt.transaction) throw new Error('Paid response omitted a successful settlement receipt; bytes were preserved.')
const report = parseCapturedJson(captured)

const rpcUrl = rpcUrlFor(NETWORK, process.env.BASE_RPC_URL)
if (!rpcUrl) throw new Error('No Base RPC URL is available for settlement confirmation.')
const settlement = await confirmSettlement({
  rpcUrl,
  caip2Network: NETWORK,
  transaction: receipt.transaction,
  asset: ASSET,
  payer: account.address,
  payTo: PAYEE,
  minAmount: AMOUNT,
  attempts: 18,
  retryDelayMs: 2_500,
  requestTimeoutMs: 4_000,
})
if (settlement.status !== 'confirmed') throw new Error(`Settlement was ${settlement.status}; refusing to call the diagnostic complete.`)

await writeEvidence({
  schemaVersion: 'maha-x402-trust-report-canary/0.1',
  state: 'settled_and_verified',
  classification: 'publisher-funded diagnostic; not a customer, organic demand, or revenue traction',
  subject: SUBJECT,
  endpoint: ENDPOINT,
  method: request.method,
  amountBaseUnits: AMOUNT,
  network: NETWORK,
  asset: ASSET,
  payee: PAYEE,
  buyer: account.address,
  transaction: receipt.transaction,
  responseFile: 'claim-triage-trust-report.json',
  responseBytes: captured.bytes.byteLength,
  responseSha256: createHash('sha256').update(captured.bytes).digest('hex'),
  reportShape: {
    score: typeof report.score,
    grade: typeof report.grade,
    flags: Array.isArray(report.flags) ? report.flags.length : null,
  },
  startedAt,
  completedAt: new Date().toISOString(),
})
