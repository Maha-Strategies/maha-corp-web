import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { LEGACY_ADAPTER_IDS } from '../lib/epistemic-adapters.ts'
import { buildEpistemicIngestionBatch } from '../lib/epistemic-ingestion.ts'
import { ALIGNMENT_BATCH_7_INTAKE } from '../lib/frontier-alignment-batch-7-intake.ts'
import { FRONTIER_ALIGNMENT_AUDIT, alignmentBlockers } from '../lib/frontier-source-alignment.ts'
import { ARTIFACT_VERSIONS, compileOutstandingRecoveryPackets, RECOVERY_CHANNELS, SOURCE_RECOVERY_OUTSTANDING_IDS } from '../lib/source-recovery.ts'

test('the outstanding queue covers every and only uninspected frontier record', () => {
  const uninspected = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => !entry.evidence.sourceContentInspected)
  const packets = compileOutstandingRecoveryPackets()
  assert.equal(uninspected.length, 5)
  assert.equal(SOURCE_RECOVERY_OUTSTANDING_IDS.length, 1)
  assert.deepEqual(packets.flatMap((packet) => packet.affectedRecordIds).sort(), uninspected.map((entry) => entry.recordId).sort())
  for (const packet of packets) {
    assert.equal(packet.inspectionAuthorized, false)
    assert.equal(packet.canonicalMutationAuthorized, false)
    assert.ok(packet.requests.some((request) => request.channel === 'doi-resolver') || packet.sourceIdentifier === null)
    assert.ok(packet.requests.some((request) => request.channel === 'institutional-repository'))
    assert.ok(packet.requests.some((request) => ['arxiv', 'biorxiv'].includes(request.channel)))
  }
})

test('all uninspected positional assignments remain automatically blocked and non-explanatory', () => {
  const rows = FRONTIER_ALIGNMENT_AUDIT.filter((entry) => !entry.evidence.sourceContentInspected)
  assert.equal(rows.filter((entry) => entry.assignmentOrigin === 'positional-legacy').length, 5)
  for (const entry of rows) {
    assert.equal(entry.evidence.claimSupported, false)
    assert.equal(entry.evidence.inspectedContentLocation, null)
    assert.ok(alignmentBlockers(entry.recordId).includes('source-not-inspected'))
    assert.ok(alignmentBlockers(entry.recordId).includes('source-assignment-positional-legacy'))
  }
})

test('new ingestion records enter a required-uninspected alignment audit by default', () => {
  for (const adapterId of LEGACY_ADAPTER_IDS.filter((candidate) => candidate !== 'mcp-private-canary')) {
    const batch = buildEpistemicIngestionBatch({ adapterId, idempotencyKey: `default-alignment-audit-${adapterId}` }, new Date('2026-08-28T00:00:00Z'))
    assert.ok(batch.records.length > 0, adapterId)
    for (const record of batch.records) {
      assert.equal(record.alignmentDecision.contentInspectionState, 'required-uninspected')
      assert.equal(record.alignmentDecision.explanatoryEligible, false)
      assert.equal(record.alignmentDecision.canonicalEligible, false)
      assert.equal(record.gateDecision.publicEligible, false)
      assert.ok(record.gateDecision.reasons.some((reason) => reason.startsWith('source-content-inspection-missing:')))
    }
  }
})

test('recovery vocabulary covers DOI, repositories, preprints, author manuscripts, and government mirrors', () => {
  for (const channel of ['doi-resolver', 'crossref', 'institutional-repository', 'arxiv', 'biorxiv', 'osti', 'usgs', 'nist']) {
    assert.ok((RECOVERY_CHANNELS as readonly string[]).includes(channel), channel)
  }
  for (const artifact of ['accepted-manuscript', 'preprint', 'repository-copy', 'government-report']) {
    assert.ok((ARTIFACT_VERSIONS as readonly string[]).includes(artifact), artifact)
  }
})

test('Batch 7 preserves the immutable pre-inspection backlog snapshot', () => {
  assert.equal(ALIGNMENT_BATCH_7_INTAKE.status, 'inspection-pending')
  assert.equal(ALIGNMENT_BATCH_7_INTAKE.recordCount, 94)
  assert.equal(ALIGNMENT_BATCH_7_INTAKE.sourceContractCount, 19)
  assert.equal(ALIGNMENT_BATCH_7_INTAKE.explanatoryEligibleCount, 0)
  assert.equal(ALIGNMENT_BATCH_7_INTAKE.canonicalEligibleCount, 0)
  assert.equal(Object.keys(ALIGNMENT_BATCH_7_INTAKE.domainCounts).length, 8)
  assert.ok(ALIGNMENT_BATCH_7_INTAKE.records.every((record) => record.assignmentOrigin === 'positional-legacy'))
})

test('Batch 7 intake and outstanding recovery artifacts regenerate byte-identically', () => {
  const root = new URL('..', import.meta.url).pathname
  const paths = [
    'content/frontier-alignment/batch-7-intake.json',
    'docs/frontier-audit/alignment-batch-7-intake.md',
    'content/source-recovery/outstanding-packets.json',
    'docs/source-recovery/outstanding.md',
  ]
  const before = paths.map((path) => readFileSync(join(root, path), 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-frontier-alignment-batch-7-intake.ts')], { cwd: root })
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-source-recovery-packets.ts'), '--outstanding', '--write'], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(join(root, path), 'utf8'), before[index]))
})

test('outstanding recovery artifacts stay outside public projection', () => {
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  const llms = readFileSync(new URL('../lib/llms-manifest.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(sitemap, /outstanding-packets|source-recovery\/outstanding/)
  assert.doesNotMatch(llms, /outstanding-packets|source-recovery\/outstanding/)
})
