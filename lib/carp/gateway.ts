import { createHash, randomBytes } from 'node:crypto'

import { Redis } from '@upstash/redis'
import * as adilos from 'adilosjs'
import * as ecjsonrpc from 'ecjsonrpc'
import secp256k1 from 'secp256k1'

import { scopedRedisKey } from '../redis-namespace.ts'
import { handleCarpSellerRequest, type CarpSellerReply, type CarpSellerRequest } from './seller.ts'
import { normalizePrivateKey, publicKeyFor } from './identity.ts'

export const EL_CABEZON = Object.freeze({
  did: 'did:key:zQ3shX2W5Nys6KxovY5mVQpsSjS9n8p5UeCFP8kMHWqxi1v96',
  publicKey: '028edf3b1d5900c50e1d4ddf3db5edabd4850bc9889674a695208959aa9f8e0fb9',
  carpUrl: 'http://70.66.243.75:8000',
})

type BlackMessage = ecjsonrpc.BlackMessage
type ChallengeRecord = { challenge: string; createdAt: string }
type StoredAnswer = { answer: unknown; sender: string; receivedAt: string }

function redis() {
  return Redis.fromEnv()
}

function privateKey() {
  const value = process.env.CARP_AGENT_PRIVATE_KEY
  if (!value) throw new Error('CARP_AGENT_PRIVATE_KEY is not configured.')
  return normalizePrivateKey(value)
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function challengeKey(challenge: string) {
  return scopedRedisKey(`carp:challenge:${digest(challenge)}`)
}

function peerKey(publicKey: string) {
  return scopedRedisKey(`carp:peer:${publicKey.toLowerCase()}`)
}

function answerKey(requestId: string) {
  return scopedRedisKey(`carp:answer:${digest(requestId)}`)
}

function normalizePublicKey(value: string) {
  if (!/^(02|03)[a-fA-F0-9]{64}$/.test(value)) throw new Error('Expected a compressed secp256k1 public key.')
  return Buffer.from(secp256k1.publicKeyConvert(Buffer.from(value, 'hex'), true)).toString('hex')
}

function knownPeer(publicKey: string) {
  const normalized = normalizePublicKey(publicKey)
  return normalized === EL_CABEZON.publicKey ? EL_CABEZON : null
}

function blackMessage(value: unknown): BlackMessage {
  if (!value || typeof value !== 'object') throw new Error('Encrypted CARP body must be an object.')
  const record = value as Record<string, unknown>
  if (typeof record.msghex !== 'string' || typeof record.sighex !== 'string' || typeof record.spkhex !== 'string') {
    throw new Error('Encrypted CARP body is missing msghex, sighex, or spkhex.')
  }
  if (record.msghex.length > 2_000_000 || record.sighex.length > 300 || record.spkhex.length > 130) {
    throw new Error('Encrypted CARP body exceeds the supported size.')
  }
  return { msghex: record.msghex, sighex: record.sighex, spkhex: normalizePublicKey(record.spkhex) }
}

function sellerRequest(value: unknown): CarpSellerRequest {
  if (!value || typeof value !== 'object') throw new Error('Decrypted CARP request must be an object.')
  const record = value as Record<string, unknown>
  if (record.jsonrpc !== '2.0' || typeof record.method !== 'string' || (typeof record.id !== 'string' && typeof record.id !== 'number')) {
    throw new Error('Decrypted CARP request is not JSON-RPC 2.0.')
  }
  return { jsonrpc: '2.0', method: record.method, params: record.params, id: String(record.id) }
}

export async function issueChallenge() {
  const sessionKey = randomBytes(32)
  const challenge = adilos.makeChallenge(sessionKey)
  const record: ChallengeRecord = { challenge, createdAt: new Date().toISOString() }
  await redis().set(challengeKey(challenge), JSON.stringify(record), { ex: 300, nx: true })
  return challenge
}

export async function acceptChallengeResponse(input: { response: string; challenge: string }) {
  if (input.response.length > 2_000 || input.challenge.length > 2_000) throw new Error('ADILOS message is too large.')
  const store = redis()
  const record = await store.get<ChallengeRecord | string>(challengeKey(input.challenge))
  const parsed = typeof record === 'string' ? JSON.parse(record) as ChallengeRecord : record
  if (!parsed || parsed.challenge !== input.challenge) throw new Error('Challenge is unknown or expired.')
  const publicKeyBytes = adilos.validateResponse(input.response, input.challenge)
  if (!publicKeyBytes) throw new Error('ADILOS response is invalid.')
  const publicKey = normalizePublicKey(adilos.toHexString(publicKeyBytes))
  const peer = knownPeer(publicKey)
  if (!peer) throw new Error('The proven key is not an approved CARP peer.')
  await Promise.all([
    store.set(peerKey(publicKey), JSON.stringify({ ...peer, authenticatedAt: new Date().toISOString() })),
    store.del(challengeKey(input.challenge)),
  ])
  return publicKey
}

export async function prepareSellerReply(input: unknown) {
  const encrypted = blackMessage(input)
  const peer = knownPeer(encrypted.spkhex)
  if (!peer) throw new Error('CARP peer is not approved.')
  const request = sellerRequest(ecjsonrpc.blackToRed(privateKey(), encrypted))
  const reply = handleCarpSellerRequest(request)
  return { peer, request, reply }
}

export async function deliverSellerReply(input: { peer: typeof EL_CABEZON; reply: CarpSellerReply }) {
  const encrypted = ecjsonrpc.redToBlack(privateKey(), input.peer.publicKey, input.reply)
  const response = await fetch(`${input.peer.carpUrl}/cgi-bin/encresult`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'maha-carp-seller/0.2' },
    body: JSON.stringify(encrypted),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`CARP result delivery returned HTTP ${response.status}.`)
}

export async function storeEncryptedAnswer(input: unknown) {
  const encrypted = blackMessage(input)
  const peer = knownPeer(encrypted.spkhex)
  if (!peer) throw new Error('CARP peer is not approved.')
  const answer = ecjsonrpc.blackToRed(privateKey(), encrypted)
  if (!answer || typeof answer !== 'object' || !('id' in answer)) throw new Error('CARP result is not JSON-RPC 2.0.')
  const requestId = String((answer as { id: unknown }).id)
  const stored: StoredAnswer = { answer, sender: peer.did, receivedAt: new Date().toISOString() }
  await redis().set(answerKey(requestId), JSON.stringify(stored), { ex: 3_600 })
  return requestId
}

export async function readStoredAnswer(requestId: string) {
  const stored = await redis().get<StoredAnswer | string>(answerKey(requestId))
  return typeof stored === 'string' ? JSON.parse(stored) as StoredAnswer : stored
}

export function encryptOutboundRequest(request: CarpSellerRequest) {
  return ecjsonrpc.redToBlack(privateKey(), EL_CABEZON.publicKey, request)
}

export function mahaCarpPublicKey() {
  return publicKeyFor(privateKey())
}
