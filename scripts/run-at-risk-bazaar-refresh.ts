import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { payableOffers } from '../lib/x402/offers.ts'
import { createPaidFetch, decodeChallenge, type PaymentChallenge } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, BAZAAR_MERCHANT_URL, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement, rpcUrlFor } from '../lib/x402/chain.ts'

/** Pinned from the complete 215-resource Bazaar inventory on 2026-11-02. */
export const TARGETS = [
  ['celestial-result-compatibility', '7000'], ['revision-lineage-check', '6000'],
  ['unit-uncertainty-conversion', '8000'], ['bracketed-polynomial-root', '9000'],
  ['evidence-frame-compatibility', '10500'], ['covariance-uncertainty', '13000'],
  ['divine-name-disambiguation', '14000'], ['citation-binding-check', '16000'],
  ['policy-version-comparison', '17000'], ['audit-export-normalizer', '18000'],
  ['control-evidence-gaps', '19000'], ['tool-permission-diff', '21000'],
  ['publication-bundle-consistency', '22000'], ['edition-verse-resolution', '36000'],
  ['reception-lineage-retrieval', '38000'], ['book-section-the-volcanic-engine', '30000'],
  ['celestial-position-snapshot', '20000'], ['mcp-contract-compatibility', '15000'],
  ['deep-context-evaluation', '10000'], ['context-budget-ladder', '12000'],
  ['book-section-the-imagined-life', '25000'], ['exact-linear-system', '11000'],
  ['context-manifest-check', '87000'], ['evidence-version-selection-check', '63000'],
  ['neural-experiment-metrics', '160000'], ['committee-finance-snapshot', '70000'],
  ['campaign-record-reconcile', '80000'], ['public-spending-review', '180000'],
  ['automation-economics-compare', '90000'], ['assembly-schedule-compare', '150000'],
  ['panel-packing-estimate', '59000'], ['inspection-coverage-plan', '119000'],
  ['celestial-vimshottari-timing', '120000'], ['celestial-chart-evidence', '60000'],
  ['governed-context-verification-pack', '500000'],
] as const

export const CONFIRMATION = 'PUBLISHER_FUNDED_AT_RISK_35_ONCE_MAX_2_1155_USDC'
export const MAX_AMOUNT = 2_115_500n
const ORIGIN = 'https://www.mahastrategies.com'
const MIN_AGE_DAYS = 23
const DAY_MS = 86_400_000

type Listing = { resource: string; accepts?: Array<{ scheme?: string; network?: string; amount?: string; asset?: string; payTo?: string }>;
  quality?: { lastCalledAt?: string }; lastUpdated?: string }
type Step = { id: string; resource: string; amount: string; state: string; transaction?: string;
  responseSha256?: string; blockNumber?: number; httpStatus?: number }

export function assertPlan() {
  if (TARGETS.length !== 35 || new Set(TARGETS.map(([id]) => id)).size !== TARGETS.length
    || TARGETS.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== MAX_AMOUNT
    || TARGETS.some(([id]) => ['evidence-retention-matrix', 'mps-autonomous-audit'].includes(id))) {
    throw new Error('pinned_refresh_plan_invalid')
  }
  const offers = new Map(payableOffers().map(offer => [offer.id, offer]))
  return TARGETS.map(([id, amount]) => {
    const offer = offers.get(id)
    if (!offer || offer.amount !== amount || offer.method !== 'POST' || offer.discovery.requiredHeaders) {
      throw new Error(`pinned_offer_changed:${id}`)
    }
    return { id, amount, offer, resource: ORIGIN + offer.path }
  })
}

export function assertBaseTerms(challenge: PaymentChallenge, resource: string, amount: string) {
  const baseTerms = challenge.accepts.filter(term => term.network === BASE_NETWORK)
  const [term] = baseTerms
  if (challenge.x402Version !== 2 || challenge.resource.url !== resource || baseTerms.length !== 1
    || !term || term.scheme !== 'exact' || term.amount !== amount
    || term.asset.toLowerCase() !== BASE_USDC.toLowerCase()
    || term.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase()
    || term.extra?.name !== 'USD Coin' || term.extra?.version !== '2') {
    throw new Error('live_payment_terms_changed')
  }
}

export function assertStaleListing(listing: Listing | undefined, resource: string, amount: string, nowMs: number) {
  if (!listing || listing.resource !== resource || !listing.accepts?.some(term => term.scheme === 'exact'
    && term.network === BASE_NETWORK && term.amount === amount
    && term.asset?.toLowerCase() === BASE_USDC.toLowerCase()
    && term.payTo?.toLowerCase() === MAHA_PAYEE.toLowerCase())) throw new Error('listing_or_base_terms_missing')
  const lastCallMs = Date.parse(listing.quality?.lastCalledAt ?? '')
  if (!Number.isFinite(lastCallMs) || lastCallMs > nowMs || (nowMs - lastCallMs) / DAY_MS < MIN_AGE_DAYS) {
    throw new Error('listing_not_confirmed_at_risk')
  }
  // Bazaar refreshed Matrix's lastUpdated immediately after settlement while
  // quality.lastCalledAt remained stale. A recent update is therefore a
  // conservative reason to skip a canary, not evidence to pay again.
  const lastUpdateMs = Date.parse(listing.lastUpdated ?? '')
  if (!Number.isFinite(lastUpdateMs) || lastUpdateMs > nowMs
    || (nowMs - lastUpdateMs) / DAY_MS < MIN_AGE_DAYS) throw new Error('listing_not_confirmed_at_risk')
}

async function allListings(): Promise<Map<string, Listing>> {
  const rows = new Map<string, Listing>()
  let total = Number.POSITIVE_INFINITY
  for (let offset = 0; offset < total; offset += 100) {
    const url = new URL(BAZAAR_MERCHANT_URL)
    url.searchParams.set('payTo', MAHA_PAYEE)
    url.searchParams.set('limit', '100')
    url.searchParams.set('offset', String(offset))
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error('bazaar_inventory_unavailable')
    const page = await response.json() as { pagination?: { total?: number }; resources?: Listing[] }
    if (!Array.isArray(page.resources) || !Number.isInteger(page.pagination?.total)) throw new Error('bazaar_inventory_invalid')
    total = page.pagination!.total!
    for (const row of page.resources) {
      if (rows.has(row.resource)) throw new Error('duplicate_bazaar_resource')
      rows.set(row.resource, row)
    }
    if (page.resources.length === 0 && offset < total) throw new Error('bazaar_inventory_incomplete')
  }
  if (rows.size !== total) throw new Error('bazaar_inventory_incomplete')
  return rows
}

async function unpaidChallenge(resource: string, amount: string, input: Record<string, unknown>) {
  const response = await fetch(resource, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json',
    'x-maha-discovery-source': 'publisher-funded-listing-refresh' }, body: JSON.stringify(input),
  signal: AbortSignal.timeout(25_000) })
  if (response.status !== 402) throw new Error(`expected_unpaid_402:${resource}:${response.status}`)
  const challenge = decodeChallenge(response.headers.get('payment-required'))
  assertBaseTerms(challenge, resource, amount)
  const body = await response.json() as PaymentChallenge
  assertBaseTerms(body, resource, amount)
}

async function run() {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--pay')) throw new Error('unsupported_argument')
  const pay = args.includes('--pay')
  const plan = assertPlan()
  const listings = await allListings()
  for (const item of plan) {
    assertStaleListing(listings.get(item.resource), item.resource, item.amount, Date.now())
    await unpaidChallenge(item.resource, item.amount, item.offer.discovery.input)
  }
  if (!pay) {
    console.log(JSON.stringify({ state: 'read_only_preflight_passed', count: plan.length, maxAmount: MAX_AMOUNT.toString(),
      classification: 'publisher-funded-listing-refresh', customerDemand: false, organicDemand: false }))
    return
  }
  if (process.env.AT_RISK_REFRESH_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1') {
    throw new Error('explicit_confirmation_and_first_attempt_required')
  }
  const outputPath = process.env.AT_RISK_REFRESH_OUTPUT_PATH
  if (!outputPath) throw new Error('sanitized_evidence_output_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_buyer_key_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')
  const rpcUrl = rpcUrlFor(BASE_NETWORK, process.env.BASE_RPC_URL)!
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await client.readContract({ address: BASE_USDC as Address,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  if (balance < MAX_AMOUNT) throw new Error('insufficient_buyer_usdc')
  const evidence = { version: 'maha-at-risk-refresh/1', classification: 'publisher-funded-listing-refresh',
    customerDemand: false, organicDemand: false, maximumAuthorizedBaseUnits: MAX_AMOUNT.toString(),
    confirmedBaseUnits: '0', payer: account.address, payee: MAHA_PAYEE, startedAt: new Date().toISOString(),
    state: 'running', steps: [] as Step[] }
  const save = () => writeFile(outputPath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  await save()
  try {
    for (const item of plan) {
      // Re-read the complete Bazaar inventory before every payment: if another
      // buyer has made a fresh call, skip the operator canary.
      const fresh = await allListings()
      const current = fresh.get(item.resource)
      try { assertStaleListing(current, item.resource, item.amount, Date.now()) }
      catch (error) {
        if (error instanceof Error && error.message === 'listing_not_confirmed_at_risk') {
          evidence.steps.push({ id: item.id, resource: item.resource, amount: item.amount, state: 'skipped_recent_call' })
          await save()
          continue
        }
        throw error
      }
      const step: Step = { id: item.id, resource: item.resource, amount: item.amount, state: 'prepared' }
      evidence.steps.push(step)
      await save()
      let signatures = 0
      let challenges = 0
      const paidFetch = createPaidFetch({ address: account.address, chainId: base.id,
        onPaymentRequired(_term, context) {
          if (++challenges !== 1) throw new Error('second_challenge_refused')
          assertBaseTerms(context.challenge, item.resource, item.amount)
        },
        async signTypedData(typedData) {
          if (++signatures !== 1) throw new Error('second_signature_refused')
          if (Number(typedData.domain.chainId) !== base.id
            || String(typedData.domain.verifyingContract).toLowerCase() !== BASE_USDC.toLowerCase()
            || String(typedData.message.to).toLowerCase() !== MAHA_PAYEE.toLowerCase()
            || BigInt(typedData.message.value as bigint) !== BigInt(item.amount)) throw new Error('signed_payment_boundary_changed')
          step.state = 'authorization_started_outcome_unknown'
          await save()
          return account.signTypedData(typedData as Parameters<typeof account.signTypedData>[0])
        },
      })
      const response = await paidFetch(item.resource, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90_000),
        headers: { 'content-type': 'application/json', 'x-maha-discovery-source': 'publisher-funded-listing-refresh' },
        body: JSON.stringify(item.offer.discovery.input) })
      if (challenges !== 1 || signatures !== 1) throw new Error('unexpected_payment_flow')
      verifyPaymentReceipt(response.x402?.receipt, account.address)
      step.transaction = response.x402!.receipt!.transaction
      step.state = 'receipt_reported_delivery_unverified'
      await save()
      step.httpStatus = response.status
      if (!response.ok) throw new Error('paid_delivery_failed')
      const bytes = new Uint8Array(await response.arrayBuffer())
      step.responseSha256 = createHash('sha256').update(bytes).digest('hex')
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown
      if (!payload || typeof payload !== 'object' || 'error' in payload) throw new Error('paid_delivery_invalid')
      const chain = await confirmSettlement({ rpcUrl, caip2Network: BASE_NETWORK, transaction: step.transaction,
        asset: BASE_USDC, payer: account.address, payTo: MAHA_PAYEE, minAmount: item.amount,
        attempts: 12, retryDelayMs: 2500, requestTimeoutMs: 4000 })
      if (chain.status !== 'confirmed' || chain.amount !== item.amount) throw new Error('exact_settlement_not_confirmed')
      step.blockNumber = chain.blockNumber
      step.state = 'settled_and_delivery_observed_bazaar_quality_unverified'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(item.amount))
      await save()
    }
    evidence.state = 'settled_delivery_observed_bazaar_quality_unverified'
    await save()
    console.log(JSON.stringify({ state: evidence.state, confirmedBaseUnits: evidence.confirmedBaseUnits,
      completed: evidence.steps.filter(step => step.transaction).length, skipped: evidence.steps.filter(step => step.state === 'skipped_recent_call').length }))
  } catch {
    evidence.state = 'stopped_reconcile_before_any_repayment'
    await save()
    throw new Error('at_risk_refresh_stopped_inspect_evidence_and_chain_before_retry')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(error => {
  console.error(error instanceof Error ? error.message : 'at_risk_refresh_failed')
  process.exitCode = 1
})
