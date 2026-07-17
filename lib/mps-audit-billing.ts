export type MpsAuditBillingMode = 'internal_meter' | 'prepaid'

export type CreditReservation = {
  accepted: boolean
  errorCode?: string
}

export type MpsAuditBillingDecision =
  | { kind: 'allow'; creditReserved: boolean }
  | { kind: 'payment_required'; creditReserved: false }
  | { kind: 'unavailable'; creditReserved: false; errorCode: string }

/**
 * The mandatory billing hook for every new MPS audit execution.
 * Internal credentials retain meter-only access. Prepaid credentials cannot
 * cross the model boundary unless the atomic ledger reservation succeeds.
 */
export async function billingDecision(
  billingMode: MpsAuditBillingMode,
  reserveCredit: () => Promise<CreditReservation>,
): Promise<MpsAuditBillingDecision> {
  if (billingMode === 'internal_meter') return { kind: 'allow', creditReserved: false }

  let reservation: CreditReservation
  try {
    reservation = await reserveCredit()
  } catch {
    return { kind: 'unavailable', creditReserved: false, errorCode: 'reservation_failed' }
  }
  if (reservation.errorCode) {
    return { kind: 'unavailable', creditReserved: false, errorCode: reservation.errorCode }
  }
  if (!reservation.accepted) return { kind: 'payment_required', creditReserved: false }
  return { kind: 'allow', creditReserved: true }
}
