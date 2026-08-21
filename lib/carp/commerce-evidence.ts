import { createHash } from 'node:crypto'

import canonicalize from 'canonicalize'

export const CARP_STRUCTURED_DIGEST_ALGORITHM = 'RFC8785-JCS-SHA256-v1'
export const CARP_BINARY_DIGEST_ALGORITHM = 'SHA-256-raw-bytes-v1'

export type Sha256Digest = `sha256:${string}`

export type StructuredDigest = {
  algorithm: typeof CARP_STRUCTURED_DIGEST_ALGORITHM
  digest: Sha256Digest
}

export type BinaryDigest = {
  algorithm: typeof CARP_BINARY_DIGEST_ALGORITHM
  digest: Sha256Digest
}

export type DeliveryReference = {
  version: '0.1'
  orderId: string
  requestDigest: StructuredDigest
  resultDigest: StructuredDigest
  artifactDigest: BinaryDigest | null
  issuer: {
    id: 'maha-strategies'
    kind: 'seller-generated'
    providerSigned: false
  }
  limitations: readonly [
    'The request and result digests identify RFC 8785 canonical JSON bytes, not an external provider response.',
    'The artifact digest identifies raw bytes, not delivery retrieval, buyer acceptance, or escrow-release eligibility.',
    'No escrow-release authorization is represented by this delivery reference.',
  ]
}

function digestBytes(bytes: Uint8Array): Sha256Digest {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/**
 * RFC 8785/JCS canonicalization for JSON-compatible values. `canonicalize`
 * rejects values JCS cannot represent (for example undefined and NaN), which
 * keeps a receipt digest reproducible across implementations.
 */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  const canonical = canonicalize(value)
  if (canonical === undefined) throw new Error('Structured delivery evidence must be RFC 8785 canonicalizable JSON.')
  return new TextEncoder().encode(canonical)
}

export function structuredDigest(value: unknown): StructuredDigest {
  return {
    algorithm: CARP_STRUCTURED_DIGEST_ALGORITHM,
    digest: digestBytes(canonicalJsonBytes(value)),
  }
}

export function binaryDigest(value: Uint8Array): BinaryDigest {
  return {
    algorithm: CARP_BINARY_DIGEST_ALGORITHM,
    digest: digestBytes(value),
  }
}

export function createDeliveryReference(input: {
  orderId: string
  request: unknown
  result: unknown
  artifactBytes?: Uint8Array | null
}): DeliveryReference {
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(input.orderId)) throw new Error('orderId must be a bounded non-secret identifier.')
  return {
    version: '0.1',
    orderId: input.orderId,
    requestDigest: structuredDigest(input.request),
    resultDigest: structuredDigest(input.result),
    artifactDigest: input.artifactBytes ? binaryDigest(input.artifactBytes) : null,
    issuer: { id: 'maha-strategies', kind: 'seller-generated', providerSigned: false },
    limitations: [
      'The request and result digests identify RFC 8785 canonical JSON bytes, not an external provider response.',
      'The artifact digest identifies raw bytes, not delivery retrieval, buyer acceptance, or escrow-release eligibility.',
      'No escrow-release authorization is represented by this delivery reference.',
    ],
  }
}

export function verifyStructuredDigest(value: unknown, candidate: StructuredDigest): boolean {
  return candidate.algorithm === CARP_STRUCTURED_DIGEST_ALGORITHM && candidate.digest === structuredDigest(value).digest
}

