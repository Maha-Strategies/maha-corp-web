import { createHash } from 'node:crypto'

import canonicalize from 'canonicalize'
import secp256k1 from 'secp256k1'

import { MAHA_CARP_URL, didDocumentForPublicKey, normalizePrivateKey, publicKeyFor } from './identity.ts'

export const MAHA_CARP_ENDPOINT_BINDING_URL = `${MAHA_CARP_URL}/.well-known/carp/endpoint-binding.json`

export function signedEndpointBinding(options: { privateKey: string; issuedAt: string; expiresAt: string }) {
  const privateKey = normalizePrivateKey(options.privateKey)
  const publicKey = publicKeyFor(privateKey)
  const did = didDocumentForPublicKey(publicKey).id
  const descriptor = {
    type: 'CARPEndpointBinding',
    version: '0.1',
    id: did,
    endpoint: MAHA_CARP_URL,
    bindingUrl: MAHA_CARP_ENDPOINT_BINDING_URL,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    verificationMethod: `${did}#${did.slice('did:key:'.length)}`,
    proofPurpose: 'assertionMethod',
    publicKey: { type: 'secp256k1', encoding: 'compressed-hex', value: publicKey },
  }
  const protectedHeader = Buffer.from(JSON.stringify({ alg: 'ES256K' })).toString('base64url')
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  const signature = Buffer.from(secp256k1.ecdsaSign(digest, Buffer.from(privateKey, 'hex')).signature).toString('base64url')
  return {
    ...descriptor,
    proof: {
      type: 'JsonWebSignature2020',
      canonicalization: 'RFC8785',
      jws: `${protectedHeader}..${signature}`,
    },
  }
}

export function verifyEndpointBinding(value: ReturnType<typeof signedEndpointBinding>): boolean {
  const { proof, ...descriptor } = value
  if (descriptor.endpoint !== MAHA_CARP_URL || descriptor.bindingUrl !== MAHA_CARP_ENDPOINT_BINDING_URL) return false
  const [protectedHeader, empty, signature] = proof.jws.split('.')
  if (!protectedHeader || empty !== '' || !signature) return false
  const payload = Buffer.from(canonicalize(descriptor) ?? '').toString('base64url')
  const digest = createHash('sha256').update(`${protectedHeader}.${payload}`).digest()
  return secp256k1.ecdsaVerify(Buffer.from(signature, 'base64url'), digest, Buffer.from(descriptor.publicKey?.value ?? '', 'hex'))
}

export function configuredEndpointBinding() {
  const privateKey = process.env.CARP_AGENT_PRIVATE_KEY
  if (!privateKey) return null
  return signedEndpointBinding({ privateKey, issuedAt: '2026-08-21T00:00:00.000Z', expiresAt: '2027-08-21T00:00:00.000Z' })
}
