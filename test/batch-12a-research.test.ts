import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import investigations from '../content/batch-12a/source-investigations.json' with { type: 'json' }
import packets from '../content/batch-12a/remediation-packets.json' with { type: 'json' }
import decisions from '../content/batch-12a/editorial-decisions.json' with { type: 'json' }
import proposals from '../content/batch-12a/proposed-revisions.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import scopeImpact from '../content/batch-12/scope-join-impact.json' with { type: 'json' }
import { REVIEW_AXES } from '../lib/exact-revision-review.ts'
import { hasMalformedJoin, repairScopeJoin } from '../lib/scope-join-repair.ts'

const ROOT = resolve(import.meta.dirname, '..')
const DIGEST = /^sha256:[0-9a-f]{64}$/

/* --- research actually happened, and its limits are recorded -------------- */

test('the cohort is 15, split into inspected and unresolved with no overlap', () => {
  const inspectedIds = (investigations.investigations as { recordId: string }[]).map((entry) => entry.recordId)
  const blockedIds = (investigations.unresolved as { recordId: string }[]).map((entry) => entry.recordId)
  assert.equal(inspectedIds.length + blockedIds.length, 15)
  assert.equal(new Set([...inspectedIds, ...blockedIds]).size, 15, 'no record may appear twice')
})

test('every inspected record names a locator, a passage and a rights basis', () => {
  for (const entry of investigations.investigations as Record<string, unknown>[]) {
    assert.equal(entry.contentInspected, true, `${entry.recordId} claims inspection`)
    const locator = String(entry.exactLocator ?? (entry.candidateReplacement as Record<string, string>)?.exactLocator ?? '')
    const passage = String(entry.boundedPassage ?? (entry.candidateReplacement as Record<string, string>)?.boundedPassage ?? '')
    const rights = String(entry.rightsBasis ?? (entry.candidateReplacement as Record<string, string>)?.rightsBasis ?? '')
    assert.ok(locator.length > 8, `${entry.recordId} has no exact locator`)
    assert.ok(passage.length > 20, `${entry.recordId} has no inspected passage`)
    assert.ok(rights.length > 8, `${entry.recordId} has no rights basis`)
    // For a replacement, these live on the replacement rather than the record.
    const doesNotEstablish = String(entry.doesNotEstablish
      ?? (entry.candidateReplacement as Record<string, string>)?.doesNotEstablish ?? '')
    assert.ok(doesNotEstablish.length > 10, `${entry.recordId} must state what the source does not establish`)
  }
})

test('quoted passages stay short, as bounded quotation', () => {
  const quotes = (investigations.investigations as Record<string, unknown>[]).flatMap((entry) => [
    String(entry.boundedPassage ?? ''),
    String((entry.candidateReplacement as Record<string, string>)?.boundedPassage ?? ''),
  ]).filter((quote) => quote.length > 0)
  assert.ok(quotes.length > 0)
  for (const quote of quotes) {
    assert.ok(quote.split(/\s+/).length <= 30, `quotation too long: ${quote.slice(0, 50)}`)
  }
})

test('every unresolved record documents the routes that were tried', () => {
  const blocked = investigations.unresolved as { recordId: string; attemptedRoutes: string[]; outcome: string; reason: string }[]
  assert.ok(blocked.length > 0)
  for (const entry of blocked) {
    assert.equal(entry.outcome, 'remain-blocked')
    assert.ok(entry.attemptedRoutes.length >= 2, `${entry.recordId} must record more than one attempted route`)
    assert.ok(entry.reason.length > 20)
    // Identity resolution alone is never reported as inspection.
    assert.ok(entry.attemptedRoutes.some((route) => /Crossref/.test(route)))
  }
})

test('metadata resolution is never counted as content inspection', () => {
  const blockedIds = new Set((investigations.unresolved as { recordId: string }[]).map((entry) => entry.recordId))
  for (const packet of packets.packets as { recordId: string; contentInspected: boolean; shortPassage: string | null }[]) {
    if (blockedIds.has(packet.recordId)) {
      assert.equal(packet.contentInspected, false, `${packet.recordId} resolved metadata but was not inspected`)
      assert.equal(packet.shortPassage, null, 'an uninspected record cannot carry a passage')
    }
  }
  assert.match(investigations.accessPolicy, /No paywall, login or CAPTCHA was bypassed/)
})

/* --- decisions rest on inspection ----------------------------------------- */

test('an uninspected record is blocked on every axis', () => {
  const blockedIds = new Set((investigations.unresolved as { recordId: string }[]).map((entry) => entry.recordId))
  const rows = decisions.decisions as { recordId: string; axis: string; disposition: string; note: string }[]
  for (const recordId of blockedIds) {
    const forRecord = rows.filter((row) => row.recordId === recordId)
    assert.equal(forRecord.length, REVIEW_AXES.length)
    for (const row of forRecord) {
      assert.equal(row.disposition, 'remain-blocked', `${recordId}/${row.axis}`)
      assert.match(row.note, /unread source cannot support|No lawful full-text route/)
    }
  }
})

test('every decision carries the machine tier and no person', () => {
  assert.equal((decisions.tier as { reviewerKind: string }).reviewerKind, 'automated-internal-editorial')
  for (const row of decisions.decisions as Record<string, unknown>[]) {
    assert.equal(row.reviewerKind, 'automated-internal-editorial')
    assert.equal(row.independent, false)
    assert.equal(row.humanReviewed, false)
    assert.equal(row.externallyReviewed, false)
    assert.equal(row.expertEndorsement, false)
    assert.equal(row.releaseAuthority, 'separate')
    assert.match(String(row.decisionSha256), DIGEST)
  }
  assert.ok(!/"displayName"|"reviewerId"|"affiliation"/.test(JSON.stringify(decisions)))
})

test('the review is differentiated, not a rubber stamp', () => {
  const dispositions = new Set((decisions.decisions as { disposition: string }[]).map((row) => row.disposition))
  assert.ok(dispositions.size >= 3, `expected differentiated outcomes, got ${[...dispositions].join(', ')}`)
  assert.ok(dispositions.has('remain-blocked'))
})

/* --- proposals are private and inactive ----------------------------------- */

test('no proposal is active, and none creates a release', () => {
  assert.equal(proposals.active, false)
  assert.equal(proposals.pendingGovernedAdoption, true)
  for (const revision of proposals.proposedRevisions as Record<string, unknown>[]) {
    assert.equal(revision.active, false)
    assert.equal(revision.pendingGovernedAdoption, true)
    assert.match(String(revision.proposedRevisionSha256), DIGEST)
    assert.match(String(revision.activeRevisionSha256), DIGEST)
    assert.notEqual(revision.proposedRevisionSha256, revision.activeRevisionSha256)
  }
})

test('the canary is withheld because fewer than five overrides survived', () => {
  assert.equal(proposals.sourceOverrideCandidates < 5, true)
  assert.equal(proposals.canary, null, 'a canary must not be assembled from fewer than five')
  assert.match(String(proposals.canaryWithheldReason), /Five are required, and the criteria were not weakened/)
})

/* --- Part 8: the scope repair stays unapplied ----------------------------- */

test('the scope defect cannot spread, and the repair stays unapplied', () => {
  assert.equal(scopeImpact.applied, false)
  assert.equal(scopeImpact.affectedRecords, 238)
  assert.ok(scopeImpact.wouldInvalidate.activeCanonicalReleases >= 65)
  // The repair remains provably formatting-only and idempotent.
  const sample = 'Limited to Figure 4 and Methods sections. in “A Source”; the rest is unchanged.'
  const repaired = repairScopeJoin(sample)
  assert.equal(sample.length - repaired.length, 1)
  assert.equal(repairScopeJoin(repaired), repaired)
  assert.equal(hasMalformedJoin(repaired), false)
  // No generated record carries the repaired form yet: applying it is a
  // governed migration, and this sprint must not have started it.
  assert.equal(scopeImpact.requiresExactRevisionReevaluation.length, scopeImpact.digestChanges)
})

/* --- Part 9: public boundary ---------------------------------------------- */

test('the active public surface is unchanged', () => {
  assert.equal(capacity.crawlable, 764)
  assert.equal(capacity.batch12a.activePublicRoutes, 764)
  assert.equal(capacity.batch12a.activeAlignmentClear, 141)
  assert.equal(capacity.batch12a.newlyReleaseReadyProposed, 0)
  assert.equal(capacity.releaseReadiness.previewRehearsed, 0)
})

test('no Batch 12A record is in sitemap.xml or llms.txt', () => {
  const surfaces = [...(observation.sitemapPaths as string[]), ...(observation.llmsPaths as string[])]
  const ids = (packets.packets as { recordId: string }[]).map((entry) => entry.recordId)
  assert.equal(ids.length, 15)
  for (const recordId of ids) {
    const slug = recordId.split(':').pop()!
    for (const path of surfaces) {
      assert.ok(!path.endsWith(`/${slug}`), `${slug} is proposed-only but reachable at ${path}`)
    }
  }
})

test('packets and passages carry nothing private beyond bounded quotation', () => {
  for (const file of ['content/batch-12a/source-investigations.json', 'content/batch-12a/remediation-packets.json',
    'content/batch-12a/editorial-decisions.json', 'content/batch-12a/proposed-revisions.json']) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of [
      [/[Bb]earer\s+\S{16,}/, 'bearer token'],
      [/\bsbp_[A-Za-z0-9]{16,}\b/, 'supabase token'],
      [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email address'],
      [/"reviewerId"|"displayName"|"authorityId"|"authorizationBasis"/, 'reviewer or authority identity'],
      [/\bhttps?:\/\/[a-z0-9]{20}\.supabase\.(?:co|in)\b/i, 'supabase project host'],
    ] as [RegExp, string][]) {
      assert.ok(!pattern.test(text), `${file} contains ${label}`)
    }
  }
})

test('Batch 12A material is unreachable from anything served', () => {
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
  const guarded = ['batch-12a', 'remediation-packets', 'proposed-revisions', 'source-investigations']
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
  const files = ['content/batch-12a/remediation-packets.json', 'content/batch-12a/editorial-decisions.json',
    'content/batch-12a/proposed-revisions.json', 'content/scaling/capacity-model.json']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-batch-12a.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})
