import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CARP_BINARY_DIGEST_ALGORITHM,
  CARP_STRUCTURED_DIGEST_ALGORITHM,
  createDeliveryReference,
  structuredDigest,
  verifyStructuredDigest,
} from '../lib/carp/commerce-evidence.ts'
import { configuredEndpointBinding, signedEndpointBinding, verifyEndpointBinding } from '../lib/carp/endpoint-binding.ts'
import { evaluateEscrowReleaseGate } from '../lib/carp/escrow-release-gate.ts'

test('structured delivery digests use RFC 8785 canonical JSON rather than caller key order', () => {
  const first = { orderId: 'maha:order-001', nested: { b: 2, a: 'é' }, values: [true, null] }
  const second = { values: [true, null], nested: { a: 'é', b: 2 }, orderId: 'maha:order-001' }
  const digest = structuredDigest(first)
  assert.equal(digest.algorithm, CARP_STRUCTURED_DIGEST_ALGORITHM)
  assert.equal(digest.digest, structuredDigest(second).digest)
  assert.match(digest.digest, /^sha256:[a-f0-9]{64}$/)
  assert.equal(verifyStructuredDigest(second, digest), true)
})

test('delivery references distinguish seller-generated structured evidence from raw binary artifacts', () => {
  const reference = createDeliveryReference({
    orderId: 'maha:buyer-order-001',
    request: { requestId: 'r-1', amount: 1 },
    result: { status: 'delivered', outputHash: 'sha256:abc' },
    artifactBytes: new TextEncoder().encode('raw artifact bytes'),
  })
  assert.equal(reference.issuer.providerSigned, false)
  assert.equal(reference.requestDigest.algorithm, CARP_STRUCTURED_DIGEST_ALGORITHM)
  assert.equal(reference.resultDigest.algorithm, CARP_STRUCTURED_DIGEST_ALGORITHM)
  assert.equal(reference.artifactDigest?.algorithm, CARP_BINARY_DIGEST_ALGORITHM)
  assert.match(reference.limitations.join(' '), /No escrow-release authorization/)
})

test('a missing, stale, mismatched, or unpayable release recheck blocks escrow release', () => {
  const now = new Date('2026-08-21T12:00:00.000Z')
  const expectedRecipient = '0x1111111111111111111111111111111111111111'
  assert.equal(evaluateEscrowReleaseGate({ expectedRecipient, now }).status, 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT')
  const preDeposit = { phase: 'pre_deposit' as const, recipient: expectedRecipient, checkedAt: '2026-08-21T10:00:00.000Z', verdict: 'PAYABLE' as const, evidenceDigest: 'sha256:deposit-proof', provider: 'payability-provider' }
  assert.equal(evaluateEscrowReleaseGate({
    expectedRecipient, preDeposit,
    now,
    preRelease: { phase: 'pre_release', recipient: expectedRecipient, checkedAt: '2026-08-21T11:58:59.000Z', verdict: 'PAYABLE', evidenceDigest: 'sha256:proof', provider: 'payability-provider' },
  }).status, 'RELEASE_BLOCKED_UNPAYABLE_RECIPIENT')
  assert.equal(evaluateEscrowReleaseGate({
    expectedRecipient, preDeposit,
    now,
    preRelease: { phase: 'pre_release', recipient: '0x2222222222222222222222222222222222222222', checkedAt: '2026-08-21T12:00:00.000Z', verdict: 'PAYABLE', evidenceDigest: 'sha256:proof', provider: 'payability-provider' },
  }).reason, 'recipient_mismatch')
  assert.equal(evaluateEscrowReleaseGate({
    expectedRecipient, preDeposit,
    now,
    preRelease: { phase: 'pre_release', recipient: expectedRecipient, checkedAt: '2026-08-21T12:00:00.000Z', verdict: 'NOT_PAYABLE', evidenceDigest: 'sha256:proof', provider: 'payability-provider' },
  }).reason, 'recipient_not_payable')
})

test('a fresh positive recheck is still non-authorizing until an escrower enforces it', () => {
  const decision = evaluateEscrowReleaseGate({
    expectedRecipient: '0x1111111111111111111111111111111111111111',
    preDeposit: {
      phase: 'pre_deposit', recipient: '0x1111111111111111111111111111111111111111', checkedAt: '2026-08-21T10:00:00.000Z', verdict: 'PAYABLE', evidenceDigest: 'sha256:deposit-proof', provider: 'payability-provider',
    },
    now: new Date('2026-08-21T12:00:00.000Z'),
    preRelease: {
      phase: 'pre_release', recipient: '0x1111111111111111111111111111111111111111', checkedAt: '2026-08-21T11:59:30.000Z', verdict: 'PAYABLE', evidenceDigest: 'sha256:proof', provider: 'payability-provider',
    },
  })
  assert.equal(decision.status, 'RELEASE_RECHECK_PASSED_PENDING_ESCROWER')
  assert.equal(decision.releaseAuthorized, false)
})

test('endpoint binding is a same-key, endpoint-hosted proof rather than a DID-only assertion', () => {
  const binding = signedEndpointBinding({ privateKey: '1'.padStart(64, '0'), issuedAt: '2026-08-21T00:00:00.000Z', expiresAt: '2027-08-21T00:00:00.000Z' })
  assert.equal(verifyEndpointBinding(binding), true)
  assert.match(binding.bindingUrl, /\.well-known\/carp\/endpoint-binding\.json$/)
  assert.equal(binding.endpoint, 'https://www.mahastrategies.com')
  assert.equal(configuredEndpointBinding(), null)
})
