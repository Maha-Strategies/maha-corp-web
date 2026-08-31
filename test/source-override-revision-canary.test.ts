import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { epistemicReviewTargetHash, sha256Canonical } from '../lib/epistemic-publication.ts'
import {
  evaluateSourceOverrideRevisionReadiness,
  PRIVATE_REVISION_RELEASE_CANARY,
  REVISION_AUDIT_DIMENSIONS,
  SOURCE_OVERRIDE_RELEASE_CANARY_RECORD_IDS,
  SOURCE_OVERRIDE_REVISED_RECORDS,
  SOURCE_OVERRIDE_REVISION_AUDITS,
  SOURCE_OVERRIDE_REVISION_DECISIONS,
  type RevisionScopedDecision,
  type SourceOverrideRevisionAudit,
} from '../lib/source-override-revision-canary.ts'
import { PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS } from '../lib/frontier-source-override-activation.ts'

function decisionsFor(recordId: string): RevisionScopedDecision[] {
  return SOURCE_OVERRIDE_REVISION_DECISIONS.filter((decision) => decision.recordId === recordId)
}

function auditFor(recordId: string): SourceOverrideRevisionAudit {
  const audit = SOURCE_OVERRIDE_REVISION_AUDITS.find((entry) => entry.recordId === recordId)
  assert.ok(audit)
  return audit
}

test('five corrected records replace one source and preserve active bindings', () => {
  assert.equal(SOURCE_OVERRIDE_REVISED_RECORDS.length, 5)
  assert.deepEqual(SOURCE_OVERRIDE_REVISED_RECORDS.map((record) => record.id), [...SOURCE_OVERRIDE_RELEASE_CANARY_RECORD_IDS])
  for (const revised of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const active = FRONTIER_DOMAIN_GRAPH_RECORDS.find((record) => record.id === revised.id)
    const activation = PRIVATE_SOURCE_OVERRIDE_ACTIVATIONS.find((entry) => entry.recordId === revised.id)
    assert.ok(active)
    assert.ok(activation)
    assert.equal(epistemicReviewTargetHash(active), activation.priorRecordRevisionSha256)
    assert.ok(active.sources.some((source) => source.id === activation.priorSourceContractId))
    assert.ok(!active.sources.some((source) => source.id === activation.proposedSourceContractId))
    assert.deepEqual(revised.sources.map((source) => source.id), [activation.proposedSourceContractId])
    assert.deepEqual(revised.claims[0].sourceIds, [activation.proposedSourceContractId])
    assert.notEqual(epistemicReviewTargetHash(revised), activation.priorRecordRevisionSha256)
    assert.equal(revised.publication.reviewState, 'draft')
    assert.equal(revised.publication.requestedPublicPromotion, false)
    assert.equal(revised.publication.reviewEvents.length, 0)
  }
})

test('each exact revision has an eight-dimension audit and four scoped decisions', () => {
  assert.equal(SOURCE_OVERRIDE_REVISION_AUDITS.length, 5)
  assert.equal(SOURCE_OVERRIDE_REVISION_DECISIONS.length, 20)
  for (const record of SOURCE_OVERRIDE_REVISED_RECORDS) {
    const audit = auditFor(record.id)
    const { auditSha256, ...auditBody } = audit
    assert.equal(auditSha256, sha256Canonical(auditBody))
    assert.equal(audit.revisedRecordRevisionSha256, epistemicReviewTargetHash(record))
    assert.deepEqual([...new Set(audit.checks.map((check) => check.dimension))].sort(), [...REVISION_AUDIT_DIMENSIONS].sort())
    assert.equal(audit.checks.every((check) => check.verdict === 'satisfied'), true)
    const decisions = decisionsFor(record.id)
    assert.equal(decisions.length, 4)
    assert.equal(new Set(decisions.map((decision) => decision.scope)).size, 4)
    for (const decision of decisions) {
      const { decisionSha256, ...decisionBody } = decision
      assert.equal(decisionSha256, sha256Canonical(decisionBody))
      assert.equal(decision.targetSha256, audit.revisedRecordRevisionSha256)
      assert.equal(decision.auditSha256, audit.auditSha256)
      assert.equal(decision.reviewerKind, 'internal-editorial')
      assert.equal(decision.externallyReviewed, false)
      assert.equal(decision.independentlyReproduced, false)
    }
    assert.deepEqual(evaluateSourceOverrideRevisionReadiness(record, audit, decisions), { ready: true, blockers: [] })
  }
})

test('revision gate fails closed on absent, stale, tampered, metadata-only and incomplete evidence', () => {
  const record = structuredClone(SOURCE_OVERRIDE_REVISED_RECORDS[0])
  const audit = structuredClone(auditFor(record.id))
  const decisions = structuredClone(decisionsFor(record.id))
  assert.deepEqual(evaluateSourceOverrideRevisionReadiness(record, undefined, decisions).blockers, ['revision-audit-missing'])

  const staleAudit = structuredClone(audit)
  staleAudit.revisedRecordRevisionSha256 = 'sha256:stale'
  assert.ok(evaluateSourceOverrideRevisionReadiness(record, staleAudit, decisions).blockers.includes('revision-audit-target-stale'))

  const tamperedAudit = structuredClone(audit)
  tamperedAudit.exactLocator = `${tamperedAudit.exactLocator} changed`
  assert.ok(evaluateSourceOverrideRevisionReadiness(record, tamperedAudit, decisions).blockers.includes('revision-audit-digest-invalid'))
  assert.ok(evaluateSourceOverrideRevisionReadiness(record, tamperedAudit, decisions).blockers.includes('revision-audit-locator-mismatch'))

  const metadataOnlyRecord = structuredClone(record)
  metadataOnlyRecord.sources[0].exactLocator = ''
  assert.ok(evaluateSourceOverrideRevisionReadiness(metadataOnlyRecord, audit, decisions).blockers.includes('revision-audit-locator-mismatch'))

  assert.ok(evaluateSourceOverrideRevisionReadiness(record, audit, decisions.slice(1)).blockers.includes('revision-review-scope-missing'))
  const forgedDecisions = structuredClone(decisions)
  forgedDecisions[0].targetSha256 = 'sha256:forged'
  assert.ok(evaluateSourceOverrideRevisionReadiness(record, audit, forgedDecisions).blockers.includes('revision-review-digest-invalid'))
  assert.ok(evaluateSourceOverrideRevisionReadiness(record, audit, forgedDecisions).blockers.includes('revision-review-target-stale'))
})

test('private release preflight is exactly two superseding and three initial records', () => {
  assert.equal(PRIVATE_REVISION_RELEASE_CANARY.length, 5)
  assert.equal(PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'superseding').length, 2)
  assert.equal(PRIVATE_REVISION_RELEASE_CANARY.filter((entry) => entry.releaseKind === 'initial').length, 3)
  for (const entry of PRIVATE_REVISION_RELEASE_CANARY) {
    const record = SOURCE_OVERRIDE_REVISED_RECORDS.find((candidate) => candidate.id === entry.recordId)
    assert.ok(record)
    assert.equal(entry.targetSha256, epistemicReviewTargetHash(record))
    assert.equal(entry.substantialPageEligible, true)
    assert.equal(entry.state, 'private-preflight-passed-awaiting-release-authority')
    assert.equal(entry.canonicalMutationAuthorized, false)
    assert.equal(entry.releaseAuthorityPresent, false)
    assert.equal(entry.productionMutationPerformed, false)
    if (entry.releaseKind === 'superseding') {
      assert.ok(entry.priorReleaseId)
      assert.ok(entry.priorReleaseTargetSha256)
      assert.notEqual(entry.priorReleaseTargetSha256, entry.targetSha256)
    } else {
      assert.equal(entry.priorReleaseId, null)
      assert.equal(entry.priorReleaseTargetSha256, null)
    }
  }
})

test('generated revision canary is deterministic, private and authority-free', async () => {
  const run = () => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-source-override-revision-canary.ts'], {
    cwd: process.cwd(), encoding: 'utf8', env: process.env,
  })
  assert.equal(run().status, 0)
  const first = await readFile('content/epistemic/source-override-revision-canary.json', 'utf8')
  assert.equal(run().status, 0)
  const second = await readFile('content/epistemic/source-override-revision-canary.json', 'utf8')
  assert.equal(second, first)
  assert.match(first, /"canonicalMutations": 0/)
  assert.match(first, /"releasesCreated": 0/)
  assert.doesNotMatch(first, /"canonicalMutationAuthorized": true|"releaseAuthorityPresent": true|"productionMutationPerformed": true/)
})

function filesUnder(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

test('revision canary artifacts and vocabulary remain outside public sources and client bundles', () => {
  const publicSources = ['app/sitemap.ts', 'app/llms.txt/route.ts', 'lib/llms-manifest.ts', 'lib/substantial-page-public.ts']
    .filter(existsSync).map((file) => readFileSync(file, 'utf8')).join('\n')
  assert.doesNotMatch(publicSources, /source-override-revision-canary|private-preflight-passed-awaiting-release-authority/)
  const clientBundle = filesUnder('.next/static').map((file) => readFileSync(file, 'utf8')).join('\n')
  assert.doesNotMatch(clientBundle, /source-override-revision-canary|revision-audit-target-stale|private-preflight-passed-awaiting-release-authority/)
})
