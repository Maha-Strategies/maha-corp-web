import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { buildEvidenceRetentionMatrix } from '../lib/x402/context-product-family.ts'
import { EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT } from '../lib/x402/context-product-offer-schemas.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { createPaidFetch, decodeChallenge, type PaymentChallenge } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'

export const RESOURCE = 'https://www.mahastrategies.com/api/v1/context/evidence-matrix'
export const AMOUNT = '50000'
export const CONFIRMATION = 'PUBLISHER_FUNDED_MATRIX_ONCE_MAX_0_05_USDC'

export function assertMatrixTerms(challenge: PaymentChallenge): void {
  const [term] = challenge.accepts
  if (challenge.x402Version !== 2 || challenge.resource.url !== RESOURCE || challenge.accepts.length !== 1
    || !term || term.scheme !== 'exact' || term.network !== BASE_NETWORK || term.amount !== AMOUNT
    || term.asset.toLowerCase() !== BASE_USDC.toLowerCase() || term.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || term.extra?.name !== 'USD Coin' || term.extra?.version !== '2') {
    throw new Error('matrix_payment_terms_changed')
  }
}

export function assertMatrixAuthorization(confirmation: string | undefined, attempt: string | undefined): void {
  if (confirmation !== CONFIRMATION || attempt !== '1') throw new Error('explicit_confirmation_and_first_attempt_required')
}

export function assertMatrixDelivery(payload: unknown): void {
  const expected = buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT)
  if (canonicalJson(payload) !== canonicalJson(expected)) throw new Error('matrix_delivery_does_not_match_synthetic_fixture')
}

async function run() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--pay')) throw new Error('unsupported_argument')
  const pay = args.includes('--pay')
  const body = JSON.stringify(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT)
  const request = { method: 'POST', redirect: 'error' as const, headers: {
    'content-type': 'application/json', 'x-maha-discovery-source': 'publisher-funded-listing-refresh',
  }, body }
  // Default execution is read-only: no key lookup and no signature.
  const preflight = await fetch(RESOURCE, { ...request, signal: AbortSignal.timeout(20_000) })
  if (preflight.status !== 402) throw new Error('expected_unpaid_402')
  const challenge = decodeChallenge(preflight.headers.get('payment-required'))
  assertMatrixTerms(challenge)
  const challengeBody = await preflight.json() as PaymentChallenge
  assertMatrixTerms(challengeBody)
  if (canonicalJson(challenge.accepts) !== canonicalJson(challengeBody.accepts)) throw new Error('challenge_header_body_mismatch')
  assertMatrixDelivery(buildEvidenceRetentionMatrix(EVIDENCE_RETENTION_MATRIX_EXAMPLE_INPUT))
  if (!pay) {
    console.log(JSON.stringify({ state: 'read_only_preflight_passed', resource: RESOURCE, amount: AMOUNT,
      classification: 'publisher-funded-listing-refresh', customerDemand: false, organicDemand: false }))
    return
  }
  assertMatrixAuthorization(process.env.MATRIX_REFRESH_CONFIRMATION, process.env.GITHUB_RUN_ATTEMPT)
  const outputPath = process.env.MATRIX_REFRESH_OUTPUT_PATH
  if (!outputPath) throw new Error('sanitized_evidence_output_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_buyer_key_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')
  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)!
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await client.readContract({ address: BASE_USDC as Address,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  if (balance < BigInt(AMOUNT)) throw new Error('insufficient_buyer_usdc')
  const evidence = { classification: 'publisher-funded-listing-refresh', customerDemand: false, organicDemand: false,
    resource: RESOURCE, maximumAuthorizedBaseUnits: AMOUNT, payer: account.address, payee: MAHA_PAYEE,
    startedAt: new Date().toISOString(), state: 'ready', transaction: null as string | null,
    responseSha256: null as string | null, blockNumber: null as number | null }
  const save = () => writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  await save()
  let signatures = 0
  let challenges = 0
  try {
    const paidFetch = createPaidFetch({ address: account.address, chainId: base.id,
      onPaymentRequired(_term, context) {
        if (++challenges !== 1) throw new Error('second_challenge_refused')
        assertMatrixTerms(context.challenge)
      },
      async signTypedData(typedData) {
        if (++signatures !== 1) throw new Error('second_signature_refused')
        evidence.state = 'authorization_started_outcome_unknown'
        await save()
        return account.signTypedData(typedData as Parameters<typeof account.signTypedData>[0])
      },
    })
    // Exactly one signed request. No repayment for delivery failure or indexing lag.
    const response = await paidFetch(RESOURCE, { ...request, signal: AbortSignal.timeout(90_000) })
    if (challenges !== 1 || signatures !== 1) throw new Error('unexpected_payment_flow')
    verifyPaymentReceipt(response.x402?.receipt, account.address)
    evidence.transaction = response.x402!.receipt!.transaction!
    evidence.state = 'receipt_reported_delivery_unverified'
    await save()
    if (response.status !== 201) throw new Error('unexpected_paid_http_status')
    const bytes = new Uint8Array(await response.arrayBuffer())
    evidence.responseSha256 = createHash('sha256').update(bytes).digest('hex')
    assertMatrixDelivery(JSON.parse(new TextDecoder().decode(bytes)))
    const chain = await confirmSettlement({ rpcUrl, caip2Network: BASE_NETWORK, transaction: evidence.transaction,
      asset: BASE_USDC, payer: account.address, payTo: MAHA_PAYEE, minAmount: AMOUNT,
      attempts: 12, retryDelayMs: 2500, requestTimeoutMs: 4000 })
    if (chain.status !== 'confirmed' || chain.amount !== AMOUNT) throw new Error('exact_settlement_not_confirmed')
    evidence.blockNumber = chain.blockNumber
    evidence.state = 'settled_and_delivery_verified_bazaar_refresh_unverified'
    await save()
    console.log(JSON.stringify(evidence))
  } catch {
    evidence.state = 'stopped_reconcile_before_any_repayment'
    await save()
    throw new Error('matrix_refresh_stopped_inspect_evidence_and_chain_before_retry')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(error => {
  console.error(error instanceof Error ? error.message : 'matrix_refresh_failed')
  process.exitCode = 1
})
