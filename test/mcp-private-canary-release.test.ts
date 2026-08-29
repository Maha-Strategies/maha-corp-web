import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { getLegacyEpistemicAdapter } from '../lib/epistemic-adapters.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { buildEpistemicExpertReview } from '../lib/epistemic-review.ts'
import { releaseReadiness } from '../lib/epistemic-release.ts'
import {
  MCP_PRIVATE_CANARY_INSPECTION_SHA256,
  MCP_PRIVATE_CANARY_ADAPTER_ID,
  MCP_PRIVATE_CANARY_RECORD,
  MCP_PRIVATE_CANARY_TARGET_SHA256,
  mcpPrivateCanaryReviewInputs,
} from '../lib/mcp-private-canary-release.ts'

const ROOT = new URL('../', import.meta.url)

test('synthetic MCP canary adapter freezes exactly one private draft target', () => {
  const adapter = getLegacyEpistemicAdapter(MCP_PRIVATE_CANARY_ADAPTER_ID)
  assert.ok(adapter)
  const candidates = adapter.adapt()
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0]?.record.id, MCP_PRIVATE_CANARY_RECORD.id)
  assert.equal(candidates[0]?.reviewTargetSha256, MCP_PRIVATE_CANARY_TARGET_SHA256)
  assert.equal(candidates[0]?.record.publication.reviewState, 'draft')
  assert.equal(candidates[0]?.record.publication.requestedPublicPromotion, false)
  assert.equal(candidates[0]?.gateDecision.publicEligible, false)
  assert.match(candidates[0]?.record.title ?? '', /^Synthetic private/)
  assert.ok(candidates[0]?.record.boundaries.every((boundary) => !/production release$/i.test(boundary)))
  const ingestion = buildEpistemicIngestionBatch({ adapterId: MCP_PRIVATE_CANARY_ADAPTER_ID, idempotencyKey: 'synthetic-inspection-attestation' }, new Date('2026-08-29T00:00:00.000Z'))
  assert.equal(ingestion.records[0]?.alignmentDecision.contentInspectionState, 'internally-inspected-synthetic')
  assert.equal(ingestion.records[0]?.alignmentDecision.inspectionAttestationSha256, MCP_PRIVATE_CANARY_INSPECTION_SHA256)
  assert.deepEqual(ingestion.records[0]?.alignmentDecision.blockerCodes, [])
  assert.ok(!ingestion.records[0]?.gateDecision.reasons.some((reason) => reason.startsWith('source-content-inspection-missing:')))
})

test('four explicit internal-editorial decisions bind the same exact synthetic target', () => {
  const decisions = mcpPrivateCanaryReviewInputs()
  assert.deepEqual(decisions.map((decision) => decision.scope).sort(), ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'])
  assert.ok(decisions.every((decision) => decision.targetSha256 === MCP_PRIVATE_CANARY_TARGET_SHA256))
  assert.ok(decisions.every((decision) => decision.reviewer.reviewerKind === 'internal-editorial'))
  assert.ok(decisions.every((decision) => decision.criteria.length === 3 && decision.criteria.every((criterion) => criterion.verdict === 'satisfied')))
  assert.ok(decisions.every((decision) => /No external reviewer participated/.test(decision.disagreements.join(' '))))
})

test('the ordinary release gate becomes ready only after all four exact-scope decisions', () => {
  const target = { recordId: MCP_PRIVATE_CANARY_RECORD.id, targetSha256: MCP_PRIVATE_CANARY_TARGET_SHA256, candidateSnapshot: MCP_PRIVATE_CANARY_RECORD }
  const inputs = mcpPrivateCanaryReviewInputs()
  const reviews = inputs.map((input, index) => buildEpistemicExpertReview(input, new Date(`2026-08-29T00:0${index}:00.000Z`)))
  assert.equal(releaseReadiness(target, reviews.slice(0, 3)).ready, false)
  const readiness = releaseReadiness(target, reviews)
  assert.equal(readiness.ready, true)
  assert.equal(readiness.approvals.length, 4)
  assert.deepEqual(readiness.decision.reasons, [])
})

test('database and application gates constrain the canary to one Preview-only record', async () => {
  const [migration, route, workflow] = await Promise.all([
    readFile(new URL('supabase/migrations/20260829000100_mcp_evidence_tool_licensing.sql', ROOT), 'utf8'),
    readFile(new URL('app/api/admin/epistemic-ingestion/route.ts', ROOT), 'utf8'),
    readFile(new URL('.github/workflows/preview-cabezon-mcp-federation-canary.yml', ROOT), 'utf8'),
  ])
  assert.match(migration, /record_mcp_private_canary_target/)
  assert.match(migration, /recordCount',''\) <> '1'/)
  assert.match(migration, /urn:maha:record:synthetic-private-mcp-release-fixture/)
  assert.match(migration, /reviewState}',''\) <> 'draft'/)
  assert.match(migration, new RegExp(MCP_PRIVATE_CANARY_INSPECTION_SHA256))
  assert.match(route, /VERCEL_ENV !== 'preview'/)
  assert.match(route, /MCP_PRIVATE_CANARY_ENABLED !== 'true'/)
  assert.match(workflow, /Create one fully governed synthetic Preview release/)
  assert.match(workflow, /scopedReviewCount == 4/)
  assert.match(workflow, /governed-release\.json/)
})

test('synthetic fixture identifiers do not enter discovery manifests', async () => {
  const sources = await Promise.all(['app/sitemap.ts', 'app/llms.txt/route.ts', 'lib/llms-manifest.ts', 'lib/mcp-public-manifest.ts'].map((path) => readFile(new URL(path, ROOT), 'utf8')))
  for (const source of sources) assert.doesNotMatch(source, /synthetic-private-mcp-release-fixture|mcp-private-canary/)
})
