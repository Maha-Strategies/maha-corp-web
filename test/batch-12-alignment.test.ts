import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import cohort from '../content/batch-12/cohort-manifest.json' with { type: 'json' }
import remediation from '../content/batch-12/depth-remediation.json' with { type: 'json' }
import scopeImpact from '../content/batch-12/scope-join-impact.json' with { type: 'json' }
import projection from '../content/review/exact-revision-projection.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import { classifyInspectionDepth, supportsPassageAxis } from '../lib/inspection-depth.ts'
import { hasMalformedJoin, repairIsFormattingOnly, repairScopeJoin } from '../lib/scope-join-repair.ts'

const ROOT = resolve(import.meta.dirname, '..')

/* --- the depth classifier, which was wrong twice -------------------------- */

test('inspection depth is read from an explicit limitation, not a keyword', () => {
  // The first classifier matched /abstract/ anywhere and sent back three
  // records whose audits list the sections that were read.
  for (const deep of [
    'PMC3235709, abstract, Electrode array fabrication and testing, in-vivo results, Discussion, and Methods',
    'PMC4243060, abstract, Development of paper-based technology, toehold-switch results, Discussion, and Experimental procedures',
  ]) {
    assert.equal(classifyInspectionDepth(deep), 'section-or-full-text', deep.slice(0, 40))
    assert.equal(supportsPassageAxis(classifyInspectionDepth(deep)), true)
  }
  // The second attempt was a keyword list, which missed precise locators.
  for (const deep of [
    'Divakaruni et al. 2014, Chapter 16 §§2.1–2.3 and §3, pp. 311–347 (complete)',
    'LLNL/NIF “Achieving Fusion Ignition”, What Is Ignition, milestones, Gaining',
    'Distill 2017 “Feature Visualization”, Feature Visualization by Optimization',
  ]) {
    assert.equal(classifyInspectionDepth(deep), 'section-or-full-text', deep.slice(0, 40))
  }
  for (const shallow of [
    'PubMed PMID 16198003, complete indexed abstract only',
    'PMC4780047 landing page for the NIH author manuscript; abstract and metadata only',
    'Publisher-served abstract, IEEE Transactions on Power Electronics 18(3):907-914',
  ]) {
    assert.equal(classifyInspectionDepth(shallow), 'abstract-or-metadata-only', shallow.slice(0, 40))
    assert.equal(supportsPassageAxis(classifyInspectionDepth(shallow)), false)
  }
  assert.equal(classifyInspectionDepth(''), 'not-recorded')
  assert.equal(supportsPassageAxis('not-recorded'), false, 'an unrecorded depth cannot support the passage axis')
})

test('the three upgrades came from reclassification, not from finding a document', () => {
  assert.equal(remediation.upgraded.length, 3)
  assert.equal(remediation.remainInRevise.length, 4)
  assert.match(remediation.method, /No new document was retrieved/)
  assert.match(remediation.boundary, /No source was newly retrieved, inspected or rebound/)
  // Every record still in revise records an explicitly limited inspection.
  assert.match(remediation.remainInReviseReason, /abstract-only or landing-page/)
})

test('the thirty previously release-ready records stay release-ready', () => {
  const ready = new Set((projection.projections as { recordId: string; classification: string }[])
    .filter((row) => row.classification === 'release-ready').map((row) => row.recordId))
  assert.equal(ready.size, 33)
  const prior = readFileSync(resolve(ROOT, 'scripts/generate-batch-12-alignment.ts'), 'utf8')
  const frozen = [...prior.matchAll(/'(urn:maha:record:[a-z0-9-]+)',/g)].map((match) => match[1])
  assert.equal(frozen.length, 30, 'the frozen baseline must be exactly the prior thirty')
  for (const recordId of frozen) assert.ok(ready.has(recordId), `${recordId} was demoted`)
})

/* --- the scope-join correction is computed, not applied ------------------- */

test('the correction removes only a terminator at the join', () => {
  const before = 'Limited to Machine / Magnets: toroidal field sections. in “Magnets”; this candidate records the concept boundary.'
  const after = repairScopeJoin(before)
  assert.equal(before.length - after.length, 1, 'exactly one character may move')
  assert.ok(after.includes('sections in “Magnets”'))
  assert.ok(repairIsFormattingOnly(before, after))
  assert.equal(repairScopeJoin(after), after, 'the repair must be idempotent')
  // Sentence punctuation elsewhere survives: this is not a full-stop remover.
  const unrelated = 'Limited to Fig. 3 and Table 2. Nothing else here changes.'
  assert.equal(repairScopeJoin(unrelated), unrelated)
  assert.equal(hasMalformedJoin(unrelated), false)
})

test('the correction is reported as unapplied, with what it would break', () => {
  assert.equal(scopeImpact.applied, false)
  assert.equal(scopeImpact.formattingOnly, true)
  assert.ok(scopeImpact.affectedRecords > 0)
  assert.equal(scopeImpact.digestChanges, scopeImpact.affectedRecords, 'every repair moves a digest')
  assert.ok(scopeImpact.wouldInvalidate.exactRevisionReviews > 0)
  assert.ok(scopeImpact.wouldInvalidate.activeCanonicalReleases > 0)
  assert.match(scopeImpact.whyNotApplied, /invalidate the reviews|desync live releases/)
  assert.equal(scopeImpact.requiresExactRevisionReevaluation.length, scopeImpact.digestChanges,
    'every changed digest must be marked for re-evaluation')
})

test('the defect cannot grow: the affected count is pinned', () => {
  // Not a fix - a fix moves 238 digests and desyncs live releases. This makes a
  // newly-added malformed record fail here rather than pass unnoticed.
  assert.equal(scopeImpact.affectedRecords, 238)
  assert.match(scopeImpact.generator, /frontier-domain-graphs/)
})

/* --- selection is scored, not quota'd ------------------------------------- */

test('Batch 12 is 43 scored records plus the 7 depth cases', () => {
  assert.equal(cohort.alignmentAudit.count, 43)
  assert.equal(cohort.depthRemediation.cohortAtStart, 7)
  assert.equal(cohort.depthRemediation.upgraded, 3)
  assert.equal(cohort.depthRemediation.remaining, 4)
  assert.equal(cohort.combinedCohort, 50)
  const records = cohort.alignmentAudit.records as { recordId: string; total: number; components: Record<string, number> }[]
  // Ranking is total and reproducible: sorted by score, ties by record id.
  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1]
    const current = records[index]
    assert.ok(previous.total > current.total
      || (previous.total === current.total && previous.recordId < current.recordId),
      `ranking is not total at ${current.recordId}`)
  }
  // No domain quota: the spread is an outcome, not an input.
  assert.match(cohort.selectionBasis, /No domain quota/)
  assert.ok(Object.keys(cohort.domainSpread).length > 1)
})

test('nothing in Batch 12 claims to have been inspected or proposed', () => {
  assert.equal(cohort.inspected, 0)
  assert.equal(cohort.proposalsGenerated, 0)
  assert.match(cohort.boundary, /No source has been re-inspected, no binding proposed/)
})

/* --- Part 7: public boundaries -------------------------------------------- */

test('no Batch 12 record is on any public surface', () => {
  const sitemap = new Set(observation.sitemapPaths as string[])
  const llms = new Set(observation.llmsPaths as string[])
  const released = new Set((observation.releases as { recordId: string; status: string }[])
    .filter((entry) => entry.status === 'active').map((entry) => entry.recordId))
  const ids = [
    ...(cohort.alignmentAudit.records as { recordId: string }[]).map((entry) => entry.recordId),
    ...(cohort.depthRemediation.recordIds as string[]),
  ]
  for (const recordId of ids) {
    assert.ok(!released.has(recordId), `${recordId} is in Batch 12 yet released`)
    const slug = recordId.split(':').pop()!
    for (const path of [...sitemap, ...llms]) {
      assert.ok(!path.endsWith(`/${slug}`), `${slug} is unreleased but reachable at ${path}`)
    }
  }
})

test('the Production route count is unchanged by this sprint', () => {
  assert.equal(capacity.crawlable, 764)
  assert.equal(capacity.releaseReadiness.productionCrawlable, 764)
  assert.equal(capacity.releaseReadiness.previewRehearsed, 0, 'no Preview rehearsal ran')
  assert.equal(capacity.buckets['publishable-now'], 0, 'nothing became publishable')
})

test('Batch 12 artifacts carry no identity, credential or private corpus', () => {
  const files = [
    'content/batch-12/cohort-manifest.json',
    'content/batch-12/depth-remediation.json',
    'content/batch-12/scope-join-impact.json',
  ]
  const forbidden: [RegExp, string][] = [
    [/[Bb]earer\s+\S{16,}/, 'bearer token'],
    [/\bsbp_[A-Za-z0-9]{16,}\b/, 'supabase token'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, 'json web token'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
    [/"reviewerId"|"displayName"|"authorityId"|"authorizationBasis"/, 'reviewer or authority identity'],
    [/\breject-or-hold\b|\breview packet\b|\baudit corpus\b/i, 'private corpus vocabulary'],
    [/\bhttps?:\/\/[a-z0-9]{20}\.supabase\.(?:co|in)\b/i, 'supabase project host'],
  ]
  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of forbidden) assert.ok(!pattern.test(text), `${file} contains ${label}`)
  }
})

test('Batch 12 material is unreachable from anything served', () => {
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
  const guarded = ['batch-12', 'scope-join-repair', 'inspection-depth', 'depth-remediation', 'cohort-manifest']
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

test('regenerating produces byte-identical artifacts', () => {
  const files = ['content/batch-12/cohort-manifest.json', 'content/batch-12/depth-remediation.json',
    'content/batch-12/scope-join-impact.json', 'content/review/exact-revision-projection.json']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-exact-revision-review.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-12-alignment.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})
