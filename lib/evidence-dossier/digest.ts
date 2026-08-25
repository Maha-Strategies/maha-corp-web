import { createHash } from 'node:crypto'

import {
  CANONICALIZATION_VERSION,
  EMPTY_PAYLOAD_SHA256,
  canonicalJson,
  canonicalize,
  isPlaceholderDigest,
} from './canonical.ts'

// Re-exported so existing importers keep a single entry point.
export { CANONICALIZATION_VERSION, EMPTY_PAYLOAD_SHA256, canonicalJson, canonicalize, isPlaceholderDigest }

/**
 * Deterministic provenance for evidence dossiers.
 *
 * Canonicalization runs before hashing so the same evidentiary content always
 * produces the same digest, and any change to an evidentiary field always
 * changes it. The digest field itself is excluded from its own preimage.
 */

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Digest of any dossier fragment. Throws rather than returning the empty-payload
 * hash, so a placeholder can never be mistaken for provenance.
 */
export function provenanceDigest(value: unknown): string {
  const payload = canonicalJson(value)
  if (!payload || payload === '{}' || payload === 'null' || payload === '[]') {
    throw new Error('Refusing to digest an empty payload.')
  }
  const hex = sha256Hex(payload)
  if (hex === EMPTY_PAYLOAD_SHA256) {
    throw new Error('Refusing to emit the empty-payload SHA-256 as provenance.')
  }
  return `sha256:${hex}`
}

