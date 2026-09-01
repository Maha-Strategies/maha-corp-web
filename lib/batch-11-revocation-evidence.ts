import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'

/**
 * Independent evidence that the temporary credentials are gone.
 *
 * Destroying a Preview branch and revoking the token that made it are separate
 * facts, and the second is the one that outlives the run. A token still valid
 * after teardown is a standing capability against the staging project that
 * nothing in the rehearsal's own evidence would reveal.
 *
 * Kept deliberately apart from the teardown producer rather than folded into
 * its resource union: that union is consumed by a v2.0 producer this module
 * does not own, and widening a shared contract to carry an unrelated concept
 * would destabilise it. Revocation is additive - a second input the closure
 * verifier requires, which the teardown producer neither knows nor needs.
 *
 * The asymmetry is the same one teardown uses. A provider saying "this token is
 * gone" is evidence; a query that failed, was never attempted, or covered the
 * wrong scope returns the same silence as a successful check of an empty list,
 * and only one of those is revocation.
 */

export const REVOCATION_EVIDENCE_VERSION = 'maha-batch-11-revocation-evidence/1.0' as const

/** Every temporary credential a rehearsal is issued. */
export const REVOCABLE_CREDENTIALS = [
  'supabase-access-token',
  'vercel-automation-bypass',
  'github-environment-secrets',
] as const
export type RevocableCredential = (typeof REVOCABLE_CREDENTIALS)[number]

/**
 * How well a credential is actually known to be gone.
 *
 * `reported-revoked` exists because it is what an operator writes down after
 * clicking revoke, and it is not the same as a provider confirming the
 * credential no longer resolves.
 */
export type RevocationState = 'confirmed-revoked' | 'reported-revoked' | 'unknown' | 'still-active'
export const REVOCATION_STATES: readonly RevocationState[] = [
  'confirmed-revoked', 'reported-revoked', 'unknown', 'still-active',
]

export type RevocationRefusal =
  | 'no-check-for-credential'
  | 'check-did-not-succeed'
  | 'scope-insufficient'
  | 'run-mismatch'
  | 'credential-still-active'
  | 'only-self-reported'
  | 'credential-identity-inconsistent'
  | 'credential-shaped-input'

/**
 * Which field of the run artifact proves each credential's identity.
 *
 * Two of the three can be fingerprinted from the value itself, because the run
 * held that value. The third cannot: GitHub never returns a secret, so the only
 * exact thing to bind is the slot - this environment, these names, this run -
 * and pretending otherwise would mean inventing a value-shaped identity for
 * something whose value is unobservable.
 */
export const REVOCATION_IDENTITY_BINDING = {
  'supabase-access-token': 'branchManagementIdentityFingerprint',
  'vercel-automation-bypass': 'automationBypassIdentityFingerprint',
  'github-environment-secrets': 'environment-secret-slot',
} as const satisfies Readonly<Record<RevocableCredential, string>>

export type CheckStatus = 'succeeded' | 'failed' | 'malformed' | 'not-attempted'
/** Only an exact-identity check can support a revocation claim. */
export type CheckScope = 'exact-credential-fingerprint' | 'exact-environment' | 'partial' | 'unknown'

/** One sanitized post-run revocation check, supplied by the operator. */
export interface RevocationCheck {
  provider: string
  credential: RevocableCredential
  checkStatus: CheckStatus
  scope: CheckScope
  runMarker: string
  reviewedCommit: string
  /** sha256 of the credential identity. Never the credential. */
  credentialFingerprint: string
  /** True when the provider still resolves this credential. */
  stillResolves: boolean
  /** True when the only basis is an operator's own statement. */
  selfReportedOnly: boolean
  detail: string
}

export interface RevocationObservation {
  credential: RevocableCredential
  credentialFingerprint: string
  observedState: RevocationState
  refusal: RevocationRefusal | null
  providers: readonly string[]
  detail: string
}

export interface RevocationReport {
  schemaVersion: typeof REVOCATION_EVIDENCE_VERSION
  runMarker: string
  reviewedCommit: string
  observations: readonly RevocationObservation[]
  allConfirmedRevoked: boolean
  revocationDigest: string
}

const CREDENTIAL_SHAPES: readonly RegExp[] = [
  /bearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /\bsbp_[A-Za-z0-9]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i,
  /"(?:token|secret|password|apikey|api_key)"\s*:\s*"[A-Za-z0-9/+_-]{16,}"/i,
]

/** Refuses input carrying anything credential-shaped, before it is used. */
export function assertRevocationInputSanitized(input: unknown): void {
  const text = JSON.stringify(input ?? null)
  for (const pattern of CREDENTIAL_SHAPES) {
    if (pattern.test(text)) {
      throw new Error('The supplied revocation checks contain credential-shaped text. Sanitize them before producing evidence.')
    }
  }
}

/** Reduces every check for one credential to a single state. */
export function reduceRevocationState(
  credential: RevocableCredential,
  runMarker: string,
  reviewedCommit: string,
  checks: readonly RevocationCheck[],
): Omit<RevocationObservation, 'credential' | 'credentialFingerprint'> & { credentialFingerprint: string | null } {
  const forCredential = checks.filter((entry) => entry.credential === credential)
  const providers = forCredential.map((entry) => entry.provider).sort()
  const fingerprint = forCredential[0]?.credentialFingerprint ?? null

  if (forCredential.length === 0) {
    return { observedState: 'unknown', refusal: 'no-check-for-credential', providers, credentialFingerprint: fingerprint,
      detail: `No post-run check covered the ${credential}.` }
  }
  // Still resolving beats everything: a live credential is live whatever else
  // the other checks report.
  // Two checks of "the same" credential that fingerprint different values are
  // not corroboration; they are evidence that at least one tested the wrong
  // secret, and there is no way to tell which.
  if (new Set(forCredential.map((entry) => entry.credentialFingerprint)).size > 1) {
    return { observedState: 'unknown', refusal: 'credential-identity-inconsistent', providers, credentialFingerprint: null,
      detail: `${credential}: the checks disagree about which credential they tested.` }
  }
  const alive = forCredential.filter((entry) => entry.stillResolves)
  if (alive.length > 0) {
    return { observedState: 'still-active', refusal: 'credential-still-active', providers, credentialFingerprint: fingerprint,
      detail: `${credential}: ${alive.map((entry) => entry.provider).join(', ')} still resolves this credential.` }
  }
  for (const entry of forCredential) {
    if (entry.checkStatus !== 'succeeded') {
      return { observedState: 'unknown', refusal: 'check-did-not-succeed', providers, credentialFingerprint: fingerprint,
        detail: `${credential}: the ${entry.provider} check ${entry.checkStatus}; an unread state is not revocation.` }
    }
    if (entry.scope !== 'exact-credential-fingerprint' && entry.scope !== 'exact-environment') {
      return { observedState: 'unknown', refusal: 'scope-insufficient', providers, credentialFingerprint: fingerprint,
        detail: `${credential}: the ${entry.provider} check covered "${entry.scope}", which cannot identify this credential.` }
    }
    if (entry.runMarker !== runMarker || entry.reviewedCommit !== reviewedCommit) {
      return { observedState: 'unknown', refusal: 'run-mismatch', providers, credentialFingerprint: fingerprint,
        detail: `${credential}: the ${entry.provider} check belongs to a different run.` }
    }
    if (entry.selfReportedOnly) {
      return { observedState: 'reported-revoked', refusal: 'only-self-reported', providers, credentialFingerprint: fingerprint,
        detail: `${credential}: revocation was stated by the operator, not confirmed by ${entry.provider}.` }
    }
  }
  return { observedState: 'confirmed-revoked', refusal: null, providers, credentialFingerprint: fingerprint,
    detail: `${credential}: ${forCredential.length} provider check(s) confirmed the credential no longer resolves.` }
}

export function recomputeRevocationDigest(report: {
  schemaVersion: string
  runMarker: string
  reviewedCommit: string
  observations: readonly RevocationObservation[]
  allConfirmedRevoked: boolean
}): string {
  return `sha256:${createHash('sha256').update(canonicalJson({
    schemaVersion: report.schemaVersion,
    runMarker: report.runMarker,
    reviewedCommit: report.reviewedCommit,
    allConfirmedRevoked: report.allConfirmedRevoked,
    observations: report.observations.map((entry) => ({
      credential: entry.credential,
      credentialFingerprint: entry.credentialFingerprint,
      observedState: entry.observedState,
      refusal: entry.refusal,
    })),
  }), 'utf8').digest('hex')}`
}

/** Produces one observation per revocable credential. */
export function produceRevocationEvidence(input: {
  runMarker: string
  reviewedCommit: string
  checks: readonly RevocationCheck[]
}): RevocationReport {
  assertRevocationInputSanitized(input)

  const observations: RevocationObservation[] = REVOCABLE_CREDENTIALS.map((credential) => {
    const reduced = reduceRevocationState(credential, input.runMarker, input.reviewedCommit, input.checks)
    return {
      credential,
      // Absent when nothing checked it; the state is already unknown in that case.
      credentialFingerprint: reduced.credentialFingerprint ?? `sha256:${'0'.repeat(64)}`,
      observedState: reduced.observedState,
      refusal: reduced.refusal,
      providers: reduced.providers,
      detail: reduced.detail,
    }
  })

  const report = {
    schemaVersion: REVOCATION_EVIDENCE_VERSION,
    runMarker: input.runMarker,
    reviewedCommit: input.reviewedCommit,
    observations,
    allConfirmedRevoked: observations.every((entry) => entry.observedState === 'confirmed-revoked'),
  }
  return { ...report, revocationDigest: recomputeRevocationDigest(report) }
}
