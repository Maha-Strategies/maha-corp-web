import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import { ALIGNMENT_BATCH_11_PACKETS } from '../lib/frontier-alignment-batch-11.ts'
import { BATCH_11_DECISIONS, batch11DecisionTotals } from '../lib/frontier-alignment-batch-11-review.ts'
import {
  BATCH_11_CANARY_RECORD_IDS,
  BATCH_11_PRIOR_BINDINGS,
  BATCH_11_RELEASE_CANARY,
  BATCH_11_REVISED_RECORDS,
  BATCH_11_REVISION_AUDITS,
  BATCH_11_SCOPED_DECISIONS,
  batch11CanaryTotals,
  buildBatch11Revision,
  evaluateBatch11RevisionReadiness,
  type CanaryRecordId,
} from '../lib/batch-11-revision-canary.ts'
import { FRONTIER_DOMAIN_GRAPH_RECORDS } from '../lib/frontier-domain-graphs.ts'
import { epistemicReviewTargetHash } from '../lib/epistemic-publication.ts'
import { SUBSTANTIAL_PUBLICATION_QUEUE } from '../lib/substantial-publication-queue.ts'

const ROOT = resolve(import.meta.dirname, '..')
const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

// --------------------------------------------------------------- decisions

test('every packet is reviewed exactly once', () => {
  assert.equal(BATCH_11_DECISIONS.length, ALIGNMENT_BATCH_11_PACKETS.length)
  assert.equal(new Set(BATCH_11_DECISIONS.map((d) => d.recordId)).size, 20)
})

test('the distribution is recomputed from evidence, not copied from the packets', () => {
  // The packets report ten supported. One of those proposes the preprint of the
  // source the record already cites, which is not a replacement, so the review
  // lands at nine accepts and three scope revisions.
  const t = batch11DecisionTotals()
  assert.equal(t.reviewed, 20)
  assert.equal(t.acceptSourceReplacement, 9)
  assert.equal(t.reviseRecordScope, 3)
  assert.equal(t.rejectOrHold, 8)
  const packetSupported = ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.verdict === 'supported').length
  assert.equal(packetSupported, 10)
  assert.notEqual(t.acceptSourceReplacement, packetSupported, 'the review must not inherit the packet distribution')
})

test('each decision binds the exact packet digest and record revision', () => {
  for (const decision of BATCH_11_DECISIONS) {
    const packet = ALIGNMENT_BATCH_11_PACKETS.find((p) => p.recordId === decision.recordId)!
    assert.equal(decision.packetDigest, sha(packet), decision.recordId)
    const record = FRONTIER_DOMAIN_GRAPH_RECORDS.find((r) => r.id === decision.recordId)!
    assert.equal(decision.recordRevision.recordDigest, sha(record), decision.recordId)
    assert.ok(decision.recordRevision.canonicalVersion.length > 0)
  }
})

test('a held decision proposes nothing and a bound decision carries full provenance', () => {
  for (const d of BATCH_11_DECISIONS) {
    if (d.disposition === 'reject-or-hold') {
      assert.equal(d.sourceIdentity, null, d.recordId)
      assert.equal(d.boundedClaimScope, null, d.recordId)
      assert.equal(d.inspectedContentLocator, null, d.recordId)
    } else {
      assert.ok(d.sourceIdentity, d.recordId)
      assert.ok(d.versionRelationship, d.recordId)
      assert.ok(d.inspectedContentLocator, d.recordId)
      assert.ok(d.rightsBasis, d.recordId)
      assert.ok(d.boundedClaimScope, d.recordId)
      assert.ok(d.boundedClaimScope!.doesNotSupport.length > 0, `${d.recordId} must state what it does not support`)
    }
    assert.equal(d.activeBindingChanged, false)
    assert.equal(d.canonicalReleaseAuthorized, false)
  }
})

test('abstract-level evidence never permits quantitative detail', () => {
  for (const d of BATCH_11_DECISIONS.filter((x) => x.boundedClaimScope)) {
    const packet = ALIGNMENT_BATCH_11_PACKETS.find((p) => p.recordId === d.recordId)!
    if (packet.inspection?.depth === 'abstract-and-identity') {
      assert.equal(d.boundedClaimScope!.quantitativeDetailPermitted, false, d.recordId)
    }
  }
})

test('the two narrowed records make no claim their source does not carry', () => {
  const mcp = BATCH_11_DECISIONS.find((d) => d.recordId.endsWith('tool-allowlisting'))!
  assert.equal(mcp.disposition, 'revise-record-scope')
  assert.match(mcp.boundedClaimScope!.doesNotSupport.join(' '), /does not|not.*define.*tool allowlist/i)
  assert.equal(/specification defines (a )?tool allowlist/i.test(mcp.boundedClaimScope!.supports), false)

  const quartz = BATCH_11_DECISIONS.find((d) => d.recordId.endsWith('high-purity-quartz-deposits'))!
  assert.equal(quartz.disposition, 'revise-record-scope')
  assert.match(quartz.boundedClaimScope!.doesNotSupport.join(' '), /deposit or resource assessment/i)
  assert.equal(quartz.boundedClaimScope!.quantitativeDetailPermitted, false)
})

test('all eight fail-closed packets remain held', () => {
  const failed = ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.verdict === 'unresolved-fail-closed')
  assert.equal(failed.length, 8)
  for (const p of failed) {
    const d = BATCH_11_DECISIONS.find((x) => x.recordId === p.recordId)!
    assert.equal(d.disposition, 'reject-or-hold', `${p.recordId} must stay held without new evidence`)
  }
})

// ----------------------------------------------------------------- canary

test('five records entered the canary, all from accepted or narrowed decisions', () => {
  assert.equal(BATCH_11_CANARY_RECORD_IDS.length, 5)
  for (const id of BATCH_11_CANARY_RECORD_IDS) {
    const d = BATCH_11_DECISIONS.find((x) => x.recordId === id)!
    assert.notEqual(d.disposition, 'reject-or-hold', `${id} entered the canary while held`)
  }
})

test('each revision preserves the prior binding rather than deleting it', () => {
  for (const record of BATCH_11_REVISED_RECORDS) {
    const prior = BATCH_11_PRIOR_BINDINGS.find((p) => p.recordId === record.id)!
    assert.ok(prior.priorSourceContractId.length > 0)
    const text = record.boundaries.join(' ')
    assert.ok(text.includes(prior.priorSourceTitle), `${record.id}: prior source title must survive in history`)
    assert.ok(text.includes(prior.priorExactLocator), `${record.id}: prior locator must survive in history`)
  }
})

test('a revision without quantitative permission says so in its uncertainty', () => {
  for (const record of BATCH_11_REVISED_RECORDS) {
    const d = BATCH_11_DECISIONS.find((x) => x.recordId === record.id)!
    if (!d.boundedClaimScope!.quantitativeDetailPermitted) {
      assert.match(record.claims[0].uncertainty.statement, /Subject identity only; no quantitative/i, record.id)
      assert.notEqual(record.claims[0].uncertainty.kind, 'quantitative', record.id)
      assert.equal(record.claims[0].uncertainty.interval, undefined, `${record.id}: a non-quantitative revision must carry no interval`)
    }
  }
})

test('audits bind the revision they audit and carry every dimension', () => {
  for (const audit of BATCH_11_REVISION_AUDITS) {
    const record = BATCH_11_REVISED_RECORDS.find((r) => r.id === audit.recordId)!
    assert.equal(audit.revisedRecordRevisionSha256, epistemicReviewTargetHash(record))
    assert.notEqual(audit.revisedRecordRevisionSha256, audit.priorRecordRevisionSha256, 'a revision must differ from what it revises')
    assert.equal(audit.checks.length, 8)
    assert.equal(audit.externallyReviewed, false)
    assert.equal(audit.independentlyReproduced, false)
  }
})

test('four scoped decisions per record, each targeting the audited revision', () => {
  assert.equal(BATCH_11_SCOPED_DECISIONS.length, 20)
  for (const record of BATCH_11_REVISED_RECORDS) {
    const scopes = BATCH_11_SCOPED_DECISIONS.filter((d) => d.recordId === record.id)
    assert.deepEqual(
      scopes.map((s) => s.scope).sort(),
      ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'],
    )
    for (const s of scopes) assert.equal(s.targetSha256, epistemicReviewTargetHash(record))
  }
})

test('every canary passed preflight and none is released', () => {
  assert.equal(BATCH_11_RELEASE_CANARY.length, 5)
  for (const canary of BATCH_11_RELEASE_CANARY) {
    assert.equal(canary.activeCanonicalRelease, false, canary.recordId)
    assert.equal(canary.canonicalMutationAuthorized, false)
    assert.equal(canary.releaseAuthorityPresent, false)
    assert.equal(canary.productionMutationPerformed, false)
    assert.equal(canary.state, 'private-preflight-passed-awaiting-release-authority')
  }
  assert.equal(batch11CanaryTotals().activeCanonicalReleases, 0)
})

test('the merged three-gate queue still excludes every canary record', () => {
  for (const id of BATCH_11_CANARY_RECORD_IDS) {
    const admitted = SUBSTANTIAL_PUBLICATION_QUEUE.some((e) => e.recordId === id && e.eligibleForBatch5)
    assert.equal(admitted, false, `${id} is admitted by the publication queue`)
  }
  for (const canary of BATCH_11_RELEASE_CANARY) assert.equal(canary.excludedFromPublicationQueue, true)
})

// --------------------------------------------------------------- mutation

test('a stale decision cannot license a revision when the packet changes', () => {
  // The guard that stops packet acceptance being inherited by different content.
  const id = BATCH_11_CANARY_RECORD_IDS[0]
  const decision = BATCH_11_DECISIONS.find((d) => d.recordId === id)!
  const packet = ALIGNMENT_BATCH_11_PACKETS.find((p) => p.recordId === id)!
  const mutatedPacket = { ...packet, inspection: { ...packet.inspection!, locator: 'somewhere else entirely' } }
  assert.notEqual(sha(mutatedPacket), decision.packetDigest, 'a changed packet must not match the reviewed digest')
})

test('a held decision cannot build a revision', () => {
  const held = BATCH_11_DECISIONS.find((d) => d.disposition === 'reject-or-hold')!
  assert.throws(
    () => buildBatch11Revision(held.recordId as CanaryRecordId),
    /held decision cannot license a revision|no remediation packet|packet binds no source/,
  )
})

test('readiness fails closed when a scoped decision targets another revision', () => {
  const record = BATCH_11_REVISED_RECORDS[0]
  const audit = BATCH_11_REVISION_AUDITS.find((a) => a.recordId === record.id)!
  const decisions = BATCH_11_SCOPED_DECISIONS.filter((d) => d.recordId === record.id)
    .map((d) => ({ ...d, targetSha256: `sha256:${'0'.repeat(64)}` }))
  const result = evaluateBatch11RevisionReadiness(record, audit, decisions)
  assert.equal(result.ready, false)
  assert.ok(result.blockers.some((b) => b.includes('different revision')), result.blockers.join(','))
})

test('readiness fails closed when a review scope is missing', () => {
  const record = BATCH_11_REVISED_RECORDS[0]
  const audit = BATCH_11_REVISION_AUDITS.find((a) => a.recordId === record.id)!
  const partial = BATCH_11_SCOPED_DECISIONS.filter((d) => d.recordId === record.id).slice(0, 2)
  const result = evaluateBatch11RevisionReadiness(record, audit, partial)
  assert.equal(result.ready, false)
  assert.ok(result.blockers.some((b) => b.includes('missing review scopes')), result.blockers.join(','))
})

test('readiness fails closed when the revision requests promotion', () => {
  const record = BATCH_11_REVISED_RECORDS[0]
  const audit = BATCH_11_REVISION_AUDITS.find((a) => a.recordId === record.id)!
  const decisions = BATCH_11_SCOPED_DECISIONS.filter((d) => d.recordId === record.id)
  const promoted = { ...record, publication: { ...record.publication, requestedPublicPromotion: true } }
  const result = evaluateBatch11RevisionReadiness(promoted, audit, decisions)
  assert.equal(result.ready, false)
  assert.ok(result.blockers.some((b) => b.includes('public promotion') || b.includes('as it stands')), result.blockers.join(','))
})

// ------------------------------------------------------------ determinism

test('two generations are byte-identical', () => {
  const read = () => [
    readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-review-decisions.json'), 'utf8'),
    readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-revision-canary.json'), 'utf8'),
  ]
  const before = read()
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-11-decisions-and-canary.ts'], { cwd: ROOT, encoding: 'utf8' })
  assert.deepEqual(read(), before, 'regeneration changed committed bytes')
})

test('emitted digests are recomputable and totals derived', () => {
  for (const file of ['batch-11-review-decisions.json', 'batch-11-revision-canary.json']) {
    const parsed = JSON.parse(readFileSync(resolve(ROOT, `content/frontier-alignment/${file}`), 'utf8')) as Record<string, unknown>
    const { resultDigest, ...payload } = parsed
    assert.equal(sha(payload), resultDigest, file)
  }
})

// -------------------------------------------------------- public exposure

test('no public route, sitemap or automation index references this work', () => {
  for (const path of ['app/sitemap.ts', 'app/llms.txt/route.ts']) {
    const source = readFileSync(resolve(ROOT, path), 'utf8')
    for (const token of ['batch-11-review', 'batch-11-revision-canary', 'batch-11-decisions']) {
      assert.equal(source.includes(token), false, `${path} references ${token}`)
    }
  }
  let hits = ''
  try {
    hits = execFileSync('git', ['grep', '-l', '-e', 'batch-11-revision-canary', '-e', 'frontier-alignment-batch-11-review', '--', 'app/'], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(hits, '', `a public route imports the review or canary: ${hits}`)
})

test('rights are decided per source, never blanket-set', () => {
  // Three distinct positions must survive into the revisions: a US Government
  // work, an openly licensed article, and a readable-but-unlicensed deposit.
  const bases = BATCH_11_REVISED_RECORDS.map((r) => r.sources[0].rights.basis)
  assert.ok(bases.length === 5)
  assert.ok(new Set(bases).size > 1, 'a single basis across every source would be a blanket setting')
  for (const record of BATCH_11_REVISED_RECORDS) {
    const rights = record.sources[0].rights
    if (rights.basis === 'citation-with-paraphrase') {
      assert.equal(rights.quotationUsed, false, `${record.id}: an unlicensed source must not be quoted`)
    }
    assert.ok(rights.note.length > 20, `${record.id}: the rights position must be stated, not implied`)
  }
})
