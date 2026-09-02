import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import inventory from '../content/source-first/source-inventory.json' with { type: 'json' }
import eligibility from '../content/source-first/eligibility-report.json' with { type: 'json' }
import pilot from '../content/source-first/pilot-contracts.json' with { type: 'json' }
import candidates from '../content/source-first/record-candidates.json' with { type: 'json' }
import capacity from '../content/scaling/capacity-model.json' with { type: 'json' }
import observation from '../content/scaling/public-surface-observation.json' with { type: 'json' }
import {
  GOVERNANCE_MODEL, INFORMATION_DIMENSIONS, evaluateSourcePage, scanRenderedPage,
  type BoundClaim, type SourcePageCandidate,
} from '../lib/source-evidence-reference.ts'

const ROOT = resolve(import.meta.dirname, '..')
const claim = (over: Partial<BoundClaim> = {}): BoundClaim =>
  ({ recordId: 'urn:x', revisionSha256: `sha256:${'a'.repeat(64)}`, activeRelease: true, locator: 'Section 2', statement: 's', ...over })
const base = (over: Partial<SourcePageCandidate> = {}): SourcePageCandidate => ({
  sourceId: '10.0/x', identityVerified: true, inspectionDepth: 'section-or-full-text',
  exactLocators: ['Section 2'], rightsBasis: 'CC BY', claims: [claim(), claim({ recordId: 'urn:y' })],
  satisfies: [...INFORMATION_DIMENSIONS], route: '/knowledge/sources/x', searchIntent: 'what x establishes', alignmentMismatch: false, ...over,
})
const gate = (c: SourcePageCandidate, routes = new Set<string>(), intents = new Set<string>(), records = new Set<string>()) =>
  evaluateSourcePage(c, routes, intents, records)

/* --- the gate refuses what it must ---------------------------------------- */

test('an abstract-only source cannot pass a section-level gate', () => {
  for (const depth of ['abstract-only', 'landing-page-only', 'inaccessible', 'identity-conflicted', 'source-mismatched'] as const) {
    const verdict = gate(base({ inspectionDepth: depth }))
    assert.equal(verdict.eligible, false, depth)
    assert.ok(verdict.refusals.includes('not-inspected-beyond-metadata'), depth)
  }
  assert.equal(gate(base()).eligible, true, 'section-or-full-text is the only depth that passes')
})

test('an unreleased claim refuses the whole page rather than being dropped', () => {
  const verdict = gate(base({ claims: [claim(), claim({ recordId: 'urn:y', activeRelease: false })] }))
  assert.equal(verdict.eligible, false)
  assert.ok(verdict.refusals.includes('unreleased-claim-present'))
  // And a page with nothing released is refused outright.
  assert.ok(gate(base({ claims: [claim({ activeRelease: false })] })).refusals.includes('no-active-released-record'))
})

test('every information dimension is individually required', () => {
  for (const dimension of INFORMATION_DIMENSIONS) {
    const verdict = gate(base({ satisfies: INFORMATION_DIMENSIONS.filter((entry) => entry !== dimension) }))
    assert.equal(verdict.eligible, false, dimension)
    assert.deepEqual(verdict.missingDimensions, [dimension])
  }
})

test('duplicate routes, duplicate intents and record-page duplicates refuse', () => {
  assert.ok(gate(base(), new Set(['/knowledge/sources/x'])).refusals.includes('duplicate-route'))
  assert.ok(gate(base(), new Set(), new Set(['what x establishes'])).refusals.includes('duplicate-search-intent'))
  assert.ok(gate(base(), new Set(), new Set(), new Set(['/knowledge/sources/x'])).refusals.includes('duplicates-an-existing-record-page'))
  assert.ok(gate(base({ searchIntent: '   ' })).refusals.includes('duplicate-search-intent'))
})

test('identity, locator, rights and mismatch each block on their own', () => {
  assert.ok(gate(base({ identityVerified: false })).refusals.includes('identity-unverified'))
  assert.ok(gate(base({ exactLocators: [] })).refusals.includes('no-exact-locator'))
  assert.ok(gate(base({ rightsBasis: '' })).refusals.includes('no-rights-basis'))
  assert.ok(gate(base({ alignmentMismatch: true })).refusals.includes('unresolved-alignment-mismatch'))
})

test('a source page cannot manufacture a claim of its own', () => {
  // Every displayed claim must trace to a bound released record. A page with
  // released records but no claims has nothing to display.
  assert.ok(gate(base({ claims: [] })).refusals.includes('no-active-released-record'))
  assert.equal(GOVERNANCE_MODEL.inheritsFactualAuthority, false)
  assert.equal(GOVERNANCE_MODEL.requiresOwnCanonicalRelease, false)
  assert.match(GOVERNANCE_MODEL.failClosed, /must trace to an active released revision/)
})

test('prohibited page shapes are detected, and length is not the gate', () => {
  assert.deepEqual(scanRenderedPage('We replicated the result in our own laboratory.'), ['implied independent replication'])
  assert.deepEqual(scanRenderedPage('As the methods section shows, the effect holds.'), ['abstract presented as section support'])
  assert.deepEqual(scanRenderedPage('The reviewerId was recorded.'), ['private reviewer material'])
  assert.deepEqual(scanRenderedPage(`"${'q'.repeat(420)}"`), ['unbounded quotation'])
  // A short, honest page passes; a long one is not thereby better.
  assert.deepEqual(scanRenderedPage('Liu and colleagues report a U-shaped accuracy curve at Figure 5.'), [])
})

/* --- the inventory is honest ---------------------------------------------- */

test('metadata verification is never counted as inspection', () => {
  const depths = new Set((inventory.sources as { inspectionDepth: string }[]).map((entry) => entry.inspectionDepth))
  assert.ok(!depths.has('metadata-only'), 'there is no metadata-only depth that could pass')
  for (const source of inventory.sources as { inspectionDepth: string; fullTextAccessible: boolean }[]) {
    if (source.inspectionDepth !== 'section-or-full-text') assert.equal(source.fullTextAccessible, false)
  }
})

test('one source does not equal one eligible page', () => {
  assert.equal(inventory.uniqueSources, 48)
  assert.ok(eligibility.eligibleNow < inventory.uniqueSources / 2,
    'the gate must not wave most sources through')
  assert.equal(eligibility.eligibleNow, (pilot.contracts as unknown[]).length)
  assert.ok(pilot.pilotSize < pilot.requested, 'the honest pilot is smaller than requested')
})

test('every pilot contract uses at least two released claims and states its limits', () => {
  for (const contract of pilot.contracts as Record<string, unknown>[]) {
    assert.ok(Number(contract.releasedClaimsUsed) >= 2, `${contract.sourceId} would duplicate a record page`)
    assert.equal(contract.informationDimensions, INFORMATION_DIMENSIONS.length)
    assert.ok(String(contract.limitations).includes('asserts nothing beyond'))
    assert.deepEqual(contract.publicationBlockers, [])
  }
  assert.equal(pilot.public, false)
  assert.equal(pilot.released, false)
})

/* --- candidates are distinct and private ---------------------------------- */

test('a restatement of an existing record is rejected as a candidate', () => {
  assert.ok(candidates.rejectedAsDuplicate > 0, 'the duplication rule must actually bite')
  for (const candidate of candidates.candidates as Record<string, unknown>[]) {
    assert.equal(candidate.active, false)
    assert.equal(candidate.canonical, false)
    assert.match(String(candidate.candidateRevisionSha256), /^sha256:[0-9a-f]{64}$/)
    assert.ok(String(candidate.locator).length > 5, 'a candidate must name the passage it came from')
    assert.ok(String(candidate.uncertainty).length > 20, 'a candidate must state its scope and uncertainty')
  }
})

/* --- public boundary ------------------------------------------------------ */

test('Production stays at 764 and nothing new is reachable', () => {
  assert.equal(capacity.crawlable, 764)
  assert.equal(capacity.pathToTarget.currentProductionRoutes, 764)
  assert.equal(capacity.pathToTarget.stages.reachable, 764)
  assert.equal(capacity.pathToTarget.stages.sitemapListed, 764)
  assert.ok(capacity.pathToTarget.stages.candidate > 0)
  assert.notEqual(capacity.pathToTarget.stages.candidate, capacity.pathToTarget.stages.reachable)
})

test('no source route and no candidate appears in sitemap.xml or llms.txt', () => {
  const surfaces = new Set([...(observation.sitemapPaths as string[]), ...(observation.llmsPaths as string[])])
  for (const contract of pilot.contracts as { route: string }[]) {
    assert.ok(!surfaces.has(contract.route), `${contract.route} is a private contract yet listed`)
  }
  for (const candidate of candidates.candidates as { slug: string }[]) {
    for (const path of surfaces) assert.ok(!path.endsWith(`/${candidate.slug}`), `${candidate.slug} is private yet reachable`)
  }
})

test('the private inventory carries no reviewer, credential or unbounded passage', () => {
  for (const file of ['content/source-first/source-inventory.json', 'content/source-first/eligibility-report.json',
    'content/source-first/pilot-contracts.json', 'content/source-first/record-candidates.json']) {
    const text = readFileSync(resolve(ROOT, file), 'utf8')
    for (const [pattern, label] of [
      [/[Bb]earer\s+\S{16,}/, 'bearer token'],
      [/"reviewerId"|"displayName"|"authorityId"/, 'reviewer identity'],
      [/\breject-or-hold\b|\breview packet\b/i, 'private reviewer vocabulary'],
      [/"[^"]{400,}"/, 'unbounded quotation'],
      [/VERCEL_TOKEN|SUPABASE_ACCESS_TOKEN/, 'credential name'],
    ] as [RegExp, string][]) {
      assert.ok(!pattern.test(text), `${file} contains ${label}`)
    }
  }
})

test('source-first material is unreachable from anything served', () => {
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
  const guarded = ['source-first', 'source-inventory', 'pilot-contracts', 'record-candidates', 'source-evidence-reference']
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
      assert.ok(!file.includes(marker) && !source.includes(marker), `${marker} reachable via ${file}`)
    }
  }
  assert.ok(seen.size > 0)
})

test('existing queues are carried, not mutated', () => {
  assert.equal(capacity.batch12a.activePublicRoutes, 764)
  assert.equal(capacity.batch12b.newlyReleaseReadyProposed, 0)
  assert.equal(capacity.pathToTarget.existingReleaseReadyPotential, 33)
  assert.equal(capacity.pathToTarget.governedLegacyAdoptionPotential, 7)
})

test('regenerating produces byte-identical artifacts', () => {
  const files = ['content/source-first/source-inventory.json', 'content/source-first/eligibility-report.json',
    'content/source-first/pilot-contracts.json', 'content/source-first/record-candidates.json', 'content/scaling/capacity-model.json']
  const before = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-source-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  execFileSync('node', ['--experimental-strip-types', 'scripts/generate-scaling-inventory.ts'], { cwd: ROOT, stdio: 'ignore' })
  const after = files.map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
  for (const [index, file] of files.entries()) assert.equal(after[index], before[index], `${file} is not deterministic`)
})
