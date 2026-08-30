import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { resolveSigningKey, SigningKeyError, type SigningKeyEntry } from './formal-proof-signing-keys.ts'
import { verifyTrustRootSignature, type SignedTrustRootEnvelope } from './formal-proof-signing.ts'

/**
 * Out-of-package authorization for formal-proof bindings.
 *
 * The gap this closes: a package could previously declare which binding
 * manifest was authoritative. Rewriting the authorized boundary text to say
 * "this proof establishes that the model is empirically valid", recompiling the
 * attachments against the rewritten manifest and recomputing every digest
 * produced a package that verified with zero findings. Real Lean ran, the
 * theorems were genuine, every file agreed with every other file. Integrity was
 * intact and authorization was fabricated.
 *
 * Internal consistency cannot establish authorization, because the thing being
 * checked supplies the standard it is checked against. So the standard lives
 * outside the package: a trust root is committed here, reviewed as code, and
 * supplied to the verifier separately. A package can no longer nominate its own
 * authority.
 *
 * Phase 2 adds a signature over that authorization. The digest alone lives in
 * the same tree as the thing it authorizes, so one commit could change both; a
 * signature separates them, because the private key is not in the tree.
 *
 * WHAT A SIGNATURE STILL DOES NOT MEAN. It establishes that a holder of the
 * named key attested to this set of bindings. It says nothing about whether the
 * underlying claim is true. A correctly signed trust root over a false claim is
 * a correctly signed false claim.
 *
 * The key currently in the registry is synthetic and its seed is published, so
 * today this raises the cost of forgery rather than preventing it. See
 * PRODUCTION_SIGNING_BOUNDARY.
 */

export const TRUST_ROOT_SCHEMA_VERSION = 'maha-formal-proof-trust-root/0.1' as const

export interface FormalProofTrustRoot {
  schemaVersion: typeof TRUST_ROOT_SCHEMA_VERSION
  /** The dossier these bindings are authorized for. */
  dossierId: string
  /** SHA-256 of the canonical binding manifest that is authorized. */
  bindingManifestSha256: string
  /** Manifest-level revision. An older manifest is a downgrade, not an alternative. */
  bindingManifestRevision: number
  /** SHA-256 of the authorized proof manifest. */
  proofManifestSha256: string
  /** The only claims a formal proof may bind to in this dossier. Ordered. */
  authorizedClaimIds: readonly string[]
  /** The only theorems that may be attached, fully qualified. Ordered. */
  authorizedTheorems: readonly string[]
  /** The only calculation operations a proof may cite. Ordered. */
  authorizedCalculationOperationIds: readonly string[]
  /** The exact pinned toolchain. */
  toolchain: string
}

/**
 * The authorized roots.
 *
 * One entry per dossier. Adding or changing an entry is a reviewed source
 * change, which is the whole point: authorization should be as hard to alter as
 * code, not as easy to alter as a file inside a package.
 */
export const FORMAL_PROOF_TRUST_ROOTS: readonly FormalProofTrustRoot[] = [
  {
    schemaVersion: TRUST_ROOT_SCHEMA_VERSION,
    dossierId: 'dos_internal_interval_tolerance_fixture',
    bindingManifestSha256: 'sha256:aa1c9298f2d41c07989fb6a3213e296c2efd4854d071afc4b6e62b3d64d95b7e',
    bindingManifestRevision: 1,
    proofManifestSha256: 'sha256:2c6d9fd67836602ae72e4b6fd152dd51a264986ea909abf4386e04521ff69dca',
    authorizedClaimIds: ['clm_interval_composition'],
    authorizedTheorems: ['Maha.Interval.add_mem', 'Maha.Interval.add_valid'],
    authorizedCalculationOperationIds: ['interval-add'],
    toolchain: 'leanprover/lean4:v4.33.1',
  },
]

export class TrustRootError extends Error {}

const DIGEST = /^sha256:[0-9a-f]{64}$/

/** Rejects a malformed root rather than trusting a partially specified one. */
export function assertValidTrustRoot(root: FormalProofTrustRoot): void {
  if (root.schemaVersion !== TRUST_ROOT_SCHEMA_VERSION) {
    throw new TrustRootError(`Unknown trust root version ${root.schemaVersion}.`)
  }
  if (!root.dossierId.trim()) throw new TrustRootError('A trust root must name a dossier.')
  for (const [field, value] of [
    ['bindingManifestSha256', root.bindingManifestSha256],
    ['proofManifestSha256', root.proofManifestSha256],
  ] as const) {
    if (!DIGEST.test(value)) throw new TrustRootError(`${field} must be a sha256 digest.`)
  }
  if (!Number.isInteger(root.bindingManifestRevision) || root.bindingManifestRevision < 1) {
    throw new TrustRootError('bindingManifestRevision must be an integer of at least 1.')
  }
  if (!root.authorizedClaimIds.length) throw new TrustRootError('A trust root must authorize at least one claim.')
  if (!root.authorizedTheorems.length) throw new TrustRootError('A trust root must authorize at least one theorem.')
  if (!root.toolchain.trim()) throw new TrustRootError('A trust root must pin a toolchain.')
  for (const [field, list] of [
    ['authorizedClaimIds', root.authorizedClaimIds],
    ['authorizedTheorems', root.authorizedTheorems],
    ['authorizedCalculationOperationIds', root.authorizedCalculationOperationIds],
  ] as const) {
    if (new Set(list).size !== list.length) throw new TrustRootError(`${field} lists a value more than once.`)
  }
}

/**
 * Resolves the single root for a dossier.
 *
 * Two roots for one dossier is ambiguous authorization, which is refused rather
 * than resolved by picking one: choosing between them would mean the verifier
 * decides what is authorized, which is exactly what it must not do.
 */
export function resolveTrustRoot(
  dossierId: string,
  roots: readonly FormalProofTrustRoot[] = FORMAL_PROOF_TRUST_ROOTS,
): FormalProofTrustRoot {
  const matches = roots.filter((root) => root.dossierId === dossierId)
  if (matches.length === 0) throw new TrustRootError(`No trust root authorizes formal proofs for ${dossierId}.`)
  if (matches.length > 1) throw new TrustRootError(`Ambiguous trust roots for ${dossierId}.`)
  assertValidTrustRoot(matches[0])
  return matches[0]
}

/** Convenience for regenerating a root's digests from the artifacts it authorizes. */
export function digestOf(canonicalText: string): string {
  return `sha256:${createHash('sha256').update(canonicalText, 'utf8').digest('hex')}`
}

export type SignatureFailureCode =
  | 'signature-envelope-missing'
  | 'signature-envelope-malformed'
  | 'signature-invalid'
  | 'signature-key-unknown'
  | 'signature-key-ambiguous'
  | 'signature-key-revoked'
  | 'signature-key-epoch-stale'
  | 'signature-key-malformed'
  | 'signature-epoch-stale'
  | 'signature-dossier-mismatch'
  | 'signature-expired'
  | 'signature-not-yet-valid'

export interface SignatureCheck {
  authentic: boolean
  failures: SignatureFailureCode[]
  keyId: string | null
  epoch: number | null
}

const SIGNING_KEY_CODES: Record<string, SignatureFailureCode> = {
  'key-unknown': 'signature-key-unknown',
  'key-ambiguous': 'signature-key-ambiguous',
  'key-revoked': 'signature-key-revoked',
  'key-epoch-stale': 'signature-key-epoch-stale',
  'key-malformed': 'signature-key-malformed',
}

/**
 * Checks an envelope's signature against the registry.
 *
 * The key is always resolved from the registry by id. A key travelling with the
 * envelope is ignored entirely: accepting one would let an attacker sign their
 * own authorization with their own key and have it verify.
 */
export function checkTrustRootSignature(
  envelope: SignedTrustRootEnvelope | undefined,
  dossierId: string,
  options: { registry?: readonly SigningKeyEntry[]; now?: Date } = {},
): SignatureCheck {
  const failures: SignatureFailureCode[] = []
  if (!envelope) return { authentic: false, failures: ['signature-envelope-missing'], keyId: null, epoch: null }
  if (
    typeof envelope !== 'object' ||
    !envelope.payload ||
    !envelope.signature ||
    typeof envelope.signature.keyId !== 'string' ||
    typeof envelope.signature.value !== 'string'
  ) {
    return { authentic: false, failures: ['signature-envelope-malformed'], keyId: null, epoch: null }
  }

  const keyId = envelope.signature.keyId
  let key: SigningKeyEntry
  try {
    key = resolveSigningKey(keyId, options.registry)
  } catch (error) {
    const code = error instanceof SigningKeyError ? SIGNING_KEY_CODES[error.code] : 'signature-key-unknown'
    return { authentic: false, failures: [code ?? 'signature-key-unknown'], keyId, epoch: null }
  }

  // The signature must be checked before anything the payload says is believed.
  if (!verifyTrustRootSignature(envelope, key.publicKey)) {
    return { authentic: false, failures: ['signature-invalid'], keyId, epoch: null }
  }

  // Only now is the payload trustworthy enough to compare.
  if (envelope.payload.dossierId !== dossierId) failures.push('signature-dossier-mismatch')
  if (envelope.payload.authorityEpoch !== key.epoch) failures.push('signature-epoch-stale')

  const validity = envelope.payload.validity
  if (validity?.kind === 'window') {
    const now = options.now ?? new Date()
    if (Number.isNaN(Date.parse(validity.notBefore)) || Number.isNaN(Date.parse(validity.notAfter))) {
      failures.push('signature-envelope-malformed')
    } else {
      if (now < new Date(validity.notBefore)) failures.push('signature-not-yet-valid')
      if (now > new Date(validity.notAfter)) failures.push('signature-expired')
    }
  } else if (validity?.kind !== 'non-expiring-test-fixture') {
    failures.push('signature-envelope-malformed')
  }

  return { authentic: failures.length === 0, failures, keyId, epoch: envelope.payload.authorityEpoch }
}

/** The committed signed envelope for the internal fixture. */
export function loadSignedTrustRoot(path = 'content/evidence-dossier/formal-proof-trust-root.json'): SignedTrustRootEnvelope | undefined {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8')) as SignedTrustRootEnvelope
  } catch {
    return undefined
  }
}

/** Derives the Phase 1 trust-root shape from a signed envelope's payload. */
export function trustRootFromEnvelope(envelope: SignedTrustRootEnvelope): FormalProofTrustRoot {
  return {
    schemaVersion: TRUST_ROOT_SCHEMA_VERSION,
    dossierId: envelope.payload.dossierId,
    bindingManifestSha256: envelope.payload.bindingManifestSha256,
    bindingManifestRevision: envelope.payload.bindingManifestRevision,
    proofManifestSha256: envelope.payload.proofManifestSha256,
    authorizedClaimIds: envelope.payload.authorizedClaimIds,
    authorizedTheorems: envelope.payload.authorizedTheorems,
    authorizedCalculationOperationIds: envelope.payload.authorizedCalculationOperationIds,
    toolchain: envelope.payload.toolchain,
  }
}
