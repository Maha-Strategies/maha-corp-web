import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { UPLIFT_DIMENSIONS, compileUplift, citableSources, type LegacyPageInput } from '../lib/legacy-knowledge-uplift.ts'
import { upliftFor, upliftedRoutes } from '../lib/legacy-uplift-runtime.ts'
import report from '../content/legacy-uplift/uplift-report.json' with { type: 'json' }
import compiled from '../content/legacy-uplift/uplift-compiled.json' with { type: 'json' }
import { assertNoRouteChange } from './helpers/uplift-invariants.ts'

const ROOT = resolve(import.meta.dirname, '..')
const source = (over = {}) => ({
  id: 's1', title: 'A source', url: 'https://example.org/doc#p4',
  establishes: 'what this source can support in detail', boundary: 'what it cannot support in detail', ...over,
})
const page = (over: Partial<LegacyPageInput> = {}): LegacyPageInput => ({
  family: 'test', slug: 'x', route: '/knowledge/test/x', title: 'X',
  definition: 'A definition long enough to count as a direct answer to the reader question.',
  mechanism: ['step one'], limitations: ['a limit'], doesNotEstablish: ['not this'],
  sources: [source()], bridges: [], comparisons: [], relatedRoutes: [], canonicalRelease: null, ...over,
})

/* ------------------------------------------------------------ fail closed --- */

test('a page with neither its own negative space nor a source boundary is refused', () => {
  // No doesNotEstablish, and the only source declares no boundary either, so
  // there is nothing to derive from.
  const result = compileUplift(page({
    doesNotEstablish: [],
    sources: [{ id: 's1', title: 'A source', url: 'https://example.org/doc#p4' }],
  }))
  assert.equal(result.eligible, false)
  assert.ok(result.refusals.includes('no-negative-space'))
  assert.ok(result.refusals.includes('below-dimension-floor'))
  assert.deepEqual(result.sections, [], 'a refused page renders nothing')
})

test('a page without its own negative space may borrow its sources declared boundaries', () => {
  const result = compileUplift(page({ doesNotEstablish: [] }))
  assert.equal(result.eligible, true)
  const negative = result.sections.find((section) => section.dimension === 'not-established')
  assert.ok(negative, 'the derived boundary must render')
  assert.match(negative.heading, /Boundaries declared by the cited sources/)
  assert.match(negative.items[0], /boundary declared by/, 'each borrowed limit names its source')
})

test('a source without a stated boundary cannot be cited as fact', () => {
  const result = compileUplift(page({ sources: [source({ boundary: undefined })] }))
  assert.equal(result.eligible, false)
  assert.ok(result.refusals.includes('no-cited-source'))
  assert.equal(citableSources([source({ establishes: undefined })]).length, 0)
})

test('metadata-only sources never become explanatory fact', () => {
  // The semiconductor corpus stores id/title/publisher/url/sourceType only.
  const metadataOnly = { id: 'm1', title: 'A paper', publisher: 'X', url: 'https://example.org' }
  assert.equal(citableSources([metadataOnly]).length, 0)
  assert.equal(compileUplift(page({ sources: [metadataOnly] })).eligible, false)
})

test('a comparison with one side is dropped, never narrowed into a claim', () => {
  const result = compileUplift(page({
    comparisons: [{ id: 'c', title: 'One-sided', sides: ['only'], prohibitedInference: 'do not read it this way' }],
  }))
  assert.ok(result.refusals.includes('unsupported-comparison'))
  assert.equal(result.sections.filter((s) => s.dimension === 'bounded-comparison').length, 0)
})

test('a comparison without a prohibited inference is dropped', () => {
  const result = compileUplift(page({
    comparisons: [{ id: 'c', title: 'Two-sided', sides: ['a', 'b'] }],
  }))
  assert.ok(result.refusals.includes('unsupported-comparison'))
})

test('a calculation with inputs but no outputs is dropped, never estimated', () => {
  const result = compileUplift(page({ calculationInputs: ['an input'], calculationOutputs: [] }))
  assert.ok(result.refusals.includes('calculation-without-inputs'))
  assert.equal(result.sections.filter((s) => s.dimension === 'deterministic-calculation').length, 0)
})

test('a stale revision on a released record demands a governed revision', () => {
  const result = compileUplift(page({ canonicalRelease: { released: true, revisionMatches: false } }))
  assert.equal(result.eligible, false)
  assert.ok(result.refusals.includes('stale-revision'))
  assert.equal(result.requiresGovernedRevision, true)
})

/* ---------------------------------------------- evidence, not word count --- */

test('a concise page with every required dimension passes', () => {
  const result = compileUplift(page())
  assert.equal(result.eligible, true)
  assert.ok(result.after!.dimensionCount >= 6)
})

test('a long page without evidence still fails', () => {
  const padded = Array.from({ length: 60 }, (_, i) => `a long sentence of filler number ${i}`)
  const result = compileUplift(page({ mechanism: padded, limitations: padded, doesNotEstablish: [], sources: [] }))
  assert.equal(result.eligible, false)
  assert.ok(result.refusals.includes('no-cited-source'))
})

/* --------------------------------------------------------- the real corpus --- */

test('the inventory covers every named legacy family', () => {
  const families = Object.keys(report.inventory.byFamily)
  for (const expected of ['astronomy', 'mathematics', 'religion', 'neuromorphic-biocomputing', 'semiconductor-manufacturing']) {
    assert.ok(families.includes(expected), `${expected} must be inventoried`)
  }
  assert.ok(report.inventory.pages >= 150, `expected 150+ pages, got ${report.inventory.pages}`)
})

test('upgraded and blocked counts are reported separately and sum to the inventory', () => {
  const { eligibleAndUpgraded, blocked } = report.outcome
  assert.equal(eligibleAndUpgraded + blocked, report.inventory.pages)
  assert.ok(eligibleAndUpgraded < report.inventory.pages, 'not every page may be claimed as upgraded')
})

test('every blocked page names its actual failed predicate', () => {
  for (const page of compiled.pages) {
    if (page.eligible) continue
    assert.ok(page.refusals.length > 0, `${page.route} must say why`)
    assert.equal(page.after, null, 'a blocked page has no after-state')
  }
})

test('depth is measured by dimensions and evidence, never word count', () => {
  assert.ok(report.depth.after.dimensions > report.depth.before.dimensions)
  assert.match(report.depth.metric, /Word count is deliberately not among them/)
  assert.ok(!('wordCount' in report.depth.before))
})

/* ------------------------------------------------------------ the runtime --- */

test('only eligible routes resolve at runtime', () => {
  const eligible = compiled.pages.filter((p) => p.eligible).map((p) => p.route).sort()
  assert.deepEqual([...upliftedRoutes()], eligible)
  for (const page of compiled.pages) {
    if (page.eligible) assert.ok(upliftFor(page.route), `${page.route} should resolve`)
    else assert.equal(upliftFor(page.route), null, `${page.route} must not resolve`)
  }
})

test('every rendered item traces to a dimension in the contract', () => {
  for (const route of upliftedRoutes()) {
    const uplift = upliftFor(route)!
    for (const section of uplift.sections) {
      assert.ok((UPLIFT_DIMENSIONS as readonly string[]).includes(section.dimension))
      assert.ok(section.items.length > 0, 'an empty section must not render')
    }
  }
})

/* -------------------------------------------------------------- boundaries --- */

test('no existing route or canonical URL changed', () => {
  // New, separately reviewed route files are outside this legacy-uplift invariant.
  // Restrict the comparison to modified files so a newly added route cannot be
  // mistaken for a mutation of one of the 167 legacy routes audited here.
  const diff = execFileSync('git', ['diff', '--diff-filter=M', '--unified=0', 'origin/main', '--', 'app/'], { cwd: ROOT, encoding: 'utf8' })
  let changedFile = ''
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) changedFile = line.slice(6)
    if (!/^[+-][^+-]/.test(line)) continue
    const isKdpTakedown = changedFile.startsWith('app/books/the-maha-principle/')
    assert.ok(isKdpTakedown || !/alternates:\s*\{\s*canonical/.test(line) || /UpliftSections|upliftRoute|NSGOODS_PREFLIGHT_V3_EVIDENCE_PATH|TAMIL_CLASSICAL_PATH|MAYON_KNOWLEDGE_PATH/.test(line),
      `canonical must not change: ${line.slice(0, 80)}`)
    assert.ok(isKdpTakedown || !/generateStaticParams|dynamicParams =/.test(line) || /UpliftSections|upliftRoute|TAMIL_CLASSICAL_TOPICS|MAYON_TOPICS/.test(line),
      `route generation must not change: ${line.slice(0, 80)}`)
  }
  assertNoRouteChange(report)
})

test('no private artifact reaches a public route or client bundle', () => {
  let matches = ''
  try {
    matches = execFileSync('git', ['grep', '-l', '-E', 'uplift-report|reviewPacket|rejectedMaterial', '--', 'app', 'components'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch (error) {
    if ((error as { status?: number }).status !== 1) throw error
  }
  assert.equal(matches, '', 'audit and review material must stay out of served code')
  const blob = readFileSync(resolve(ROOT, 'content/legacy-uplift/uplift-report.json'), 'utf8')
  for (const pattern of [/bearer/i, /reviewerId/i, /packetDigest/i, /TOKEN["':\s]+\S{12}/]) {
    assert.ok(!pattern.test(blob), `report must not contain ${pattern}`)
  }
})
