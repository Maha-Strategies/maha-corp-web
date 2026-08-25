import { EMPTY_PAYLOAD_SHA256, canonicalJson } from './canonical.ts'

/**
 * Browser-side digest using Web Crypto. Same canonicalization as the server
 * path, so a digest computed in the operator UI matches the one the ingestion
 * command computes for identical content.
 *
 * Nothing here contacts the network.
 */

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function browserProvenanceDigest(value: unknown): Promise<string> {
  const payload = canonicalJson(value)
  if (!payload || payload === '{}' || payload === 'null' || payload === '[]') {
    throw new Error('Refusing to digest an empty payload.')
  }
  const hex = await sha256Hex(payload)
  if (hex === EMPTY_PAYLOAD_SHA256) {
    throw new Error('Refusing to emit the empty-payload SHA-256 as provenance.')
  }
  return `sha256:${hex}`
}
