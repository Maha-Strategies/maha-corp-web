import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { FRONTIER_CANARY_EPISTEMIC_ADAPTER, EPISTEMIC_MIGRATION_INVENTORY } from '../lib/epistemic-adapters.ts'
import {
  FRONTIER_CANARY_CONTROL_RECORDS,
  FRONTIER_CANARY_MANIFEST,
  FRONTIER_CANARY_RECORDS,
} from '../lib/frontier-canonicalization.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { epistemicRecordPath, epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import {
  EXPERT_REVIEW_CRITERIA,
  parseEpistemicExpertReview,
} from '../lib/epistemic-review.ts'
import { buildFrontierReviewQueues } from '../lib/frontier-review-queue.ts'
import {
  FRONTIER_SOURCE_CONTRACTS,
  parseFrontierSourceVerificationReport,
  verifyFrontierSourceContracts,
} from '../lib/frontier-source-verification.ts'

const ROOT = new URL('../', import.meta.url)

function surname(name: string) {
  return name.replace(/\bet al\.?/i, '').trim().split(/\s+/).at(-1) ?? 'Unknown'
}

async function fixtureFetch(input: string | URL | Request) {
  const url = String(input)
  if (url.startsWith('https://api.crossref.org/works/')) {
    const doi = decodeURIComponent(url.slice('https://api.crossref.org/works/'.length))
    const contract = FRONTIER_SOURCE_CONTRACTS.find((entry) => entry.source.identifiers.some((identifier) => identifier.scheme === 'doi' && identifier.value === doi))
    if (!contract) return new Response('missing', { status: 404 })
    return Response.json({ message: {
      title: [contract.source.title],
      publisher: contract.source.publisher,
      author: [{ family: surname(contract.source.authors[0]) }],
      published: { 'date-parts': [[Number(contract.source.publishedAt.slice(0, 4))]] },
    } })
  }
  const contract = FRONTIER_SOURCE_CONTRACTS.find((entry) => entry.source.url === url)
  if (!contract) return new Response('missing', { status: 404 })
  return new Response(`<html><head><title>${contract.source.title}</title></head><body>${contract.source.publishedAt} ${contract.source.exactLocator}</body></html>`, { status: 200, headers: { 'content-type': 'text/html' } })
}

test('the frontier canary is fixed at five exact records per domain with 200 controls', () => {
  assert.deepEqual(FRONTIER_CANARY_MANIFEST.counts, { domains: 8, records: 40, controls: 200 })
  assert.equal(FRONTIER_CANARY_RECORDS.length, 40)
  assert.equal(FRONTIER_CANARY_CONTROL_RECORDS.length, 200)
  assert.equal(new Set(FRONTIER_CANARY_RECORDS.map((record) => record.id)).size, 40)
  assert.equal(FRONTIER_CANARY_MANIFEST.domains.every((domain) => domain.canary.length === 5 && domain.controls === 25), true)
})

test('48 source contracts independently resolve into a hash-bound report', async () => {
  const report = await verifyFrontierSourceContracts(fixtureFetch, new Date('2026-08-25T20:00:00.000Z'))
  assert.equal(report.results.length, 48)
  assert.equal(report.summary.verified, 48, JSON.stringify(report.results.filter((result) => result.status === 'failed')))
  assert.equal(report.summary.failed, 0)
  assert.equal(report.summary.contentConfirmedLocators, 48)
  assert.equal(parseFrontierSourceVerificationReport(structuredClone(report)).reportSha256, report.reportSha256)
  const changed = structuredClone(report)
  changed.results[0].observedTitle = 'Changed after verification'
  assert.throws(() => parseFrontierSourceVerificationReport(changed), /digest/)
})

test('domain queues preserve all 240 targets and canary-control separation', async () => {
  const report = await verifyFrontierSourceContracts(fixtureFetch, new Date('2026-08-25T20:00:00.000Z'))
  const targets = FRONTIER_DOMAIN_GRAPH_RECORDS.map((record) => ({
    recordId: record.id,
    reviewTargetSha256: epistemicReviewTargetHash(record),
    sourcePublicPath: epistemicRecordPath(record),
    candidateSnapshot: record,
    gateDecision: { publicEligible: false, reasons: ['public-promotion-not-requested', 'review-state-not-canonical', 'publication-date-missing', 'canonical-version-missing', 'approval-review-missing'] },
  }))
  const queue = buildFrontierReviewQueues(targets, [], report)
  assert.deepEqual(queue.summary, { domains: 8, records: 240, canary: 40, controls: 200, exactTargets: 240, sourceVerified: 240, releaseReady: 0, canonical: 0 })
  assert.equal(queue.lanes.length, 8)
  assert.equal(queue.lanes.every((lane) => lane.summary.records === 30 && lane.summary.canary === 5 && lane.summary.controls === 25), true)
})

test('internal editorial identity remains distinct from automated verification and external expertise', () => {
  const record = FRONTIER_CANARY_RECORDS[0]
  const base = {
    recordId: record.id,
    domainSlug: record.domainSlug,
    targetSha256: epistemicReviewTargetHash(record),
    scope: 'source-fidelity',
    criteria: EXPERT_REVIEW_CRITERIA['source-fidelity'].map((criterion) => ({ criterionId: criterion.id, verdict: 'satisfied', rationale: 'The exact bounded criterion passed the declared internal protocol.' })),
    disagreements: ['The internal reviewer is not independent of the publisher.'],
    rationale: 'This is a bounded internal editorial decision and not an external expert endorsement.',
    supersedesReviewId: null,
    idempotencyKey: 'frontier-review-test-001',
  }
  const internal = parseEpistemicExpertReview({ ...base, reviewer: {
    reviewerId: 'expert_maha-internal-test', profileVersion: 1, displayName: 'Internal protocol',
    qualifications: ['Internal AI-assisted editorial protocol; not an external credential.'], affiliation: 'Maha Strategies', identityUrl: null,
    domains: [record.domainSlug], conflicts: ['Publisher and reviewer are the same organization.'], reviewerKind: 'internal-editorial', reviewMethod: 'Exact-hash internal editorial method with no external reviewer participation.',
  } })
  assert.equal(internal.reviewer.reviewerKind, 'internal-editorial')
  assert.throws(() => parseEpistemicExpertReview({ ...base, scope: 'domain-fidelity', criteria: EXPERT_REVIEW_CRITERIA['domain-fidelity'].map((criterion) => ({ criterionId: criterion.id, verdict: 'satisfied', rationale: 'The exact bounded criterion passed the declared automated protocol.' })), reviewer: {
    reviewerId: 'expert_maha-automated-test', profileVersion: 1, displayName: 'Automated protocol',
    qualifications: ['Machine source verifier; not a domain expert.'], affiliation: 'Maha Strategies', identityUrl: null,
    domains: [record.domainSlug], conflicts: [], reviewerKind: 'automated-verifier', reviewMethod: 'Deterministic machine verification only.',
  } }), /may decide only source-fidelity or rights-and-locator/)
})

test('the bounded ingestion adapter contains only the 40 canaries and stays out of the legacy inventory', () => {
  assert.equal(FRONTIER_CANARY_EPISTEMIC_ADAPTER.adapt().length, 40)
  assert.equal(EPISTEMIC_MIGRATION_INVENTORY.counts.adapters, 5)
  const batch = buildEpistemicIngestionBatch({ adapterId: 'frontier-canary', idempotencyKey: 'frontier-canary-test' }, new Date('2026-08-25T20:00:00.000Z'))
  assert.equal(batch.recordCount, 40)
  assert.equal(batch.records.every((entry) => FRONTIER_CANARY_RECORDS.some((record) => record.id === entry.candidateRecordId)), true)
})

test('production surfaces persist verification, separate authority, and verify 200 negative controls', async () => {
  const [migration, sourceRoute, queueRoute, script, workflow, recordPage] = await Promise.all([
    'supabase/migrations/20260825200000_frontier_source_verification_ledger.sql',
    'app/api/admin/epistemic-source-verifications/route.ts',
    'app/api/admin/epistemic-frontier-review-queues/route.ts',
    'scripts/run-frontier-canonicalization-canary.ts',
    '.github/workflows/production-frontier-canonicalization-canary.yml',
    'app/knowledge/[kind]/[slug]/[recordSlug]/page.tsx',
  ].map((path) => readFile(new URL(path, ROOT), 'utf8')))
  assert.match(migration, /epistemic_source_verification_runs/)
  assert.match(migration, /record_epistemic_frontier_canary_batch/)
  assert.match(migration, /reject_epistemic_ledger_mutation/)
  assert.match(sourceRoute, /authorizeEpistemicOperations/)
  assert.match(queueRoute, /buildFrontierReviewQueues/)
  assert.match(script, /FRONTIER_CANARY_CONTROL_RECORDS/)
  assert.match(script, /privateControl404s/)
  assert.match(script, /No external reviewer participated/)
  assert.match(workflow, /PROMOTE_40_INTERNAL_CANARIES/)
  assert.match(workflow, /production-database/)
  assert.match(recordPage, /reviewerKind/)
  assert.match(recordPage, /internal review cannot be mistaken for independent expert endorsement/)
})
