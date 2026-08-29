import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { COMMERCIAL_API_OPERATIONS } from '../lib/commercial-api-metering.ts'
import type { EpistemicCanonicalRelease } from '../lib/epistemic-release.ts'
import { sha256Canonical } from '../lib/epistemic-publication.ts'
import { EPISTEMIC_RECORDS } from '../lib/epistemic-pilots.ts'
import {
  buildLicensedEvidenceProjection,
  buildMcpEvidenceGrantSnapshot,
  MCP_EVIDENCE_CAPABILITY,
  MCP_EVIDENCE_LICENSE_PLANS,
  MCP_EVIDENCE_LICENSE_TERMS_SHA256,
  MCP_EVIDENCE_TOOL_NAME,
  mcpEvidenceOutputSha256,
  mcpEvidenceRequestSha256,
  parseMcpEvidenceRpcEnvelope,
  parseMcpEvidenceToolArguments,
  type McpEvidenceExecutionReservation,
} from '../lib/mcp-evidence-licensing.ts'

const ROOT = new URL('../', import.meta.url)

function releaseFixture(): EpistemicCanonicalRelease {
  const seed = EPISTEMIC_RECORDS[0]
  const recordSnapshot = {
    ...seed,
    publication: {
      ...seed.publication,
      requestedPublicPromotion: true,
      reviewState: 'published-canonical' as const,
      canonicalVersion: '1.0.0',
      publishedAt: '2026-08-29',
      reviewEvents: [{
        reviewId: 'epireview_1234567890abcdef1234567890abcdef',
        reviewerId: 'reviewer_internal_test',
        reviewerProfileVersion: 1,
        reviewerRole: 'Internal editorial reviewer',
        reviewerKind: 'internal-editorial' as const,
        reviewMethod: 'explicit-scope-checklist',
        scope: 'source-fidelity' as const,
        targetSha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        reviewedAt: '2026-08-29T00:00:00.000Z',
        verdict: 'approve' as const,
        rationale: 'Fixture approval used only to test the licensed projection boundary.',
      }],
    },
  }
  const releaseId = 'epirelease_1234567890abcdef1234567890abcdef'
  const recordSha256 = sha256Canonical(recordSnapshot)
  const unsigned = {
    schemaVersion: 'maha-epistemic-release/1.0' as const,
    releaseId,
    releaseKind: 'initial' as const,
    recordId: recordSnapshot.id,
    domainSlug: recordSnapshot.domainSlug,
    targetSha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    canonicalPath: `/knowledge/${recordSnapshot.domainSlug}/concepts/${recordSnapshot.slug}`,
    canonicalVersion: '1.0.0',
    supersedesReleaseId: null,
    approvals: [{
      scope: 'source-fidelity' as const,
      reviewId: 'epireview_1234567890abcdef1234567890abcdef',
      reviewSha256: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewedAt: '2026-08-29T00:00:00.000Z',
      reviewerKind: 'internal-editorial' as const,
      reviewMethod: 'explicit-scope-checklist',
    }],
    assuranceTier: 'internally-reviewed-canonical' as const,
    authority: {
      authorityId: 'authority_internal_test',
      displayName: 'Withheld test authority',
      role: 'Release authority',
      authorizationBasis: 'Fixture authorization exists only for deterministic unit testing.',
      publicAttribution: false,
    },
    authoritySha256: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    publicChangeSummary: 'Fixture canonical release for licensed evidence projection tests.',
    rationale: 'This fixture exercises machine access without representing a real release or review.',
    recordSha256,
    recordSnapshot,
    gateDecision: {
      recordId: recordSnapshot.id,
      publicEligible: true,
      evaluatedAgainst: 'maha-epistemic/1.0' as const,
      reasons: [],
    },
    releasedAt: '2026-08-29T00:00:00.000Z',
  }
  return { ...unsigned, releaseSha256: sha256Canonical(unsigned) }
}

function reservation(release: EpistemicCanonicalRelease, idempotentReplay = false): McpEvidenceExecutionReservation {
  return {
    executionId: 'mcpexe_1234567890abcdef1234567890abcdef',
    grantId: 'mcpgrant_1234567890abcdef1234567890abcdef',
    planId: 'evidence-developer-v1',
    planVersion: '1.0.0',
    clientRequestId: 'request-0001',
    requestSha256: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    releaseId: release.releaseId,
    releaseSha256: release.releaseSha256,
    quotaPeriodStartedAt: '2026-08-01T00:00:00.000Z',
    unitQuantity: 1,
    idempotentReplay,
  }
}

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(objectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => [key, ...objectKeys(entry)])
}

test('tool arguments require one exact selector and produce a stable request digest', () => {
  const parsed = parseMcpEvidenceToolArguments({ clientRequestId: 'request-0001', selector: { releaseId: 'epirelease_1234567890abcdef1234567890abcdef' } })
  assert.equal(parsed.selector.releaseId, 'epirelease_1234567890abcdef1234567890abcdef')
  assert.equal(mcpEvidenceRequestSha256(parsed), mcpEvidenceRequestSha256(parsed))
  assert.throws(() => parseMcpEvidenceToolArguments({ clientRequestId: 'request-0001', selector: {} }), /exactly one/)
  assert.throws(() => parseMcpEvidenceToolArguments({ clientRequestId: 'request-0001', selector: { releaseId: 'epirelease_1234567890abcdef1234567890abcdef', canonicalPath: '/knowledge/a/b/c' } }), /exactly one/)
  assert.throws(() => parseMcpEvidenceToolArguments({ clientRequestId: 'request-0001', selector: { canonicalPath: '/internal/audit/record' } }), /invalid/)
})

test('license snapshots distinguish internal evaluation from actual commercial consideration', () => {
  const internal = buildMcpEvidenceGrantSnapshot({
    grantId: 'mcpgrant_1234567890abcdef1234567890abcdef',
    clientId: 'client_1234567890abcdef1234567890abcdef',
    credentialId: 'cred_1234567890abcdef1234567890abcdef',
    planId: 'evidence-internal-canary-v1',
    validFrom: '2026-08-29T00:00:00.000Z',
    validUntil: '2026-09-05T00:00:00.000Z',
    considerationState: 'internal-evaluation',
    contractedAmountUsdCents: 0,
    receivedAmountUsdCents: 0,
    commercialReference: null,
    issuedAt: '2026-08-29T00:00:00.000Z',
  })
  assert.equal(internal.termsSha256, MCP_EVIDENCE_LICENSE_TERMS_SHA256)
  assert.equal(internal.monthlyQuotaUnits, MCP_EVIDENCE_LICENSE_PLANS['evidence-internal-canary-v1'].monthlyQuotaUnits)
  assert.throws(() => buildMcpEvidenceGrantSnapshot({ ...internal, grantId: undefined, considerationState: 'internal-evaluation', contractedAmountUsdCents: 1 }), /cannot claim/)
  assert.throws(() => buildMcpEvidenceGrantSnapshot({ ...internal, grantId: undefined, planId: 'evidence-developer-v1', considerationState: 'externally-contracted', commercialReference: null }), /commercialReference/)
})

test('developer licensing matches the adopted per-lookup and subscription boundary', () => {
  const developer = MCP_EVIDENCE_LICENSE_PLANS['evidence-developer-v1']
  assert.equal(developer.listPriceUsdCents, 125_000)
  assert.equal(developer.monthlyQuotaUnits, 10_000)
  assert.equal(developer.listPriceUsdCents / developer.monthlyQuotaUnits, 12.5)
})

test('licensed projection preserves claims, locators, limitations and release provenance', () => {
  const release = releaseFixture()
  const projection = buildLicensedEvidenceProjection(release, reservation(release))
  assert.deepEqual(projection.record.claims, release.recordSnapshot.claims)
  assert.deepEqual(projection.record.sources, release.recordSnapshot.sources)
  assert.deepEqual(projection.record.boundaries, release.recordSnapshot.boundaries)
  assert.deepEqual(projection.record.prohibitedInferences, release.recordSnapshot.prohibitedInferences)
  assert.equal(projection.release.releaseSha256, release.releaseSha256)
  assert.equal(projection.release.assuranceTier, 'internally-reviewed-canonical')
  assert.equal(projection.release.releaseAuthority.attribution, 'withheld-by-consent')
  const keys = objectKeys(projection)
  for (const forbidden of ['actorFingerprint', 'credentialId', 'commercialReference', 'bearerToken', 'secret']) assert.equal(keys.includes(forbidden), false)
})

test('idempotent replay reproduces identical licensed bytes', () => {
  const release = releaseFixture()
  const first = buildLicensedEvidenceProjection(release, reservation(release, false))
  const replay = buildLicensedEvidenceProjection(release, reservation(release, true))
  assert.deepEqual(replay, first)
  assert.equal(mcpEvidenceOutputSha256(replay), mcpEvidenceOutputSha256(first))
})

test('projection refuses release substitution and noneligible records', () => {
  const release = releaseFixture()
  assert.throws(() => buildLicensedEvidenceProjection(release, { ...reservation(release), releaseSha256: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }), /does not bind/)
  assert.throws(() => buildLicensedEvidenceProjection({ ...release, gateDecision: { ...release.gateDecision, publicEligible: false, reasons: ['blocked'] } }, reservation(release)), /not publication-eligible/)
})

test('capability and aggregate metering recognize licensed MCP evidence retrieval', async () => {
  const credentialSource = await readFile(new URL('lib/agent-client-credentials.ts', ROOT), 'utf8')
  assert.match(credentialSource, new RegExp(`AGENT_CAPABILITIES = \\[.*${MCP_EVIDENCE_CAPABILITY}`))
  assert.deepEqual(COMMERCIAL_API_OPERATIONS.mcp_evidence_retrieval, { endpoint: '/api/mcp/evidence', method: 'POST' })
})

test('migration enforces append-only grants, atomic active-release checks, replay and quota', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260829000100_mcp_evidence_tool_licensing.sql', ROOT), 'utf8')
  for (const required of [
    'mcp_evidence_license_grants',
    'mcp_evidence_execution_events',
    'reject_mcp_evidence_ledger_mutation',
    'reserve_mcp_evidence_execution',
    "child.supersedes_release_id = release.release_id",
    "withdrawal.release_id = release.release_id",
    "return jsonb_build_object('outcome','idempotency_conflict')",
    "return jsonb_build_object('outcome','quota_exhausted')",
    "return jsonb_build_object('outcome','license_required')",
    "event.event_type='revoked'",
    'for update of grant',
  ]) assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(
    migration,
    /if found then[\s\S]+where grant\.grant_id=v_existing\.grant_id[\s\S]+event\.event_type='revoked'[\s\S]+return jsonb_build_object\('outcome','license_required'\)[\s\S]+return jsonb_build_object\('outcome','idempotent_replay'/,
    'idempotent replay must revalidate the original active license before returning stored execution identity',
  )
  assert.match(migration, /'evidence-developer-v1'[\s\S]+10000,125000/)
  assert.match(migration, /'evidence-enterprise-v1'[\s\S]+100000,null/)
  assert.match(migration, /revoke insert, update, delete, truncate[\s\S]+from service_role/)
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]+to (?:anon|authenticated)/i)
})

test('runtime is private-by-discovery until the protected lifecycle canary passes', async () => {
  const [route, adminRoute, manifest, llms] = await Promise.all([
    readFile(new URL('app/api/mcp/evidence/route.ts', ROOT), 'utf8'),
    readFile(new URL('app/api/admin/mcp-evidence-licenses/route.ts', ROOT), 'utf8'),
    readFile(new URL('lib/mcp-public-manifest.ts', ROOT), 'utf8'),
    readFile(new URL('lib/llms-manifest.ts', ROOT), 'utf8'),
  ])
  assert.match(route, /authorizeClientCapability\(token, MCP_EVIDENCE_CAPABILITY\)/)
  assert.ok(route.indexOf('authorizeClientCapability') < route.indexOf('reserveMcpEvidenceExecution'))
  assert.ok(route.indexOf('findActiveMcpEvidenceRelease') < route.indexOf('reserveMcpEvidenceExecution'))
  assert.match(route, /MAX_BODY_BYTES = 16_384/)
  assert.match(route, /idempotency_conflict/)
  assert.match(adminRoute, /authorizeRevenueOperations/)
  assert.doesNotMatch(route, /EPISTEMIC_OPERATIONS_TOKEN|EPISTEMIC_RELEASE_AUTHORITY_TOKEN|SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(`${manifest}\n${llms}`, /api\/mcp\/evidence|maha-licensed-evidence/)
})

test('MCP envelope validation rejects primitives and preserves notification semantics', () => {
  assert.throws(() => parseMcpEvidenceRpcEnvelope('null'), /must be an object/)
  assert.throws(() => parseMcpEvidenceRpcEnvelope('[]'), /must be an object/)
  assert.throws(() => parseMcpEvidenceRpcEnvelope(JSON.stringify({ jsonrpc: '2.0', method: 'ping' })), /require a valid id/)
  assert.throws(() => parseMcpEvidenceRpcEnvelope(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'notifications/initialized' })), /cannot include an id/)
  assert.deepEqual(
    parseMcpEvidenceRpcEnvelope(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })),
    { message: { jsonrpc: '2.0', method: 'notifications/initialized' }, id: undefined, initializedNotification: true },
  )
})

test('MCP tool contract accepts no credential, payment or publication authority in arguments', () => {
  const serialized = JSON.stringify(MCP_EVIDENCE_LICENSE_PLANS) + JSON.stringify(MCP_EVIDENCE_TOOL_NAME)
  assert.doesNotMatch(serialized, /token|secret|payment|publish|withdraw/i)
})
