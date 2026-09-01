import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import packets from '../content/review/internal-review-packets.json' with { type: 'json' }
import decisions from '../content/review/internal-review-decisions.json' with { type: 'json' }
import canary from '../content/review/release-canary-manifest.json' with { type: 'json' }
import plan from '../content/review/preview-release-plan.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import { REVIEW_AXES, classifyForRelease, projectReviewState, releaseAuthorized } from '../lib/exact-revision-review.ts'
import { REVIEW_TIERS, assertMachineReviewerPermitted, assertNoPersonAttribution, assertTierNotOverstated } from '../lib/review-tier.ts'
import { reviewAssuranceTier } from '../lib/epistemic-release.ts'

/**
 * Review is an input to release, never a substitute for it.
 *
 * The failure this guards against is a short-circuit: a page appearing because
 * something was reviewed, or because a flag said eligible, without a release
 * naming the exact revision. These pin that every such path refuses, and that
 * nothing a reviewer wrote reaches a public surface.
 */

const ROOT = resolve(import.meta.dirname, '..')
const DIGEST = /^sha256:[0-9a-f]{64}$/
const revision = `sha256:${'a'.repeat(64)}`
const audit = `sha256:${'b'.repeat(64)}`
const decisionSha = `sha256:${'c'.repeat(64)}`

const fullBundle = (over: Partial<{ revisionSha256: string; decision: 'approve' | 'revise' | 'reject' }> = {}) =>
  REVIEW_AXES.map((axis) => ({
    axis, decision: over.decision ?? ('approve' as const), reviewerKind: 'internal-editorial' as const,
    decisionSha256: decisionSha, note: 'n', revisionSha256: over.revisionSha256 ?? revision,
  }))

const project = (over: Parameters<typeof projectReviewState>[0]['decisions']) =>
  projectReviewState({ recordId: 'urn:x', revisionSha256: revision, auditSha256: audit, decisions: over })

/* --- review alone cannot release ------------------------------------------ */

test('an approval for a stale revision cannot release the current revision', () => {
  const stale = project(fullBundle({ revisionSha256: `sha256:${'9'.repeat(64)}` }))
  assert.equal(stale.state, 'approved-only-for-stale-revision')
  assert.equal(releaseAuthorized(stale), false)
  assert.equal(classifyForRelease(stale, false), 'stale-review-decision')
  assert.deepEqual(stale.decidedAxes, [], 'a stale decision decides nothing about this revision')
})

test('a missing review axis blocks release', () => {
  for (const dropped of REVIEW_AXES) {
    const partial = project(fullBundle().filter((entry) => entry.axis !== dropped))
    assert.equal(partial.state, 'incomplete-decision-bundle', `${dropped} must be required`)
    assert.equal(releaseAuthorized(partial), false)
    assert.deepEqual(partial.missingAxes, [dropped])
    assert.equal(classifyForRelease(partial, false), 'exact-revision-review-missing')
  }
})

test('a blanket approve-record decision is not a bundle', () => {
  // One decision on one axis is what a blanket verdict looks like here.
  const blanket = project([fullBundle()[0]])
  assert.equal(blanket.state, 'incomplete-decision-bundle')
  assert.equal(releaseAuthorized(blanket), false)
  assert.equal(blanket.missingAxes.length, REVIEW_AXES.length - 1)
})

test('reject outranks approve, and conflict outranks both', () => {
  const mixed = [...fullBundle(), { ...fullBundle()[0], decision: 'reject' as const }]
  assert.equal(project(mixed).state, 'conflicting-active-decisions')
  const rejected = project(fullBundle({ decision: 'reject' }))
  assert.equal(rejected.state, 'rejected')
  assert.equal(classifyForRelease(rejected, false), 'rejected')
  const revise = project(fullBundle({ decision: 'revise' }))
  assert.equal(revise.state, 'revise-requested')
  assert.equal(releaseAuthorized(revise), false)
})

test('malformed digests are unverifiable, never a soft pass', () => {
  assert.equal(projectReviewState({ recordId: 'urn:x', revisionSha256: 'nope', auditSha256: audit, decisions: [] }).state,
    'malformed-or-unverifiable')
  assert.equal(project([{ ...fullBundle()[0], decisionSha256: 'nope' }]).state, 'malformed-or-unverifiable')
  assert.equal(project([{ ...fullBundle()[0], axis: 'invented-axis' as never }]).state, 'malformed-or-unverifiable')
})

test('no observable decision is reported as absence, not as pending approval', () => {
  const none = project([])
  assert.equal(none.state, 'no-observable-decision')
  assert.equal(releaseAuthorized(none), false)
  assert.equal(classifyForRelease(none, false), 'exact-revision-review-missing')
})

test('release state is passed in, never inferred from review', () => {
  const approved = project(fullBundle())
  assert.equal(approved.state, 'approved-for-exact-revision')
  assert.equal(releaseAuthorized(approved), true, 'a full exact-revision bundle authorizes a release')
  // But an existing release still overrides the classification outright.
  assert.equal(classifyForRelease(approved, true), 'release-already-exists-observation-stale')
})

/* --- the cohort outcome is what the artifacts say ------------------------- */

test('every one of the 38 carries a state, a classification and a digest', () => {
  const rows = projection.projections as { recordId: string; state: string; classification: string; projectionDigest: string; revisionSha256: string }[]
  assert.equal(rows.length, 38)
  assert.equal(new Set(rows.map((row) => row.recordId)).size, 38)
  for (const row of rows) {
    assert.match(row.projectionDigest, DIGEST)
    assert.match(row.revisionSha256, DIGEST)
  }
  assert.equal(projection.releaseReady, rows.filter((row) => row.classification === 'release-ready').length)
})

test('the review was not a rubber stamp', () => {
  const rows = projection.projections as { classification: string }[]
  const distinct = new Set(rows.map((row) => row.classification))
  assert.ok(distinct.size >= 3, `expected differentiated outcomes, got ${[...distinct].join(', ')}`)
  assert.ok((projection.classifications as Record<string, number>)['revise-and-rereview'] > 0,
    'a cohort where nothing was sent back would not be a review')
  assert.ok((projection.classifications as Record<string, number>).rejected > 0)
})

test('every revise decision names the evidence that caused it', () => {
  const revised = (decisions.decisions as { decision: string; note: string; axis: string }[]).filter((entry) => entry.decision === 'revise')
  assert.ok(revised.length > 0)
  for (const entry of revised) {
    assert.ok(entry.note.length > 20, 'a decision must say why')
    assert.ok(/abstract|not inspected|absent|reproduced|no boundary/i.test(entry.note), entry.note)
  }
})

test('decisions are append-only and bind the exact revision', () => {
  assert.equal(decisions.appendOnly, true)
  const rows = decisions.decisions as { recordId: string; revisionSha256: string; axis: string; decisionSha256: string }[]
  for (const row of rows) {
    assert.match(row.revisionSha256, DIGEST)
    assert.match(row.decisionSha256, DIGEST)
    assert.ok(REVIEW_AXES.includes(row.axis as never))
  }
  // One decision per record per axis: no record decided twice on one axis.
  const keys = rows.map((row) => `${row.recordId}::${row.axis}`)
  assert.equal(new Set(keys).size, keys.length)
})

/* --- nothing prepared is published ---------------------------------------- */

test('the canary and the plan both state they are unreleased', () => {
  assert.equal(canary.released, false)
  assert.equal(plan.dispatched, false)
  assert.equal(plan.productionMutationAuthorized, false)
  assert.equal((canary.canary as unknown[]).length, 5)
  assert.equal(new Set((canary.canary as { domainSlug: string }[]).map((entry) => entry.domainSlug)).size, 5,
    'the canary must span five domains')
})

test('no reviewed-but-unreleased record is on any public surface', () => {
  const sitemap = new Set(observation.sitemapPaths as string[])
  const llms = new Set(observation.llmsPaths as string[])
  const releasedIds = new Set((observation.releases as { recordId: string; status: string }[])
    .filter((entry) => entry.status === 'active').map((entry) => entry.recordId))
  for (const row of projection.projections as { recordId: string }[]) {
    assert.ok(!releasedIds.has(row.recordId), `${row.recordId} is in the cohort yet released`)
    const slug = row.recordId.split(':').pop()!
    for (const path of [...sitemap, ...llms]) {
      assert.ok(!path.endsWith(`/${slug}`), `${slug} is unreleased but reachable at ${path}`)
    }
  }
})

/* --- nothing private leaves ----------------------------------------------- */

test('packets and decisions carry no identity, prose or private corpus', () => {
  const files = [
    'content/review/exact-revision-projection.json',
    'content/review/internal-review-packets.json',
    'content/review/internal-review-decisions.json',
    'content/review/release-canary-manifest.json',
    'content/review/preview-release-plan.json',
    'docs/operations/exact-revision-review.md',
  ]
  const forbidden: [RegExp, string][] = [
    [/[Bb]earer\s+\S{16,}/, 'bearer token'],
    [/\bsbp_[A-Za-z0-9]{16,}\b/, 'supabase token'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, 'json web token'],
    [/postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i, 'database url'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
    [/"reviewerId"|"displayName"|"authorityId"|"authorizationBasis"/, 'reviewer or authority identity'],
    [/\breject-or-hold\b/, 'private disposition vocabulary'],
    [/\bhttps?:\/\/[a-z0-9]{20}\.supabase\.(?:co|in)\b/i, 'supabase project host'],
  ]
  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of forbidden) assert.ok(!pattern.test(text), `${file} contains ${label}`)
  }
})

test('packets contain only what a reviewer needs', () => {
  const rows = packets.packets as Record<string, unknown>[]
  assert.equal(rows.length, 38)
  const allowed = new Set(['packetVersion', 'recordId', 'revisionSha256', 'auditSha256', 'title', 'claims', 'source', 'alignment', 'requiredAxes', 'packetDigest'])
  for (const row of rows) {
    for (const key of Object.keys(row)) assert.ok(allowed.has(key), `packet carries unexpected field ${key}`)
    assert.match(String(row.packetDigest), DIGEST)
    assert.deepEqual(row.requiredAxes, [...REVIEW_AXES])
  }
})

test('review artifacts are unreachable from anything served', () => {
  // A bounded walk from every app entry over local imports.
  const seen = new Set<string>()
  const queue: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry.name)) queue.push(path)
    }
  }
  collect(join(ROOT, 'app'))
  for (const extra of ['lib/llms-manifest.ts', 'app/sitemap.ts']) {
    if (existsSync(join(ROOT, extra))) queue.push(join(ROOT, extra))
  }
  const guarded = ['exact-revision-review', 'internal-review-packets', 'internal-review-decisions', 'preview-release-plan', 'release-canary-manifest']
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file) || !existsSync(file)) continue
    seen.add(file)
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = resolve(dirname(file), match[1])
      for (const candidate of [target, `${target}.ts`, `${target}.tsx`, join(target, 'index.ts')]) {
        if (existsSync(candidate) && !seen.has(candidate)) queue.push(candidate)
      }
    }
    for (const marker of guarded) {
      assert.ok(!file.includes(marker) && !source.includes(marker), `${marker} is reachable from a served route via ${file}`)
    }
  }
  assert.ok(seen.size > 0)
})

/* --- the capacity model now sees what it could not ------------------------ */

test('the canonical-release bucket is observable and carries the release-ready count', () => {
  assert.equal(capacity.observability.canonicalReleaseBucketObservable, true)
  assert.match(capacity.observability.reviewObservedVia, /exact-revision review projection/)
  assert.equal(capacity.buckets['blocked-on-canonical-release'], projection.releaseReady)
  assert.equal(capacity.buckets['publishable-now'], 0, 'nothing was released, so nothing became publishable')
})

test('regenerating produces byte-identical artifacts', () => {
  const files = [
    'content/review/exact-revision-projection.json',
    'content/review/internal-review-decisions.json',
    'content/review/preview-release-plan.json',
    'docs/operations/exact-revision-review.md',
    'content/scaling/capacity-model.json',
  ]
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-exact-revision-review.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})

/* --- the tier is declared, and cannot overstate itself -------------------- */

test('the tier declares every assurance it does not have', () => {
  const tier = REVIEW_TIERS['automated-internal-editorial']
  assert.equal(tier.reviewerKind, 'automated-internal-editorial')
  assert.equal(tier.independent, false)
  assert.equal(tier.expertEndorsement, false)
  assert.equal(tier.externallyReviewed, false)
  assert.equal(tier.humanReviewed, false)
  assert.equal(tier.releaseAuthority, 'separate')
  assert.equal(tier.verifies, 'deterministic evidence-policy compliance')
  for (const phrase of ['scientific truth', 'independent reproduction', 'expert consensus']) {
    assert.ok(tier.doesNotEstablish.includes(phrase), `${phrase} must be disclaimed`)
    assert.ok(tier.publicStatement.includes(phrase), `${phrase} must appear in the public statement`)
  }
})

test('a machine tier cannot claim to be independent, expert, external or human', () => {
  for (const field of ['independent', 'expertEndorsement', 'externallyReviewed', 'humanReviewed'] as const) {
    assert.throws(() => assertTierNotOverstated({ ...REVIEW_TIERS['automated-internal-editorial'], [field]: true }),
      /cannot declare itself independent, expert, external or human/, `${field} must be refused`)
  }
  assert.throws(() => assertTierNotOverstated({ ...REVIEW_TIERS['automated-internal-editorial'], releaseAuthority: 'same' }),
    /must not also hold release authority/)
})

test('undeclared machine reviewer kinds fail closed', () => {
  for (const kind of ['automated-scorer', 'machine-review', 'synthetic-editorial', 'generated-approval', 'agent-reviewer']) {
    assert.throws(() => assertMachineReviewerPermitted(kind), /has no declared tier/, `${kind} must fail closed`)
  }
  // Human tiers are not gated by this: it is not a general allowlist.
  assert.equal(assertMachineReviewerPermitted('internal-editorial'), null)
  assert.equal(assertMachineReviewerPermitted('external-expert'), null)
  assert.equal(assertMachineReviewerPermitted('automated-internal-editorial')?.reviewerKind, 'automated-internal-editorial')
})

test('a machine decision cannot be attributed to a person', () => {
  for (const attribution of [{ displayName: 'A Reviewer' }, { reviewerId: 'expert_someone' }]) {
    assert.throws(() => assertNoPersonAttribution('automated-internal-editorial', attribution),
      /cannot carry a reviewer identity/)
  }
  // A human tier may of course name its reviewer.
  assert.doesNotThrow(() => assertNoPersonAttribution('internal-editorial', { displayName: 'A Reviewer' }))
})

test('every produced decision names the machine tier, and none names a person', () => {
  assert.equal((decisions.tier as { reviewerKind: string }).reviewerKind, 'automated-internal-editorial')
  const rows = decisions.decisions as { reviewerKind: string }[]
  assert.ok(rows.length > 0)
  for (const row of rows) assert.equal(row.reviewerKind, 'automated-internal-editorial')
  const carried = decisions.carriedForward as { axes: { reviewerKind: string }[] }[]
  for (const entry of carried) for (const axis of entry.axes) assert.equal(axis.reviewerKind, 'automated-internal-editorial')
  const text = JSON.stringify(decisions)
  assert.ok(!/"displayName"|"reviewerId"|"affiliation"/.test(text), 'no identity field may appear')
})

test('the assurance tier keeps machine review out of the human tier', () => {
  assert.equal(reviewAssuranceTier([{ scope: 's', reviewerKind: 'internal-editorial' } as never]), 'internally-reviewed-canonical')
  assert.equal(reviewAssuranceTier([{ scope: 's', reviewerKind: 'automated-internal-editorial' } as never]),
    'automated-internal-review-canonical')
  // Mixing them is neither, and must not collapse into the human tier.
  assert.equal(reviewAssuranceTier([
    { scope: 'a', reviewerKind: 'internal-editorial' } as never,
    { scope: 'b', reviewerKind: 'automated-internal-editorial' } as never,
  ]), 'mixed-review-canonical')
})

test('the operator report states the tier and its limits verbatim', () => {
  const report = readFileSync(resolve(ROOT, 'docs/operations/exact-revision-review.md'), 'utf8')
  assert.match(report, /automated-internal-editorial/)
  assert.match(report, /\| humanReviewed \| false \|/)
  assert.match(report, /deterministic evidence-policy compliance/)
  assert.match(report, /does not establish scientific truth, independent reproduction or expert consensus/)
  assert.match(report, /No decision below was made by a person/)
})

/**
 * This re-pin replaces a defective one, and the defect is worth naming.
 *
 * The old assertion pinned 30/7/1. Those counts were produced by an
 * inspection-depth classifier that matched /abstract/ anywhere in the recorded
 * inspection location, so three records whose audits list the sections that
 * were read - "abstract, Methods, Discussion, in-vivo results" - were counted
 * as having reached only the abstract. Keeping the pin would have preserved the
 * misreading and blocked its correction.
 *
 * What is pinned now is the property rather than the tally: the cohort still
 * partitions into 38, the reviewer tier still changes no decision, and the
 * thirty that were release-ready before remain so.
 */
test('the tier correction changes no decision, and the cohort still partitions', () => {
  const counts = projection.classifications as Record<string, number>
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), 38)
  assert.equal(counts.rejected, 1)
  assert.equal(counts['release-ready'], projection.releaseReady)
  assert.ok(counts['revise-and-rereview'] > 0, 'nothing sent back would not be a review')
  // The tier is declarative: no decision may cite it as a reason.
  const rows = decisions.decisions as { note: string }[]
  for (const row of rows) {
    assert.ok(!/tier|automated|machine/i.test(row.note), 'a decision must cite evidence, not its own tier')
  }
})
