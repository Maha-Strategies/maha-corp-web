import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  buildEpistemicFactoryQueueJob,
  compileEpistemicDraft,
  detectEpistemicClaimConflicts,
  EPISTEMIC_FACTORY_MCP_TOOLS,
  parseEpistemicFactoryRecord,
  verifyEpistemicBridgeContracts,
} from '../lib/epistemic-factory-tools.ts'
import { verifyEpistemicFactoryQueueJob } from '../lib/epistemic-factory-worker.ts'
import { epistemicRecordPath } from '../lib/epistemic-publication.ts'
import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from '../lib/quantum-systems-graph.ts'
import { SEMICONDUCTOR_EQUIPMENT_ARTICLES } from '../lib/semiconductor-equipment.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from '../lib/synthetic-biology-graph.ts'

const ROOT = new URL('../', import.meta.url)
const graph = [...QUANTUM_SYSTEMS_GRAPH_RECORDS, ...SYNTHETIC_BIOLOGY_GRAPH_RECORDS]

test('factory draft compilation preserves a noncanonical exact-hash boundary', () => {
  const record = structuredClone(QUANTUM_SYSTEMS_GRAPH_RECORDS[0])
  const parsed = parseEpistemicFactoryRecord(record)
  const compilation = compileEpistemicDraft(parsed, epistemicRecordPath(parsed), graph, new Date('2026-08-24T15:00:00.000Z'))
  assert.equal(compilation.recordId, record.id)
  assert.equal(compilation.canonicalStatus, 'noncanonical-draft')
  assert.deepEqual(compilation.indexControl, { crawlable: false, sitemapEligible: false, robotsDirective: 'noindex, nofollow, noarchive' })
  assert.equal(compilation.candidateSnapshot.publication.reviewState, 'draft')
  assert.equal(compilation.candidateSnapshot.publication.reviewEvents.length, 0)
  assert.match(compilation.compilationSha256, /^sha256:[a-f0-9]{64}$/)
})

test('factory parser rejects promotion state and inherited review decisions', () => {
  const promoted = structuredClone(QUANTUM_SYSTEMS_GRAPH_RECORDS[0])
  promoted.publication.requestedPublicPromotion = true
  assert.throws(() => parseEpistemicFactoryRecord(promoted), /non-promoted drafts/)
  const reviewed = structuredClone(QUANTUM_SYSTEMS_GRAPH_RECORDS[0])
  reviewed.publication.reviewEvents.push({ reviewerId: 'agent', reviewerRole: 'agent', reviewedAt: new Date().toISOString(), verdict: 'approve', rationale: 'not valid' })
  assert.throws(() => parseEpistemicFactoryRecord(reviewed), /cannot carry review decisions/)
})

test('conflict detection returns bounded lexical leads rather than truth decisions', () => {
  const source = QUANTUM_SYSTEMS_GRAPH_RECORDS[0]
  const candidate = structuredClone(QUANTUM_SYSTEMS_GRAPH_RECORDS[1])
  candidate.id = 'urn:maha:record:conflict-probe'
  candidate.slug = 'conflict-probe'
  candidate.claims[0].id = 'urn:maha:claim:conflict-probe'
  candidate.claims[0].statement = source.claims[0].statement
  candidate.sections.forEach((section) => { section.claimIds = section.claimIds.map(() => candidate.claims[0].id) })
  candidate.bridges = []
  const leads = detectEpistemicClaimConflicts(candidate, [source])
  assert.equal(leads[0]?.kind, 'exact-duplicate')
  assert.equal(leads[0]?.requiresHumanAdjudication, true)
  assert.equal('verdict' in (leads[0] ?? {}), false)
})

test('bridge verification fails unresolved and under-specified bridge contracts closed', () => {
  const candidate = structuredClone(QUANTUM_SYSTEMS_GRAPH_RECORDS[0])
  candidate.bridges = [{
    id: 'urn:maha:bridge:unresolved-equivalence',
    sourceConceptId: candidate.id,
    targetConceptId: 'urn:maha:record:does-not-exist',
    bridgeType: 'mathematical-equivalence',
    statement: 'A proposed equivalence that has not supplied a formal attachment.',
  }]
  const findings = verifyEpistemicBridgeContracts(candidate, graph)
  assert.equal(findings[0].status, 'blocked')
  assert.deepEqual(findings[0].reasons, ['bridge-target-unresolved', 'formal-attachment-required'])
  assert.equal(findings[0].proofVerified, false)
})

test('the durable worker re-verifies every digest and remains noncanonical', () => {
  const record = QUANTUM_SYSTEMS_GRAPH_RECORDS[0]
  const compilation = compileEpistemicDraft(record, epistemicRecordPath(record), graph, new Date('2026-08-24T15:00:00.000Z'))
  const job = buildEpistemicFactoryQueueJob(compilation, new Date('2026-08-24T15:01:00.000Z'))
  const result = verifyEpistemicFactoryQueueJob(job)
  assert.equal(result.recordId, record.id)
  assert.equal(result.canonical, false)
  assert.equal(result.sitemapEligible, false)
  const drifted = structuredClone(job)
  drifted.compilation.candidateSnapshot.summary += ' drift'
  assert.throws(() => verifyEpistemicFactoryQueueJob(drifted), /candidate digest/)
})

test('MCP exposure is authenticated and non-mutating while queue and release stay separate', async () => {
  assert.deepEqual(EPISTEMIC_FACTORY_MCP_TOOLS.map((tool) => tool.name), [
    'factory_draft_node', 'factory_detect_conflict', 'factory_verify_bridge',
  ])
  assert.ok(EPISTEMIC_FACTORY_MCP_TOOLS.every((tool) => tool.readOnly))
  assert.equal((EPISTEMIC_FACTORY_MCP_TOOLS.map((tool) => tool.name) as string[]).includes('factory_promote_to_public'), false)
  const [mcpRoute, queueRoute, workerRoute, releaseRoute, revalidation] = await Promise.all([
    readFile(new URL('app/api/mcp/epistemic-factory/route.ts', ROOT), 'utf8'),
    readFile(new URL('app/api/admin/epistemic-factory/jobs/route.ts', ROOT), 'utf8'),
    readFile(new URL('app/api/admin/epistemic-factory/worker/route.ts', ROOT), 'utf8'),
    readFile(new URL('app/api/admin/epistemic-releases/route.ts', ROOT), 'utf8'),
    readFile(new URL('lib/epistemic-revalidation.ts', ROOT), 'utf8'),
  ])
  assert.match(mcpRoute, /authorizeEpistemicOperations/)
  assert.doesNotMatch(mcpRoute, /enqueueEpistemicFactoryJob|authorizeEpistemicReleaseAuthority|executeEpistemicCanonicalRelease/)
  assert.match(queueRoute, /enqueueEpistemicFactoryJob/)
  assert.match(workerRoute, /completeEpistemicFactoryJob/)
  assert.match(releaseRoute, /authorizeEpistemicReleaseAuthority/)
  assert.equal(releaseRoute.match(/revalidateEpistemicReleasePaths\(/g)?.length, 2)
  for (const path of ['release.canonicalPath', "'/sitemap.xml'", "'/llms.txt'", "'/knowledge/epistemic-system/releases/registry.json'"]) assert.ok(revalidation.includes(path))
})

test('the execution migration makes jobs durable without granting publication authority', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260825170000_epistemic_factory_execution_queue.sql', ROOT), 'utf8')
  for (const contract of [
    'epistemic_factory_jobs', 'epistemic_factory_draft_targets', 'enqueue_epistemic_factory_job',
    'claim_epistemic_factory_jobs', 'complete_epistemic_factory_job', 'for update skip locked',
    'reviewTargetSha256', 'sourcePublicPath', 'noncanonical-draft', 'requestedPublicPromotion',
    'revoke insert, update, delete, truncate',
  ]) assert.match(migration, new RegExp(contract, 'i'))
  assert.doesNotMatch(migration, /record_epistemic_canonical_release|published-canonical/)
})

test('the first scale batch contains 46 bounded pilot records and semiconductor equipment reaches 25', () => {
  assert.equal(QUANTUM_SYSTEMS_GRAPH_RECORDS.length, 23)
  assert.equal(SYNTHETIC_BIOLOGY_GRAPH_RECORDS.length, 23)
  assert.equal(graph.length, 46)
  assert.equal(SEMICONDUCTOR_EQUIPMENT_ARTICLES.length, 25)
  assert.ok(SEMICONDUCTOR_EQUIPMENT_ARTICLES.some((article) => article.slug === 'chip-to-wafer-and-wafer-to-wafer-bonding-system'))
})
