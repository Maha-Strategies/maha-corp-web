import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Binds the rehearsal to the exact credential it was authorized for.
 *
 * A run that holds a valid-but-wrong Management API token behaves like a run
 * that holds the right one, right up until the first authorization failure -
 * which happens after the branch already exists. The last rehearsal proved
 * that: it used a stale token, created a branch, and only then received a 403.
 * Nothing was damaged, but nothing was verified either, and the branch had to
 * be cleaned up.
 *
 * So the token is identified before anything is created. Identity is a
 * fingerprint of the whole secret, never a prefix, suffix, length or name:
 * those are guessable, and a name in particular says nothing about which token
 * is actually bound to the environment.
 *
 * Nothing here accepts, stores, logs or returns the token or any fragment of
 * it. Every refusal message is a fixed string.
 */

export const CREDENTIAL_PROVENANCE_VERSION = 'maha-batch-11-credential-provenance/1.0' as const

/** The only accepted shape for an expected credential identity. */
export const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/

export type ProvenanceRefusal =
  | 'credential-absent'
  | 'credential-fingerprint-absent'
  | 'credential-fingerprint-malformed'
  | 'credential-fingerprint-mismatch'
  | 'pooler-capability-unavailable'
  | 'pooler-capability-malformed'
  | 'pooler-capability-production-target'

export class CredentialProvenanceRefused extends Error {
  code: ProvenanceRefusal

  constructor(code: ProvenanceRefusal, message: string) {
    super(message)
    this.name = 'CredentialProvenanceRefused'
    this.code = code
  }
}

/** Non-reversible identity of a secret. Safe to record in evidence. */
export function fingerprintCredential(token: string): string {
  return `sha256:${createHash('sha256').update(token, 'utf8').digest('hex')}`
}

/**
 * Refuses unless the supplied token is the one the environment expects.
 *
 * Both sides are hashed to a fixed width before comparison, so the compare is
 * timing-safe and cannot leak how much of a wrong token matched. A raw token,
 * a prefix, a suffix or a human-readable token name supplied as the expected
 * value is refused as malformed rather than being treated as identity.
 */
export function assertExpectedCredential(token: string, expectedFingerprint: string): string {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new CredentialProvenanceRefused('credential-absent',
      'The Supabase access token is not bound to this environment.')
  }
  if (typeof expectedFingerprint !== 'string' || expectedFingerprint.trim().length === 0) {
    throw new CredentialProvenanceRefused('credential-fingerprint-absent',
      'SUPABASE_ACCESS_TOKEN_SHA256 is not bound to this environment, so the token cannot be identified.')
  }
  const expected = expectedFingerprint.trim()
  if (!FINGERPRINT_PATTERN.test(expected)) {
    // A raw token or a token name lands here. Neither is identity evidence,
    // and the value is never echoed.
    throw new CredentialProvenanceRefused('credential-fingerprint-malformed',
      'SUPABASE_ACCESS_TOKEN_SHA256 must be exactly "sha256:" followed by 64 lowercase hexadecimal characters.')
  }

  const actual = fingerprintCredential(token)
  const a = Buffer.from(actual, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // Equal by construction: both are the same fixed-width fingerprint shape.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new CredentialProvenanceRefused('credential-fingerprint-mismatch',
      'The bound Supabase access token is not the token this rehearsal was authorized for.')
  }
  return actual
}

/** A read-only Management API probe result, as handed in by the caller. */
export interface CapabilityProbe {
  status: number
  /** Parsed body, or null when it could not be read. Never logged. */
  body: unknown
}

export interface PoolerCapability {
  version: typeof CREDENTIAL_PROVENANCE_VERSION
  parentProjectRefFingerprint: string
  /** Non-reversible identity of the selected PRIMARY pooler host. */
  primaryHostFingerprint: string
  poolMode: string
  databaseType: 'PRIMARY'
  status: 200
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Proves the token can actually read the parent project's pooler config.
 *
 * This is the capability the rehearsal needs and the one the stale token did
 * not have. Asking for it first turns an authorization failure into a refusal
 * before any branch exists, rather than a 403 after one does.
 *
 * The probe is read-only. Its body never reaches a log or an error message:
 * a Management API response can quote the request, and the request carried a
 * credential.
 */
export function assertPoolerCapability(
  parentProjectRef: string,
  productionProjectRef: string,
  probe: CapabilityProbe,
): PoolerCapability {
  if (!parentProjectRef || parentProjectRef === productionProjectRef) {
    throw new CredentialProvenanceRefused('pooler-capability-production-target',
      'The configured staging parent project is the Production project.')
  }
  if (probe.status !== 200) {
    // 401 and 403 mean the wrong token; 404 the wrong project; 429 and 5xx an
    // unusable answer. None of them licenses creating a branch.
    throw new CredentialProvenanceRefused('pooler-capability-unavailable',
      `The parent pooler capability probe returned ${probe.status} instead of 200.`)
  }
  if (!Array.isArray(probe.body)) {
    throw new CredentialProvenanceRefused('pooler-capability-malformed',
      'The parent pooler capability probe did not return a configuration array.')
  }
  const primary = probe.body
    .filter(isObject)
    .filter((entry) => entry.database_type === 'PRIMARY')
  if (primary.length !== 1) {
    throw new CredentialProvenanceRefused('pooler-capability-malformed',
      `Expected exactly one PRIMARY pooler configuration, found ${primary.length}.`)
  }
  const entry = primary[0]
  const host = typeof entry.db_host === 'string' ? entry.db_host.trim() : ''
  const poolMode = typeof entry.pool_mode === 'string' ? entry.pool_mode : ''
  if (!host || !poolMode) {
    throw new CredentialProvenanceRefused('pooler-capability-malformed',
      'The PRIMARY pooler configuration is missing a host or a pool mode.')
  }

  return {
    version: CREDENTIAL_PROVENANCE_VERSION,
    parentProjectRefFingerprint: fingerprintCredential(parentProjectRef),
    primaryHostFingerprint: fingerprintCredential(host),
    poolMode,
    databaseType: 'PRIMARY',
    status: 200,
  }
}
