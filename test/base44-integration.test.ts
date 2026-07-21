import assert from 'node:assert/strict'
import test from 'node:test'

import { base44OpenApiDocument } from '../lib/base44-integration.ts'

test('Base44 OpenAPI surface exposes only the MPS runtime audit endpoint', () => {
  assert.deepEqual(Object.keys(base44OpenApiDocument.paths), ['/api/mps-audits'])
  assert.equal(base44OpenApiDocument.paths['/api/mps-audits'].post.operationId, 'runMpsClaimAudit')
  assert.equal(base44OpenApiDocument.paths['/api/mps-audits'].post.security[0].bearerCredential.length, 0)
  assert.ok(JSON.stringify(base44OpenApiDocument).includes('402'))
  assert.ok(!JSON.stringify(base44OpenApiDocument).includes('checkout'))
})
