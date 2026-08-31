import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES,
  ALIGNMENT_BATCH_10_PRIVATE_CANARY,
  ALIGNMENT_BATCH_10_REVIEW_DECISIONS,
  ALIGNMENT_BATCH_10_REVIEW_VERSION,
  compilePrivateBatch10OverrideCandidate,
  type Batch10ReviewDecision,
} from '../lib/frontier-alignment-batch-10-review.ts'
import { ALIGNMENT_BATCH_10_REMEDIATION_PACKETS } from '../lib/frontier-alignment-batch-10.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { FRONTIER_ALIGNMENT_AUDIT, alignmentFor, verdictTotals } from '../lib/frontier-source-alignment.ts'

const root = new URL('..', import.meta.url).pathname
const generatedPaths = [
  join(root, 'content/frontier-alignment/batch-10-review-decisions.json'),
  join(root, 'content/frontier-alignment/batch-10-source-override-canary.json'),
  join(root, 'docs/frontier-audit/alignment-batch-10-review-decisions.md'),
]

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`
}

test('Batch 10 records twenty append-only internal decisions bound to exact packets and active revisions', () => {
  assert.equal(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.length, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.recordId)).size, 20)
  assert.equal(new Set(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.decisionId)).size, 20)
  const totals = { accept: 0, revise: 0, reject: 0 }
  for (const decision of ALIGNMENT_BATCH_10_REVIEW_DECISIONS) {
    const packet = ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.find((entry) => entry.recordId === decision.recordId)!
    totals[decision.decision] += 1
    assert.equal(decision.schemaVersion, ALIGNMENT_BATCH_10_REVIEW_VERSION)
    assert.equal(decision.packetId, packet.packetId)
    assert.equal(decision.packetContentSha256, sha256(packet))
    assert.equal(decision.proposedSourceIdentifier, packet.replacement.identifier)
    assert.equal(decision.review.reviewPass, 'separate-second-pass')
    assert.equal(decision.review.externallyReviewed, false)
    assert.equal(decision.review.independentlyReproduced, false)
    assert.equal(decision.checks.sourceIdentity, 'verified')
    assert.equal(decision.checks.contentInspected, true)
    assert.equal(decision.checks.exactLocatorInspected, true)
    assert.equal(decision.checks.rightsBasis, 'citation-with-paraphrase-only')
    assert.equal(decision.canonicalMutationAuthorized, false)
    assert.equal(decision.publicProjectionAuthorized, false)
    assert.equal(decision.releaseAuthorized, false)
    const { decisionSha256, ...withoutDigest } = decision
    assert.equal(decisionSha256, sha256(withoutDigest))
  }
  assert.deepEqual(totals, { accept: 12, revise: 8, reject: 0 })
})

test('decision scope follows the actual record kind rather than source relevance alone', () => {
  for (const decision of ALIGNMENT_BATCH_10_REVIEW_DECISIONS) {
    if (decision.decision === 'accept') assert.equal(decision.checks.claimScope, 'supports-exact-bounded-claim')
    if (decision.decision === 'revise') assert.equal(decision.checks.claimScope, 'record-revision-required')
    if (decision.decision === 'reject') assert.equal(decision.checks.claimScope, 'does-not-support-claim')
  }
  assert.equal(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.find((entry) => entry.recordId.endsWith('moire-superlattices'))?.decision, 'revise')
  assert.equal(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.find((entry) => entry.recordId.endsWith('neutral-beam-injection'))?.decision, 'revise')
  assert.equal(ALIGNMENT_BATCH_10_REVIEW_DECISIONS.find((entry) => entry.recordId.endsWith('least-authority-tokens'))?.decision, 'accept')
})

test('all twelve accepted proposals have independently recomputable candidate and provenance digests', () => {
  assert.equal(ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES.length, 12)
  for (const candidate of ALIGNMENT_BATCH_10_ACCEPTED_CANDIDATES) {
    const { candidateRevisionSha256, provenanceSha256, ...base } = candidate
    assert.equal(candidateRevisionSha256, sha256(base))
    assert.equal(provenanceSha256, sha256({
      candidateRevisionSha256,
      packetContentSha256: candidate.packetContentSha256,
      reviewDecisionSha256: candidate.reviewDecisionSha256,
      priorRecordRevisionSha256: candidate.priorRecordRevisionSha256,
    }))
    assert.equal(candidate.applicationState, 'private-candidate-only')
  }
})

test('the five-record private canary spans five domains and applies no binding', () => {
  assert.equal(ALIGNMENT_BATCH_10_PRIVATE_CANARY.length, 5)
  const domains = ALIGNMENT_BATCH_10_PRIVATE_CANARY.map((entry) =>
    FRONTIER_DOMAIN_GRAPH_RECORDS.find((record) => record.id === entry.recordId)!.domainSlug)
  assert.equal(new Set(domains).size, 5)
  for (const candidate of ALIGNMENT_BATCH_10_PRIVATE_CANARY) {
    const active = alignmentFor(candidate.recordId)!
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((entry) => entry.id === candidate.recordId)!
    assert.deepEqual(record.claims[0]?.sourceIds, [active.sourceContractId])
    assert.notEqual(active.sourceContractId, candidate.proposedSourceContractId)
    assert.equal(candidate.canonicalMutationAuthorized, false)
    assert.equal(candidate.publicProjectionAuthorized, false)
    assert.equal(candidate.releaseAuthorized, false)
  }
})

test('revise, missing, stale, packet-substituted, and forged decisions fail closed', () => {
  const before = new Map(FRONTIER_DOMAIN_GRAPH_RECORDS.map((record) => [record.id, record.claims.map((claim) => [...claim.sourceIds])]))
  const revise = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.find((entry) => entry.decision === 'revise')!
  const accepted = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.find((entry) => entry.decision === 'accept')!
  assert.throws(() => compilePrivateBatch10OverrideCandidate(revise.recordId), /source-override-record-revision-required/)
  assert.throws(
    () => compilePrivateBatch10OverrideCandidate(accepted.recordId, ALIGNMENT_BATCH_10_REVIEW_DECISIONS.filter((entry) => entry.recordId !== accepted.recordId)),
    /source-override-review-missing/,
  )
  const stale = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.recordId === accepted.recordId
    ? { ...entry, activeRecordRevisionSha256: `sha256:${'0'.repeat(64)}` } : entry) as Batch10ReviewDecision[]
  assert.throws(() => compilePrivateBatch10OverrideCandidate(accepted.recordId, stale), /source-override-review-digest-invalid/)
  const substituted = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.recordId === accepted.recordId
    ? { ...entry, proposedSourceIdentifier: 'doi:10.0000/substituted' } : entry) as Batch10ReviewDecision[]
  assert.throws(() => compilePrivateBatch10OverrideCandidate(accepted.recordId, substituted), /source-override-review-digest-invalid/)
  const forged = ALIGNMENT_BATCH_10_REVIEW_DECISIONS.map((entry) => entry.recordId === revise.recordId
    ? { ...entry, decision: 'accept' as const } : entry) as Batch10ReviewDecision[]
  assert.throws(() => compilePrivateBatch10OverrideCandidate(revise.recordId, forged), /source-override-review-digest-invalid/)
  for (const record of FRONTIER_DOMAIN_GRAPH_RECORDS) assert.deepEqual(record.claims.map((claim) => claim.sourceIds), before.get(record.id))
})

test('Batch 10 review leaves active alignment totals and source contracts unchanged', () => {
  assert.deepEqual(verdictTotals(), {
    supported: 94, 'partially-supported': 47, mismatched: 86, 'insufficient-evidence': 9, 'inaccessible-source': 4,
  })
  assert.equal(FRONTIER_ALIGNMENT_AUDIT.filter((entry) => entry.evidence.subjectAligned === 'mismatched').length, 86)
  for (const decision of ALIGNMENT_BATCH_10_REVIEW_DECISIONS) {
    assert.equal(alignmentFor(decision.recordId)?.evidence.subjectAligned, 'mismatched')
  }
})

test('Batch 10 artifacts regenerate byte-identically and have no public index path', () => {
  const before = generatedPaths.map((path) => readFileSync(path, 'utf8'))
  execFileSync(process.execPath, ['--experimental-strip-types', join(root, 'scripts/generate-frontier-alignment-batch-10-review.ts')], { cwd: root })
  generatedPaths.forEach((path, index) => assert.equal(readFileSync(path, 'utf8'), before[index], `${path} drifted`))

  const indexes = [readFileSync(join(root, 'app/sitemap.ts'), 'utf8'), readFileSync(join(root, 'app/llms.txt/route.ts'), 'utf8')].join('\n')
  for (const marker of [ALIGNMENT_BATCH_10_REVIEW_VERSION, 'batch-10-review-decisions', 'batch-10-source-override-canary', 'private-candidate-only']) {
    assert.doesNotMatch(indexes, new RegExp(marker))
  }
  for (const path of generatedPaths.slice(0, 2)) {
    const artifact = JSON.parse(readFileSync(path, 'utf8'))
    const { artifactSha256, ...withoutDigest } = artifact
    assert.equal(artifactSha256, sha256(withoutDigest))
  }
})
