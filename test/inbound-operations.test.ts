import assert from 'node:assert/strict'
import test from 'node:test'

import { inboundOperationHash, parseInboundOperation } from '../lib/inbound-operations.ts'

const submissionId = `inbound_${'a'.repeat(32)}`

test('inbound operations accept only the defined review actions', () => {
  assert.deepEqual(parseInboundOperation({ submissionId, action: 'start_review', idempotencyKey: 'review-0001', note: 'Initial review.' }), {
    submissionId, action: 'start_review', idempotencyKey: 'review-0001', note: 'Initial review.',
  })
  assert.throws(() => parseInboundOperation({ submissionId, action: 'send_email', idempotencyKey: 'review-0001' }), /not supported/)
})

test('operations idempotency hashes are deterministic and non-plaintext', () => {
  const hash = inboundOperationHash('review-0001')
  assert.match(hash, /^sha256:[a-f0-9]{64}$/)
  assert.equal(hash, inboundOperationHash('review-0001'))
})
