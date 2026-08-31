import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto'

import { canonicalJson } from '../../packages/maha-lean-bridge/src/canonicalize.ts'

/**
 * Signed trust-root envelopes for formal-proof authorization.
 *
 * Phase 1 moved authorization out of the package into reviewed source. That
 * resists a tampered package but not an attacker who can also edit the
 * repository: the digest and the thing it authorizes sit in the same tree, so
 * one commit changes both. A signature separates the two — the private key is
 * not in the tree, so editing the repository no longer produces a trust root
 * anyone will accept.
 *
 * WHY Ed25519.
 *
 *   * It is deterministic (RFC 8032). Signing is a pure function of key and
 *     message with no random nonce, so identical inputs produce identical
 *     signature bytes. Every artifact in this codebase is byte-reproducible and
 *     a randomized scheme — ECDSA without RFC 6979 — would put a varying field
 *     inside otherwise deterministic material.
 *   * It is native to node:crypto, so it adds no dependency to a package that
 *     is deliberately dependency-free.
 *   * It has no parameters to choose wrongly: one curve, one hash, fixed 32-byte
 *     keys and 64-byte signatures, and no signature malleability to reason about.
 *
 * WHAT A SIGNATURE MEANS HERE. It establishes that a holder of the named
 * private key attested to this exact set of authorized bindings. It says
 * nothing whatever about whether the underlying scientific claim is true. A
 * signed trust root over a false claim is a correctly signed false claim.
 */

export const SIGNED_TRUST_ROOT_VERSION = 'maha-signed-formal-proof-trust-root/0.1' as const
export const SIGNATURE_ALGORITHM = 'ed25519' as const
export const SIGNATURE_CANONICALIZATION = 'maha-dossier-canonical/1.0' as const

/** The authorized facts. Everything a verifier compares a package against. */
export interface TrustRootPayload {
  /**
   * The authority namespace this root claims to come from.
   *
   * Inside the signed payload so it cannot be substituted: an attacker cannot
   * take a genuine envelope and re-attribute it to a different authority
   * without invalidating the signature.
   */
  authorityId: string
  dossierId: string
  bindingManifestSha256: string
  bindingManifestRevision: number
  proofManifestSha256: string
  authorizedClaimIds: readonly string[]
  authorizedTheorems: readonly string[]
  authorizedCalculationOperationIds: readonly string[]
  toolchain: string
  /**
   * Monotonic authority generation.
   *
   * A key rotation raises the epoch. An envelope signed under an older epoch is
   * stale even if its signature is perfectly valid, which is what makes replay
   * of a superseded authorization detectable.
   */
  authorityEpoch: number
  /**
   * Validity window, or an explicit statement that this is a non-expiring test
   * fixture. Requiring one of the two means a root can never be silently
   * perpetual by omission.
   */
  validity:
    | { kind: 'window'; notBefore: string; notAfter: string }
    | { kind: 'non-expiring-test-fixture'; reason: string }
}

export interface TrustRootSignature {
  algorithm: typeof SIGNATURE_ALGORITHM
  canonicalization: typeof SIGNATURE_CANONICALIZATION
  keyId: string
  /** Base64 of the 64-byte Ed25519 signature. */
  value: string
}

export interface SignedTrustRootEnvelope {
  schemaVersion: typeof SIGNED_TRUST_ROOT_VERSION
  payload: TrustRootPayload
  signature: TrustRootSignature
}

/**
 * The exact bytes that are signed.
 *
 * Only the payload. The signature block is excluded, or it would have to
 * contain its own digest. Canonical JSON gives code-point key ordering, NFC
 * strings and no locale sensitivity, so macOS and Linux produce identical
 * bytes for identical content.
 */
export function signingBytes(payload: TrustRootPayload): Buffer {
  return Buffer.from(canonicalJson(payload), 'utf8')
}

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Builds a private key from a 32-byte seed, so fixtures are reproducible. */
export function privateKeyFromSeed(seed: Buffer) {
  if (seed.byteLength !== 32) throw new Error('An Ed25519 seed must be exactly 32 bytes.')
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' })
}

/** Builds a public key from raw 32 bytes, the form the registry stores. */
export function publicKeyFromRaw(raw: Buffer) {
  if (raw.byteLength !== 32) throw new Error('An Ed25519 public key must be exactly 32 bytes.')
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, raw]), format: 'der', type: 'spki' })
}

/** Raw 32-byte public key, base64, as stored in the registry. */
export function rawPublicKeyBase64(seed: Buffer): string {
  const spki = createPublicKey(privateKeyFromSeed(seed)).export({ format: 'der', type: 'spki' })
  return Buffer.from(spki.subarray(spki.length - 32)).toString('base64')
}

export function signTrustRoot(payload: TrustRootPayload, seed: Buffer, keyId: string): SignedTrustRootEnvelope {
  return {
    schemaVersion: SIGNED_TRUST_ROOT_VERSION,
    payload,
    signature: {
      algorithm: SIGNATURE_ALGORITHM,
      canonicalization: SIGNATURE_CANONICALIZATION,
      keyId,
      // Ed25519 takes no digest argument: the scheme hashes internally.
      value: cryptoSign(null, signingBytes(payload), privateKeyFromSeed(seed)).toString('base64'),
    },
  }
}

/**
 * Verifies the signature over the payload.
 *
 * Returns a boolean rather than throwing so a caller cannot accidentally treat
 * a thrown error as a pass. Malformed input is false, never an exception that
 * some enclosing try/catch swallows into success.
 */
export function verifyTrustRootSignature(envelope: SignedTrustRootEnvelope, publicKeyRawBase64: string): boolean {
  try {
    if (envelope.schemaVersion !== SIGNED_TRUST_ROOT_VERSION) return false
    if (envelope.signature.algorithm !== SIGNATURE_ALGORITHM) return false
    if (envelope.signature.canonicalization !== SIGNATURE_CANONICALIZATION) return false
    const signature = Buffer.from(envelope.signature.value, 'base64')
    if (signature.byteLength !== 64) return false
    const key = publicKeyFromRaw(Buffer.from(publicKeyRawBase64, 'base64'))
    return cryptoVerify(null, signingBytes(envelope.payload), key, signature)
  } catch {
    return false
  }
}
