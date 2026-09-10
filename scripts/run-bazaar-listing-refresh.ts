/**
 * Republish Bazaar listings that advertise a price the server no longer charges.
 *
 * A Bazaar listing is written by the CDP facilitator when it processes a paid
 * call, and by nothing else. There is no crawl: every one of this payee's
 * fifteen listings has a `lastUpdated` within a second of its `lastCalledAt`.
 * So a price change never reaches the Bazaar on its own, and an offer whose
 * listed amount is below its real one is discoverable but unbuyable to any
 * agent that enforces a price ceiling -- which the published Maha buyer recipe
 * does at $0.005.
 *
 * Correcting a listing therefore costs exactly one settlement at the new price.
 * This script pays that, once per offer, and only for offers whose listing is
 * actually wrong.
 *
 *   npm run refresh:bazaar-listings                 # plan only, no key, no spend
 *   npm run refresh:bazaar-listings -- --phase=2    # plan phase 2
 *   npm run refresh:bazaar-listings -- --execute    # pay, needs the confirmation
 *
 * `--plan` is the default and is safe to run at any time: it reads the live
 * catalogue and the live Bazaar, prints what it would pay, and prints the
 * confirmation string that authorizes exactly that spend. If the plan later
 * changes, the confirmation stops matching and execution refuses.
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { payableOffers, type X402Offer } from '../lib/x402/offers.ts'
import { createPaidFetch, type PaymentRequirement } from '../lib/x402/client.ts'
import {
  BASE_NETWORK, BASE_USDC, BAZAAR_MERCHANT_URL, CANARY_BUYER, MAHA_PAYEE,
  verifyPaymentReceipt, type BazaarResource,
} from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'

const ORIGIN = 'https://www.mahastrategies.com'

/**
 * Phase 1 is the five lowest-priced payable offers, phase 2 the next three.
 * Derived from the catalogue rather than pinned, so the phases follow the
 * ladder instead of drifting from it. What is pinned is the spend, through the
 * confirmation string.
 */
export const PHASES = { 1: [0, 5], 2: [5, 8] } as const
export type Phase = keyof typeof PHASES

export type Row = {
  offerId: string
  path: string
  amountBaseUnits: string
  amountUsdc: string
  listedBaseUnits: string | null
  action: 'pay' | 'skip_listing_already_correct' | 'skip_not_in_selected_phase'
}

type Step = Row & {
  state: string
  transaction?: string
  blockNumber?: number
  responseSha256?: string
  listingCorrectedTo?: string
}

const usdc = (baseUnits: string) => (Number(baseUnits) / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')

export function rankedOffers(): X402Offer[] {
  return [...payableOffers()].sort((a, b) => Number(a.amount) - Number(b.amount))
}

export function selected(phase: Phase | 'all'): X402Offer[] {
  const ranked = rankedOffers()
  if (phase === 'all') return ranked.slice(PHASES[1][0], PHASES[2][1])
  const [from, to] = PHASES[phase]
  return ranked.slice(from, to)
}

/** Read-only. The Bazaar merchant index for this payee, keyed by resource path. */
async function listedAmounts(): Promise<Map<string, string>> {
  const url = new URL(BAZAAR_MERCHANT_URL)
  url.searchParams.set('payTo', MAHA_PAYEE)
  url.searchParams.set('limit', '100')
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`bazaar_merchant_read_failed_${response.status}`)
  const data = await response.json() as { resources?: BazaarResource[] }
  const map = new Map<string, string>()
  for (const row of data.resources ?? []) {
    const accepted = row.accepts?.find((a) => a.network === BASE_NETWORK
      && a.payTo.toLowerCase() === MAHA_PAYEE.toLowerCase()
      && a.asset.toLowerCase() === BASE_USDC.toLowerCase())
    if (accepted && row.resource) map.set(row.resource.replace(ORIGIN, ''), String(accepted.amount))
  }
  return map
}

async function plan(phase: Phase | 'all'): Promise<{ rows: Row[]; payable: Row[]; totalBaseUnits: bigint; confirmation: string }> {
  const listed = await listedAmounts()
  const inPhase = new Set(selected(phase).map((o) => o.id))
  const rows: Row[] = rankedOffers().map((offer) => {
    const listedBaseUnits = listed.get(offer.path) ?? null
    const correct = listedBaseUnits === offer.amount
    return {
      offerId: offer.id,
      path: offer.path,
      amountBaseUnits: offer.amount,
      amountUsdc: usdc(offer.amount),
      listedBaseUnits,
      action: !inPhase.has(offer.id) ? 'skip_not_in_selected_phase'
        : correct ? 'skip_listing_already_correct'
        : 'pay',
    }
  })
  const payable = rows.filter((r) => r.action === 'pay')
  const totalBaseUnits = payable.reduce((n, r) => n + BigInt(r.amountBaseUnits), BigInt(0))
  // The confirmation names the phase, the offer count and the exact total, so
  // an authorization cannot survive the plan changing underneath it.
  const confirmation = `BAZAAR_LISTING_REFRESH_PHASE_${String(phase).toUpperCase()}_${payable.length}_OFFERS_MAX_${usdc(String(totalBaseUnits)).replace('.', '_')}_USDC`
  return { rows, payable, totalBaseUnits, confirmation }
}

function printPlan(phase: Phase | 'all', p: Awaited<ReturnType<typeof plan>>): void {
  console.log(`\nBazaar listing refresh -- phase ${phase}\n`)
  console.log(`  ${'offer'.padEnd(38)}${'price'.padStart(10)}${'listed'.padStart(10)}   action`)
  for (const row of p.rows) {
    if (row.action === 'skip_not_in_selected_phase') continue
    const listed = row.listedBaseUnits ?? 'not listed'
    const note = row.action === 'pay' ? `pay $${row.amountUsdc}` : 'already correct, no payment'
    console.log(`  ${row.offerId.padEnd(38)}${row.amountBaseUnits.padStart(10)}${listed.padStart(10)}   ${note}`)
  }
  console.log(`\n  offers needing payment: ${p.payable.length}`)
  console.log(`  total spend:            $${usdc(String(p.totalBaseUnits))} USDC\n`)
  if (p.payable.length === 0) {
    console.log('  Nothing to do. Every listing in this phase already matches the catalogue.\n')
    return
  }
  console.log('  To execute, run:\n')
  console.log(`    export BAZAAR_REFRESH_CONFIRMATION='${p.confirmation}'`)
  console.log(`    export X402_BUYER_PRIVATE_KEY='0x...'                 # the canary buyer, ${CANARY_BUYER}`)
  console.log(`    export BAZAAR_REFRESH_OUTPUT_PATH=/tmp/bazaar-refresh-$(date +%Y%m%d).json`)
  console.log(`    npm run refresh:bazaar-listings -- --phase=${phase} --execute\n`)
}

/** Refuse any challenge that is not exactly the published price for this path. */
export function assertRefreshRequirement(requirement: PaymentRequirement, row: Row, resource: string): void {
  if (resource !== ORIGIN + row.path
    || requirement.scheme !== 'exact'
    || requirement.network !== BASE_NETWORK
    || requirement.amount !== row.amountBaseUnits
    || requirement.asset.toLowerCase() !== BASE_USDC.toLowerCase()
    || requirement.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()) {
    throw new Error(`refresh_payment_boundary_changed:${row.offerId}`)
  }
}

async function indexedAt(path: string, expected: string): Promise<boolean> {
  const listed = await listedAmounts().catch(() => new Map<string, string>())
  return listed.get(path) === expected
}

async function execute(phase: Phase | 'all'): Promise<void> {
  const p = await plan(phase)
  printPlan(phase, p)
  if (p.payable.length === 0) return

  if (process.env.BAZAAR_REFRESH_CONFIRMATION !== p.confirmation) {
    throw new Error(`confirmation_required_and_must_match_the_current_plan: ${p.confirmation}`)
  }
  const outputPath = process.env.BAZAAR_REFRESH_OUTPUT_PATH
  if (!outputPath) throw new Error('evidence_output_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_key_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')

  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)
  if (!rpcUrl) throw new Error('base_rpc_required')
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await client.readContract({
    address: BASE_USDC as Address,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf', args: [account.address],
  })
  if (balance < p.totalBaseUnits) throw new Error('insufficient_balance_for_authorized_plan')

  const offers = new Map(payableOffers().map((o) => [o.id, o]))
  const evidence = {
    version: 'maha-bazaar-listing-refresh/0.1',
    classification: 'publisher-funded-listing-refresh',
    customerDemand: false,
    organicDemand: false,
    phase: String(phase),
    confirmation: p.confirmation,
    maximumAuthorizedBaseUnits: String(p.totalBaseUnits),
    confirmedBaseUnits: '0',
    buyer: account.address,
    payee: MAHA_PAYEE,
    startedAt: new Date().toISOString(),
    state: 'running',
    steps: [] as Step[],
  }
  const save = () => writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  await save()

  try {
    for (const row of p.payable) {
      const offer = offers.get(row.offerId)!
      const step: Step = { ...row, state: 'not_attempted' }
      evidence.steps.push(step)
      // The catalogue must not have moved since the plan was priced.
      if (offer.amount !== row.amountBaseUnits || offer.path !== row.path) throw new Error('catalogue_changed_since_plan')

      let signatures = 0
      let challenges = 0
      const paidFetch = createPaidFetch({
        address: account.address,
        chainId: base.id,
        async signTypedData(request) {
          if (++signatures !== 1) throw new Error('second_signature_refused')
          step.state = 'authorization_signed_outcome_not_yet_known'
          await save()
          return account.signTypedData({
            domain: { ...request.domain, verifyingContract: request.domain.verifyingContract as `0x${string}` },
            types: request.types, primaryType: request.primaryType,
            message: {
              ...request.message,
              from: request.message.from as `0x${string}`,
              to: request.message.to as `0x${string}`,
              nonce: request.message.nonce as `0x${string}`,
            },
          })
        },
        onPaymentRequired(requirement, context) {
          if (++challenges !== 1) throw new Error('second_challenge_refused')
          assertRefreshRequirement(requirement, row, context.challenge.resource.url)
        },
      })

      // Never automatically retry a paid request, including a lost response.
      const response = await paidFetch(ORIGIN + row.path, {
        method: 'POST',
        signal: AbortSignal.timeout(120_000),
        headers: { 'content-type': 'application/json', 'x-maha-discovery-source': 'publisher-funded-listing-refresh' },
        body: JSON.stringify(offer.discovery.input),
      })
      if (challenges !== 1 || signatures !== 1) throw new Error('unexpected_payment_flow')
      if (response.x402?.receipt) {
        verifyPaymentReceipt(response.x402.receipt, account.address)
        step.transaction = response.x402.receipt.transaction
        step.state = 'receipt_reported_delivery_unverified'
        await save()
      }
      // 202 is a completed purchase for the async offers; only a 4xx/5xx is a failure.
      if (response.status >= 400 || !step.transaction) throw new Error(`paid_delivery_not_confirmed:${row.offerId}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      step.responseSha256 = createHash('sha256').update(bytes).digest('hex')

      const chain = await confirmSettlement({
        rpcUrl, caip2Network: BASE_NETWORK, transaction: step.transaction, asset: BASE_USDC,
        payer: account.address, payTo: MAHA_PAYEE, minAmount: row.amountBaseUnits,
        attempts: 12, retryDelayMs: 2500, requestTimeoutMs: 4000,
      })
      if (chain.status !== 'confirmed' || chain.amount !== row.amountBaseUnits) throw new Error('exact_settlement_unconfirmed')
      step.blockNumber = chain.blockNumber
      step.state = 'settled_pending_listing_update'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(row.amountBaseUnits))
      await save()

      // Read-only observation. Index lag never triggers another payment.
      for (let observation = 0; observation < 4; observation += 1) {
        await new Promise((resolve) => setTimeout(resolve, 15_000))
        if (await indexedAt(row.path, row.amountBaseUnits)) {
          step.listingCorrectedTo = row.amountBaseUnits
          step.state = 'settled_and_listing_corrected'
          break
        }
      }
      await save()
      console.log(`  ${step.state === 'settled_and_listing_corrected' ? '✓' : '·'} ${row.offerId} -> ${row.amountBaseUnits} (${step.state})`)
    }
    evidence.state = evidence.steps.every((s) => s.listingCorrectedTo) ? 'complete' : 'settled_pending_listing_update'
    await save()
    console.log(`\n  spent $${usdc(evidence.confirmedBaseUnits)} USDC across ${evidence.steps.length} offers. Evidence: ${outputPath}\n`)
  } catch (error) {
    evidence.state = 'stopped_do_not_repay_without_reconciliation'
    await save()
    console.error(error instanceof Error ? error.message : 'refresh_failed')
    throw new Error('refresh_stopped_inspect_evidence_before_any_retry')
  }
}

async function run(): Promise<void> {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => !/^--(plan|execute|phase=(1|2|all))$/.test(a))
  if (unknown.length) throw new Error(`unsupported_arguments: ${unknown.join(' ')}`)
  const phaseArg = args.find((a) => a.startsWith('--phase='))?.slice('--phase='.length) ?? '1'
  const phase = (phaseArg === 'all' ? 'all' : Number(phaseArg) as Phase)
  if (args.includes('--execute')) return execute(phase)
  printPlan(phase, await plan(phase))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : 'refresh_failed')
    process.exitCode = 1
  })
}
