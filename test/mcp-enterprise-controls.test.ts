import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_MCP_ALLOWED_METHODS, DEFAULT_MCP_SLA_POLICY, evaluateMcpServerPolicy, parseMcpServerPolicy, parseMcpSlaPolicy, parseToolsListResponse } from '../lib/mcp/validation.ts'

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

test('canonical gateway policy requires explicit tool approval', () => {
  const readOnly = parseMcpServerPolicy({ allowedMethods: DEFAULT_MCP_ALLOWED_METHODS, allowedToolNames: [] })
  assert.deepEqual(evaluateMcpServerPolicy({ jsonrpc: '2.0', id: '1', method: 'tools/list' }, readOnly), { allowed: true })
  assert.equal(evaluateMcpServerPolicy({ jsonrpc: '2.0', id: '2', method: 'tools/call', params: { name: 'portfolio.risk' } }, readOnly).allowed, false)

  const callable = parseMcpServerPolicy({ allowedMethods: [...DEFAULT_MCP_ALLOWED_METHODS, 'tools/call'], allowedToolNames: ['portfolio.risk'] })
  assert.deepEqual(evaluateMcpServerPolicy({ jsonrpc: '2.0', id: '3', method: 'tools/call', params: { name: 'portfolio.risk', arguments: {} } }, callable), { allowed: true })
  assert.equal(evaluateMcpServerPolicy({ jsonrpc: '2.0', id: '4', method: 'tools/call', params: { name: 'admin.delete' } }, callable).allowed, false)
})

test('canonical gateway policy rejects ambiguous method and tool combinations', () => {
  assert.throws(() => parseMcpServerPolicy({ allowedMethods: ['tools/call'], allowedToolNames: [] }), /requires/)
  assert.throws(() => parseMcpServerPolicy({ allowedMethods: ['tools/list'], allowedToolNames: ['portfolio.risk'] }), /requires/)
  assert.throws(() => parseMcpServerPolicy({ allowedMethods: ['unknown'], allowedToolNames: [] }), /unsupported/)
})
