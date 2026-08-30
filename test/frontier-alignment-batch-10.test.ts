import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { ALIGNMENT_BATCH_9_REMEDIATION_PACKETS } from '../lib/frontier-alignment-batch-9.ts'
import {
  ALIGNMENT_BATCH_10_REMEDIATION_PACKETS,
  ALIGNMENT_BATCH_10_VERSION,
} from '../lib/frontier-alignment-batch-10.ts'
import {
  FRONTIER_ALIGNMENT_AUDIT,
  alignmentBlockers,
  alignmentFor,
  verdictTotals,
} from '../lib/frontier-source-alignment.ts'

const root = new URL('..', import.meta.url).pathname
const jsonPath = join(root, 'content/frontier-alignment/batch-10-remediation-packets.json')
const reportPath = join(root, 'docs/frontier-audit/alignment-batch-10-remediation-packets.md')
const modulePath = join(root, 'lib/frontier-alignment-batch-10.ts')

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

test('Batch 10 freezes twenty priority records from the 66 mismatches outside Batch 9', () => {
  const batch9Ids = new Set(ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((packet) => packet.recordId))
  const mismatchIds = FRONTIER_ALIGNMENT_AUDIT
    .filter((entry) => entry.evidence.subjectAligned === 'mismatched')
    .map((entry) => entry.recordId)
  const remainingIds = mismatchIds.filter((recordId) => !batch9Ids.has(recordId))

  assert.equal(mismatchIds.length, 86)
  assert.equal(remainingIds.length, 66)
  assert.equal(ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.length, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.map((packet) => packet.recordId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.map((packet) => packet.packetId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.map((packet) => packet.replacement.proposedSourceContractId)).size, 20)

  for (const packet of ALIGNMENT_BATCH_10_REMEDIATION_PACKETS) {
    assert.ok(remainingIds.includes(packet.recordId))
    assert.ok(packet.priority.total >= 8)
    assert.ok(packet.priority.unlocks.length > 0)
    assert.equal(
      packet.priority.total,
      packet.priority.productRelevance
        + packet.priority.graphLeverage
        + packet.priority.correctionValue
        + packet.priority.inspectability,
    )
  }
})

test('selection declares meaningful product leverage', () => {
  const counts = {
    substantial: ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.filter((packet) => packet.priority.unlocks.includes('substantial-page')).length,
    dossier: ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.filter((packet) => packet.priority.unlocks.includes('evidence-dossier')).length,
    bridge: ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.filter((packet) => packet.priority.unlocks.includes('quantum-bridge')).length,
  }
  assert.ok(counts.substantial >= 20)
  assert.ok(counts.dossier >= 18)
  assert.ok(counts.bridge >= 6)
})

test('every replacement has verified metadata, inspected content, and an exact locator', () => {
  for (const packet of ALIGNMENT_BATCH_10_REMEDIATION_PACKETS) {
    const inspection = packet.replacement.inspection
    assert.equal(inspection.metadataVerified, true)
    assert.equal(inspection.contentInspected, true)
    assert.equal(inspection.exactLocatorInspected, true)
    assert.ok(inspection.inspectedContentLocation.length > 20)
    assert.ok(inspection.findings.length > 20)
    assert.ok(inspection.limitation.length > 20)
    assert.match(packet.replacement.url, /^https:\/\//)
    assert.doesNotMatch(packet.replacement.url, /@/)
    assert.deepEqual(packet.replacement.rights, {
      basis: 'citation-with-paraphrase',
      quotationUsed: false,
      sourceContentCommitted: false,
    })
  }
})

test('replacements remain private and cannot change the active source binding', () => {
  for (const packet of ALIGNMENT_BATCH_10_REMEDIATION_PACKETS) {
    assert.equal(packet.disposition, 'blocked-pending-source-override-review')
    assert.equal(packet.canonicalMutationAuthorized, false)
    assert.equal(packet.promotionEligible, false)
    assert.equal(packet.externallyReviewed, false)
    assert.equal(packet.independentlyReproduced, false)

    const audit = alignmentFor(packet.recordId)!
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === packet.recordId)!
    assert.equal(audit.evidence.subjectAligned, 'mismatched')
    assert.equal(audit.evidence.sourceContentInspected, true)
    assert.equal(audit.proposedSourceOverride?.decision, 'pending-human-decision')
    assert.equal(audit.proposedSourceOverride?.identifier, packet.replacement.identifier)
    assert.deepEqual(record.claims[0]?.sourceIds, [audit.sourceContractId])
    assert.ok(alignmentBlockers(packet.recordId).includes('source-subject-mismatched'))
  }
  assert.deepEqual(verdictTotals(), {
    supported: 90,
    'partially-supported': 50,
    mismatched: 86,
    'insufficient-evidence': 9,
    'inaccessible-source': 5,
  })
})

test('module-load guards fail closed on authority, inspection, and priority tampering', () => {
  const source = readFileSync(modulePath, 'utf8')
  const mutations = [
    source.replace('canonicalMutationAuthorized: false,', 'canonicalMutationAuthorized: true as false,'),
    source.replace('contentInspected: true,', 'contentInspected: false as true,'),
    source.replace('score: [4, 3, 2, 1]', 'score: [0, 0, 0, 0]'),
  ]
  for (const [index, mutated] of mutations.entries()) {
    assert.notEqual(mutated, source)
    const scratch = mkdtempSync(join(tmpdir(), `maha-batch10-${index}-`))
    const target = join(scratch, 'mutated.ts')
    writeFileSync(target, mutated)
    const result = spawnSync(process.execPath, ['--experimental-strip-types', target], { encoding: 'utf8' })
    rmSync(scratch, { recursive: true, force: true })
    assert.notEqual(result.status, 0, `mutation ${index} bypassed the module guard`)
  }
})

test('generated packets carry reproducible packet and batch digests', () => {
  const artifact = JSON.parse(readFileSync(jsonPath, 'utf8'))
  assert.equal(artifact.schemaVersion, ALIGNMENT_BATCH_10_VERSION)
  assert.equal(artifact.selection.activeMismatches, 86)
  assert.equal(artifact.selection.excludedBatch9Records, 20)
  assert.equal(artifact.selection.eligibleRemainingMismatches, 66)
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

test('Batch 10 artifacts regenerate byte-identically and stay out of public indexes', () => {
  const paths = [jsonPath, reportPath]
  const before = paths.map((path) => readFileSync(path, 'utf8'))
  execFileSync(process.execPath, [
    '--experimental-strip-types',
    join(root, 'scripts/generate-frontier-alignment-batch-10-remediation.ts'),
  ], { cwd: root })
  paths.forEach((path, index) => assert.equal(readFileSync(path, 'utf8'), before[index], `${path} drifted`))

  const servedIndexes = [
    readFileSync(join(root, 'app/sitemap.ts'), 'utf8'),
    readFileSync(join(root, 'app/llms.txt/route.ts'), 'utf8'),
  ].join('\n')
  for (const marker of ['batch-10-remediation', ALIGNMENT_BATCH_10_VERSION, 'blocked-pending-source-override-review']) {
    assert.doesNotMatch(servedIndexes, new RegExp(marker))
  }
})
