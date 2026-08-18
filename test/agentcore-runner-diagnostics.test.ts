import assert from 'node:assert/strict'
import test from 'node:test'

import { errorDiagnostics } from '../lib/x402/agentcore-runner-diagnostics.ts'

test('AgentCore runner reports a bounded sanitized AWS cause chain', () => {
  const aws = Object.assign(new Error('session rejected for AKIA1234567890ABCDEF and 0x' + 'a'.repeat(64)), {
    name: 'ValidationException',
    $metadata: { requestId: 'request-123', httpStatusCode: 400 },
  })
  const outer = new Error('The bounded payment session could not be created.', { cause: aws })

  assert.deepEqual(errorDiagnostics(outer), [
    { name: 'Error', message: 'The bounded payment session could not be created.' },
    {
      name: 'ValidationException',
      message: 'session rejected for [REDACTED_AWS_ACCESS_KEY] and [REDACTED_32_BYTE_VALUE]',
      requestId: 'request-123',
      httpStatusCode: 400,
    },
  ])
})
