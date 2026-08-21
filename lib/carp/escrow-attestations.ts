import { createHash } from 'node:crypto'

import canonicalize from 'canonicalize'
import secp256k1 from 'secp256k1'

import { createDeliveryReference, type DeliveryReference } from './commerce-evidence.ts'
import { didDocumentForPublicKey, normalizePrivateKey, publicKeyFor } from './identity.ts'

type SignedProof = { type: 'JsonWebSignature2020'; canonicalization: 'RFC8785'; jws: string }

function normalizedAddress(value: string): string {
  const address = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(address)) throw new Error('sellerAddress must be a 20-byte EVM address.')
  return address
}

function normalizedOrderId(value: string): string {
  const orderId = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(orderId)) throw new Error('escrowOrderId must be a bytes32 hex value.')
  return orderId
}

function signDescriptor<T extends Record<string, unknown>>(descriptor: T, privateKey: string): T & { proof: SignedProof } {
  const protectedHeader = Buffer.from(JSON.stringify({ alg: 'ES256K' })).toString('base64url')
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  const signature = Buffer.from(secp256k1.ecdsaSign(digest, Buffer.from(privateKey, 'hex')).signature).toString('base64url')
  return { ...descriptor, proof: { type: 'JsonWebSignature2020', canonicalization: 'RFC8785', jws: `${protectedHeader}..${signature}` } }
}

function verifyDescriptor(value: { publicKey: { value: string }; proof: SignedProof } & Record<string, unknown>): boolean {
  const { proof, ...descriptor } = value
  const [protectedHeader, empty, signature] = proof.jws.split('.')
  if (!protectedHeader || empty !== '' || !signature) return false
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  return secp256k1.ecdsaVerify(Buffer.from(signature, 'base64url'), digest, Buffer.from(value.publicKey.value, 'hex'))
}

export function signedEscrowOrderBinding(input: { privateKey: string; sellerAddress: string; escrowOrderId: string; issuedAt: string; expiresAt: string }) {
  const privateKey = normalizePrivateKey(input.privateKey)
  const publicKey = publicKeyFor(privateKey)
  const did = didDocumentForPublicKey(publicKey).id
  return signDescriptor({
    type: 'CARPEscrowOrderBinding', version: '0.1', sellerDid: did,
    sellerAddress: normalizedAddress(input.sellerAddress), escrowOrderId: normalizedOrderId(input.escrowOrderId),
    issuedAt: input.issuedAt, expiresAt: input.expiresAt,
    publicKey: { type: 'secp256k1', encoding: 'compressed-hex', value: publicKey },
  }, privateKey)
}

export function verifyEscrowOrderBinding(value: ReturnType<typeof signedEscrowOrderBinding>): boolean {
  return value.type === 'CARPEscrowOrderBinding'
    && value.sellerDid === didDocumentForPublicKey(value.publicKey.value).id
    && /^0x[a-f0-9]{40}$/.test(value.sellerAddress)
    && /^0x[a-f0-9]{64}$/.test(value.escrowOrderId)
    && verifyDescriptor(value)
}

export function signedEscrowDeliveryReference(input: {
  privateKey: string
  sellerAddress: string
  escrowOrderId: string
  request: unknown
  result: unknown
  artifactBytes?: Uint8Array | null
  issuedAt: string
}): DeliveryReference & { escrowOrderId: string; sellerDid: string; sellerAddress: string; publicKey: { type: string; encoding: string; value: string }; issuedAt: string; proof: SignedProof } {
  const privateKey = normalizePrivateKey(input.privateKey)
  const publicKey = publicKeyFor(privateKey)
  const did = didDocumentForPublicKey(publicKey).id
  const escrowOrderId = normalizedOrderId(input.escrowOrderId)
  const reference = createDeliveryReference({ orderId: escrowOrderId, request: input.request, result: input.result, artifactBytes: input.artifactBytes })
  return signDescriptor({
    ...reference, escrowOrderId, sellerDid: did, sellerAddress: normalizedAddress(input.sellerAddress), issuedAt: input.issuedAt,
    publicKey: { type: 'secp256k1', encoding: 'compressed-hex', value: publicKey },
  }, privateKey)
}

export function verifyEscrowDeliveryReference(value: ReturnType<typeof signedEscrowDeliveryReference>): boolean {
  return value.orderId === value.escrowOrderId
    && value.sellerDid === didDocumentForPublicKey(value.publicKey.value).id
    && /^0x[a-f0-9]{40}$/.test(value.sellerAddress)
    && /^0x[a-f0-9]{64}$/.test(value.escrowOrderId)
    && verifyDescriptor(value)
}
