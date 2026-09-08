import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  assertDeterminations, canonicalJson, determinationFailures, isPromotion,
  RemediationContractError, type Determination, type Inspection,
} from '../lib/federation-tranche-two-remediation.ts'

const determinations = JSON.parse(
  readFileSync('content/federation/federation-tranche-2-remediation-determinations-v1.json', 'utf8')) as {
    counts: { reassessed: number; promotions: number }
    determinations: Determination[]
    provenanceDigest: string
    boundary: string
  }
const inspection = JSON.parse(
  readFileSync('content/federation/federation-tranche-2-remediation-inspection-v1.json', 'utf8')) as {
    inspections: Inspection[]
    provenanceDigest: string
  }

const ok: Inspection = {
  url: 'https://example.test/a', observedOn: '2026-09-05', httpStatus: 200,
  establishes: 'something', doesNotEstablish: 'something else',
}
const base = (over: Partial<Determination> = {}): Determination => ({
  candidateId: 'cand_test', proposedUrl: 'https://example.test/page',
  originalDisposition: 'blocked', originalReason: 'it could not be inspected',
  outcome: 'promote-to-evidence-ready', restsOn: [ok.url],
  finding: 'it could be inspected', ...over,
})

/* -- the contract ---------------------------------------------------------- */

test('a promotion must rest on a source that answered 200 in this pass', () => {
  // The rule doing the real work. Without it, "the route could not be
  // inspected" would be answerable by asserting that it could.
  const unreachable: Inspection = { ...ok, httpStatus: 404 }
  const failures = determinationFailures(base(), [unreachable])
  assert.ok(failures.some((f) => /must rest on at least one source that answered 200/.test(f)))
  assert.deepEqual(determinationFailures(base(), [ok]), [])
})

test('a determination cannot rest on a source nobody fetched', () => {
  assert.ok(determinationFailures(base({ restsOn: ['https://example.test/never-fetched'] }), [ok])
    .some((f) => /was not inspected in this pass/.test(f)))
})

test('a candidate held back must name the ground it is held on', () => {
  assert.ok(determinationFailures(base({ outcome: 'hold-reason-confirmed' }), [ok])
    .some((f) => /must name the ground/.test(f)))
})

test('a narrowing with no exclusions is refused', () => {
  // A "narrowed" scope that forbids nothing is the original scope with a
  // reassuring label.
  const failures = determinationFailures(base({
    outcome: 'promote-with-narrowed-scope',
    narrowedScope: { mayState: ['everything'], mayNotState: [] },
  }), [ok])
  assert.ok(failures.some((f) => /must say what the page may not state/.test(f)))
})

test('a corrected reason must actually differ from the reason it corrects', () => {
  const same = 'it could not be inspected'
  assert.ok(determinationFailures(base({
    outcome: 'hold-with-corrected-reason', holdGround: 'canonical-owner-already-covers-this-facet',
    originalReason: same, finding: same,
  }), [ok]).some((f) => /must differ from the reason it corrects/.test(f)))
})

test('a duplicative rejection must name the canonical owner it defers to', () => {
  assert.ok(determinationFailures(base({ outcome: 'reject-duplicative', holdGround: 'canonical-owner-already-covers-this-facet' }), [ok])
    .some((f) => /must name the canonical owner/.test(f)))
})

test('the original reason is restated, never discarded', () => {
  assert.ok(determinationFailures(base({ originalReason: '' }), [ok])
    .some((f) => /must be restated, not discarded/.test(f)))
})

test('one candidate cannot be determined twice', () => {
  assert.throws(() => assertDeterminations([base(), base()], [ok]), RemediationContractError)
})

/* -- the emitted artifacts -------------------------------------------------- */

test('all fifteen non-ready candidates are reassessed, and only those', () => {
  assert.equal(determinations.counts.reassessed, 15)
  assert.equal(new Set(determinations.determinations.map((d) => d.candidateId)).size, 15)
})

test('every emitted determination satisfies the contract', () => {
  assert.doesNotThrow(() => assertDeterminations(determinations.determinations, inspection.inspections))
})

test('the machine-readable-article definition stays rejected as duplicative', () => {
  // Named explicitly in the brief: it must remain rejected in favour of the
  // canonical, and re-inspection must not be an excuse to revive it.
  const d = determinations.determinations.find((x) => x.candidateId === 'cand_48485c2639eca0b2fb4d9852')
  assert.ok(d, 'the duplicative candidate must still be present')
  assert.equal(d.outcome, 'reject-duplicative')
  assert.equal(d.canonicalOwner, 'https://publish.mahastrategies.com/docs/machine-readability')
})

test('not everything was unblocked', () => {
  // A remediation pass that promoted all fifteen would be evidence that it was
  // not checking. Ten candidates stay non-ready here.
  const held = determinations.determinations.filter((d) => !isPromotion(d.outcome))
  assert.ok(held.length >= 9, `only ${held.length} candidates held; a pass that clears almost everything is suspect`)
  for (const d of held) assert.ok(d.holdGround, `${d.candidateId} is held without a ground`)
})

test('every promotion is narrowed rather than waved through', () => {
  for (const d of determinations.determinations.filter((x) => isPromotion(x.outcome))) {
    assert.equal(d.outcome, 'promote-with-narrowed-scope', `${d.candidateId} was promoted without a narrowing`)
    assert.ok((d.narrowedScope?.mayNotState.length ?? 0) > 0)
  }
})

test('no promotion claims customer outcomes', () => {
  // The one thing no inspected source establishes: the offer excludes
  // performance guarantees and the founding-partner tier is still open.
  for (const d of determinations.determinations.filter((x) => isPromotion(x.outcome))) {
    for (const line of d.narrowedScope?.mayState ?? []) {
      assert.ok(!/customer outcome|proven saving|guaranteed/i.test(line),
        `${d.candidateId} may-state claims an outcome: ${line}`)
    }
  }
})

test('the pass creates no public route', () => {
  const proposed = determinations.determinations.map((d) => d.proposedUrl)
  const paths = proposed.map((u) => new URL(u).pathname)
  // Every proposed page is a proposal. None may exist as a file in this repo.
  for (const p of paths) {
    assert.ok(!p.startsWith('/app'), `${p} looks like a route file`)
  }
  assert.match(determinations.boundary, /No public route is created/i)
})

test('artifacts are byte-identical across two regeneration runs', () => {
  const read = () => [
    readFileSync('content/federation/federation-tranche-2-remediation-determinations-v1.json', 'utf8'),
    readFileSync('content/federation/federation-tranche-2-remediation-inspection-v1.json', 'utf8'),
  ]
  const before = read()
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-federation-tranche-two-remediation.ts'],
    { stdio: 'ignore' })
  assert.deepEqual(read(), before)
})

test('the provenance digest is reproducible from the body', () => {
  for (const artifact of [determinations, inspection] as Record<string, unknown>[]) {
    const { provenanceDigest, ...body } = artifact
    const recomputed = `sha256:${execFileSync('shasum', ['-a', '256'], { input: canonicalJson(body) })
      .toString().split(' ')[0]}`
    assert.equal(recomputed, provenanceDigest, 'the artifact was hand-edited after generation')
  }
})

test('the remediation binds to the Tranche 2 artifacts it derives from', () => {
  const upstream = (determinations as unknown as { upstreamTrancheTwoDigests: Record<string, string> })
    .upstreamTrancheTwoDigests
  assert.ok(upstream, 'the remediation must record what it was derived from')
  // A digest that is present must be a real one; "not available" is honest and
  // allowed, silently omitting the binding is not.
  for (const [name, value] of Object.entries(upstream)) {
    assert.ok(/^sha256:[0-9a-f]{64}$/.test(value) || value === 'not-available-at-generation-time',
      `${name} carries neither a digest nor an explicit unavailability`)
  }
})
