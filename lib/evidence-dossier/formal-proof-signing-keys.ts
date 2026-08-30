/**
 * The public-key registry for formal-proof trust roots.
 *
 * This is the root of authority and it lives outside the Evidence Dossier
 * package by construction. A package may carry an envelope; it may never carry
 * the key that decides whether that envelope counts. If it could, an attacker
 * would simply ship their own key alongside their own signature and every
 * signature would verify.
 *
 * Resolution fails closed. Unknown, duplicated, revoked and epoch-stale keys are
 * all refusals rather than warnings, because a verifier that continues past an
 * unresolved key is not checking anything.
 *
 * NO PRODUCTION PRIVATE KEY EXISTS OR IS COMMITTED. The only key here is a
 * synthetic fixture whose seed is a constant in this file, so anyone can forge
 * signatures under it. That is intentional and safe precisely because it
 * authorizes nothing outside the internal test fixture. See
 * PRODUCTION_SIGNING_BOUNDARY below for what would have to be true before any
 * of this authorizes real work.
 */

export const SIGNING_KEY_REGISTRY_VERSION = 'maha-formal-proof-key-registry/0.1' as const

export interface SigningKeyEntry {
  keyId: string
  /** Raw 32-byte Ed25519 public key, base64. */
  publicKey: string
  status: 'active' | 'revoked'
  /**
   * The authority generation this key signs for.
   *
   * An envelope must carry the epoch of the key that signed it. Rotation
   * introduces a new key at a higher epoch and revokes the old one, so a
   * replayed envelope from before the rotation is stale rather than merely
   * old-but-valid.
   */
  epoch: number
  /** Why the key exists, and for a revoked key, why it was withdrawn. */
  note: string
  /** True only for keys that authorize nothing outside internal fixtures. */
  syntheticTestKey: boolean
}

/**
 * The seed of the synthetic fixture key.
 *
 * Published deliberately. A key whose private half is a constant in a public
 * repository is not a secret and must never be treated as one; naming it here
 * makes that impossible to forget. Anyone can sign with it, which is why it
 * authorizes only the internal interval-tolerance fixture.
 */
export const SYNTHETIC_TEST_KEY_SEED_HEX =
  '00000000000000000000000000000000000000000000000000000000000000ff'

export const SYNTHETIC_TEST_KEY_ID = 'synthetic-fixture-key/DO-NOT-USE-IN-PRODUCTION/v1' as const

/** A revoked synthetic key, present so revocation is exercised rather than assumed. */
export const SYNTHETIC_REVOKED_KEY_ID = 'synthetic-fixture-key/DO-NOT-USE-IN-PRODUCTION/v0' as const

export const SYNTHETIC_REVOKED_KEY_SEED_HEX =
  '00000000000000000000000000000000000000000000000000000000000000fe'

/**
 * What would have to exist before this authorizes production work.
 *
 * Recorded so the current state is not mistaken for the target state:
 *
 *   1. A private key generated in and never leaving an HSM or KMS, with no
 *      export path, held by someone other than whoever can merge to this
 *      repository. Splitting those two roles is the entire point; a signing key
 *      a committer can read reintroduces the threat Phase 2 exists to close.
 *   2. A signing procedure that records who requested a trust root, who
 *      approved it and what was signed, so a signature is attributable to a
 *      decision rather than only to a key.
 *   3. A revocation path that can be exercised without a deploy.
 *   4. A published key-distribution channel independent of this repository, so
 *      a reader can obtain the public key without trusting the artifact they
 *      are checking.
 *
 * None of these exist today. The registry below contains synthetic keys only.
 */
export const PRODUCTION_SIGNING_BOUNDARY =
  'No production signing key exists. The registry contains synthetic fixture keys whose private seeds are constants in this repository, and they authorize only the internal test fixture.'

export const SIGNING_KEY_REGISTRY: readonly SigningKeyEntry[] = [
  {
    keyId: SYNTHETIC_TEST_KEY_ID,
    // Filled from the seed above by scripts/generate-formal-proof-trust-root.ts.
    publicKey: 'Vpmpzvhw4v8MAitnaJzHb+BekJFcXwFD+TVspy9K/5k=',
    status: 'active',
    epoch: 2,
    note: 'Synthetic fixture key. Its private seed is a published constant; it authorizes only the internal interval-tolerance fixture.',
    syntheticTestKey: true,
  },
  {
    keyId: SYNTHETIC_REVOKED_KEY_ID,
    publicKey: 'l9Yr12PsuciKKLI/yJqS3Q3gYyl3eUTiUGZtk4iLcJY=',
    status: 'revoked',
    epoch: 1,
    note: 'Superseded by v1 at epoch 2. Retained so revocation and epoch staleness are exercised by tests rather than assumed.',
    syntheticTestKey: true,
  },
]

export type SigningKeyErrorCode = 'key-unknown' | 'key-ambiguous' | 'key-revoked' | 'key-epoch-stale' | 'key-malformed'

export class SigningKeyError extends Error {
  // Assigned explicitly rather than as a parameter property: Node's strip-only
  // TypeScript mode, which runs this repository's scripts and tests, rejects
  // parameter properties because they emit runtime code.
  code: SigningKeyErrorCode

  constructor(message: string, code: SigningKeyErrorCode) {
    super(message)
    this.code = code
  }
}

/** The highest active epoch in the registry. Envelopes below it are stale. */
export function currentAuthorityEpoch(registry: readonly SigningKeyEntry[] = SIGNING_KEY_REGISTRY): number {
  const active = registry.filter((entry) => entry.status === 'active')
  if (active.length === 0) throw new SigningKeyError('The registry contains no active key.', 'key-unknown')
  return Math.max(...active.map((entry) => entry.epoch))
}

/**
 * Resolves a key id to an active, current key.
 *
 * Ambiguity is refused rather than resolved: choosing between two entries with
 * the same id would make the verifier decide what is authorized.
 */
export function resolveSigningKey(
  keyId: string,
  registry: readonly SigningKeyEntry[] = SIGNING_KEY_REGISTRY,
): SigningKeyEntry {
  const matches = registry.filter((entry) => entry.keyId === keyId)
  if (matches.length === 0) throw new SigningKeyError(`No registered key ${keyId}.`, 'key-unknown')
  if (matches.length > 1) throw new SigningKeyError(`Ambiguous registry entries for ${keyId}.`, 'key-ambiguous')
  const entry = matches[0]
  if (entry.status === 'revoked') throw new SigningKeyError(`Key ${keyId} is revoked.`, 'key-revoked')
  if (!/^[A-Za-z0-9+/]{42,44}={0,2}$/.test(entry.publicKey)) {
    throw new SigningKeyError(`Key ${keyId} has a malformed public key.`, 'key-malformed')
  }
  if (entry.epoch < currentAuthorityEpoch(registry)) {
    throw new SigningKeyError(`Key ${keyId} signs for a superseded epoch.`, 'key-epoch-stale')
  }
  return entry
}
