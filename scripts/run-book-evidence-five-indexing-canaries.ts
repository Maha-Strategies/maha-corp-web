import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { buildLicensedSection, LICENSED_SECTION_BOOKS, type LicensedSectionBook } from '../lib/x402/licensed-book-sections.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { verifyMicroProduct } from '../lib/x402/micro-products.ts'
import type { MicroProductId } from '../lib/x402/micro-contracts.ts'
import { createPaidFetch, decodeChallenge, type PaymentChallenge, type PaymentRequirement } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, BAZAAR_MERCHANT_URL, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt, type BazaarResource } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'

export const CONFIRMATION = 'PUBLISHER_FUNDED_BOOK_EVIDENCE_FIVE_ONCE_MAX_0_255_USDC'
export const TARGETS = [
  { id: 'book-section-the-maha-principle', path: '/api/v1/books/the-maha-principle/section', amount: '31000' },
  { id: 'book-section-the-orbital-mind', path: '/api/v1/books/the-orbital-mind/section', amount: '33000' },
  { id: 'evidence-scope-check', path: '/api/v1/micro/evidence-scope-check', amount: '41000' },
  { id: 'evidence-version-selection-check', path: '/api/v1/micro/evidence-version-selection-check', amount: '63000' },
  { id: 'context-manifest-check', path: '/api/v1/micro/context-manifest-check', amount: '87000' },
] as const
const origin = 'https://www.mahastrategies.com'
type Step = { offerId: string; resource: string; amount: string; state: string; transaction?: string; responseSha256?: string;
  blockNumber?: number; payloadVerified?: boolean; bazaarIndexed?: boolean }

export function assertCanaryRequirement(requirement: PaymentRequirement, target: typeof TARGETS[number], resource: string) {
  if (resource !== origin + target.path || requirement.scheme !== 'exact' || requirement.network !== BASE_NETWORK
    || requirement.amount !== target.amount || requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()
    || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()) throw new Error('canary_payment_boundary_changed')
}

async function indexed(step: Step): Promise<boolean> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) return false
  const data = await response.json() as { resources?: BazaarResource[] }
  return (data.resources ?? []).some(row => row.resource === step.resource && row.accepts?.some(a =>
    a.amount === step.amount && a.network === BASE_NETWORK && a.payTo.toLowerCase() === MAHA_PAYEE.toLowerCase()
    && a.asset.toLowerCase() === BASE_USDC.toLowerCase() && a.scheme === 'exact'))
}

export function assertBookEvidenceChallenge(challenge: PaymentChallenge, target: typeof TARGETS[number]) {
  if (challenge.x402Version !== 2 || challenge.accepts.length !== 1) throw new Error('unexpected_payment_challenge')
  assertCanaryRequirement(challenge.accepts[0]!, target, challenge.resource.url)
  const extra = challenge.accepts[0]!.extra
  if (extra?.name !== 'USD Coin' || extra?.version !== '2') throw new Error('asset_domain_changed')
}

async function run() {
  const args = process.argv.slice(2)
  if (args.some(a => a !== '--pay')) throw new Error('unsupported_argument')
  if (TARGETS.reduce((sum, t) => sum + BigInt(t.amount), BigInt(0)) !== BigInt(255000)) throw new Error('approved_plan_changed')
  // Check ALL products before reading a key or signing any authorization.
  for (const target of TARGETS) {
    const offer = X402_OFFERS.find(o => o.id === target.id)!
    if (!offer?.availability.payableInProduction || offer.amount !== target.amount || offer.path !== target.path) throw new Error('pinned_offer_changed')
    const response = await fetch(origin + target.path, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(offer.discovery.input) })
    if (response.status !== 402) throw new Error('unpaid_preflight_requires_402')
    const header = decodeChallenge(response.headers.get('payment-required'))
    assertBookEvidenceChallenge(header, target)
    const body = await response.json() as PaymentChallenge
    assertBookEvidenceChallenge(body, target)
    if (JSON.stringify(header.accepts) !== JSON.stringify(body.accepts)) throw new Error('challenge_header_body_mismatch')
  }
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: 'read_only_preflight_passed', products: TARGETS.length, servicePaymentsBaseUnits: '255000', maximumAuthorizedBaseUnits: '255000', customerDemand: false, organicDemand: false })); return }

  if (process.env.BOOK_EVIDENCE_CANARY_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1') throw new Error('explicit_authorization_and_first_attempt_required')
  const outputPath = process.env.BOOK_EVIDENCE_CANARY_OUTPUT_PATH
  if (!outputPath) throw new Error('evidence_output_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_key_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')
  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('base_rpc_required')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await client.readContract({ address: BASE_USDC as Address, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  if (balance < BigInt(255000)) throw new Error('insufficient_balance_for_authorized_plan')
  const evidence = { version: 'maha-book-evidence-five-indexing-canary/1.0', classification: 'publisher-funded-indexing-canary',
    customerDemand: false, organicDemand: false, maximumAuthorizedBaseUnits: '255000', plannedBaseUnits: '255000', confirmedBaseUnits: '0',
    buyer: account.address, payee: MAHA_PAYEE, startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[] }
  const save = () => writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  await save()
  try {
    for (const target of TARGETS) {
      const offer = X402_OFFERS.find(o => o.id === target.id)!
      const step: Step = { offerId: target.id, resource: origin + target.path, amount: target.amount, state: 'not_attempted' }
      evidence.steps.push(step)
      if (offer.amount !== target.amount || offer.path !== target.path) throw new Error('pinned_offer_changed')
      let signatures = 0
      let challenges = 0
      const paidFetch = createPaidFetch({ address: account.address, chainId: base.id,
        async signTypedData(request) {
          if (++signatures !== 1) throw new Error('second_signature_refused')
          step.state = 'authorization_signed_outcome_not_yet_known'
          await save()
          return account.signTypedData({ domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` },
            types: request.types, primaryType: request.primaryType,
            message: { ...request.message, from: request.message.from as `0x${string}`, to: request.message.to as `0x${string}`, nonce: request.message.nonce as `0x${string}` } })
        },
        onPaymentRequired(requirement, context) {
          if (++challenges !== 1) throw new Error('second_challenge_refused')
          assertBookEvidenceChallenge(context.challenge, target)
        },
      })
      // Never automatically retry a paid request, including a lost response.
      const response = await paidFetch(step.resource, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
        headers: { 'content-type': 'application/json', 'user-agent': 'maha-canary/book-evidence-five-indexing', 'x-maha-discovery-source': 'publisher-funded-indexing-canary' }, body: JSON.stringify(offer.discovery.input) })
      if (challenges !== 1 || signatures !== 1) throw new Error('unexpected_payment_flow')
      if (response.x402?.receipt) {
        verifyPaymentReceipt(response.x402.receipt, account.address)
        step.transaction = response.x402.receipt.transaction
        step.state = 'receipt_reported_delivery_unverified'
        await save()
      }
      if (response.status !== 200 || !step.transaction) throw new Error('paid_delivery_not_confirmed')
      const bytes = new Uint8Array(await response.arrayBuffer())
      step.responseSha256 = createHash('sha256').update(bytes).digest('hex')
      const decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      const book = LICENSED_SECTION_BOOKS.find(bookId => target.id === 'book-section-' + bookId)
      step.payloadVerified = book
        ? canonicalJson(decoded) === canonicalJson(buildLicensedSection(book as LicensedSectionBook, offer.discovery.input))
        : await verifyMicroProduct(target.id as MicroProductId, offer.discovery.input, decoded)
      if (!step.payloadVerified) throw new Error('payload_integrity_failed')
      const chain = await confirmSettlement({ rpcUrl, caip2Network: BASE_NETWORK, transaction: step.transaction, asset: BASE_USDC,
        payer: account.address, payTo: MAHA_PAYEE, minAmount: target.amount, attempts: 12, retryDelayMs: 2500, requestTimeoutMs: 4000 })
      if (chain.status !== 'confirmed' || chain.amount !== target.amount) throw new Error('exact_settlement_unconfirmed')
      step.blockNumber = chain.blockNumber
      step.state = 'settled_and_verified_pending_index'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(target.amount))
      await save()
      // Delayed read-only observations. Index lag never triggers another payment.
      for (let observation = 0; observation < 4; observation++) {
        await new Promise(resolve => setTimeout(resolve, 15_000))
        step.bazaarIndexed = await indexed(step).catch(() => false)
        if (step.bazaarIndexed) { step.state = 'settled_verified_and_indexed'; break }
      }
      await save()
    }
    evidence.state = evidence.steps.every(s => s.bazaarIndexed) ? 'complete' : 'verified_pending_index'
    await save()
  } catch {
    evidence.state = 'stopped_do_not_repay_without_reconciliation'
    await save()
    throw new Error('canary_stopped_inspect_sanitized_evidence_before_any_retry')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(error => {
  console.error(error instanceof Error ? error.message : 'canary_failed')
  process.exitCode = 1
})
