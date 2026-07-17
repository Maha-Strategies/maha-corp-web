import assert from 'node:assert/strict'
import test from 'node:test'

import {
  authorizeMpsOperations,
  operatorActionRequestHash,
  operatorIdempotencyHash,
  parseMpsOperatorAction,
  parseMpsOperationsLookup,
} from '../lib/mps-operations.ts'

test('operational lookup accepts supported exact identifiers without wildcard searches', () => {
  assert.deepEqual(parseMpsOperationsLookup('client_0123456789abcdef0123456789abcdef'), {
    kind: 'client', value: 'client_0123456789abcdef0123456789abcdef',
  })
  assert.deepEqual(parseMpsOperationsLookup('Customer@Example.com'), {
    kind: 'receipt_email', value: 'customer@example.com',
  })
  assert.deepEqual(parseMpsOperationsLookup('mhaic_Abc-123_'), {
    kind: 'credential_prefix', value: 'mhaic_Abc-123_',
  })
  assert.throws(() => parseMpsOperationsLookup('unsupported lookup'), /client, credential/)
})

test('credit adjustments require a bounded non-zero integer and audit context', () => {
  const action = parseMpsOperatorAction({
    action: 'credit_adjustment',
    clientId: 'client_0123456789abcdef0123456789abcdef',
    quantity: 2,
    idempotencyKey: 'support-case-1042',
    reason: 'Restore credits after confirmed engine failure.',
    referenceId: 'ticket-1042',
  })
  assert.equal(action.action, 'credit_adjustment')
  assert.throws(() => parseMpsOperatorAction({ ...action, quantity: 0 }), /non-zero integer/)
})

test('operator idempotency and request hashes are deterministic and separately scoped', () => {
  const action = parseMpsOperatorAction({
    action: 'credential_revocation',
    credentialId: 'cred_0123456789abcdef0123456789abcdef',
    idempotencyKey: 'abuse-case-1043',
    reason: 'Credential reported as compromised.',
    referenceId: 'ticket-1043',
  })
  assert.equal(operatorIdempotencyHash(action.idempotencyKey), operatorIdempotencyHash(action.idempotencyKey))
  assert.equal(operatorActionRequestHash(action), operatorActionRequestHash(action))
  assert.notEqual(operatorIdempotencyHash(action.idempotencyKey), operatorActionRequestHash(action))
})

test('credential replacement accepts only a valid credential and complete audit context', () => {
  const action = parseMpsOperatorAction({
    action: 'credential_replacement',
    credentialId: 'cred_0123456789abcdef0123456789abcdef',
    idempotencyKey: 'support-case-1044',
    reason: 'Customer lost the only plaintext copy.',
    referenceId: 'ticket-1044',
  })
  assert.equal(action.action, 'credential_replacement')
  assert.throws(() => parseMpsOperatorAction({ ...action, credentialId: 'cred_invalid' }), /credentialId/)
})

test('operations authorization distinguishes missing configuration and invalid tokens', () => {
  const original = process.env.MPS_OPERATIONS_TOKEN
  try {
    delete process.env.MPS_OPERATIONS_TOKEN
    assert.deepEqual(authorizeMpsOperations(new Request('https://example.test')), { kind: 'unconfigured' })

    process.env.MPS_OPERATIONS_TOKEN = 'operations-test-secret'
    assert.deepEqual(
      authorizeMpsOperations(new Request('https://example.test', { headers: { Authorization: 'Bearer wrong-secret' } })),
      { kind: 'unauthorized' },
    )
    const authorization = authorizeMpsOperations(new Request('https://example.test', {
      headers: { Authorization: 'Bearer operations-test-secret' },
    }))
    assert.equal(authorization.kind, 'authorized')
    if (authorization.kind === 'authorized') assert.match(authorization.actorFingerprint, /^sha256:[a-f0-9]{64}$/)
  } finally {
    if (original === undefined) delete process.env.MPS_OPERATIONS_TOKEN
    else process.env.MPS_OPERATIONS_TOKEN = original
  }
})
