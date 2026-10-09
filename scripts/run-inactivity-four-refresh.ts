import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { createPaidFetch, decodeChallenge, type PaymentChallenge } from '../lib/x402/client.ts'
import { BASE_NETWORK, BASE_USDC, CANARY_BUYER, MAHA_PAYEE, verifyPaymentReceipt } from '../lib/x402/discovery-payment-recipe.ts'
import { confirmSettlement } from '../lib/x402/chain.ts'
import { buildGovernedContextVerificationPack } from '../lib/x402/context-product-family.ts'
import { verifyCelestialProduct } from '../lib/x402/celestial-products.ts'
import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { auditInputHash, parseMpsAuditResponse } from '../lib/mps-audit-engine.ts'

export const CONFIRMATION = 'PUBLISHER_FUNDED_INACTIVITY_FOUR_ONCE_MAX_0_93_USDC_20261009'
export const TARGETS = [
  { id: 'mps-autonomous-audit', path: '/api/v1/mps/audit', amount: '250000' },
  { id: 'governed-context-verification-pack', path: '/api/v1/context/governed-verification', amount: '500000' },
  { id: 'celestial-chart-evidence', path: '/api/v1/calculations/chart', amount: '60000' },
  { id: 'celestial-vimshottari-timing', path: '/api/v1/calculations/vimshottari', amount: '120000' },
] as const
type Target = typeof TARGETS[number]
const ORIGIN = 'https://www.mahastrategies.com'
const CAP = 930000n
const SYNTHETIC_PASSAGE = 'Soil microbial diversity has declined sharply across intensively farmed land. A 2019 meta-analysis attributed most of the loss to tillage frequency. Studies show that cover cropping restores diversity within three seasons, though the mechanism remains an open question.'
type Step = { offerId: string; resource: string; amount: string; state: string; lastCalledAt?: string;
  transaction?: string; blockNumber?: number; responseSha256?: string; deliveryVerified?: boolean; auditId?: string }

export function assertAuthorization(confirmation: string | undefined, attempt: string | undefined) {
  if (confirmation !== CONFIRMATION || attempt !== '1') throw new Error('exact_confirmation_and_first_attempt_required')
  if (TARGETS.reduce((sum, t) => sum + BigInt(t.amount), 0n) !== CAP) throw new Error('approved_cohort_changed')
}
export function assertTerms(challenge: PaymentChallenge, target: Target) {
  const t = challenge.accepts?.[0]
  if (challenge.x402Version !== 2 || challenge.resource?.url !== ORIGIN + target.path || challenge.accepts.length !== 1
    || !t || t.scheme !== 'exact' || t.amount !== target.amount || t.network !== BASE_NETWORK
    || t.payTo.toLowerCase() !== MAHA_PAYEE.toLowerCase() || t.asset.toLowerCase() !== BASE_USDC.toLowerCase()
    || t.extra?.name !== 'USD Coin' || t.extra?.version !== '2' || t.maxTimeoutSeconds !== 60) throw new Error('approved_payment_terms_changed')
}
export function requestFor(target: Target, runId: string) {
  if (!/^\d+$/.test(runId)) throw new Error('github_run_id_required')
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-maha-discovery-source': 'publisher-funded-listing-refresh' }
  let body: Record<string, unknown>
  if (target.id === 'mps-autonomous-audit') {
    body = { clientRequestId: `publisher_inactivity_${runId}_mps`, text: SYNTHETIC_PASSAGE }
    headers['x-maha-idempotency-key'] = String(body.clientRequestId)
    headers['x-maha-input-hash'] = auditInputHash(SYNTHETIC_PASSAGE)
  } else if (target.id === 'governed-context-verification-pack') {
    body = { budgetMode: 'guaranteed', clientRequestId: `publisher_inactivity_${runId}_governed`,
      documents: [
        { id: 'release', text: 'The release may proceed only after the security owner approves the evidence packet.\n\nThe rollback begins when the error rate exceeds two percent for five minutes.\n\nRoutine status notes describe staffing and meeting schedules.', title: 'Release rule' },
        { id: 'operations', text: 'The operator must preserve the request digest and approval identity.\n\nRoutine status notes describe staffing and meeting schedules.', title: 'Operations note' },
      ], provenance: 'compact', requiredEvidence: [
        { evidenceId: 'release-authority', sourceId: 'release', text: 'The release may proceed only after the security owner approves the evidence packet.' },
        { evidenceId: 'rollback', sourceId: 'release', text: 'The rollback begins when the error rate exceeds two percent for five minutes.' },
      ], scoring: 'bm25', task: 'Preserve the release authority and rollback condition.', tokenBudget: 128 }
  } else {
    body = { dataClass: 'synthetic', instantUtc: '2000-01-01T12:00:00.000Z', latitudeDegrees: 0, longitudeDegrees: 0,
      ...(target.id === 'celestial-vimshottari-timing' ? { referenceInstantUtc: '2026-01-01T12:00:00.000Z' } : {}) }
  }
  return { method: 'POST', redirect: 'error' as const, headers, body: JSON.stringify(body), input: body }
}
export function verifyDelivery(target: Target, input: Record<string, unknown>, value: unknown): boolean {
  try {
    if (target.id === 'governed-context-verification-pack') return canonicalJson(value) === canonicalJson(buildGovernedContextVerificationPack(input))
    if (target.id === 'celestial-chart-evidence' || target.id === 'celestial-vimshottari-timing') return verifyCelestialProduct(target.id, input, value)
    const v = value as { offerId?: string; status?: string; clientRequestId?: string; inputHash?: string; audit?: { input_hash?: string; mps_version?: string; claims?: unknown[] } }
    if (v.offerId !== target.id || v.status !== 'completed' || v.clientRequestId !== input.clientRequestId
      || v.inputHash !== auditInputHash(String(input.text)) || v.audit?.input_hash !== v.inputHash || v.audit.mps_version !== '0.1') return false
    const claims = parseMpsAuditResponse(JSON.stringify(v.audit), String(input.text))
    return canonicalJson(claims) === canonicalJson(v.audit.claims)
  } catch { return false }
}

async function merchant() {
  const r = await fetch(`https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=${MAHA_PAYEE}&limit=100`, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error('merchant_unavailable')
  const d = await r.json() as { resources: Array<{ resource: string; quality?: { lastCalledAt?: string }; accepts?: Array<{ amount: string }> }>; pagination?: { total: number } }
  if (!Array.isArray(d.resources) || (d.pagination?.total ?? 101) > 100) throw new Error('incomplete_merchant_snapshot')
  return d.resources
}
async function run() {
  const pay = process.argv.slice(2).includes('--pay')
  if (process.argv.slice(2).some(a => a !== '--pay')) throw new Error('unsupported_argument')
  assertAuthorization(process.env.INACTIVITY_FOUR_CONFIRMATION, process.env.GITHUB_RUN_ATTEMPT)
  const runId = process.env.GITHUB_RUN_ID ?? ''
  const output = process.env.INACTIVITY_FOUR_OUTPUT_PATH
  if (!output) throw new Error('evidence_path_required')
  const listing = await merchant()
  const evidence = { classification: 'publisher-funded-listing-refresh', customerDemand: false, organicDemand: false,
    runId, startedAt: new Date().toISOString(), maximumAuthorizedBaseUnits: String(CAP), confirmedBaseUnits: '0',
    signedBaseUnits: '0', state: 'preflight', buyer: CANARY_BUYER, payee: MAHA_PAYEE, steps: [] as Step[] }
  // An existing artifact may represent an uncertain payment. Never overwrite it.
  await writeFile(output, JSON.stringify(evidence, null, 2), { flag: 'wx', mode: 0o600 })
  const save = () => writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
  const pending: Target[] = []
  for (const target of TARGETS) {
    const row = listing.find(r => r.resource === ORIGIN + target.path)
    const last = Date.parse(row?.quality?.lastCalledAt ?? '')
    if (!Number.isFinite(last) || last > Date.now() + 300000) throw new Error('listing_activity_unknown')
    const step: Step = { offerId: target.id, resource: ORIGIN + target.path, amount: target.amount,
      lastCalledAt: row!.quality!.lastCalledAt, state: 'not_attempted' }
    evidence.steps.push(step)
    if (Date.now() - last < 23 * 86400000) { step.state = 'skipped_recent_settlement'; continue }
    const req = requestFor(target, runId)
    const r = await fetch(step.resource, { ...req, signal: AbortSignal.timeout(20000) })
    if (r.status !== 402) throw new Error('expected_unpaid_402')
    const header = decodeChallenge(r.headers.get('payment-required'))
    assertTerms(header, target)
    const body = await r.json() as PaymentChallenge
    assertTerms(body, target)
    if (canonicalJson(body.accepts) !== canonicalJson(header.accepts)) throw new Error('challenge_disagreement')
    const validation = await fetch('https://api.cdp.coinbase.com/platform/v2/x402/validate', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resource: step.resource, method: 'POST' }), signal: AbortSignal.timeout(30000) })
    const valid = await validation.json() as { valid?: boolean; simulation?: { outcome?: string } }
    if (!validation.ok || valid.valid !== true || valid.simulation?.outcome !== 'accepted') throw new Error('bazaar_validation_failed')
    step.state = 'preflight_passed'
    pending.push(target)
  }
  evidence.state = 'preflight_passed'
  await save()
  if (!pay || !pending.length) { console.log(JSON.stringify(evidence)); return }
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error('dedicated_buyer_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) throw new Error('unexpected_buyer')
  const rpcUrl = process.env.BASE_RPC_URL || 'https://base-rpc.publicnode.com'
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const balance = await publicClient.readContract({ address: BASE_USDC as `0x${string}`, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [account.address] })
  const needed = pending.reduce((sum, t) => sum + BigInt(t.amount), 0n)
  if (balance < needed || needed > CAP) throw new Error('insufficient_balance_or_cap_exceeded')
  try {
    for (const target of pending) {
      const step = evidence.steps.find(s => s.offerId === target.id)!
      const req = requestFor(target, runId)
      let signatures = 0, challenges = 0
      const paidFetch = createPaidFetch({ address: account.address, chainId: base.id,
        onPaymentRequired(_term, context) { if (++challenges !== 1) throw new Error('second_challenge_refused'); assertTerms(context.challenge, target) },
        async signTypedData(data) {
          if (++signatures !== 1) throw new Error('second_signature_refused')
          const total = BigInt(evidence.signedBaseUnits) + BigInt(target.amount)
          if (total > CAP || data.message.value !== BigInt(target.amount) || data.message.to.toLowerCase() !== MAHA_PAYEE.toLowerCase()
            || data.domain.chainId !== base.id || data.domain.verifyingContract.toLowerCase() !== BASE_USDC.toLowerCase()) throw new Error('signature_boundary_changed')
          evidence.signedBaseUnits = String(total)
          step.state = 'authorization_started_outcome_unknown'
          await save()
          return account.signTypedData(data as Parameters<typeof account.signTypedData>[0])
        },
      })
      const response = await paidFetch(step.resource, { ...req, signal: AbortSignal.timeout(120000) })
      if (signatures !== 1 || challenges !== 1) throw new Error('unexpected_payment_flow')
      verifyPaymentReceipt(response.x402?.receipt, account.address)
      step.transaction = response.x402!.receipt!.transaction
      step.state = 'receipt_received_delivery_unverified'
      await save()
      const chain = await confirmSettlement({ rpcUrl, caip2Network: BASE_NETWORK, transaction: step.transaction,
        asset: BASE_USDC, payer: account.address, payTo: MAHA_PAYEE, minAmount: target.amount, attempts: 12, retryDelayMs: 2500, requestTimeoutMs: 4000 })
      if (chain.status !== 'confirmed' || chain.amount !== target.amount) throw new Error('exact_settlement_unconfirmed')
      step.blockNumber = chain.blockNumber
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(target.amount))
      step.state = 'settled_delivery_unverified'
      await save()
      const bytes = new Uint8Array(await response.arrayBuffer())
      step.responseSha256 = createHash('sha256').update(bytes).digest('hex')
      const payload = JSON.parse(new TextDecoder().decode(bytes))
      step.deliveryVerified = response.ok && verifyDelivery(target, req.input, payload)
      if (target.id === 'mps-autonomous-audit') step.auditId = typeof payload.auditId === 'string' ? payload.auditId : undefined
      await save()
      if (!step.deliveryVerified) throw new Error('delivery_verification_failed_no_repayment')
      step.state = 'settled_and_delivery_verified'
      await save()
      console.log(JSON.stringify(step))
    }
    evidence.state = 'paid_once_delivery_verified_bazaar_refresh_pending'
    const current = await merchant()
    for (const step of evidence.steps) {
      if (!step.transaction) continue
      const row = current.find(r => r.resource === step.resource)
      if (Date.parse(row?.quality?.lastCalledAt ?? '') >= Date.parse(evidence.startedAt) - 5000
        && row?.accepts?.some(a => a.amount === step.amount)) step.state = 'settled_delivery_verified_bazaar_refreshed'
    }
    if (evidence.steps.every(s => s.state === 'skipped_recent_settlement' || s.state === 'settled_delivery_verified_bazaar_refreshed')) evidence.state = 'complete'
    await save()
    console.log(JSON.stringify(evidence))
  } catch (error) {
    evidence.state = 'stopped_reconcile_before_any_repayment'
    await save()
    console.error(error instanceof Error ? error.message : 'refresh_failed')
    throw new Error('refresh_stopped_no_automatic_repayment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(error => {
  console.error(error instanceof Error ? error.message : 'refresh_failed'); process.exitCode = 1
})
