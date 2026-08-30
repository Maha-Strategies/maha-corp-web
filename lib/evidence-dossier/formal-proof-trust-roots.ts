import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  isEpochStale,
  isSyntheticKey,
  resolveSigningKey,
  SigningKeyError,
  type SigningKeyEntry,
} from './formal-proof-signing-keys.ts'
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
  | 'signature-key-malformed'
  | 'signature-dossier-mismatch'

/**
 * Failures of the key's standing rather than of the cryptography.
 *
 * These are separated because a genuine signature by a key that is not
 * permitted to sign this payload is exactly the case that previously read as
 * fully valid. The signature really is authentic; the authority is not.
 */
export type SigningAuthorityFailureCode =
  | 'signing-authority-scope-missing'
  | 'signing-authority-scope-malformed'
  | 'signing-authority-wildcard-scope'
  | 'signing-authority-mismatch'
  | 'signing-authority-dossier-not-permitted'
  | 'signing-authority-validity-kind-not-permitted'
  | 'signing-authority-epoch-stale'
  | 'signing-authority-key-epoch-superseded'
  | 'signing-authority-production-standing-claimed'
  | 'signing-authority-expired'
  | 'signing-authority-not-yet-valid'

export interface SignatureCheck {
  /** The cryptographic signature is genuine and the key resolves. */
  authentic: boolean
  /** The resolved key is permitted to sign this payload. */
  authorityValid: boolean
  failures: SignatureFailureCode[]
  authorityFailures: SigningAuthorityFailureCode[]
  keyId: string | null
  authorityId: string | null
  epoch: number | null
  syntheticTestKey: boolean
}

const SIGNING_KEY_CODES: Record<string, SignatureFailureCode> = {
  'key-unknown': 'signature-key-unknown',
  'key-ambiguous': 'signature-key-ambiguous',
  'key-revoked': 'signature-key-revoked',
  'key-malformed': 'signature-key-malformed',
}

const SCOPE_CODES: Record<string, SigningAuthorityFailureCode> = {
  'scope-missing': 'signing-authority-scope-missing',
  'scope-malformed': 'signing-authority-scope-malformed',
  'scope-wildcard': 'signing-authority-wildcard-scope',
  'key-epoch-stale': 'signing-authority-key-epoch-superseded',
}

const REFUSED = (failures: SignatureFailureCode[], keyId: string | null): SignatureCheck => ({
  authentic: false,
  authorityValid: false,
  failures,
  authorityFailures: [],
  keyId,
  authorityId: null,
  epoch: null,
  syntheticTestKey: true,
})

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
  if (!envelope) return REFUSED(['signature-envelope-missing'], null)
  if (
    typeof envelope !== 'object' ||
    !envelope.payload ||
    !envelope.signature ||
    typeof envelope.signature.keyId !== 'string' ||
    typeof envelope.signature.value !== 'string' ||
    typeof envelope.payload.authorityId !== 'string'
  ) {
    return REFUSED(['signature-envelope-malformed'], null)
  }

  const keyId = envelope.signature.keyId
  let key: SigningKeyEntry
  try {
    key = resolveSigningKey(keyId, options.registry)
  } catch (error) {
    if (error instanceof SigningKeyError) {
      const signatureCode = SIGNING_KEY_CODES[error.code]
      if (signatureCode) return REFUSED([signatureCode], keyId)
      // A scope problem is a failure of standing, not of cryptography. The key
      // exists and is unrevoked, so the signature can still be genuine; what it
      // cannot be is authorized.
      const scopeCode = SCOPE_CODES[error.code] ?? 'signing-authority-scope-malformed'
      return {
        authentic: false,
        authorityValid: false,
        failures: [],
        authorityFailures: [scopeCode],
        keyId,
        authorityId: null,
        epoch: null,
        syntheticTestKey: true,
      }
    }
    return REFUSED(['signature-key-unknown'], keyId)
  }

  // Authenticity first, and nothing the payload says is believed before it.
  const failures: SignatureFailureCode[] = []
  if (!verifyTrustRootSignature(envelope, key.publicKey)) {
    return REFUSED(['signature-invalid'], keyId)
  }
  if (envelope.payload.dossierId !== dossierId) failures.push('signature-dossier-mismatch')

  // Standing next. These are separate because a genuine signature by a key that
  // may not sign this payload is precisely the case that used to read valid.
  const authorityFailures: SigningAuthorityFailureCode[] = []
  if (envelope.payload.authorityId !== key.authorityId) {
    authorityFailures.push('signing-authority-mismatch')
  }
  if (!key.scope.permittedDossierIds.includes(envelope.payload.dossierId)) {
    authorityFailures.push('signing-authority-dossier-not-permitted')
  }
  if (envelope.payload.authorityEpoch !== key.epoch) {
    authorityFailures.push('signing-authority-epoch-stale')
  }
  if (isEpochStale(key, options.registry)) {
    authorityFailures.push('signing-authority-key-epoch-superseded')
  }
  // A synthetic key must never stand behind anything outside its fixture set,
  // even if the payload otherwise looks well formed.
  if (isSyntheticKey(key) && !key.scope.permittedDossierIds.includes(envelope.payload.dossierId)) {
    authorityFailures.push('signing-authority-production-standing-claimed')
  }

  const validity = envelope.payload.validity
  if (!validity || !['window', 'non-expiring-test-fixture'].includes(validity.kind)) {
    failures.push('signature-envelope-malformed')
  } else {
    if (!key.scope.allowedValidityKinds.includes(validity.kind)) {
      authorityFailures.push('signing-authority-validity-kind-not-permitted')
    }
    if (validity.kind === 'window') {
      const now = options.now ?? new Date()
      if (Number.isNaN(Date.parse(validity.notBefore)) || Number.isNaN(Date.parse(validity.notAfter))) {
        failures.push('signature-envelope-malformed')
      } else {
        if (now < new Date(validity.notBefore)) authorityFailures.push('signing-authority-not-yet-valid')
        if (now > new Date(validity.notAfter)) authorityFailures.push('signing-authority-expired')
      }
    }
  }

  return {
    authentic: failures.length === 0,
    authorityValid: failures.length === 0 && authorityFailures.length === 0,
    failures,
    authorityFailures,
    keyId,
    authorityId: key.authorityId,
    epoch: envelope.payload.authorityEpoch,
    syntheticTestKey: isSyntheticKey(key),
  }
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
