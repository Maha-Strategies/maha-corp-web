import assert from 'node:assert/strict'
import test from 'node:test'

import { isVendorAuthored } from '../lib/uplift/vendor-authorship.ts'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

import { fingerprintFile, intake, type IntakeSubmission } from '../lib/local-evidence-intake.ts'
import { gradeEvidence, type InspectionAttestation } from '../lib/legacy-evidence-levels.ts'
import reuse from '../content/evidence-batch-7/reuse-audit.json' with { type: 'json' }
import artifacts from '../content/evidence-batch-7/acquisition-and-governance.json' with { type: 'json' }
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import audit from '../content/evidence-batch-9/depth-audit.json' with { type: 'json' }
import { assertFirstPartyPartition } from './helpers/uplift-invariants.ts'

const ROOT = resolve(import.meta.dirname, '..')
const submission = (o: Partial<IntakeSubmission> = {}): IntakeSubmission => ({
  localPath: '', declaredSourceIdentity: 'doi:10.1000/example', declaredVersion: 'version of record',
  accessBasis: 'institutional-subscription', inspectedPages: 'pp. 12-14', inspectedSections: 'Results',
  observedContent: 'the operator recorded what the passage said in their own words, at length',
  boundedClaim: 'the claim this passage supports', limitation: 'what the passage does not establish',
  operatorAttestsRead: true, operatorAttestationNote: 'read on the supplied copy', ...o,
})

/* ------------------------------------------------------------- reuse ------ */

test('reuse requires an exact inspected passage', () => {
  for (const entry of reuse.accepted) {
    assert.ok(entry.exactLocator.length > 10, `${entry.route} must name where the passage sits`)
    assert.ok(entry.supportingPassage.length > 80, 'the passage itself must be recorded')
    assert.ok(entry.pageClaim.length > 20)
    assert.ok(entry.whyItMatches.length > 60, 'the match must be argued, not asserted')
  }
})

test('graph proximity and family membership cannot authorize reuse', () => {
  const positional = reuse.rejected.find((r) => r.rejectionClass === 'positional-family-inference-refused')
  assert.ok(positional, 'a family-adjacency rejection must be recorded')
  assert.match(String(positional.reason), /Adjacency in the same family is not support/)
  assert.equal(reuse.summary.positionalInferencesUsed, 0)
})

test('a word match is not a subject match', () => {
  const wordMatch = reuse.rejected.find((r) => r.rejectionClass === 'word-match-not-subject-match')
  assert.ok(wordMatch)
  assert.match(String(wordMatch.reason), /two senses of calibration are unrelated/)
})

test('a source supporting only part of a claim is refused', () => {
  const partial = reuse.rejected.find((r) => r.rejectionClass === 'supports-only-part-of-the-claim')
  assert.ok(partial)
  assert.match(String(partial.reason), /one side of a two-sided claim/)
})

test('limitations travel with reused evidence', () => {
  for (const entry of reuse.accepted) {
    assert.ok(entry.limitationsCarried.length > 60, `${entry.route} must carry the source's limits`)
    assert.ok(entry.rightsBasis.length > 5)
    assert.ok(entry.version.length > 5, 'the version must travel too')
  }
})

test('no source was reopened to raise its page count', () => {
  assert.equal(reuse.summary.sourcesReopened, 0)
  assert.equal(reuse.summary.accepted + reuse.summary.rejected, 8)
})

/* --------------------------------------------------- the vendor correction --- */

test('vendor-authored sources cannot confer independent support', () => {
  // Batch 9 moved this from a route list to a source-level exclusion, so a
  // vendor-authored source now confers nothing on any page that cites it.
  // Asserted through the module. A source-text grep would pass even if the
  // exclusion had been deleted, as long as the identifier still appeared.
  assert.ok(isVendorAuthored('asml-lithography'))
  assert.ok(isVendorAuthored('tel-process-equipment'))
  assert.ok(isVendorAuthored('amkor-3d-stack'))
  assert.equal(isVendorAuthored('nist-dlmf-3-8'), false)
  const supplierPages = compiled.pages.filter((p) => p.route.startsWith('/knowledge/suppliers/'))
  assert.ok(supplierPages.length > 0)
  assertFirstPartyPartition(audit, report)
})

test('the five states remain disjoint and partition the corpus', () => {
  const s = report.pageStates
  assert.equal(s.legacyUnchanged + s.structurallyUplifted + s.firstPartyDocumented
    + s.independentlySourceSupported + s.blocked, s.total)
  // The 37 and 41 figures of this batch both counted vendor-backed pages.
  // Batch 9 corrected that, so the invariant checked here is the partition.
  assert.ok(s.independentlySourceSupported > 0)
})

/* ------------------------------------------------------------- intake ----- */

test('local intake never uploads and never retains full text', () => {
  const path = resolve(tmpdir(), `intake-${Date.now()}.txt`)
  writeFileSync(path, 'a supplied document body that must never be published')
  try {
    const result = intake(submission({ localPath: path }))
    assert.equal(result.accepted, true)
    assert.equal(result.uploaded, false)
    assert.equal(result.fullTextRetained, false)
    const serialized = JSON.stringify(result)
    assert.ok(!serialized.includes('a supplied document body'), 'file content must never appear in the result')
    assert.match(result.draftAttestation!.status, /draft-pending-review/)
  } finally {
    rmSync(path, { force: true })
  }
})

test('a fingerprint alone cannot establish inspection', () => {
  const path = resolve(tmpdir(), `intake-${Date.now()}-2.txt`)
  writeFileSync(path, 'content')
  try {
    assert.ok(fingerprintFile(path), 'the file fingerprints')
    // Everything present except the attestation.
    const result = intake(submission({ localPath: path, operatorAttestsRead: false }))
    assert.equal(result.accepted, false)
    assert.ok(result.refusals.includes('operator-has-not-attested-reading'))
    assert.equal(result.draftAttestation, null)
  } finally {
    rmSync(path, { force: true })
  }
})

test('confidential and unauthorized material is refused', () => {
  for (const basis of ['confidential', 'unauthorized'] as const) {
    const result = intake(submission({ localPath: 'x', accessBasis: basis }))
    assert.equal(result.accepted, false)
    assert.ok(result.refusals.some((r) => r.startsWith(basis)))
  }
})

test('a missing file, locator, claim or limitation is refused', () => {
  assert.ok(intake(submission({ localPath: '/does/not/exist' })).refusals.includes('file-not-found'))
  const path = resolve(tmpdir(), `intake-${Date.now()}-3.txt`)
  writeFileSync(path, 'c')
  try {
    for (const [field, refusal] of [['inspectedPages', 'no-locator'], ['boundedClaim', 'no-bounded-claim'], ['limitation', 'no-limitation']] as const) {
      const patch = field === 'inspectedPages' ? { inspectedPages: '', inspectedSections: '' } : { [field]: '' }
      assert.ok(intake(submission({ localPath: path, ...patch as object })).refusals.includes(refusal))
    }
  } finally {
    rmSync(path, { force: true })
  }
})

/* --------------------------------------------------------- governance ----- */

test('every blocked page has an acquisition packet with no credentials or full text', () => {
  assert.equal(artifacts.acquisitionPackets.count, 28)
  for (const packet of artifacts.acquisitionPackets.packets) {
    assert.equal(packet.containsCredentials, false)
    assert.equal(packet.containsFullText, false)
    assert.ok(packet.evidenceSufficientToUnblock.length > 40, 'a packet must say what would unblock it')
    assert.match(packet.packetDigest, /^sha256:[0-9a-f]{64}$/)
  }
  const barriers = Object.keys(artifacts.acquisitionPackets.byBarrier)
  assert.ok(barriers.length >= 4, 'barriers must be distinguished, not lumped')
})

test('proposed revisions are inactive and refuse review inheritance', () => {
  assert.equal(artifacts.proposedRevisions.allInactive, true)
  for (const revision of artifacts.proposedRevisions.revisions) {
    assert.equal(revision.predecessorPreserved, true)
    assert.equal(revision.reviewInheritedFromPredecessor, false)
    assert.equal(revision.proposalActive, false)
    assert.match(revision.revisionDigest, /^sha256:[0-9a-f]{64}$/)
    assert.notEqual(revision.revisionDigest, revision.provenanceDigest)
  }
})

test('family indexes keep the states distinct and imply no verification', () => {
  assert.equal(artifacts.familyIndexes.length, 8)
  for (const index of artifacts.familyIndexes) {
    assert.equal(index.impliesIndependentVerification, false)
    assert.equal(index.countedAsDetailPageCoverage, false)
    assert.equal(index.independentlySupported + index.firstPartyDocumented
      + index.structuralOnly + index.blocked, index.children)
  }
})

test('private packets and document content stay outside built output', () => {
  const leaked = execFileSync('bash', ['-lc',
    "find .next/server .next/static -type f \\( -name '*.js' -o -name '*.html' \\) -print0 2>/dev/null | xargs -0 grep -l 'acquisitionPackets\\|supportingPassage\\|evidenceSufficientToUnblock\\|draftAttestation' 2>/dev/null || true"],
  { cwd: ROOT, encoding: 'utf8' }).trim()
  assert.equal(leaked, '', `private material must not reach built output: ${leaked}`)
})
