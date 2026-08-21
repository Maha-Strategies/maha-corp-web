export const CARP_PRE_MONEY_GATE_VERSION = '1.0.0'

export type GateResult = {
  version: typeof CARP_PRE_MONEY_GATE_VERSION
  decision: 'PRE_MONEY_BLOCKED' | 'PRE_MONEY_READY_FOR_EXTERNAL_REVIEW'
  moneyAuthorized: false
  blockingReasons: string[]
  requiredEvidence: string[]
}

type CounterpartyScreen = {
  address: string
  blocklist: 'clear' | 'blocked' | 'unknown'
  sanctions: 'clear' | 'match' | 'unknown'
  payability: 'payable' | 'not_payable' | 'unknown'
}

export type PreMoneyGateInput = {
  token: {
    address: string
    behavior: 'standard_erc20' | 'fee_on_transfer' | 'no_boolean_return' | 'unknown'
    allowlisted: boolean
  }
  buyer: CounterpartyScreen
  seller: CounterpartyScreen & {
    accountKind: 'eoa' | 'contract' | 'unknown'
    canWithdrawEth: boolean | null
    canReceivePlainEth: boolean | null
  }
  escrow: {
    sourceVerified: boolean
    timeoutBlocks: number | null
    releaseFailureRecoveryTest: 'pass' | 'fail' | 'not_run'
    unresponsiveBuyerRecoveryTest: 'pass' | 'fail' | 'not_run'
    administratorUnavailableRecoveryTest: 'pass' | 'fail' | 'not_run'
  }
  didOrderBinding: {
    verified: boolean
    sellerDid: string | null
    sellerAddress: string | null
    escrowOrderId: string | null
  }
}

/**
 * A deterministic, metadata-only gate for a proposed escrow order. It never
 * calls a screening service or an escrow contract and can never authorize a
 * payment. A positive result means only that all declared evidence is present
 * and suitable for independent, human/external review.
 */
export function evaluatePreMoneyGate(input: PreMoneyGateInput): GateResult {
  const blockingReasons: string[] = []
  const requiredEvidence: string[] = []
  if (!input.escrow.sourceVerified) blockingReasons.push('escrow_source_not_verified')
  if (!input.token.allowlisted) blockingReasons.push('token_not_allowlisted')
  if (input.token.behavior !== 'standard_erc20') blockingReasons.push(`token_behavior_${input.token.behavior}`)
  for (const [role, counterparty] of [['buyer', input.buyer], ['seller', input.seller]] as const) {
    if (counterparty.blocklist !== 'clear') blockingReasons.push(`${role}_blocklist_${counterparty.blocklist}`)
    if (counterparty.sanctions !== 'clear') blockingReasons.push(`${role}_sanctions_${counterparty.sanctions}`)
    if (counterparty.payability !== 'payable') blockingReasons.push(`${role}_payability_${counterparty.payability}`)
  }
  if (input.seller.accountKind === 'unknown') blockingReasons.push('seller_account_kind_unknown')
  if (input.seller.accountKind === 'contract' && input.seller.canWithdrawEth !== true) blockingReasons.push('seller_contract_cannot_withdraw_eth')
  if (input.seller.accountKind === 'contract' && input.seller.canReceivePlainEth !== true) blockingReasons.push('seller_contract_cannot_receive_plain_eth')
  if (!Number.isInteger(input.escrow.timeoutBlocks) || (input.escrow.timeoutBlocks ?? 0) < 1) blockingReasons.push('timeout_blocks_invalid')
  for (const [name, result] of Object.entries({
    release_failure: input.escrow.releaseFailureRecoveryTest,
    unresponsive_buyer: input.escrow.unresponsiveBuyerRecoveryTest,
    administrator_unavailable: input.escrow.administratorUnavailableRecoveryTest,
  })) {
    if (result !== 'pass') blockingReasons.push(`recovery_test_${name}_${result}`)
  }
  if (!input.didOrderBinding.verified || !input.didOrderBinding.sellerDid || !input.didOrderBinding.sellerAddress || !input.didOrderBinding.escrowOrderId) {
    blockingReasons.push('seller_did_address_order_binding_unverified')
  }
  requiredEvidence.push(
    'Token behavior allowlist evidence',
    'Buyer and seller blocklist, sanctions, and payability evidence',
    'Seller EOA/contract and ETH-withdraw capability evidence where applicable',
    'Escrow timeout and recovery-test evidence',
    'Seller DID-to-address-to-escrow-order signed binding',
  )
  return {
    version: CARP_PRE_MONEY_GATE_VERSION,
    decision: blockingReasons.length === 0 ? 'PRE_MONEY_READY_FOR_EXTERNAL_REVIEW' : 'PRE_MONEY_BLOCKED',
    moneyAuthorized: false,
    blockingReasons,
    requiredEvidence,
  }
}
