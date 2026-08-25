import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  FRONTIER_DOMAIN_GRAPH_RECORDS,
  FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN,
  FRONTIER_EPISTEMIC_DOMAINS,
} from '../lib/frontier-domain-graphs.ts'
import { EPISTEMIC_DOMAINS, EPISTEMIC_RECORDS, PUBLIC_EPISTEMIC_RECORDS, buildDomainRegistry } from '../lib/epistemic-pilots.ts'
import { epistemicRecordPath, evaluatePublicationGate } from '../lib/epistemic-publication.ts'
import { buildEpistemicCandidateAudit } from '../lib/epistemic-audit.ts'

const root = new URL('../', import.meta.url)

test('eight frontier domains compile to exact bounded 30-record cohorts', () => {
  assert.equal(FRONTIER_EPISTEMIC_DOMAINS.length, 8)
  assert.equal(FRONTIER_DOMAIN_GRAPH_RECORDS.length, 240)
  assert.equal(EPISTEMIC_DOMAINS.length, 10)
  assert.equal(EPISTEMIC_RECORDS.length, 290)

  const allIds = new Set(EPISTEMIC_RECORDS.map((record) => record.id))
  const frontierIds = new Set<string>()
  const frontierPaths = new Set<string>()
  for (const domain of FRONTIER_EPISTEMIC_DOMAINS) {
    const records = FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN[domain.slug]
    assert.equal(records.length, 30, domain.slug)
    assert.equal(records.reduce((total, record) => total + record.bridges.length, 0), 34, domain.slug)
    for (const requiredKind of ['concept', 'mechanism', 'method', 'measurement', 'comparison']) {
      assert.ok(records.some((record) => record.recordKind === requiredKind), `${domain.slug} lacks ${requiredKind}`)
    }
    for (const record of records) {
      assert.equal(frontierIds.has(record.id), false, record.id)
      assert.equal(frontierPaths.has(epistemicRecordPath(record)), false, epistemicRecordPath(record))
      frontierIds.add(record.id)
      frontierPaths.add(epistemicRecordPath(record))
      assert.ok(record.bridges.every((bridge) => allIds.has(bridge.targetConceptId)))
    }
  }
})

test('frontier candidates remain source-bound, exact-hash reviewable, and noncanonical', () => {
  for (const record of FRONTIER_DOMAIN_GRAPH_RECORDS) {
    assert.equal(record.claims.length, 1)
    assert.equal(record.sources.length, 1)
    assert.equal(record.publication.reviewState, 'draft')
    assert.equal(record.publication.requestedPublicPromotion, false)
    assert.equal(record.publication.reviewEvents.length, 0)
    assert.deepEqual(record.publication.requiredReviewScopes, [
      'source-fidelity',
      'domain-fidelity',
      'boundary-adequacy',
      'rights-and-locator',
    ])
    const source = record.sources[0]
    assert.ok(source.exactLocator.length >= 24)
    assert.ok(source.rights.note.length >= 24)
    assert.equal(source.rights.quotationUsed, false)
    assert.ok(source.publishedAt || source.sourceChronology?.accessedAt)
    assert.deepEqual(evaluatePublicationGate(record).reasons, [
      'public-promotion-not-requested',
      'review-state-not-canonical',
      'publication-date-missing',
      'approval-review-missing',
      'expert-review-missing:source-fidelity',
      'expert-review-missing:domain-fidelity',
      'expert-review-missing:boundary-adequacy',
      'expert-review-missing:rights-and-locator',
    ])
    const automatedAudit = buildEpistemicCandidateAudit(record, new Date('2026-08-25T00:00:00.000Z'))
    assert.equal(automatedAudit.status, 'automated-checks-passed')
    assert.equal(automatedAudit.counts.blockers, 0)
    assert.equal(automatedAudit.sourceClaimLinks.length, 1)
    assert.equal(PUBLIC_EPISTEMIC_RECORDS.includes(record), false)
  }
})

test('domain registries expose aggregate capacity but never frontier draft identities', () => {
  for (const domain of FRONTIER_EPISTEMIC_DOMAINS) {
    const registry = buildDomainRegistry(domain.slug)
    assert.equal(registry?.counts.graphRecords, 30)
    assert.equal(registry?.counts.graphEdges, 34)
    assert.equal(registry?.counts.publicCanonicalRecords, 0)
    assert.equal(registry?.counts.withheldRecords, 30)
    assert.equal(registry?.withheldInventory.disclosure, 'aggregate-only')
    const serialized = JSON.stringify(registry)
    for (const record of FRONTIER_DOMAIN_GRAPH_RECORDS_BY_DOMAIN[domain.slug]) {
      assert.equal(serialized.includes(record.id), false)
      assert.equal(serialized.includes(record.title), false)
    }
  }
})

test('production operator parallelizes bounded cohorts without release authority', async () => {
  const [script, workflow, packageJson, hub, sitemap, llms] = await Promise.all([
    'scripts/run-frontier-domain-scale.ts',
    '.github/workflows/production-frontier-domain-scale.yml',
    'package.json',
    'app/knowledge/page.tsx',
    'app/sitemap.ts',
    'lib/llms-manifest.ts',
  ].map((path) => readFile(new URL(path, root), 'utf8')))

  assert.match(script, /mapConcurrent\(domainBatches, 4/)
  assert.match(script, /limit: 50/)
  assert.match(script, /automated source-to-claim and unsupported-inference audit/)
  assert.match(script, /noncanonicalDraftTargets: selected\.length/)
  assert.doesNotMatch(script, /target\.candidateSnapshot/)
  assert.match(script, /sitemapEligibleRecordPages: 0/)
  assert.match(script, /sampled noncanonical frontier route did not return 404/i)
  assert.doesNotMatch(script, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.match(workflow, /enqueue-drain-verify/)
  assert.doesNotMatch(workflow, /EPISTEMIC_RELEASE_AUTHORITY_TOKEN/)
  assert.doesNotMatch(workflow, /publish/)
  assert.match(packageJson, /operate:frontier-domain-scale/)
  assert.match(hub, /Governed frontier domain/)
  assert.match(sitemap, /EPISTEMIC_DOMAINS\.map/)
  assert.match(llms, /EPISTEMIC_DOMAINS\.map/)
})
