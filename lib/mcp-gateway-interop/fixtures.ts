import { createHash } from 'node:crypto'

import { GOVERNANCE_SCHEMA_VERSION, type GovernancePolicy } from '../governance/envelope.ts'
import type { ActorIdentity, Sha256 } from '../governed-workflow/types.ts'
import type { GatewayPolicyChain } from './governance.ts'
import type { McpGatewayContext, McpToolCallFrame } from './mcp-adapter.ts'

/**
 * Sanitized fixtures for the four demonstrated paths.
 *
 * Everything is invented. There is no real tenant, agent, upstream, document
 * or argument value anywhere in this file, and the "documents" referenced are
 * digests of strings that exist only here.
 */

export const GATEWAY_FIXTURE_VERSION = '2026-08-22'

function syntheticDigest(label: string): Sha256 {
  return `sha256:${createHash('sha256').update(`gateway-interop:${label}`, 'utf8').digest('hex')}`
}

export const FIXTURE_TENANT_ID = 'tenant-synthetic-gateway'
export const FIXTURE_AGENT_ID = 'agent-synthetic-assistant'
export const FIXTURE_TARGET_ID = 'upstream-synthetic-records'
export const FIXTURE_RESOURCE = 'https://upstream.invalid/records'

/** Reviewer identity is a digest and a role, never a name. */
export const FIXTURE_REVIEWER: ActorIdentity = {
  actorKind: 'human_reviewer',
  actorIdSha256: syntheticDigest('reviewer:records-approver'),
  actorRole: 'records-approver',
}

/** An agent identity, for proving an agent cannot approve its own action. */
export const FIXTURE_AGENT_ACTOR: ActorIdentity = {
  actorKind: 'agent',
  actorIdSha256: syntheticDigest('actor:assistant'),
  actorRole: 'synthetic-assistant',
}

/**
 * The tenant policy.
 *
 * `records.export` is on the review list, so exporting always needs a human.
 * `records.read` is not, so reading proceeds. Payment is forbidden at the root,
 * which no child layer can undo.
 */
export const FIXTURE_ROOT_POLICY: GovernancePolicy = {
  schemaVersion: GOVERNANCE_SCHEMA_VERSION,
  policyId: 'gateway.interop.synthetic',
  policyVersion: GATEWAY_FIXTURE_VERSION,
  allowedTenantIds: [FIXTURE_TENANT_ID],
  allowedAgentIds: [FIXTURE_AGENT_ID],
  allowedTransports: ['mcp'],
  allowedTargetIds: [FIXTURE_TARGET_ID],
  allowedResources: [FIXTURE_RESOURCE],
  allowedOperations: ['tools/call', 'tools/list'],
  allowedCapabilities: ['records.read', 'records.export'],
  maxInputBytes: 65_536,
  maxHops: 2,
  maxTimeoutMs: 30_000,
  review: { operations: [], capabilities: ['records.export'] },
  payment: { mode: 'forbid', allowedBuyerPolicyIds: [] },
}

export const FIXTURE_CHAIN: GatewayPolicyChain = { root: FIXTURE_ROOT_POLICY }

/** A tenant that has withdrawn export authority entirely. */
export const FIXTURE_RESTRICTED_CHAIN: GatewayPolicyChain = {
  root: FIXTURE_ROOT_POLICY,
  layers: [{
    policyId: 'gateway.interop.synthetic.no-export',
    policyVersion: GATEWAY_FIXTURE_VERSION,
    parentPolicyId: FIXTURE_ROOT_POLICY.policyId,
    scope: 'tenant',
    constraints: { allowedCapabilities: ['records.read'] },
  }],
}

export const FIXTURE_CONTEXT: McpGatewayContext = {
  requestId: 'req-synthetic-0001',
  tenantId: FIXTURE_TENANT_ID,
  agentId: FIXTURE_AGENT_ID,
  targetId: FIXTURE_TARGET_ID,
  resource: FIXTURE_RESOURCE,
  timeoutMs: 10_000,
  hopCount: 1,
  evidence: [
    { evidenceId: 'ev-retention-schedule', contentSha256: syntheticDigest('evidence:retention-schedule:r1') },
    { evidenceId: 'ev-access-basis', contentSha256: syntheticDigest('evidence:access-basis:r1') },
  ],
}

/** The same evidence slot, revised — for the approval-invalidation path. */
export const FIXTURE_EVIDENCE_REVISED = [
  { evidenceId: 'ev-retention-schedule', contentSha256: syntheticDigest('evidence:retention-schedule:r2') },
  { evidenceId: 'ev-access-basis', contentSha256: syntheticDigest('evidence:access-basis:r1') },
]

/** Allowed: reading is not on the review list. */
export const FIXTURE_READ_FRAME: McpToolCallFrame = {
  jsonrpc: '2.0', id: 1, method: 'tools/call',
  params: { name: 'records.read', arguments: { recordRef: 'SYNTH-REC-0001', fields: ['status', 'category'] } },
}

/** Approval required: exporting is on the review list. */
export const FIXTURE_EXPORT_FRAME: McpToolCallFrame = {
  jsonrpc: '2.0', id: 2, method: 'tools/call',
  params: { name: 'records.export', arguments: { recordRef: 'SYNTH-REC-0001', format: 'ndjson' } },
}

/** Denied: the capability is outside the policy entirely. */
export const FIXTURE_DELETE_FRAME: McpToolCallFrame = {
  jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: { name: 'records.delete', arguments: { recordRef: 'SYNTH-REC-0001' } },
}

export const FIXTURE_EPOCH = new Date('2026-08-22T10:00:00.000Z')

export function fixtureClock(start: Date = FIXTURE_EPOCH, stepMs = 1_000) {
  let current = start.getTime()
  return () => { const value = new Date(current); current += stepMs; return value }
}
