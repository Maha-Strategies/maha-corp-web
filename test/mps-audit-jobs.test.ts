import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMpsAuditJobId,
  parseMpsAuditJobRequest,
  validMpsAuditJobId,
} from '../lib/mps-audit-jobs.ts'

test('MPS audit job request keeps the source text for the audit engine', () => {
  const request = parseMpsAuditJobRequest({
    clientRequestId: 'audit-client-request-01',
    text: '  In 2024, the company reported a 32 percent increase in output.  ',
  })

  assert.equal(request.text, '  In 2024, the company reported a 32 percent increase in output.  ')
})

test('MPS audit job request rejects invalid idempotency keys', () => {
  assert.throws(
    () => parseMpsAuditJobRequest({ clientRequestId: 'short', text: 'A sufficiently long passage for validation.' }),
    /clientRequestId/,
  )
})

test('MPS audit job identifiers use the public audit format', () => {
  const auditId = createMpsAuditJobId()
  assert.equal(validMpsAuditJobId(auditId), true)
  assert.equal(validMpsAuditJobId('audit_invalid'), false)
})
