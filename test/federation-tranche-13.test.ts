import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const F = 'content/federation'
const read = (n: string) => JSON.parse(readFileSync(`${F}/federation-tranche-13-${n}-v1.json`, 'utf8'))
const cohort = read('cohort')
const decisions = read('decisions')
const deps = read('dependency-validation')
const specs = read('page-specifications')
const sources = read('source-inspections')
const readiness = read('readiness')

const priorTranches = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology']
const coveredIds = new Set<string>()
for (const t of priorTranches) {
  const d = JSON.parse(readFileSync(`${F}/federation-tranche-${t}-cohort-v1.json`, 'utf8')) as Record<string, unknown>
  for (const v of Object.values(d)) if (Array.isArray(v)) for (const e of v) {
    if (e && typeof e === 'object' && 'candidateId' in e) coveredIds.add((e as { candidateId: string }).candidateId)
  }
}

test('the cohort is exactly 100 unique candidates', () => {
  assert.equal(cohort.entries.length, 100)
  assert.equal(new Set(cohort.entries.map((e: { candidateId: string }) => e.candidateId)).size, 100)
})

test('zero overlap with Tranches 1 through 12', () => {
  const overlap = cohort.entries.filter((e: { candidateId: string }) => coveredIds.has(e.candidateId))
  assert.deepEqual(overlap, [], `overlapping: ${overlap.map((e: { candidateId: string }) => e.candidateId).join(', ')}`)
  assert.equal(coveredIds.size, 1200, 'prior tranches should cover exactly 1,200 candidates')
})

test('no superseded candidate was selected', () => {
  const lineage = JSON.parse(readFileSync(`${F}/federation-candidate-lineage-v2.json`, 'utf8')) as
    { supersededCandidates: { candidateId: string }[] }
  const superseded = new Set(lineage.supersededCandidates.map((s) => s.candidateId))
  assert.equal(cohort.entries.filter((e: { candidateId: string }) => superseded.has(e.candidateId)).length, 0)
  assert.equal(cohort.counts.supersededSelected, 0)
})

test('selection does not rely on the migrated rank or tranche fields', () => {
  // The mythology migration left both non-contiguous; the unreviewed pool spans
  // ranks 1 to 1,624. Selecting a rank window would pick an arbitrary set.
  assert.match(cohort.selectionRule, /non-contiguous/)
  assert.match(cohort.selectionRule, /scores\.weighted/)
})

test('the four-page property/topic cap holds', () => {
  const perTopic: Record<string, number> = {}
  for (const e of cohort.entries as { siteId: string; topic: string }[]) {
    const k = `${e.siteId}::${e.topic}`
    perTopic[k] = (perTopic[k] ?? 0) + 1
  }
  const over = Object.entries(perTopic).filter(([, n]) => n > 4)
  assert.deepEqual(over, [], `topics over the cap: ${over.map(([k, n]) => `${k}=${n}`).join(', ')}`)
})

test('proportional shortfalls are recorded, not absorbed', () => {
  // agentic-publishing has 8 candidates left against a target of 10, and
  // mayon-rajan 4 against 5. Silently selecting fewer would misreport coverage.
  assert.ok(cohort.shortfalls.length > 0)
  for (const s of cohort.shortfalls as { siteId: string; target: number; available: number }[]) {
    assert.ok(s.available < s.target)
    assert.equal(cohort.appliedTargets[s.siteId], s.available, `${s.siteId} target must be capped at what exists`)
  }
})

test('every decision covers exactly one candidate in the cohort', () => {
  const cohortIds = new Set(cohort.entries.map((e: { candidateId: string }) => e.candidateId))
  assert.equal(decisions.decisions.length, 100)
  const seen = new Set<string>()
  for (const d of decisions.decisions as { candidateId: string }[]) {
    assert.ok(cohortIds.has(d.candidateId), `${d.candidateId} is not in the cohort`)
    assert.ok(!seen.has(d.candidateId), `${d.candidateId} decided twice`)
    seen.add(d.candidateId)
  }
  assert.equal(seen.size, 100)
})

test('only evidence-ready candidates receive specifications', () => {
  const ready = new Set((decisions.decisions as { candidateId: string; finalState: string }[])
    .filter((d) => d.finalState === 'evidence-ready').map((d) => d.candidateId))
  assert.equal(specs.specifications.length, ready.size)
  for (const s of specs.specifications as { candidateId: string }[]) {
    assert.ok(ready.has(s.candidateId), `${s.candidateId} has a specification without being evidence-ready`)
  }
})

test('rejected, revised and blocked candidates cannot become specifications', () => {
  const specIds = new Set(specs.specifications.map((s: { candidateId: string }) => s.candidateId))
  for (const d of decisions.decisions as { candidateId: string; finalState: string }[]) {
    if (d.finalState !== 'evidence-ready') {
      assert.ok(!specIds.has(d.candidateId), `${d.candidateId} is ${d.finalState} but has a specification`)
    }
  }
})

test('every evidence-ready candidate rests on an inspected source', () => {
  // The gate that bounds this tranche. Evidence-ready requires inspected content
  // with an exact locator, so a candidate can reach it only on an inspected topic.
  const inspected = new Set(sources.inspections.map((i: { topic: string }) => i.topic))
  for (const d of (decisions.decisions as { topic: string; finalState: string }[])) {
    if (d.finalState === 'evidence-ready') assert.ok(inspected.has(d.topic), `${d.topic} was never inspected`)
  }
  for (const s of specs.specifications as { citations: { locator: string }[] }[]) {
    assert.ok(s.citations.length > 0)
    for (const c of s.citations) assert.ok(c.locator.trim().length > 0, 'a citation without a locator is not evidence')
  }
})

test('a missing prerequisite blocks rather than being inferred', () => {
  const missing = (deps.dependencies as { candidateId: string; state: string }[]).filter((d) => d.state === 'missing')
  assert.ok(missing.length > 0, 'this tranche has missing prerequisites')
  const byId = new Map((decisions.decisions as { candidateId: string; finalState: string }[]).map((d) => [d.candidateId, d.finalState]))
  for (const m of missing) assert.equal(byId.get(m.candidateId), 'blocked', `${m.candidateId} has a missing dependency but is not blocked`)
})

test('each specification carries five bounded questions', () => {
  for (const s of specs.specifications as { boundedQuestions: string[] }[]) assert.equal(s.boundedQuestions.length, 5)
  assert.equal(specs.counts.boundedQuestions, specs.specifications.length * 5)
})

test('demand remains unknown where no route-specific evidence exists', () => {
  for (const e of cohort.entries as { demandBasis: string }[]) assert.equal(e.demandBasis, 'unknown')
  for (const s of specs.specifications as { evidenceMetadata: { demandEvidence: string } }[]) {
    assert.equal(s.evidenceMetadata.demandEvidence, 'unknown')
  }
})

test('every source records identity, locator, rights and boundary', () => {
  for (const i of sources.inspections as Record<string, string>[]) {
    for (const field of ['sourceIdentity', 'version', 'stableUrl', 'locator', 'inspectionDepth', 'accessBasis', 'reuseBasis', 'supportedClaimScope', 'boundary', 'sourceClass', 'independence']) {
      assert.ok(i[field]?.trim(), `inspection ${i.inspectionId} is missing ${field}`)
    }
  }
  assert.match(sources.method, /Metadata was not treated as inspection/)
})

test('no private, credential or restricted material enters the artifacts', () => {
  const raw = ['cohort', 'decisions', 'dependency-validation', 'page-specifications', 'readiness', 'source-inspections']
    .map((n) => readFileSync(`${F}/federation-tranche-13-${n}-v1.json`, 'utf8')).join('\n')
  for (const pattern of [/sk-[A-Za-z0-9]{16,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"(password|apiKey|api_key|secret)"\s*:/i]) {
    assert.ok(!pattern.test(raw), `artifact matches ${pattern}`)
  }
})

test('the readiness summary states the honest bound on evidence-ready', () => {
  assert.match(readiness.honestOutcome, /bounded by source inspection, not by candidate quality/)
  assert.equal(readiness.status, 'reviewed-not-published')
  assert.match(readiness.publicationBoundary, /No route, release, sitemap entry or public page is created/)
})

test('artifacts regenerate byte-identically', () => {
  const names = ['cohort', 'decisions', 'dependency-validation', 'page-specifications', 'readiness', 'source-inspections']
  const before = names.map((n) => readFileSync(`${F}/federation-tranche-13-${n}-v1.json`, 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-federation-tranche-13.ts'], { stdio: 'ignore' })
  assert.deepEqual(names.map((n) => readFileSync(`${F}/federation-tranche-13-${n}-v1.json`, 'utf8')), before)
})

test('no prior tranche artifact was mutated', () => {
  // The invariant is that nothing *earlier* than this tranche changed. Excluding
  // only the literal string "tranche-13" also flagged Tranche 14's new files,
  // which are additions by a later tranche rather than mutations of an earlier
  // one. The frozen map and lineage are still guarded: they carry no tranche
  // number and so are never excluded.
  const trancheNumber = (file: string) => {
    const m = /federation-tranche-(\d+)/.exec(file)
    return m ? Number(m[1]) : null
  }
  const changed = execFileSync('git', ['status', '--short', '--', F], { encoding: 'utf8' })
    .split('\n')
    // Modifications and deletions only. A new file is an addition, not a
    // mutation, and the candidate map v3 additions are new files carrying no
    // tranche number — which the number check below would otherwise read as
    // earlier artifacts being rewritten.
    .filter((l) => /^\s*[MD]/.test(l))
    .map((l) => l.slice(3).trim()).filter(Boolean)
    .filter((f) => {
      const n = trancheNumber(f)
      return n === null || n < 13
    })
  assert.deepEqual(changed, [], `earlier artifacts changed: ${changed.join(', ')}`)
})

/* -- closure: prose, report and artifacts must agree ------------------------ */

const semantic = read('semantic-validation')
const report = readFileSync('docs/operations/federation-tranche-13-readiness.md', 'utf8')

test('readiness counts are derived from the artifacts, not asserted beside them', () => {
  const c = readiness.counts
  assert.equal(c.cohort, cohort.entries.length)
  assert.equal(c.specifications, specs.specifications.length)
  assert.equal(c.topicsInspected, new Set(sources.inspections.map((i: { topic: string }) => i.topic)).size)
  assert.equal(c.distinctSources,
    new Set(sources.inspections.map((i: { sourceIdentity: string }) => i.sourceIdentity)).size)
  assert.equal(c.boundedQuestions,
    (specs.specifications as { boundedQuestions: unknown[] }[]).reduce((n, s) => n + s.boundedQuestions.length, 0))
  assert.equal(c.dependenciesMissing,
    (deps.dependencies as { state: string }[]).filter((d) => d.state === 'missing').length)
})

test('the readiness narrative states the number of topics actually inspected', () => {
  // The narrative said two topics after twenty-seven had been inspected. It is
  // now interpolated from the same derived block the counts come from, so a
  // stale sentence would require the counts to be stale too.
  const inspected = new Set(sources.inspections.map((i: { topic: string }) => i.topic)).size
  assert.match(readiness.honestOutcome, new RegExp(`inspected for ${inspected} of`))
  assert.ok(!/inspected for two topics/.test(readiness.honestOutcome))
})

test('the Markdown report agrees with the artifacts on every count', () => {
  const c = readiness.counts
  for (const [label, value] of [
    ['Cohort', c.cohort], ['Topics in cohort', c.topicsInCohort], ['Topics inspected', c.topicsInspected],
    ['Distinct sources', c.distinctSources], ['Specifications', c.specifications],
    ['Bounded questions', c.boundedQuestions], ['Dependencies missing', c.dependenciesMissing],
  ] as [string, number][]) {
    assert.ok(report.includes(`| ${label} | ${value} |`), `report disagrees on ${label}: expected ${value}`)
  }
  for (const [state, n] of Object.entries(c.byFinalState as Record<string, number>)) {
    assert.ok(report.includes(`| \`${state}\` | ${n} |`), `report disagrees on ${state}`)
  }
})

test('no artifact still claims a stale inspected-topic count', () => {
  // The specific regression. A comment is not covered by a digest, which is how
  // the stale sentence survived a byte-identical regeneration check.
  //
  // Scans the generated artifacts rather than this file: a test that greps its
  // own source matches the pattern it is searching for, which is a false
  // failure and would have to be defeated by obfuscating the pattern.
  const stale = new RegExp(['inspected', 'for', 'two', 'topics'].join(' '))
  for (const text of [readiness.honestOutcome, report, JSON.stringify(sources)]) {
    assert.ok(!stale.test(text))
  }
})

test('semantic validation covers every candidate exactly once', () => {
  const ids = (semantic.validations as { candidateId: string }[]).map((v) => v.candidateId)
  assert.equal(ids.length, cohort.entries.length)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...ids].sort(),
    (cohort.entries as { candidateId: string }[]).map((c) => c.candidateId).sort())
})

test('every semantic validation carries a digest and a prohibited inference', () => {
  for (const v of semantic.validations as { candidateDigest: string; prohibitedInference: string }[]) {
    assert.match(v.candidateDigest, /^sha256:[0-9a-f]{64}$/)
    assert.ok(v.prohibitedInference.trim().length > 30)
  }
})
