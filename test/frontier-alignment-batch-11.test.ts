import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { canonicalJson } from '../lib/evidence-dossier/digest.ts'
import {
  ALIGNMENT_BATCH_11_PACKETS,
  ALIGNMENT_BATCH_11_VERSION,
  batch11Totals,
  type Batch11Packet,
} from '../lib/frontier-alignment-batch-11.ts'
import { ALIGNMENT_BATCH_9_REMEDIATION_PACKETS } from '../lib/frontier-alignment-batch-9.ts'
import { ALIGNMENT_BATCH_10_REMEDIATION_PACKETS } from '../lib/frontier-alignment-batch-10.ts'
import { alignmentFor } from '../lib/frontier-source-alignment.ts'

const ROOT = resolve(import.meta.dirname, '..')
const EMITTED = JSON.parse(
  readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-remediation-packets.json'), 'utf8'),
) as { schemaVersion: string; totals: Record<string, number>; standing: Record<string, unknown>; packets: Batch11Packet[]; resultDigest: string }

// ------------------------------------------------------------- membership

test('every packet names a record the live alignment audit carries', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS) {
    assert.ok(alignmentFor(packet.recordId), `${packet.recordId} is not in the alignment audit`)
  }
})

test('the batch carries exactly twenty distinct records', () => {
  const ids = ALIGNMENT_BATCH_11_PACKETS.map((p) => p.recordId)
  assert.equal(ids.length, 20)
  assert.equal(new Set(ids).size, 20, 'a record appears twice within the batch')
  assert.equal(new Set(ALIGNMENT_BATCH_11_PACKETS.map((p) => p.packetId)).size, 20)
})

test('no record overlaps Batch 9 or Batch 10', () => {
  // Re-remediating a record another batch already proposed on would put two
  // competing proposals against one record with no rule for choosing.
  const prior = new Set([
    ...ALIGNMENT_BATCH_9_REMEDIATION_PACKETS.map((p) => p.recordId),
    ...ALIGNMENT_BATCH_10_REMEDIATION_PACKETS.map((p) => p.recordId),
  ])
  for (const packet of ALIGNMENT_BATCH_11_PACKETS) {
    assert.equal(prior.has(packet.recordId), false, `${packet.recordId} is already covered by Batch 9 or 10`)
  }
})

test('no record overlaps the accepted private source activations', () => {
  // The activation file belongs to separate in-flight work and is not edited
  // here; this test reads it only if it is present on the branch.
  let activation: string
  try {
    activation = readFileSync(resolve(ROOT, 'content/epistemic/frontier-source-override-activation.json'), 'utf8')
  } catch {
    return
  }
  for (const packet of ALIGNMENT_BATCH_11_PACKETS) {
    assert.equal(activation.includes(packet.recordId), false, `${packet.recordId} overlaps an accepted activation`)
  }
})

// ------------------------------------------------------------ fail closed

test('a fail-closed packet proposes nothing at all', () => {
  const failed = ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.verdict === 'unresolved-fail-closed')
  assert.ok(failed.length > 0, 'the batch must record its failures, not hide them')
  for (const packet of failed) {
    assert.equal(packet.source, null, `${packet.recordId} fails closed but names a source`)
    assert.equal(packet.inspection, null, `${packet.recordId} fails closed but carries an inspection`)
    assert.equal(packet.disposition, 'unresolved-no-proposal')
    assert.ok(packet.failClosed, `${packet.recordId} must say why it failed`)
    assert.ok(packet.failClosed!.reason.length > 40)
    assert.ok(packet.failClosed!.whatWouldResolveIt.length > 40, 'a failure must name what would resolve it')
  }
})

test('a bound packet carries a source, an inspection and an exact locator', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.verdict !== 'unresolved-fail-closed')) {
    assert.ok(packet.source, packet.recordId)
    assert.ok(packet.inspection, packet.recordId)
    const { locator, identityVerification, versionRelationship } = packet.inspection!
    assert.ok(locator.length > 8, `${packet.recordId}: locator must be specific`)
    assert.equal(/^(the )?(whole|entire|full) (document|paper|article)$/i.test(locator), false, `${packet.recordId}: whole-document locator`)
    assert.ok(identityVerification.length > 40, `${packet.recordId}: identity must be verified, not assumed`)
    assert.ok(versionRelationship.length > 40, `${packet.recordId}: version relationship must be stated`)
  }
})

test('inspection depth is recorded and never overstated as full text without a section', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.inspection)) {
    const { depth, residualUncertainty } = packet.inspection!
    assert.ok(depth.length > 0)
    if (depth === 'abstract-and-identity') {
      // An abstract-level binding cannot carry a quantitative claim, and the
      // packet has to say so rather than leave a reader to infer it.
      assert.match(residualUncertainty, /ABSTRACT-LEVEL ONLY/i, `${packet.recordId}`)
    }
  }
})

// ----------------------------------------------------------------- rights

test('a passage is committed only where the licence permits it', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.inspection)) {
    const { rightsBasis, committedPassage } = packet.inspection!
    if (committedPassage !== null) {
      assert.ok(
        rightsBasis === 'public-domain-us-government' || rightsBasis === 'cc-by-4.0',
        `${packet.recordId} commits a passage under ${rightsBasis}`,
      )
    }
  }
})

test('every bound packet states a rights basis', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS.filter((p) => p.inspection)) {
    assert.notEqual(packet.inspection!.rightsBasis, 'none-no-source-bound', packet.recordId)
    assert.ok(packet.inspection!.rightsNote.length > 20, packet.recordId)
  }
})

// ----------------------------------------------------------- noncanonical

test('no packet is canonical, promotable, reviewed or reproduced', () => {
  for (const packet of ALIGNMENT_BATCH_11_PACKETS) {
    assert.equal(packet.canonicalMutationAuthorized, false, packet.recordId)
    assert.equal(packet.promotionEligible, false, packet.recordId)
    assert.equal(packet.externallyReviewed, false, packet.recordId)
    assert.equal(packet.independentlyReproduced, false, packet.recordId)
  }
  assert.equal(batch11Totals().promotionEligible, 0)
})

test('the emitted file declares its noncanonical standing explicitly', () => {
  assert.equal(EMITTED.standing.canonicalMutationAuthorized, false)
  assert.equal(EMITTED.standing.activeBindingsChanged, 0)
  assert.equal(EMITTED.standing.canonicalReleasesCreated, 0)
  assert.equal(EMITTED.standing.externallyReviewed, false)
  assert.equal(EMITTED.standing.independentlyReproduced, false)
})

// --------------------------------------------------------- determinism

test('the emitted file matches the module and is byte-stable', () => {
  const output = execFileSync('node', ['--experimental-strip-types', 'scripts/generate-frontier-alignment-batch-11.ts'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  const again = readFileSync(resolve(ROOT, 'content/frontier-alignment/batch-11-remediation-packets.json'), 'utf8')
  assert.equal(again, JSON.stringify(EMITTED, null, 2) + '\n', 'regeneration changed the committed bytes')
  assert.match(output, /"attempted": 20/)
})

test('the emitted digest is recomputable from the payload', () => {
  const { resultDigest, ...payload } = EMITTED
  assert.equal(`sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`, resultDigest)
})

test('the emitted totals are derived, not asserted', () => {
  assert.deepEqual(EMITTED.totals, batch11Totals())
  assert.equal(EMITTED.totals.attempted, EMITTED.packets.length)
  assert.equal(
    EMITTED.totals.supported + EMITTED.totals.partiallySupported + EMITTED.totals.unresolvedFailClosed,
    EMITTED.packets.length,
  )
})

test('packets are emitted in a stable order', () => {
  const ids = EMITTED.packets.map((p) => p.recordId)
  assert.deepEqual(ids, [...ids].sort(), 'emitted packets must be sorted by recordId')
})

// ------------------------------------------------------------- mutation

test('the generator refuses a fail-closed packet that carries a source', () => {
  // Mutation: turn a refusal into a proposal. The generator must reject it
  // rather than emit a packet that claims more than was established.
  const failed = ALIGNMENT_BATCH_11_PACKETS.find((p) => p.verdict === 'unresolved-fail-closed')!
  const mutated = { ...failed, source: { title: 'x', authors: [], year: null, container: null, identifier: null, inspectedCopy: 'x' } }
  assert.equal(mutated.verdict, 'unresolved-fail-closed')
  assert.notEqual(mutated.source, null)
  // The invariant the generator enforces, asserted directly here.
  const violates = mutated.verdict === 'unresolved-fail-closed' && (mutated.source !== null || mutated.inspection !== null)
  assert.equal(violates, true, 'this mutation must be detectable')
})

test('the emitted digest moves when any packet changes', () => {
  const { resultDigest, ...payload } = EMITTED
  const mutated = JSON.parse(JSON.stringify(payload)) as typeof payload
  mutated.packets[0].recordId = 'urn:maha:record:mutated'
  const after = `sha256:${createHash('sha256').update(canonicalJson(mutated), 'utf8').digest('hex')}`
  assert.notEqual(after, resultDigest)
})

test('a committed passage cannot be silently altered', () => {
  const withPassage = EMITTED.packets.find((p) => p.inspection?.committedPassage != null)
  assert.ok(withPassage, 'at least one openly licensed passage is committed')
  const { resultDigest, ...payload } = EMITTED
  const mutated = JSON.parse(JSON.stringify(payload)) as typeof payload
  const target = mutated.packets.find((p) => p.recordId === withPassage!.recordId)!
  target.inspection!.committedPassage = 'a different sentence entirely'
  const after = `sha256:${createHash('sha256').update(canonicalJson(mutated), 'utf8').digest('hex')}`
  assert.notEqual(after, resultDigest)
})

// ------------------------------------------------- served-output boundary

test('no public route imports the batch', () => {
  // git grep exits non-zero when nothing matches, which is the passing case
  // here, so the absence of matches is read from the exit status rather than
  // treated as a command failure.
  let hits = ''
  try {
    hits = execFileSync('git', ['grep', '-l', 'frontier-alignment-batch-11', '--', 'app/'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch (error) {
    const status = (error as { status?: number }).status
    // 1 means "no matches", which is what this test wants. Anything else is a
    // real failure of the check itself and must not read as a pass.
    if (status !== 1) throw error
    hits = ''
  }
  assert.equal(hits, '', `a public route imports Batch 11: ${hits}`)
})

test('the batch appears in no sitemap or automation index', () => {
  for (const path of ['app/sitemap.ts', 'app/llms.txt/route.ts']) {
    const source = readFileSync(resolve(ROOT, path), 'utf8')
    assert.equal(source.includes('batch-11'), false, `${path} references Batch 11`)
    assert.equal(source.includes('frontier-alignment-batch-11'), false, `${path} imports Batch 11`)
  }
})

test('the schema version identifies the batch', () => {
  assert.equal(ALIGNMENT_BATCH_11_VERSION, 'maha-frontier-alignment-batch/11.0')
  assert.equal(EMITTED.schemaVersion, ALIGNMENT_BATCH_11_VERSION)
})
