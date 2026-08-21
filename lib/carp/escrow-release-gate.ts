export const ESCROW_RELEASE_INTEGRATION_STATUS = 'not_deployed' as const
export const MAX_PRE_RELEASE_PAYABILITY_AGE_SECONDS = 60

export type PayabilityAttestation = {
  phase: 'pre_deposit' | 'pre_release'
  recipient: string
  checkedAt: string
  verdict: 'PAYABLE' | 'NOT_PAYABLE' | 'UNREACHABLE' | 'UNSUPPORTED'
  evidenceDigest: string | null
  provider: string | null
}

export type EscrowReleaseDecision =
  | {
    status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT'
    releaseAuthorized: false
    reason: 'pre_deposit_attestation_missing' | 'pre_deposit_recipient_mismatch' | 'pre_release_attestation_missing' | 'recipient_mismatch' | 'pre_release_attestation_stale' | 'recipient_not_payable'
    recovery: 'arbitration_required'
    integrationStatus: typeof ESCROW_RELEASE_INTEGRATION_STATUS
  }
  | {
    status: 'RELEASE_RECHECK_PASSED_PENDING_ESCROWER'
    releaseAuthorized: false
    reason: 'external_escrower_must_enforce_the_attestation'
    recovery: 'await_escrower_release'
    integrationStatus: typeof ESCROW_RELEASE_INTEGRATION_STATUS
  }

/**
 * This does not release funds. It defines the attestation an escrower must
 * enforce immediately before release. Until the escrower integrates it, even a
 * successful recheck remains intentionally non-authorizing.
 */
export function evaluateEscrowReleaseGate(input: {
  expectedRecipient: string
  preDeposit?: PayabilityAttestation | null
  preRelease?: PayabilityAttestation | null
  now?: Date
}): EscrowReleaseDecision {
  const preDeposit = input.preDeposit
  if (!preDeposit) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'pre_deposit_attestation_missing', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  if (preDeposit.phase !== 'pre_deposit' || preDeposit.recipient !== input.expectedRecipient) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'pre_deposit_recipient_mismatch', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  const preRelease = input.preRelease
  if (!preRelease) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'pre_release_attestation_missing', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  if (preRelease.phase !== 'pre_release' || preRelease.recipient !== input.expectedRecipient) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'recipient_mismatch', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  const checkedAt = Date.parse(preRelease.checkedAt)
  const ageMilliseconds = (input.now ?? new Date()).getTime() - checkedAt
  if (!Number.isFinite(checkedAt) || ageMilliseconds < 0 || ageMilliseconds > MAX_PRE_RELEASE_PAYABILITY_AGE_SECONDS * 1_000) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'pre_release_attestation_stale', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  if (preRelease.verdict !== 'PAYABLE' || !preRelease.evidenceDigest || !preRelease.provider) {
    return { status: 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT', releaseAuthorized: false, reason: 'recipient_not_payable', recovery: 'arbitration_required', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
  }
  return { status: 'RELEASE_RECHECK_PASSED_PENDING_ESCROWER', releaseAuthorized: false, reason: 'external_escrower_must_enforce_the_attestation', recovery: 'await_escrower_release', integrationStatus: ESCROW_RELEASE_INTEGRATION_STATUS }
}
