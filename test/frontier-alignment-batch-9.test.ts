import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import {
  ALIGNMENT_BATCH_9_REMEDIATION_PACKETS,
  ALIGNMENT_BATCH_9_VERSION,
} from '../lib/frontier-alignment-batch-9.ts'
import {
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
  verdictTotals,
} from '../lib/frontier-source-alignment.ts'

const root = new URL('..', import.meta.url).pathname
const jsonPath = join(root, 'content/frontier-alignment/batch-9-remediation-packets.json')
const reportPath = join(root, 'docs/frontier-audit/alignment-batch-9-remediation-packets.md')

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

test('Batch 9 freezes twenty inspected mismatches across all eight frontier domains', () => {
  assert.equal(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.length, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.recordId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.packetId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.replacement.proposedSourceContractId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.domainSlug)).size, 8)

  for (const packet of ALIGNMENT_BATCH_9_REMEDIATION_PACKETS) {
    const audit = alignmentFor(packet.recordId)!
    assert.equal(audit.evidence.subjectAligned, 'mismatched')
    assert.equal(audit.evidence.sourceContentInspected, true)
    assert.ok(packet.priority.total >= 7)
    assert.equal(
      packet.priority.total,
      packet.priority.productRelevance
        + packet.priority.graphLeverage
        + packet.priority.correctionValue
        + packet.priority.inspectability,
    )
  }
})

test('every replacement has inspected content and an exact inspected locator', () => {
  for (const packet of ALIGNMENT_BATCH_9_REMEDIATION_PACKETS) {
    const inspection = packet.replacement.inspection
    assert.equal(inspection.metadataVerified, true)
    assert.equal(inspection.contentInspected, true)
    assert.equal(inspection.exactLocatorInspected, true)
    assert.ok(inspection.inspectedContentLocation.length > 20)
    assert.ok(inspection.findings.length > 20)
    assert.ok(inspection.limitation.length > 20)
    assert.match(packet.replacement.url, /^https:\/\//)
    assert.doesNotMatch(packet.replacement.url, /@/)
    assert.equal(packet.replacement.replacementDecision, 'replacement-supported')
    assert.deepEqual(packet.replacement.rights, {
      basis: 'citation-with-paraphrase',
      quotationUsed: false,
      sourceContentCommitted: false,
    })
  }
})

test('all replacements remain blocked and confer no release or mutation authority', () => {
  for (const packet of ALIGNMENT_BATCH_9_REMEDIATION_PACKETS) {
    assert.equal(packet.disposition, 'blocked-pending-source-override-review')
    assert.equal(packet.canonicalMutationAuthorized, false)
    assert.equal(packet.promotionEligible, false)
    assert.equal(packet.externallyReviewed, false)
    assert.equal(packet.independentlyReproduced, false)

    const audit = alignmentFor(packet.recordId)!
    assert.equal(audit.proposedSourceOverride?.decision, 'pending-human-decision')
    assert.equal(audit.proposedSourceOverride?.identifier, packet.replacement.identifier)
    assert.equal(audit.proposedSourceOverride?.inspection?.replacementDecision, 'replacement-supported')
    assert.ok(alignmentBlockers(packet.recordId).includes('source-subject-mismatched'))
  }
})

test('Batch 9 does not alter canonical source bindings, verdicts, or aggregate counts', () => {
  for (const packet of ALIGNMENT_BATCH_9_REMEDIATION_PACKETS) {
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === packet.recordId)!
    const audit = alignmentFor(packet.recordId)!
    assert.deepEqual(record.claims[0]?.sourceIds, [audit.sourceContractId])
    assert.notEqual(audit.sourceIdentifier, packet.replacement.identifier.replace(/^(doi|url):/, ''))
    assert.equal(audit.evidence.subjectAligned, 'mismatched')
  }
  assert.deepEqual(verdictTotals(), {
    supported: 90,
    'partially-supported': 50,
    mismatched: 86,
    'insufficient-evidence': 9,
    'inaccessible-source': 5,
  })
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => alignmentBlockers(entry.recordId).length === 0).length, 90)
})

test('generated remediation packets carry independently reproducible packet and batch digests', () => {
  const artifact = JSON.parse(readFileSync(jsonPath, 'utf8'))
  assert.equal(artifact.schemaVersion, ALIGNMENT_BATCH_9_VERSION)
  assert.equal(artifact.packets.length, 20)
  for (const packet of artifact.packets) {
    const { packetDigest, ...withoutDigest } = packet
    assert.equal(packetDigest, sha256(withoutDigest))
  }
  const { batchDigest, ...withoutDigest } = artifact
  assert.equal(batchDigest, sha256(withoutDigest))
  assert.deepEqual(artifact.counts, {
    replacementSourcesDiscovered: 20,
    replacementMetadataVerified: 20,
    replacementContentInspected: 20,
    replacementLocatorsInspected: 20,
    blockedPendingReview: 20,
    canonicalMutationsAuthorized: 0,
    promotionEligible: 0,
  })
})

test('Batch 9 artifacts regenerate byte-identically and stay out of public indexes', () => {
  const paths = [jsonPath, reportPath]
  const before = paths.map((path) => readFileSync(path, 'utf8'))
  execFileSync(process.execPath, [
    '--experimental-strip-types',
    join(root, 'scripts/generate-frontier-alignment-batch-9-remediation.ts'),
  ], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(path, 'utf8'), before[index], `${path} drifted`))

  const servedIndexes = [
    readFileSync(join(root, 'app/sitemap.ts'), 'utf8'),
    readFileSync(join(root, 'app/llms.txt/route.ts'), 'utf8'),
  ].join('\n')
  for (const marker of ['batch-9-remediation', ALIGNMENT_BATCH_9_VERSION, 'blocked-pending-source-override-review']) {
    assert.doesNotMatch(servedIndexes, new RegExp(marker))
  }
})
