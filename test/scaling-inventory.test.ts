import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import inventory from '../content/scaling/public-inventory.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import { PAGE_FAMILIES, classifyPath, evaluateCandidate } from '../lib/scaling-page-families.ts'
import { PAGE_TARGET, bucketFor } from '../lib/scaling-capacity.ts'

/**
 * The scaling model must not become a way to publish things that are not ready.
 *
 * A page count is easy to raise dishonestly: classify a draft as a page, let a
 * template mint routes, or quietly treat "reviewed" as implied by "compiled".
 * These pin the opposite - that the gate refuses, that the counts come from an
 * observation rather than an assertion, and that nothing private rides along.
 */

const ROOT = resolve(import.meta.dirname, '..')

/* --- the observation is what it claims to be ------------------------------ */

test('the observation carries digests for every source it reports', () => {
  for (const [name, source] of Object.entries(observation.sources as Record<string, { sha256: string; url: string }>)) {
    assert.match(source.sha256, /^sha256:[0-9a-f]{64}$/, `${name} must carry a digest`)
    assert.match(source.url, /^https:\/\/www\.mahastrategies\.com\//)
  }
  assert.equal(inventory.sourceDigests.sitemap, (observation.sources as Record<string, { sha256: string }>).sitemap.sha256)
})

test('counts are derived, not asserted', () => {
  assert.equal(inventory.crawlable, (observation.sitemapPaths as string[]).length)
  assert.equal(capacity.crawlable, inventory.crawlable)
  assert.equal(capacity.gapToTarget, PAGE_TARGET - capacity.crawlable)
  assert.equal(inventory.reconciliation.duplicateSitemapPaths, 0, 'a duplicate URL is not a second page')
})

test('every active release path is crawlable', () => {
  const active = (observation.releases as { canonicalPath: string; status: string }[]).filter((r) => r.status === 'active')
  const paths = new Set(observation.sitemapPaths as string[])
  assert.equal(inventory.reconciliation.releasePathsMissingFromSitemap.length, 0)
  for (const release of active) assert.ok(paths.has(release.canonicalPath), `${release.canonicalPath} is released but not crawlable`)
})

test('family counts partition the crawlable surface exactly once', () => {
  const summed = (inventory.families as { crawlable: number }[]).reduce((total, family) => total + family.crawlable, 0)
  assert.equal(summed + (inventory.unclassified as string[]).length, inventory.crawlable,
    'every path must land in exactly one family or be reported unclassified')
})

/* --- the gate refuses what it should -------------------------------------- */

const FULL = PAGE_FAMILIES.find((family) => family.id === 'substantial-record')!.requires

test('a record page without an active canonical release is refused', () => {
  const verdict = evaluateCandidate(
    { path: '/knowledge/quantum-systems/concepts/example', satisfies: FULL, hasActiveCanonicalRelease: false, searchIntent: 'a distinct question' },
    new Set(), new Set(),
  )
  assert.equal(verdict.eligible, false)
  assert.ok(verdict.refusals.includes('release-required'))
})

test('a page missing any required information is refused, and says which', () => {
  for (const dropped of FULL) {
    const verdict = evaluateCandidate(
      {
        path: '/knowledge/quantum-systems/concepts/example',
        satisfies: FULL.filter((requirement) => requirement !== dropped),
        hasActiveCanonicalRelease: true,
        searchIntent: `intent-${dropped}`,
      },
      new Set(), new Set(),
    )
    assert.equal(verdict.eligible, false, `${dropped} must be required`)
    assert.deepEqual(verdict.missing, [dropped])
  }
})

test('a duplicate route or a reused search intent is refused', () => {
  const candidate = {
    path: '/knowledge/quantum-systems/concepts/example',
    satisfies: FULL, hasActiveCanonicalRelease: true, searchIntent: 'How a transmon qubit stores information',
  }
  assert.ok(evaluateCandidate(candidate, new Set([candidate.path]), new Set()).refusals.includes('duplicate-route'))
  assert.ok(evaluateCandidate(candidate, new Set(), new Set([candidate.searchIntent.toLowerCase()])).refusals.includes('search-intent-not-distinct'))
  assert.ok(evaluateCandidate({ ...candidate, searchIntent: '   ' }, new Set(), new Set()).refusals.includes('search-intent-not-distinct'))
})

test('an unrecognised route has no family and cannot publish', () => {
  const verdict = evaluateCandidate(
    { path: '/generated/2026-09-01/daily', satisfies: FULL, hasActiveCanonicalRelease: true, searchIntent: 'a date' },
    new Set(), new Set(),
  )
  assert.equal(verdict.familyId, null)
  assert.deepEqual(verdict.refusals, ['unknown-family'])
})

test('methodology is classified before the record prefix swallows it', () => {
  assert.equal(classifyPath('/knowledge/epistemic-system/releases')?.id, 'methodology')
  assert.equal(classifyPath('/knowledge/quantum-systems/concepts/transmon')?.id, 'substantial-record')
})

/* --- the bucket ordering cannot skip a prerequisite ----------------------- */

test('a record is never reported publishable while any gate is open', () => {
  const base = { recordId: 'urn:x', alignmentClear: true, exactRevisionReviewed: true, activeCanonicalRelease: true, hasSubstantialPage: false }
  assert.equal(bucketFor(base), 'publishable-now')
  assert.equal(bucketFor({ ...base, alignmentClear: false }), 'blocked-on-source-inspection')
  assert.equal(bucketFor({ ...base, exactRevisionReviewed: false }), 'blocked-on-exact-revision-review')
  assert.equal(bucketFor({ ...base, activeCanonicalRelease: false }), 'blocked-on-canonical-release')
  assert.equal(bucketFor({ ...base, hasSubstantialPage: true }), null)
  // Inspection comes first: a record that is neither inspected nor released is
  // reported against inspection, because releasing it is not the next step.
  assert.equal(bucketFor({ ...base, alignmentClear: false, activeCanonicalRelease: false }), 'blocked-on-source-inspection')
})

test('the model states that it cannot observe review without a release', () => {
  assert.equal(capacity.observability.canonicalReleaseBucketObservable, false)
  assert.match(capacity.observability.reviewObservedVia, /active canonical release/)
})

/* --- nothing private rides along ------------------------------------------ */

test('the committed artifacts carry no credential, reviewer or authority material', () => {
  const files = [
    'content/scaling/public-surface-observation.json',
    'content/scaling/public-inventory.json',
    'content/scaling/capacity-model.json',
    'docs/operations/scaling-to-1000.md',
  ]
  const forbidden: [RegExp, string][] = [
    [/[Bb]earer\s+\S{16,}/, 'bearer token'],
    [/\bsbp_[A-Za-z0-9]{16,}\b/, 'supabase token'],
    [/\bsb_secret_[A-Za-z0-9]{16,}\b/, 'supabase secret key'],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, 'json web token'],
    [/postgres(?:ql)?:\/\/[^\s"']*:[^\s"'@]+@/i, 'database url'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
    [/"reviewerId"|"reviewMethod"|"authorityId"|"authorizationBasis"/, 'reviewer or authority identity'],
    [/\breject-or-hold\b|\breview packet\b|\baudit corpus\b/i, 'private corpus excerpt'],
    [/\bhttps?:\/\/[a-z0-9]{20}\.supabase\.(?:co|in)\b/i, 'supabase project host'],
  ]
  for (const file of files) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of forbidden) {
      assert.ok(!pattern.test(text), `${file} contains ${label}`)
    }
  }
})

test('release authority survives only as a withheld digest, never as attribution', () => {
  const text = readFileSync(resolve(ROOT, 'content/scaling/public-surface-observation.json'), 'utf8')
  assert.ok(!text.includes('releaseAuthority'), 'authority blocks must not be carried into the observation')
  assert.ok(!text.includes('approvals'), 'review prose must not be carried into the observation')
  // Only scope names survive from the approval records.
  const release = (observation.releases as { approvalScopes: string[] }[])[0]
  for (const scope of release.approvalScopes) assert.match(scope, /^[a-z-]+$/)
})

/* --- the generator is deterministic --------------------------------------- */

test('regenerating produces byte-identical artifacts', () => {
  const files = ['content/scaling/public-inventory.json', 'content/scaling/capacity-model.json', 'docs/operations/scaling-to-1000.md']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})

test('the report states the shortfall rather than rounding it away', () => {
  const report = readFileSync(resolve(ROOT, 'docs/operations/scaling-to-1000.md'), 'utf8')
  assert.match(report, /\*\*The publishable-now pool is 0\.\*\*/)
  assert.match(report, /limit of observation, not as a finding/)
  assert.ok(!/\bwill rank\b|\bguarantee/i.test(report), 'the report must not promise search outcomes')
})
