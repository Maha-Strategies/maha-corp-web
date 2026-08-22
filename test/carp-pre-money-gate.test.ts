import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluatePreMoneyGate, type PreMoneyGateInput } from '../lib/carp/pre-money-gate.ts'
import {
  signedEscrowDeliveryReference,
  signedEscrowOrderBinding,
  verifyEscrowDeliveryReference,
  verifyEscrowOrderBinding,
} from '../lib/carp/escrow-attestations.ts'
import { SAMLEY_CINNAMON_TEA_RFQ_OFFER, handleCarpSellerRequest } from '../lib/carp/seller.ts'

const address = '0x1111111111111111111111111111111111111111'
const orderId = `0x${'a'.repeat(64)}`
const clearCounterparty = { address, blocklist: 'clear' as const, sanctions: 'clear' as const, payability: 'payable' as const }

function readyInput(): PreMoneyGateInput {
  return {
    token: { address, behavior: 'standard_erc20' as const, allowlisted: true },
    buyer: clearCounterparty,
    seller: { ...clearCounterparty, accountKind: 'eoa' as const, canWithdrawEth: null, canReceivePlainEth: null },
    escrow: {
      sourceVerified: true,
      timeoutBlocks: 100,
      releaseFailureRecoveryTest: 'pass' as const,
      unresponsiveBuyerRecoveryTest: 'pass' as const,
      administratorUnavailableRecoveryTest: 'pass' as const,
      enforcement: {
        supportsQuotedOrders: true,
        enforcesDidAddressOrderBinding: true,
        enforcesSignedDeliveryReference: true,
        enforcesTokenBehaviorAllowlist: true,
        enforcesCounterpartyScreening: true,
        enforcesRecipientCapabilityCheck: true,
        enforcesReleasePreflight: true,
        shipmentDisputeRecovery: 'tested' as const,
        administratorRecovery: 'panel_tested' as const,
      },
    },
    didOrderBinding: { verified: true, sellerDid: 'did:key:zexample', sellerAddress: address, escrowOrderId: orderId },
  }
}

test('enquiry-only RFQs explicitly deny purchasability and return no payment route', () => {
  assert.equal(SAMLEY_CINNAMON_TEA_RFQ_OFFER.purchasable, false)
  const reply = handleCarpSellerRequest({ jsonrpc: '2.0', method: 'purchase', id: 'rfq-not-purchasable-1', params: { offeringRef: SAMLEY_CINNAMON_TEA_RFQ_OFFER.offeringRef, quantity: 1 } })
  assert.ok('error' in reply)
  assert.equal((reply.error.data as { purchasable: boolean }).purchasable, false)
  assert.equal(JSON.stringify(reply).includes('paymentInstructions'), false)
})

test('fee-on-transfer and non-standard ERC20 tokens fail the pre-money gate', () => {
  for (const behavior of ['fee_on_transfer', 'no_boolean_return'] as const) {
    const result = evaluatePreMoneyGate({ ...readyInput(), token: { address, behavior, allowlisted: true } })
    assert.equal(result.decision, 'PRE_MONEY_BLOCKED')
    assert.ok(result.blockingReasons.includes(`token_behavior_${behavior}`))
    assert.equal(result.moneyAuthorized, false)
  }
})

test('buyer or seller blocklisting blocks the order before money is authorized', () => {
  for (const role of ['buyer', 'seller'] as const) {
    const input = readyInput()
    if (role === 'buyer') input.buyer = { ...input.buyer, blocklist: 'blocked' }
    else input.seller = { ...input.seller, blocklist: 'blocked' }
    const result = evaluatePreMoneyGate(input)
    assert.equal(result.decision, 'PRE_MONEY_BLOCKED')
    assert.ok(result.blockingReasons.includes(`${role}_blocklist_blocked`))
  }
})

test('failed release recovery, unresponsive buyer, and unavailable administrator each block pre-money review', () => {
  for (const field of ['releaseFailureRecoveryTest', 'unresponsiveBuyerRecoveryTest', 'administratorUnavailableRecoveryTest'] as const) {
    const input = readyInput()
    input.escrow = { ...input.escrow, [field]: 'fail' }
    const result = evaluatePreMoneyGate(input)
    assert.equal(result.decision, 'PRE_MONEY_BLOCKED')
    assert.ok(result.blockingReasons.some((reason) => reason.includes('recovery_test_')))
  }
})

test('the confirmed current escrobot and ClawFace boundary is blocked for an RFQ order', () => {
  const input = readyInput()
  input.escrow.enforcement = {
    supportsQuotedOrders: false,
    enforcesDidAddressOrderBinding: false,
    enforcesSignedDeliveryReference: false,
    enforcesTokenBehaviorAllowlist: false,
    enforcesCounterpartyScreening: false,
    enforcesRecipientCapabilityCheck: false,
    enforcesReleasePreflight: false,
    shipmentDisputeRecovery: 'admin_only',
    administratorRecovery: 'single_admin',
  }
  const result = evaluatePreMoneyGate(input)
  assert.equal(result.version, '1.1.0')
  assert.equal(result.decision, 'PRE_MONEY_BLOCKED')
  assert.ok(result.blockingReasons.includes('escrow_does_not_support_quoted_orders'))
  assert.ok(result.blockingReasons.includes('escrow_does_not_enforce_token_behavior_allowlist'))
  assert.ok(result.blockingReasons.includes('shipment_dispute_recovery_admin_only'))
  assert.ok(result.blockingReasons.includes('administrator_recovery_single_admin'))
  assert.equal(result.moneyAuthorized, false)
})

test('a Seller DID key binds the exact seller wallet and escrow-generated order id', () => {
  const binding = signedEscrowOrderBinding({ privateKey: '1'.padStart(64, '0'), sellerAddress: address, escrowOrderId: orderId, issuedAt: '2026-08-21T00:00:00.000Z', expiresAt: '2026-08-22T00:00:00.000Z' })
  assert.equal(verifyEscrowOrderBinding(binding), true)
  assert.equal(binding.sellerAddress, address)
  assert.equal(binding.escrowOrderId, orderId)
  assert.equal(verifyEscrowOrderBinding({ ...binding, escrowOrderId: `0x${'b'.repeat(64)}` }), false)
})

test('delivery reference is DID-signed and cannot be copied to another escrow order', () => {
  const reference = signedEscrowDeliveryReference({
    privateKey: '1'.padStart(64, '0'), sellerAddress: address, escrowOrderId: orderId,
    request: { offer: 'synthetic', buyerInputDigest: 'sha256:request' }, result: { status: 'delivered' }, issuedAt: '2026-08-21T00:00:00.000Z',
  })
  assert.equal(verifyEscrowDeliveryReference(reference), true)
  assert.equal(reference.orderId, orderId)
  assert.equal(verifyEscrowDeliveryReference({ ...reference, escrowOrderId: `0x${'b'.repeat(64)}` }), false)
})
