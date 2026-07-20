import assert from 'node:assert/strict'
import test from 'node:test'
import { mcpBridgeManifest } from '../lib/mcp-bridge.ts'

test('commercial bridge compatibility is versioned and distinct from the Cognitive Gateway', () => {
  assert.equal(mcpBridgeManifest.bridge.version, '0.3.2')
  assert.equal(mcpBridgeManifest.security.paymentAuthority, 'none')
  assert.match(mcpBridgeManifest.distinctServices[0].relationship, /not interchangeable/i)
})
