import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { NANO_ARTICLES, NANO_CANDIDATES, NANO_PATH, NANO_SOURCES } from '../lib/nanotechnology-knowledge.ts'
import { PHYSICAL_AI_ARTICLES, PHYSICAL_AI_CANDIDATES, PHYSICAL_AI_PATH, PHYSICAL_AI_SOURCES } from '../lib/physical-ai-knowledge.ts'

/**
 * Both sections publish explanation under one evidence contract, so one test
 * file checks both. The section-specific claims — what each one refuses to
 * say — are asserted separately at the bottom.
 */

const SECTIONS = [
  { name: 'nanotechnology', path: NANO_PATH, articles: NANO_ARTICLES, sources: NANO_SOURCES, candidates: NANO_CANDIDATES },
  { name: 'physical-ai', path: PHYSICAL_AI_PATH, articles: PHYSICAL_AI_ARTICLES, sources: PHYSICAL_AI_SOURCES, candidates: PHYSICAL_AI_CANDIDATES },
] as const

/** The shape both sections' source registries share. */
type SourceRecord = { title: string; url: string; locator: string; inspected: string; claim: string; boundary: string; rights: string }

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

test('every article carries the full seven-part structure', () => {
  for (const section of SECTIONS) {
    for (const article of section.articles) {
      const where = `${section.name}/${article.slug}`
      assert.match(article.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, where)
      assert.ok(article.title.trim().length > 12, `${where}: title is missing or too thin`)
      for (const field of ['answer', 'explanation', 'example', 'establishes', 'boundary'] as const) {
        assert.ok(article[field] && article[field].trim().length > 40, `${where}: ${field} is missing or too thin`)
      }
      assert.ok(article.checks.length >= 3, `${where}: fewer than three checks`)
      assert.ok(article.related.length >= 2, `${where}: fewer than two onward links`)
    }
    // Distinct prose, not one template with the nouns swapped.
    for (const field of ['title', 'answer', 'explanation', 'example', 'boundary'] as const) {
      const distinct = new Set(section.articles.map((article) => article[field])).size
      assert.equal(distinct, section.articles.length, `${section.name}: repeated ${field}`)
    }
  }
})

test('every cited source resolves and records where it was read', () => {
  for (const section of SECTIONS) {
    const cited = new Set<string>()
    for (const article of section.articles) {
      for (const id of article.sources) {
        const source: SourceRecord | undefined = (section.sources as Record<string, SourceRecord>)[id]
        assert.ok(source, `${section.name}/${article.slug}: unknown source id ${id}`)
        assert.ok(source.locator.trim().length > 0, `${id}: no locator`)
        assert.match(source.inspected, ISO_DATE, `${id}: inspection date is not a date`)
        assert.ok(source.claim.trim().length > 0 && source.boundary.trim().length > 0, `${id}: claim or boundary missing`)
        assert.ok(source.rights.trim().length > 0, `${id}: no reuse basis recorded`)
        assert.match(source.url, /^https:\/\//, `${id}: not an https source`)
        cited.add(id)
      }
    }
    // A source listed but never used would be an unearned citation.
    assert.deepEqual([...cited].sort(), Object.keys(section.sources).sort(), `${section.name}: unused source entries`)
  }
})

test('a sourceless article says so rather than implying evidence it lacks', () => {
  for (const section of SECTIONS) {
    for (const article of section.articles.filter((entry) => entry.sources.length === 0)) {
      const prose = `${article.answer} ${article.explanation} ${article.establishes} ${article.boundary}`
      assert.match(prose, /Maha|fixture|calculator|method|proposal/i, `${section.name}/${article.slug}`)
    }
  }
})

test('internal links point at articles that exist', () => {
  for (const section of SECTIONS) {
    const slugs = new Set(section.articles.map((article) => article.slug))
    for (const article of section.articles) {
      for (const slug of article.related) {
        assert.ok(slugs.has(slug), `${section.name}/${article.slug}: related slug ${slug} does not exist`)
        assert.notEqual(slug, article.slug, `${section.name}/${article.slug}: links to itself`)
      }
    }
  }
})

test('cross-section links point at routes that exist in this repo', () => {
  // A cross-link into another section is only honest if that page is real, so
  // resolve each one against the App Router tree rather than trusting the text.
  const resolves = (path: string) => {
    const segments = path.replace(/^\//, '').split('/')
    if (existsSync(new URL(`../app/${segments.join('/')}/page.tsx`, import.meta.url))) return true
    // A deep path may be served by its section's dynamic [slug] route.
    const parent = segments.slice(0, -1).join('/')
    return parent.length > 0 && existsSync(new URL(`../app/${parent}/[slug]/page.tsx`, import.meta.url))
  }
  for (const section of SECTIONS) {
    for (const article of section.articles) {
      for (const link of article.crossLinks ?? []) {
        assert.match(link.path, /^\//, `${section.name}/${article.slug}: ${link.path} is not a site-relative path`)
        assert.ok(resolves(link.path), `${section.name}/${article.slug}: ${link.path} has no route`)
        assert.ok(link.label.trim().length > 0, `${section.name}/${article.slug}: unlabelled cross-link`)
      }
    }
  }
})

test('candidate map: statuses are exhaustive, honest and never claim measured demand', () => {
  for (const section of SECTIONS) {
    assert.ok(section.candidates.length <= 24, `${section.name}: proposed more than the 24-candidate ceiling`)
    assert.equal(new Set(section.candidates.map((candidate) => candidate.slug)).size, section.candidates.length)
    const implemented = section.candidates.filter((candidate) => candidate.status === 'implemented')
    assert.deepEqual(
      implemented.map((candidate) => candidate.slug).sort(),
      section.articles.map((article) => article.slug).sort(),
      `${section.name}: implemented candidates and published articles disagree`,
    )
    for (const candidate of section.candidates) {
      assert.equal(candidate.demand, 'unknown', `${section.name}/${candidate.slug}: demand was not measured`)
      assert.ok(candidate.question.trim() && candidate.audience.trim() && candidate.contribution.trim(), candidate.slug)
      if (candidate.status !== 'implemented') {
        assert.ok(candidate.note && candidate.note.trim().length > 0, `${section.name}/${candidate.slug}: no reason recorded`)
      }
      if (candidate.status === 'duplicative') {
        assert.match(candidate.note ?? '', /\/knowledge\//, `${section.name}/${candidate.slug}: no owning route named`)
      }
    }
  }
})

test('a duplicative candidate names a route that actually owns the subject', () => {
  for (const section of SECTIONS) {
    for (const candidate of section.candidates.filter((entry) => entry.status === 'duplicative')) {
      const owner = (candidate.note ?? '').match(/\/knowledge\/[a-z0-9/-]+/)?.[0]
      assert.ok(owner, `${section.name}/${candidate.slug}`)
      const segments = owner.replace(/^\//, '').split('/')
      const direct = existsSync(new URL(`../app/${segments.join('/')}/page.tsx`, import.meta.url))
      const dynamic = existsSync(new URL(`../app/${segments.slice(0, -1).join('/')}/[slug]/page.tsx`, import.meta.url))
      assert.ok(direct || dynamic, `${section.name}/${candidate.slug}: ${owner} has no route`)
    }
  }
})

test('the two sections do not publish the same slug twice', () => {
  const nano = new Set(NANO_ARTICLES.map((article) => article.slug))
  const overlap = PHYSICAL_AI_ARTICLES.map((article) => article.slug).filter((slug) => nano.has(slug))
  assert.deepEqual(overlap, [], 'a slug published in both sections would be two answers to one question')
})

test('every article is reachable from the homepage through ordinary links', () => {
  // homepage -> /knowledge -> section hub -> article, with no JavaScript and
  // no search step. Each hop is checked against the rendered source.
  const home = read('app/page.tsx') + read('components/Navbar.tsx')
  assert.match(home, /href: '\/knowledge'|href="\/knowledge"/, 'the homepage does not link to /knowledge')

  const index = read('app/knowledge/page.tsx')
  assert.match(index, /NANO_PATH/, '/knowledge does not link the nanotechnology hub')
  assert.match(index, /PHYSICAL_AI_PATH/, '/knowledge does not link the physical AI hub')

  for (const section of SECTIONS) {
    const hub = read(`app${section.path}/page.tsx`)
    // The hub maps over the full article list, so every slug is emitted.
    assert.match(hub, /ARTICLES\.map/, `${section.name}: hub does not list every article`)
    assert.ok(existsSync(new URL(`../app${section.path}/[slug]/page.tsx`, import.meta.url)), `${section.name}: no article route`)
    const route = read(`app${section.path}/[slug]/page.tsx`)
    assert.match(route, /dynamicParams = false/, `${section.name}: article route is not a closed set`)
    assert.match(route, /generateStaticParams/, `${section.name}: article route has no static params`)
  }
})

test('each hub appears in the sitemap with all of its articles', () => {
  const sitemap = read('app/sitemap.ts')
  for (const token of ['NANO_PATH', 'NANO_ARTICLES.map', 'PHYSICAL_AI_PATH', 'PHYSICAL_AI_ARTICLES.map']) {
    assert.ok(sitemap.includes(token), `sitemap is missing ${token}`)
  }
})

test('the robotics section keeps ownership and links here rather than being restated', () => {
  const robotics = read('app/knowledge/robotics/page.tsx')
  assert.match(robotics, /href="\/knowledge\/physical-ai"/, 'robotics does not link physical AI')
  assert.match(robotics, /href="\/knowledge\/nanotechnology"/, 'robotics does not link nanotechnology')

  // Physical AI must defer to robotics on hardware, safety and evidence intake.
  const hub = read(`app${PHYSICAL_AI_PATH}/page.tsx`)
  assert.match(hub, /knowledge\/robotics/, 'physical AI does not point back at robotics')
  const deferred = PHYSICAL_AI_CANDIDATES.filter((candidate) => candidate.status === 'duplicative')
  assert.ok(deferred.length >= 3, 'physical AI claims subjects robotics already owns')
  for (const candidate of deferred) assert.match(candidate.note ?? '', /robotics/i, candidate.slug)
})

test('neither section claims a capability, approval or result it does not have', () => {
  const nanoProse = NANO_ARTICLES.map((a) => `${a.answer} ${a.explanation} ${a.boundary}`).join(' ')
  const physicalProse = PHYSICAL_AI_ARTICLES.map((a) => `${a.answer} ${a.explanation} ${a.boundary}`).join(' ')

  // The section boundaries, asserted where readers will actually meet them.
  const nanoHub = read(`app${NANO_PATH}/page.tsx`)
  const physicalHub = read(`app${PHYSICAL_AI_PATH}/page.tsx`)
  assert.match(nanoHub, /no laborator|synthesis|We run no|manufactur/i)
  assert.match(physicalHub, /operates no robot|no robots|replicated none/i)

  // Regulatory status is not safety, and a reported benchmark is the authors'.
  assert.match(nanoProse, /regulator/i)
  assert.match(physicalProse, /reported|their own/i)
  for (const article of [...NANO_ARTICLES, ...PHYSICAL_AI_ARTICLES]) {
    assert.ok(article.boundary.trim().length > 40, `${article.slug}: boundary is too thin to be a real limit`)
  }
})

test('figures quoted from a source match what that source actually says', () => {
  // Each entry was verified against the source on the date in its record.
  // If someone edits one of these numbers, the edit has to be re-verified
  // rather than absorbed silently.
  const verified: [keyof typeof PHYSICAL_AI_SOURCES | keyof typeof NANO_SOURCES, string[]][] = [
    ['vla', ['7B', '970k', '55B', '16.5', '29 tasks']],
    ['benchmark', ['50 distinct', 'ten training tasks']],
    ['teleoperation', ['six fine manipulation tasks', '80–90%', 'ten minutes']],
    ['rt2', ['6,000']],
    ['storage', ['2 mg/cm²', '5–10 mg/cm²', '99.96%', '500 cycles']],
  ]
  const all: Record<string, { claim: string }> = { ...PHYSICAL_AI_SOURCES, ...NANO_SOURCES }
  for (const [id, figures] of verified) {
    const source = all[id]
    assert.ok(source, `source ${id} was removed; its figures were verified and cannot silently disappear`)
    for (const figure of figures) {
      assert.ok(source.claim.includes(figure), `${id}: the verified figure "${figure}" is no longer in the claim`)
    }
  }
})

test('a reported result is attributed, never stated as fact about the world', () => {
  const all: Record<string, { claim: string; boundary: string; inspected: string }> = { ...PHYSICAL_AI_SOURCES, ...NANO_SOURCES }
  const today = '2026-12-31'
  for (const [id, source] of Object.entries(all)) {
    assert.ok(source.inspected <= today, `${id}: inspected in the future`)
    // Any claim carrying a performance figure must name whose result it is.
    if (/\d+(\.\d+)?\s*(%|percentage points)/.test(source.claim)) {
      assert.match(
        source.claim,
        /report|authors|their|argue|states|gives/i,
        `${id}: a percentage is stated without saying who reported it`,
      )
    }
  }
  // Every article citing a performance figure must also carry a boundary that
  // says the figure is the original authors', not a Maha finding.
  for (const article of PHYSICAL_AI_ARTICLES.filter((a) => /\d+(\.\d+)?\s*(%|percentage points)/.test(a.explanation))) {
    assert.match(article.boundary, /authors|own|report/i, `${article.slug}: figure without an ownership boundary`)
  }
})
