import { writeFile } from 'node:fs/promises'

import * as adilos from 'adilosjs'
import * as ecjsonrpc from 'ecjsonrpc'

import { EL_CABEZON } from '../lib/carp/gateway.ts'
import { MAHA_CARP_DID_URL, MAHA_CARP_SAD_URL, normalizePrivateKey, publicKeyFor, verifySignedAgentDescriptor } from '../lib/carp/identity.ts'

const baseUrl = process.env.CARP_SELLER_BASE_URL?.replace(/\/$/, '') ?? 'https://www.mahastrategies.com'
const evidencePath = process.env.CARP_HANDSHAKE_EVIDENCE_PATH ?? 'artifacts/carp/handshake-evidence.json'
const privateKey = normalizePrivateKey(process.env.CARP_AGENT_PRIVATE_KEY ?? '')

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(body)}`)
  return body
}

async function main() {
  const checks = {
    publishedDidMatchesSad: false,
    sadSignatureVerified: false,
    elCabezonChallengeAnswered: false,
    elCabezonAcknowledgedMahaKey: false,
    encryptedAboutAccepted: false,
    asynchronousResultPending: false,
  }
  let requestId: string | null = null

  try {
    const did = await json(`${baseUrl}/.well-known/carp/did.json`) as { id: string; verificationMethod: Array<{ publicKeyMultibase: string }> }
    const sad = await json(`${baseUrl}/.well-known/carp/sad.json`) as ReturnType<typeof import('../lib/carp/identity.ts').signedAgentDescriptor>
    if (sad.id !== did.id || !verifySignedAgentDescriptor(sad)) throw new Error('Published Maha DID/SAD identity verification failed.')
    if (sad.publicKey.value !== publicKeyFor(privateKey)) throw new Error('Local CARP key does not match the published SAD.')
    checks.publishedDidMatchesSad = true
    checks.sadSignatureVerified = true

    const challengeEnvelope = await json(`${EL_CABEZON.carpUrl}/cgi-bin/challenge`) as { result?: { challenge?: string } }
    const challenge = challengeEnvelope.result?.challenge
    if (!challenge) throw new Error('El-Cabezon did not return an ADILOS challenge.')
    const response = adilos.makeResponse(challenge, Buffer.from(privateKey, 'hex'))
    if (!response) throw new Error('Could not create the ADILOS response.')
    checks.elCabezonChallengeAnswered = true
    const accepted = await json(`${EL_CABEZON.carpUrl}/cgi-bin/response`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rsp: response, chall: challenge }),
    }) as { ack?: string }
    if (accepted.ack !== sad.publicKey.value) throw new Error('El-Cabezon acknowledged a different public key.')
    checks.elCabezonAcknowledgedMahaKey = true

    requestId = `maha-handshake-${Date.now()}`
    const encrypted = ecjsonrpc.redToBlack(privateKey, EL_CABEZON.publicKey, { jsonrpc: '2.0', method: 'about', params: [], id: requestId })
    const request = await fetch(`${EL_CABEZON.carpUrl}/cgi-bin/encrequest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encrypted), signal: AbortSignal.timeout(20_000),
    })
    const requestBody = await request.text()
    if (!request.ok) throw new Error(`El-Cabezon encrypted about request returned HTTP ${request.status}: ${requestBody}`)
    checks.encryptedAboutAccepted = true
    checks.asynchronousResultPending = true

    const evidence = {
      schemaVersion: '1.0.0', verifiedAt: new Date().toISOString(), outcome: 'accepted_pending_async_result',
      maha: { did: did.id, didUrl: MAHA_CARP_DID_URL, sadUrl: MAHA_CARP_SAD_URL, publicKey: sad.publicKey.value },
      peer: { did: EL_CABEZON.did, carpUrl: EL_CABEZON.carpUrl, publicKey: EL_CABEZON.publicKey },
      checks, requestId,
      caveats: [
        'El-Cabezon accepted the identity proof and encrypted request; directory inclusion requires Bryan\'s operator confirmation.',
        'No CARP rent, admission fee, escrow payment, or x402 payment was made by this handshake.',
      ],
    }
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8' })
    console.log(JSON.stringify(evidence, null, 2))
  } catch (error) {
    const evidence = {
      schemaVersion: '1.0.0', verifiedAt: new Date().toISOString(), outcome: 'blocked_by_peer_configuration',
      maha: { didUrl: MAHA_CARP_DID_URL, sadUrl: MAHA_CARP_SAD_URL },
      peer: { did: EL_CABEZON.did, carpUrl: EL_CABEZON.carpUrl, publicKey: EL_CABEZON.publicKey },
      checks, requestId, blocker: error instanceof Error ? error.message : String(error),
      caveats: [
        'This is partial handshake evidence, not proof of directory inclusion or end-to-end delivery.',
        'No CARP rent, admission fee, escrow payment, or x402 payment was made by this handshake.',
      ],
    }
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8' })
    console.error(JSON.stringify(evidence, null, 2))
    throw error
  }
}

await main()
