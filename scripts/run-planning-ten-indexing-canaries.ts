import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { MICRO_OFFERS } from '../lib/x402/micro-offers.ts'
import { verifyMicroProduct } from '../lib/x402/micro-products.ts'
import type { MicroProductId } from '../lib/x402/micro-contracts.ts'
import { createPaidFetch, decodeChallenge, type PaymentChallenge, type PaymentRequirement } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, BAZAAR_MERCHANT_URL, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt, type BazaarResource } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'

export const CONFIRMATION = 'PUBLISHER_FUNDED_PLANNING_TEN_ONCE_MAX_0_98_USDC'
export const TARGETS = [
  { id: 'inspection-tolerance-check', path: '/api/v1/micro/inspection-tolerance-check', amount: '29000' },
  { id: 'inspection-coverage-plan', path: '/api/v1/micro/inspection-coverage-plan', amount: '119000' },
  { id: 'panel-packing-estimate', path: '/api/v1/micro/panel-packing-estimate', amount: '59000' },
  { id: 'assembly-schedule-compare', path: '/api/v1/micro/assembly-schedule-compare', amount: '150000' },
  { id: 'automation-economics-compare', path: '/api/v1/micro/automation-economics-compare', amount: '90000' },
  { id: 'public-spending-review', path: '/api/v1/micro/public-spending-review', amount: '180000' },
  { id: 'campaign-record-reconcile', path: '/api/v1/micro/campaign-record-reconcile', amount: '80000' },
  { id: 'committee-finance-snapshot', path: '/api/v1/micro/committee-finance-snapshot', amount: '70000' },
  { id: 'area-program-check', path: '/api/v1/micro/area-program-check', amount: '39000' },
  { id: 'neural-experiment-metrics', path: '/api/v1/micro/neural-experiment-metrics', amount: '160000' },
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

export function assertPlanningChallenge(challenge: PaymentChallenge, target: typeof TARGETS[number]) {
  if (challenge.x402Version !== 2 || challenge.accepts.length !== 1) throw new Error('unexpected_payment_challenge')
  assertCanaryRequirement(challenge.accepts[0]!, target, challenge.resource.url)
  const extra = challenge.accepts[0]!.extra
  if (extra?.name !== 'USD Coin' || extra?.version !== '2') throw new Error('asset_domain_changed')
}

async function run() {
  const args = process.argv.slice(2)
  if (args.some(a => a !== '--pay')) throw new Error('unsupported_argument')
  if (TARGETS.reduce((sum, t) => sum + BigInt(t.amount), BigInt(0)) !== BigInt(976000)) throw new Error('approved_plan_changed')
  // Check ALL products before reading a key or signing any authorization.
  for (const target of TARGETS) {
    const offer = MICRO_OFFERS.find(o => o.id === target.id)!
    if (!offer?.availability.payableInProduction || offer.amount !== target.amount || offer.path !== target.path) throw new Error('pinned_offer_changed')
    const response = await fetch(origin + target.path, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(offer.discovery.input) })
    if (response.status !== 402) throw new Error('unpaid_preflight_requires_402')
    const header = decodeChallenge(response.headers.get('payment-required'))
    assertPlanningChallenge(header, target)
    const body = await response.json() as PaymentChallenge
    assertPlanningChallenge(body, target)
    if (JSON.stringify(header.accepts) !== JSON.stringify(body.accepts)) throw new Error('challenge_header_body_mismatch')
  }
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: 'read_only_preflight_passed', products: TARGETS.length, servicePaymentsBaseUnits: '976000', maximumAuthorizedBaseUnits: '980000', customerDemand: false, organicDemand: false })); return }

  if (process.env.PLANNING_CANARY_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1') throw new Error('explicit_authorization_and_first_attempt_required')
  const outputPath = process.env.PLANNING_CANARY_OUTPUT_PATH
  if (!outputPath) throw new Error('evidence_output_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_key_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')
  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('base_rpc_required')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await client.readContract({ address: BASE_USDC as Address, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  if (balance < BigInt(976000)) throw new Error('insufficient_balance_for_authorized_plan')
  const evidence = { version: 'maha-planning-ten-indexing-canary/1.0', classification: 'publisher-funded-indexing-canary',
    customerDemand: false, organicDemand: false, maximumAuthorizedBaseUnits: '980000', plannedBaseUnits: '976000', confirmedBaseUnits: '0',
    buyer: account.address, payee: MAHA_PAYEE, startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[] }
  const save = () => writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  await save()
  try {
    for (const target of TARGETS) {
      const offer = MICRO_OFFERS.find(o => o.id === target.id)!
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
          assertPlanningChallenge(context.challenge, target)
        },
      })
      // Never automatically retry a paid request, including a lost response.
      const response = await paidFetch(step.resource, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
        headers: { 'content-type': 'application/json', 'user-agent': 'maha-canary/planning-ten-indexing', 'x-maha-discovery-source': 'publisher-funded-indexing-canary' }, body: JSON.stringify(offer.discovery.input) })
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
      step.payloadVerified = await verifyMicroProduct(target.id as MicroProductId, offer.discovery.input, JSON.parse(new TextDecoder().decode(bytes)))
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
