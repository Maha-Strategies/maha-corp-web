import { createHash } from 'node:crypto'

import canonicalize from 'canonicalize'
import secp256k1 from 'secp256k1'

export const MAHA_CARP_URL = 'https://www.mahastrategies.com'
export const MAHA_CARP_DID_URL = `${MAHA_CARP_URL}/.well-known/carp/did.json`
export const MAHA_CARP_SAD_URL = `${MAHA_CARP_URL}/.well-known/carp/sad.json`
export const MAHA_CARP_IDENTITY_ISSUED_AT = '2026-08-27T00:00:00.000Z'
export const MAHA_CARP_IDENTITY_EXPIRES_AT = '2027-08-27T00:00:00.000Z'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58(value: Uint8Array) {
  let number = BigInt(`0x${Buffer.from(value).toString('hex') || '0'}`)
  let encoded = ''
  const zero = BigInt(0)
  const fiftyEight = BigInt(58)
  while (number > zero) {
    const remainder = Number(number % fiftyEight)
    encoded = BASE58_ALPHABET[remainder] + encoded
    number /= fiftyEight
  }
  for (const byte of value) {
    if (byte !== 0) break
    encoded = `1${encoded}`
  }
  return encoded || '1'
}

export function normalizePrivateKey(value: string) {
  const normalized = value.trim().replace(/^0x/, '').toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(normalized) || !secp256k1.privateKeyVerify(Buffer.from(normalized, 'hex'))) {
    throw new Error('CARP_AGENT_PRIVATE_KEY must be a valid 32-byte secp256k1 private key.')
  }
  return normalized
}

export function publicKeyFor(privateKey: string) {
  return Buffer.from(secp256k1.publicKeyCreate(Buffer.from(normalizePrivateKey(privateKey), 'hex'), true)).toString('hex')
}

export function multibaseForPublicKey(publicKeyHex: string) {
  const publicKey = Buffer.from(publicKeyHex, 'hex')
  if (publicKey.length !== 33 || (publicKey[0] !== 2 && publicKey[0] !== 3)) {
    throw new Error('CARP public key must be compressed secp256k1.')
  }
  // multicodec secp256k1-pub = 0xe7, varint-encoded as 0xe7 0x01.
  return `z${base58(Buffer.concat([Buffer.from([0xe7, 0x01]), publicKey]))}`
}

export function didDocumentForPublicKey(publicKeyHex: string) {
  const multibase = multibaseForPublicKey(publicKeyHex)
  const did = `did:key:${multibase}`
  const method = `${did}#${multibase}`
  return {
    '@context': ['https://www.w3.org/ns/did/v1.1'],
    id: did,
    verificationMethod: [{ id: method, type: 'Multikey', controller: did, publicKeyMultibase: multibase }],
    authentication: [method],
    assertionMethod: [method],
    capabilityInvocation: [method],
    capabilityDelegation: [method],
  }
}

type SadOptions = {
  privateKey: string
  issuedAt: string
  expiresAt: string
  sequence?: number
}

export function signedAgentDescriptor(options: SadOptions) {
  const privateKey = normalizePrivateKey(options.privateKey)
  const publicKey = publicKeyFor(privateKey)
  const didDocument = didDocumentForPublicKey(publicKey)
  const method = didDocument.assertionMethod[0]
  const descriptor = {
    type: 'CARPAgentDescriptor',
    version: '0.1',
    id: didDocument.id,
    handle: 'maha-strategies',
    sequence: options.sequence ?? 2,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    carpUrl: MAHA_CARP_URL,
    publicKey: { type: 'secp256k1', encoding: 'compressed-hex', value: publicKey },
    role: 'Seller',
    descrip: 'Maha Strategies CABEZON Seller for governed digital services and bounded physical-goods enquiries. Deep Context Evaluation is the only directly payable offering; physical-goods listings remain enquiry-only and explicitly non-purchasable until an order-specific quote is accepted.',
    protocols: [{ name: 'CARP', version: '0.1', minVersion: '0.1', features: ['challenge-response', 'encrypted-jsonrpc', 'async'] }],
    cryptography: { curve: 'secp256k1', signatureAlgorithm: 'ECDSA' },
    social: [
      { type: 'website', url: MAHA_CARP_URL },
      { type: 'seller-profile', url: `${MAHA_CARP_URL}/.well-known/carp/seller.json` },
    ],
  }
  const protectedHeader = Buffer.from(JSON.stringify({ alg: 'ES256K' })).toString('base64url')
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  const signature = Buffer.from(secp256k1.ecdsaSign(digest, Buffer.from(privateKey, 'hex')).signature).toString('base64url')
  return {
    ...descriptor,
    proof: {
      type: 'JsonWebSignature2020',
      created: options.issuedAt,
      verificationMethod: method,
      proofPurpose: 'assertionMethod',
      canonicalization: 'RFC8785',
      jws: `${protectedHeader}..${signature}`,
    },
  }
}

export function verifySignedAgentDescriptor(value: ReturnType<typeof signedAgentDescriptor>) {
  const { proof, ...descriptor } = value
  const [protectedHeader, empty, signature] = proof.jws.split('.')
  if (!protectedHeader || empty !== '' || !signature) return false
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  return secp256k1.ecdsaVerify(
    Buffer.from(signature, 'base64url'),
    digest,
    Buffer.from(descriptor.publicKey.value, 'hex'),
  )
}

export function configuredIdentity() {
  const value = process.env.CARP_AGENT_PRIVATE_KEY
  if (!value) return null
  const privateKey = normalizePrivateKey(value)
  const publicKey = publicKeyFor(privateKey)
  return {
    did: didDocumentForPublicKey(publicKey),
    sad: signedAgentDescriptor({
      privateKey,
      issuedAt: MAHA_CARP_IDENTITY_ISSUED_AT,
      expiresAt: MAHA_CARP_IDENTITY_EXPIRES_AT,
    }),
  }
}
