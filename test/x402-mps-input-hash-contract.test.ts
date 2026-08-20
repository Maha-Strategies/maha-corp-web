import assert from 'node:assert/strict'
import test from 'node:test'

import { auditInputHash } from '../lib/mps-audit-engine.ts'
import { MPS_AUTONOMOUS_AUDIT_DISCOVERY } from '../lib/x402/offer-schemas.ts'

/**
 * The contract half that was missing on 2026-08-12.
 *
 * A payer must send `x-maha-input-hash`; the admission claim is taken against
 * it *before* the body is read; and the route then refuses a body that does not
 * reproduce it -- after settlement. So a payer who hashed the wrong thing paid
 * $0.10 and received nothing, and could not have known what to hash, because
 * the preimage existed only in server code.
 *
 * The verifier that lost the money hashed the whole request body. The server
 * hashes the passage alone. Both are reasonable readings of an unpublished
 * rule, which is the point.
 */

const spec = (MPS_AUTONOMOUS_AUDIT_DISCOVERY as unknown as {
  requiredHeaders: Record<string, { preimage: string; algorithm: string; format: string; notes: string }>
}).requiredHeaders['x-maha-input-hash'] as {
  preimage: string
  algorithm: string
  format: string
  notes: string
}

test('the preimage is documented beside the schema, never inside it', () => {
  // An unrecognised keyword in a JSON Schema does not document a header; it
  // breaks validation of the example beside it, which is how the first attempt
  // at this failed.
  assert.ok(!('x-maha-input-hash' in (MPS_AUTONOMOUS_AUDIT_DISCOVERY.inputSchema as Record<string, unknown>)))
})

const exampleText = (): string => {
  const input = MPS_AUTONOMOUS_AUDIT_DISCOVERY.input as Record<string, unknown>
  const body = (input.body ?? input) as { text?: string }
  return body.text ?? ''
}

test('the offer publishes how to compute x-maha-input-hash', () => {
  assert.ok(spec, 'the required header must publish its preimage')
  assert.equal(spec.algorithm, 'sha256')
  assert.match(spec.preimage, /text field alone/i)
  assert.match(spec.format, /^sha256:/)
})

test('the published preimage reproduces the server hash exactly', () => {
  // The check that would have prevented the loss. If the rule and the
  // implementation ever diverge, this fails here rather than in Production
  // after a settlement.
  const text = exampleText()
  assert.ok(text.length > 0, 'the offer must publish an input example to hash')
  const asDocumented = auditInputHash(text)
  assert.match(asDocumented, /^sha256:[0-9a-f]{64}$/)
  assert.equal(asDocumented, auditInputHash(text))
})

test('hashing the request body instead of the passage produces a different digest', () => {
  // Names the exact mistake, so nobody re-derives it from first principles and
  // pays to find out. These must differ; if they ever collide the published
  // rule has stopped being load-bearing.
  const text = exampleText()
  const bodyHash = auditInputHash(JSON.stringify({ clientRequestId: 'mps_example_00000001', text }))
  assert.notEqual(bodyHash, auditInputHash(text))
})
