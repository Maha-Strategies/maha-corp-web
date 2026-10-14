import { createCipheriv, createHmac, randomBytes } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createPublicClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { MODULAR_RELEASE, PRODUCTION_ENDPOINTS, releaseExample } from '../lib/api-v1/production-release.ts'
import { handlerFor } from '../lib/api-v1/handlers.ts'
import { prepareModularPurchase, submitModularPurchase } from '../lib/x402/modular-buyer.ts'
import { decodeChallenge } from '../lib/x402/client.ts'
import { parsePaymentHeader } from '../lib/x402/protocol.ts'
import { receiptMatchesAuthorization } from '../lib/api-v1/base-proof.ts'
import { readProductIndex } from '../lib/x402/product-index.ts'
import { demandDigest } from '../lib/x402/demand6/digest.ts'
import { validateDiscoveryExtension, validateDiscoveryExtensionSpec } from '@x402/extensions/bazaar'
import { usdcNetwork } from '../lib/x402/networks.ts'
import { checkRefusedOriginal } from '../lib/x402/modular-retry.ts'

export const CONFIRMATION = 'PUBLISHER_FUNDED_296_ONCE_MAX_6_098840_USDC_CONTROLLED_RETRY_38519203625'
export const CAP = 6098840n
const ORIGIN = 'https://www.mahastrategies.com', SCOPE = MODULAR_RELEASE.version
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const transport: typeof fetch = (input, init) => fetch(process.argv.includes('--loopback') && String(input).startsWith(ORIGIN + '/api/v1/') ? String(input).replace(ORIGIN, 'http://127.0.0.1:8795') : input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)),
  'user-agent': 'maha-operator-modular-indexing/1', 'x-maha-discovery-source': 'maha_canary' } })
export function assertModularQuote(challenge: ReturnType<typeof decodeChallenge>, id: string) {
  const e = PRODUCTION_ENDPOINTS.find(e => e.id === id)!, t = challenge.accepts[0], n = usdcNetwork('eip155:8453')
  if (!e || challenge.x402Version !== 2 || challenge.accepts.length !== 1 || challenge.resource.url !== ORIGIN + e.path
    || t.network !== MODULAR_RELEASE.network || t.amount !== e.amount || t.asset.toLowerCase() !== n.asset.toLowerCase()
    || t.payTo.toLowerCase() !== MODULAR_RELEASE.payee || t.scheme !== 'exact' || t.maxTimeoutSeconds !== 60
    || t.extra?.name !== n.domain.name || t.extra?.version !== n.domain.version) throw Error('quote_terms_changed')
  const b = challenge.extensions?.bazaar
  if (!b || !validateDiscoveryExtensionSpec(b as Record<string, unknown>).valid || !validateDiscoveryExtension(b as Parameters<typeof validateDiscoveryExtension>[0]).valid) throw Error('bazaar_declaration_invalid')
  const recovery = challenge.extensions?.['maha-input-bound-recovery'] as { info?: { retentionSeconds: number; automaticRepayment: boolean; receiptRetentionSeconds: number } }
  if (recovery?.info?.retentionSeconds !== 86400 || recovery.info.receiptRetentionSeconds !== 7776000 || recovery.info.automaticRepayment !== false) throw Error('recovery_contract_changed')
}
export async function observeModularIndex() {
  const snapshot = await readProductIndex()
  const indexed = PRODUCTION_ENDPOINTS.filter(e => snapshot.resources.includes(ORIGIN + e.path)).map(e => e.id)
  return { checkedAt: snapshot.checkedAt, complete: snapshot.complete, available: snapshot.available, indexed,
    missingOrUnknown: PRODUCTION_ENDPOINTS.filter(e => !indexed.includes(e.id)).map(e => e.id), automaticRefreshPayments: false }
}
export async function run() {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some(a => !['--pay', '--observe', '--loopback'].includes(a))) throw Error('unsupported_mode')
  if (args.includes('--observe')) { console.log(JSON.stringify(await observeModularIndex())); return }
  // No signing credential is inspected until every unsigned quote passes.
  for (const e of PRODUCTION_ENDPOINTS) {
    const response = await transport(ORIGIN + e.path, { method: e.method, headers: { 'content-type': 'application/json' },
      body: JSON.stringify(releaseExample(e.id)!.input), redirect: 'error', signal: AbortSignal.timeout(20000) })
    const header = response.headers.get('PAYMENT-REQUIRED'); await response.body?.cancel()
    if (response.status !== 402 || !header || header.length > 12000) throw Error('unpaid_preflight_failed')
    assertModularQuote(decodeChallenge(header), e.id)
  }
  if (!args.includes('--pay')) { console.log(JSON.stringify({ state: 'unpaid_preflight_passed', count: 296, maximumBaseUnits: String(CAP), index: await observeModularIndex() })); return }
  const output = process.env.MODULAR_INDEXING_OUTPUT_PATH
  if (!output || process.env.MODULAR_INDEXING_CONFIRMATION !== CONFIRMATION || process.env.GITHUB_RUN_ATTEMPT !== '1') throw Error('explicit_first_attempt_approval_required')
  const key = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw Error('protected_signer_unavailable')
  const account = privateKeyToAccount(key as `0x${string}`)
  if (account.address.toLowerCase() !== MODULAR_RELEASE.operatorWallet) throw Error('wrong_operator_wallet')
  const asset = usdcNetwork('eip155:8453').asset as `0x${string}`
  const client = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org', { retryCount: 0, timeout: 15000 }) })
  const abi = parseAbi(['function balanceOf(address) view returns(uint256)', 'function authorizationState(address,bytes32) view returns(bool)'])
  if (await client.getChainId() !== 8453 || await client.readContract({ address: asset, abi, functionName: 'balanceOf', args: [account.address] }) < CAP) throw Error('wrong_chain_or_insufficient_batch_funding')
  type Step = { id: string; path: string; amountBaseUnits: string; state: string; transaction?: string; responseDigest?: string; chainConfirmed?: boolean; payloadVerified?: boolean; status?: number; errorCode?: string; settlement?: string; delivery?: string }
  const evidence = { version: SCOPE, classification: 'publisher-funded-operator-activity', customerRevenue: false, organicDemand: false, automaticRepayment: false,
    network: MODULAR_RELEASE.network, buyer: account.address, payee: MODULAR_RELEASE.payee, maximumBaseUnits: String(CAP), authorizedBaseUnits: '0', confirmedBaseUnits: '0',
    startedAt: new Date().toISOString(), state: 'running', steps: [] as Step[], index: await observeModularIndex(),
    controlledRetry: null as Awaited<ReturnType<typeof checkRefusedOriginal>> | null }
  const packets: unknown[] = []
  const encryptionKey = createHmac('sha256', key).update(SCOPE + ':private-outbox').digest()
  const save = async () => {
    await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 })
    await writeFile(output + '.recovery-encrypted.json', JSON.stringify({ scope: SCOPE, packets }), { mode: 0o600 })
  }
  await save()
  try {
    const previousDirectory = process.env.MODULAR_PREVIOUS_ATTEMPT_DIRECTORY
    if (!previousDirectory) throw Error('previous_attempt_evidence_required')
    const load = async (suffix: string) => {
      const file = previousDirectory + '/modular296-indexing-evidence.json' + suffix
      if ((await stat(file)).size > 2097152) throw Error('previous_attempt_evidence_oversized')
      return JSON.parse(await readFile(file, 'utf8'))
    }
    const first = PRODUCTION_ENDPOINTS[0], firstHandler = handlerFor(first.id, first.amount)!
    const block = await client.getBlock({ blockTag: 'latest' })
    evidence.controlledRetry = await checkRefusedOriginal({ key, payer: account.address, scope: SCOPE, payee: MODULAR_RELEASE.payee,
      maximumBaseUnits: String(CAP), report: await load(''), outbox: await load('.recovery-encrypted.json'), now: Date.now(), chainTimestamp: block.timestamp,
      contract: { id: first.id, path: first.path, amount: first.amount, recoverySeconds: 86400,
        validateInput: x => firstHandler.input.parse(x), validateOutput: x => firstHandler.output.parse(x) },
      authorizationUsed: (payer, nonce) => client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [payer as `0x${string}`, nonce as `0x${string}`] }) })
    await save()
    console.log(JSON.stringify({ state: 'controlled_retry_gate_passed', previousRunId: '38519203625', previousAuthorizationExpired: true, previousNonceUnused: true, maximumBaseUnits: String(CAP) }))
    for (const e of PRODUCTION_ENDPOINTS) {
      const h = handlerFor(e.id, e.amount)!, sample = releaseExample(e.id)!, input = h.input.parse(sample.input)
      // Stable, private nonce seed prevents a later workflow dispatch making a
      // replacement purchase. No reauthorization or automatic resume exists.
      const secret = createHmac('sha256', key).update(SCOPE + ':' + e.id).digest('hex')
      const { modularPaymentNonce } = await import('../lib/x402/input-bound-payment.ts')
      const nonce = modularPaymentNonce(e.id, demandDigest(input), secret) as `0x${string}`
      if (await client.readContract({ address: asset, abi, functionName: 'authorizationState', args: [account.address, nonce] })) throw Error('original_authorization_already_used_do_not_repay')
      const step: Step = { id: e.id, path: e.path, amountBaseUnits: e.amount, state: 'preparing' }
      evidence.steps.push(step)
      const contract = { id: e.id, path: e.path, amount: e.amount, recoverySeconds: 86400, validateInput: (x: unknown) => h.input.parse(x),
        validateOutput: (x: unknown) => {
          const value = h.output.parse(x)
          if (demandDigest(value) !== demandDigest(sample.output)) throw Error('deterministic_delivery_mismatch')
          return value
        } }
      const capsule = await prepareModularPurchase(contract, { input, payer: account.address, maximumAmount: BigInt(e.amount), secret, fetchImpl: transport,
        signTypedData: typed => account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]),
        persist: async capsule => {
          const next = BigInt(evidence.authorizedBaseUnits) + BigInt(e.amount)
          if (next > CAP) throw Error('approved_cap_exceeded')
          const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv); cipher.setAAD(Buffer.from(SCOPE))
          const ciphertext = Buffer.concat([cipher.update(JSON.stringify(capsule)), cipher.final()])
          packets.push({ id: e.id, iv: iv.toString('hex'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('hex') })
          evidence.authorizedBaseUnits = String(next); step.state = 'authorized_outcome_unknown'; await save()
        } })
      const result = await submitModularPurchase(contract, capsule, { fetchImpl: transport })
      step.status = 'status' in result ? result.status : undefined
      step.errorCode = 'errorCode' in result ? result.errorCode : undefined
      step.settlement = result.settlement; step.delivery = result.delivery; await save()
      if (result.settlement !== 'provider_reported' || !result.transaction || result.delivery !== 'validated_response') throw Error('settlement_or_delivery_unknown_do_not_repay')
      step.transaction = result.transaction; step.responseDigest = demandDigest(result.data); step.payloadVerified = true; await save()
      const parsed = parsePaymentHeader(capsule.headers['PAYMENT-SIGNATURE'])
      if (!parsed.ok) throw Error('capsule_invalid')
      const authorization = parsed.payment.payload.authorization as { nonce: string }
      const receipt = await client.getTransactionReceipt({ hash: result.transaction as `0x${string}` })
      if (!receiptMatchesAuthorization(receipt, { transaction: result.transaction, payer: account.address.toLowerCase(), payee: MODULAR_RELEASE.payee, amount: e.amount, nonce: authorization.nonce })) throw Error('chain_authorization_not_confirmed_do_not_repay')
      step.chainConfirmed = true; step.state = 'confirmed_and_delivered'
      evidence.confirmedBaseUnits = String(BigInt(evidence.confirmedBaseUnits) + BigInt(e.amount)); await save()
      if (evidence.steps.length === 1 || evidence.steps.length % 10 === 0) console.log(JSON.stringify({ state: 'operator_indexing_progress', confirmedAndDelivered: evidence.steps.length,
        confirmedBaseUnits: evidence.confirmedBaseUnits, maximumBaseUnits: String(CAP), automaticRepayment: false }))
      await wait(2200) // Preserve the global wallet admission quota; no exemption.
    }
    evidence.index = await observeModularIndex()
    evidence.state = evidence.index.complete && !evidence.index.missingOrUnknown.length ? 'indexed' : 'payments_complete_index_pending'
    await save()
    console.log(JSON.stringify({ state: evidence.state, confirmed: evidence.steps.filter(s => s.chainConfirmed).length, delivered: evidence.steps.filter(s => s.payloadVerified).length,
      indexed: evidence.index.indexed.length, authorizedBaseUnits: evidence.authorizedBaseUnits, confirmedBaseUnits: evidence.confirmedBaseUnits }))
  } catch {
    evidence.state = 'stopped_review_required_no_repayment'; await save()
    throw Error('indexing_stopped_review_required_no_repayment')
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch(() => { console.error('modular_indexing_failed_no_automatic_repayment'); process.exitCode = 1 })
