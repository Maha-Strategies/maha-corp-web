import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { privateKeyToAccount } from 'viem/accounts'

import { createPaidFetch } from '../lib/x402/client.ts'
import { IDEMPOTENCY_KEY_HEADER, INPUT_HASH_HEADER } from '../lib/x402/admission.ts'
import { CANARY_BUYER, BASE_USDC, MAHA_PAYEE, BASE_NETWORK } from '../lib/x402/discovery-payment-recipe.ts'
import { MPS_AUTONOMOUS_AUDIT_OFFER } from '../lib/x402/offers.ts'

/**
 * The single authorized $0.10 MPS settlement, and the three things settlement
 * alone does not prove: that the job completes, that recovering it is free, and
 * that replaying the request does not charge again.
 *
 * x402-doctor cannot do this job. It deliberately never records a response
 * body -- which is right for a diagnostic that runs against arbitrary offers --
 * but the retrieval token is issued exactly once inside that body, so a
 * verifier that discards it cannot test recovery at all.
 *
 * The token is therefore held in memory and never written anywhere. Evidence
 * records that retrieval *worked*, not the credential that made it work.
 *
 * Pays at most once. Every failure path after the signature returns without
 * retrying: an x402 settlement can broadcast and then fail to answer, so a
 * second authorization can double-spend against a delivery nobody observed.
 */

const SUBJECT = 'https://www.mahastrategies.com/api/v1/mps/audit'
const MAX_AMOUNT = BigInt(MPS_AUTONOMOUS_AUDIT_OFFER.amount)

type Json = Record<string, unknown>

function assertEqual(field: string, actual: unknown, wanted: unknown): void {
  if (String(actual).toLowerCase() !== String(wanted).toLowerCase()) {
    throw new Error(`${field}: ${String(actual)} != ${String(wanted)}`)
  }
}

async function readJson(response: Response): Promise<Json> {
  const text = await response.text()
  try {
    return JSON.parse(text) as Json
  } catch {
    throw new Error(`Expected JSON, got ${response.status}: ${text.slice(0, 200)}`)
  }
}

export async function run(): Promise<void> {
  const evidence: Json = { subject: SUBJECT, startedAt: new Date().toISOString() }

  // --- 1. Free challenge, asserted before the key is used -------------------
  const challenge = await readJson(await fetch(SUBJECT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }))
  const accepts = (challenge.accepts ?? []) as Json[]
  if (accepts.length !== 1) throw new Error(`expected one requirement, got ${accepts.length}`)
  const requirement = accepts[0]
  assertEqual('amount', requirement.amount, MPS_AUTONOMOUS_AUDIT_OFFER.amount)
  assertEqual('network', requirement.network, BASE_NETWORK)
  assertEqual('asset', requirement.asset, BASE_USDC)
  assertEqual('payTo', requirement.payTo, MAHA_PAYEE)
  assertEqual('scheme', requirement.scheme, 'exact')
  evidence.terms = {
    amount: requirement.amount, network: requirement.network,
    asset: requirement.asset, payTo: requirement.payTo, scheme: requirement.scheme,
  }
  console.log(`terms: ${String(requirement.amount)} ${String(requirement.network)} -> ${String(requirement.payTo)}`)

  // --- 2. The request, and the claim that must cover exactly its bytes ------
  const extensions = challenge.extensions as Json | undefined
  const bazaar = extensions?.bazaar as Json | undefined
  const info = bazaar?.info as Json | undefined
  const input = (info?.input as Json | undefined)?.body as Json | undefined
  if (!input) throw new Error('the challenge published no input example')

  const clientRequestId = `mps_prod_verify_${process.env.GITHUB_RUN_ID ?? Date.now()}`
  const body = JSON.stringify({ ...input, clientRequestId })
  // Prefixed, not bare hex. readAdmissionClaim matches /^sha256:[a-f0-9]{64}$/
  // so the algorithm travels with the digest -- a bare hash would silently
  // become ambiguous the day a second algorithm is accepted.
  const inputHash = `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`
  const admissionHeaders = {
    'content-type': 'application/json',
    [IDEMPOTENCY_KEY_HEADER]: clientRequestId,
    [INPUT_HASH_HEADER]: inputHash,
  }
  evidence.clientRequestId = clientRequestId
  evidence.inputHash = inputHash
  console.log(`clientRequestId: ${clientRequestId}`)

  // --- 3. The one signature -------------------------------------------------
  const privateKey = process.env.X402_BUYER_PRIVATE_KEY?.trim()
  if (!privateKey || !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error('X402_BUYER_PRIVATE_KEY must contain a dedicated EVM private key.')
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  if (account.address.toLowerCase() !== CANARY_BUYER.toLowerCase()) {
    throw new Error(`Refused unexpected payer ${account.address}; expected ${CANARY_BUYER}.`)
  }
  evidence.payer = account.address

  let signatures = 0
  const paidFetch = createPaidFetch({
    address: account.address,
    chainId: 8453,
    signTypedData: (typedData) => account.signTypedData(typedData as Parameters<typeof account.signTypedData>[0]),
    onPaymentRequired(live) {
      signatures += 1
      if (signatures > 1) throw new Error('Refusing to sign a second authorization in one run.')
      const amount = BigInt(live.amount)
      if (amount <= BigInt(0) || amount > MAX_AMOUNT) {
        throw new Error(`Refusing ${amount} base units; the ceiling is ${MAX_AMOUNT}.`)
      }
      assertEqual('live network', live.network, BASE_NETWORK)
      assertEqual('live asset', live.asset, BASE_USDC)
      assertEqual('live payTo', live.payTo, MAHA_PAYEE)
    },
  })

  const paid = await paidFetch(SUBJECT, { method: 'POST', headers: admissionHeaders, body })
  const paymentResponse = paid.headers.get('payment-response') ?? ''
  const result = await readJson(paid)
  evidence.paidStatus = paid.status
  evidence.signaturesProduced = signatures

  let transaction: string | null = null
  if (paymentResponse) {
    try {
      const decoded = JSON.parse(Buffer.from(paymentResponse, 'base64').toString('utf8')) as Json
      transaction = typeof decoded.transaction === 'string' ? decoded.transaction : null
      evidence.paymentResponse = { success: decoded.success, network: decoded.network, transaction }
    } catch {
      evidence.paymentResponse = { parseError: true }
    }
  }
  console.log(`paid status: ${paid.status}  transaction: ${transaction ?? 'NONE'}`)

  if (paid.status !== 201) {
    evidence.outcome = 'delivery_failed_after_payment'
    await writeFile('mps-verification.json', `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    throw new Error(`Payment may have settled but delivery returned ${paid.status}. Preserve this evidence; do not retry.`)
  }

  const auditId = typeof result.auditId === 'string' ? result.auditId : null
  const retrievalToken = typeof result.retrievalToken === 'string' ? result.retrievalToken : null
  if (!auditId) throw new Error('The paid response carried no auditId.')
  if (!retrievalToken) throw new Error('The paid response carried no retrievalToken; the job would be unrecoverable.')
  evidence.auditId = auditId
  evidence.retrievalTokenIssued = true
  evidence.jobStatus = result.status
  evidence.sourceTextStored = result.sourceTextStored
  console.log(`auditId: ${auditId}  status: ${String(result.status)}`)

  // --- 4. Recovery must be free --------------------------------------------
  const retrievalUrl = `${SUBJECT}/${auditId}`
  const retrieved = await fetch(retrievalUrl, { headers: { authorization: `Bearer ${retrievalToken}` } })
  const retrievedBody = await readJson(retrieved)
  evidence.retrieval = {
    status: retrieved.status,
    free: retrieved.status !== 402,
    sameAudit: retrievedBody.auditId === auditId,
  }
  console.log(`retrieval: HTTP ${retrieved.status} free=${retrieved.status !== 402}`)
  if (retrieved.status === 402) throw new Error('Retrieval demanded a second payment. The offer must be unpriced on that path.')
  if (retrieved.status !== 200) throw new Error(`Retrieval returned ${retrieved.status}.`)
  if (retrievedBody.auditId !== auditId) throw new Error('Retrieval returned a different job.')

  // --- 5. Replay must not charge again --------------------------------------
  // Deliberately a plain fetch, not paidFetch: if this answers 402 the guard
  // has failed, and the correct reaction is to report it, not to pay it.
  const replay = await fetch(SUBJECT, { method: 'POST', headers: admissionHeaders, body })
  const replayBody = await readJson(replay)
  evidence.replay = {
    status: replay.status,
    chargedAgain: replay.status === 402,
    sameAudit: replayBody.auditId === auditId,
  }
  console.log(`replay: HTTP ${replay.status} sameAudit=${replayBody.auditId === auditId}`)
  if (replay.status === 402) throw new Error('An identical replay demanded a second payment. Idempotency is not holding.')
  if (replayBody.auditId !== auditId) {
    throw new Error(`An identical replay produced a different job (${String(replayBody.auditId)}); it would have been charged twice.`)
  }

  evidence.outcome = 'verified'
  evidence.finishedAt = new Date().toISOString()
  await writeFile('mps-verification.json', `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  console.log('\nVerified: one settlement, job delivered, retrieval free, replay charged nothing.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
