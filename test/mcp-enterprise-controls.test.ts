import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_MCP_SLA_POLICY, parseMcpSlaPolicy, parseToolsListResponse } from '../lib/mcp/validation.ts'

test('MCP SLA controls accept defaults and enforce commercial safety bounds', () => {
  assert.deepEqual(parseMcpSlaPolicy(DEFAULT_MCP_SLA_POLICY), DEFAULT_MCP_SLA_POLICY)
  assert.throws(() => parseMcpSlaPolicy({ ...DEFAULT_MCP_SLA_POLICY, timeoutMs: 999 }), /timeoutMs/)
  assert.throws(() => parseMcpSlaPolicy({ ...DEFAULT_MCP_SLA_POLICY, requestsPerMinute: 601 }), /requestsPerMinute/)
  assert.throws(() => parseMcpSlaPolicy({ ...DEFAULT_MCP_SLA_POLICY, failureThreshold: 1.5 }), /failureThreshold/)
  assert.throws(() => parseMcpSlaPolicy({ ...DEFAULT_MCP_SLA_POLICY, cooldownMs: 4_999 }), /cooldownMs/)
})

test('tools/list discovery accepts a bounded MCP inventory and pagination cursor', () => {
  const parsed = parseToolsListResponse({
    jsonrpc: '2.0', id: 'discover_test',
    result: { tools: [{ name: 'portfolio.risk', description: 'Scores a portfolio.', inputSchema: { type: 'object', properties: { portfolioId: { type: 'string' } }, required: ['portfolioId'] } }], nextCursor: 'page-2' },
  }, 'discover_test')
  assert.equal(parsed.tools[0].name, 'portfolio.risk')
  assert.equal(parsed.nextCursor, 'page-2')
})

test('tools/list discovery rejects untrusted envelopes, duplicate names, and malformed schemas', () => {
  assert.throws(() => parseToolsListResponse({ jsonrpc: '2.0', id: 'wrong', result: { tools: [] } }, 'expected'), /envelope/)
  assert.throws(() => parseToolsListResponse({ jsonrpc: '2.0', id: 'x', result: { tools: [{ name: 'same', inputSchema: {} }, { name: 'same', inputSchema: {} }] } }, 'x'), /duplicate/)
  assert.throws(() => parseToolsListResponse({ jsonrpc: '2.0', id: 'x', result: { tools: [{ name: '../unsafe', inputSchema: {} }] } }, 'x'), /tool name/)
  assert.throws(() => parseToolsListResponse({ jsonrpc: '2.0', id: 'x', result: { tools: [{ name: 'valid', inputSchema: [] }] } }, 'x'), /inputSchema/)
})
