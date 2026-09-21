import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { policyCandidateMap, POLICY_AREAS, POLICY_ISSUES, POLICY_METHODS, POLICY_POSITIONS } from '../lib/policy-expansion-map.ts'
import { POLICY_DRAFTS, policyDraft } from '../lib/policy-expansion-drafts.ts'
import { POLICY_SOURCES, policySource } from '../lib/policy-expansion-sources.ts'
import { POLICY_DRAFT_ROBOTS, policyDraftsAvailable, type PolicyDraft } from '../lib/policy-expansion-types.ts'
import { filterPolicyEntries } from '../lib/policy-expansion-search.ts'
import { validatePolicyDraft } from '../lib/policy-expansion-validation.ts'
import { policyArtifacts } from '../scripts/policy-expansion-artifacts.ts'

test('freeze has exactly the authorized 24/96/4/4 slots, not 128 new routes', () => {
  const map = policyCandidateMap()
  assert.deepEqual(map.counts, { areas: 4, issues: 24, questions: 96, methodologies: 4, planningSlots: 128, reusedQuestionUrls: 5, localAnswerDrafts: 12 })
  assert.equal(POLICY_AREAS.length, 4)
  assert.equal(POLICY_ISSUES.length, 24)
  assert.equal(map.questions.length, 96)
  for (const [area, count] of [['domestic', 12], ['foreign', 4], ['geopolitics', 4], ['technology', 4]] as const) assert.equal(POLICY_ISSUES.filter(i => i.area === area).length, count)
  const rows = [...map.areas, ...map.issues, ...map.questions, ...map.methodologies]
  assert.equal(new Set(rows.map(r => r.proposedUrl)).size, 128)
  assert.equal(new Set(map.questions.map(r => r.readerQuestion)).size, 96)
  assert.ok(rows.every(r => r.searchDemand === 'unknown' && r.proposedOwner === 'www.mahastrategies.com'))
  assert.equal(map.publicationApproved, false)
})

test('dependency DAG resolves to issue/question/method IDs or real technical canonicals', () => {
  const map = policyCandidateMap()
  const manifest = JSON.parse(fs.readFileSync('content/federation/implementations/maha-policy-pages-v2.json', 'utf8'))
  const nodes = new Map<string, string[]>([
    ...map.areas.map(a => [a.id, a.dependencies] as [string, string[]]),
    ...map.issues.map(i => [i.id, i.dependencies] as [string, string[]]),
    ...map.questions.map(q => [q.id, q.dependencies] as [string, string[]]),
    ...map.methodologies.map(m => [m.proposedUrl, m.dependencies] as [string, string[]]),
  ])
  const external = new Set(manifest.pages.map((p: { canonicalUrl: string }) => p.canonicalUrl))
  function visit(id: string, stack: string[]) {
    if (external.has(id)) return
    assert.ok(nodes.has(id), `missing dependency ${id}`)
    assert.ok(!stack.includes(id), `cycle ${id}`)
    for (const dep of nodes.get(id)!) visit(dep, [...stack, id])
  }
  for (const id of nodes.keys()) visit(id, [])
})

test('five existing proposals are reused without asserting personal approval', () => {
  const map = policyCandidateMap()
  const published = POLICY_POSITIONS.filter(p => p.kind === 'existing-published-proposal')
  assert.equal(published.length, 5)
  for (const p of published) {
    assert.ok(map.questions.some(q => q.existingEquivalent === p.provenance && q.treatment === 'revise-existing'))
    assert.ok(fs.readFileSync('app/policy/[slug]/page.tsx', 'utf8').includes(p.id))
    assert.ok(p.locator && p.gap && p.approval)
  }
  assert.equal(POLICY_POSITIONS.filter(p => p.kind === 'value').length, 2)
})

test('all twelve briefs are mapped and have inspectable baseline, costs, authority and failures', () => {
  assert.equal(POLICY_DRAFTS.length, 12)
  for (const d of POLICY_DRAFTS) {
    assert.ok(validatePolicyDraft(d))
    assert.ok(policyCandidateMap().questions.some(q => q.readerQuestion === d.question && q.proposedUrl.endsWith(d.slug)))
    assert.ok(d.answer.split(/\s+/).length >= 70 && d.answer.split(/\s+/).length <= 150, `${d.slug}: approximate 100-word answer`)
    assert.ok(d.costs.assumptions && d.costs.funding && d.costs.distribution && d.costs.uncertainty)
    for (const slug of d.related) assert.ok(policyDraft(slug), `missing related ${slug}`)
    assert.doesNotMatch(JSON.stringify(d), /\b(I will|we will|as your president|as a presidential candidate)\b/i)
  }
  assert.equal(POLICY_DRAFTS.filter(d => d.readiness === 'revise-current-baseline').length, 4)
  assert.equal(policyDraft('toString'), undefined)
})

test('all 15 source packets name exact locators, versions, scope and rights limits', () => {
  assert.equal(POLICY_SOURCES.length, 15)
  assert.equal(new Set(POLICY_SOURCES.map(s => s.id)).size, 15)
  for (const s of POLICY_SOURCES) {
    assert.equal(new URL(s.url).protocol, 'https:')
    for (const value of [s.locator, s.supports, s.limitation, s.rights]) assert.ok(value.length > 20)
    assert.match(s.version, /\b20\d{2}\b/, 'Version must identify a year; a month/year is valid without padding.')
    assert.equal(s.depth, 'section')
  }
  assert.match(policySource('crs-china-historical').version, /2023/)
  assert.match(policySource('crs-china-historical').limitation, /cannot establish current/)
  assert.throws(() => policySource('made-up-source'), /unknown-policy-source/)
})

test('mutation: evidence and authority cannot lose their cited source', () => {
  for (const kind of ['current-law', 'empirical-evidence', 'source-description', 'forecast'] as const) {
    const d = structuredClone(POLICY_DRAFTS[0]); d.baseline[0] = { kind, text: 'A material factual assertion', sources: [] }
    assert.throws(() => validatePolicyDraft(d), /unsupported-baseline/)
  }
  const d = structuredClone(POLICY_DRAFTS[0]); d.authority[0] = { actor: 'Government', role: 'Act', status: 'source-bounded', sources: [] }
  assert.throws(() => validatePolicyDraft(d), /unsupported-authority/)
  const missing = structuredClone(POLICY_DRAFTS[0]); missing.sources = []
  assert.throws(() => validatePolicyDraft(missing), /unrendered-source/)
})

test('mutation: no fabricated approval or independent cost score', () => {
  const approved = { ...POLICY_DRAFTS[0], status: 'personally approved' } as unknown as PolicyDraft
  assert.throws(() => validatePolicyDraft(approved), /unapproved-position/)
  const scored = { ...POLICY_DRAFTS[0], costs: { ...POLICY_DRAFTS[0].costs, status: 'independently-scored' } } as unknown as PolicyDraft
  assert.throws(() => validatePolicyDraft(scored), /missing-cost-review/)
})

test('search handles case, whitespace, accent normalization, combined terms, filters and no result', () => {
  const entries = [{ title: 'Housing affordability', description: 'Costs and authority', href: '/one', area: 'domestic', label: 'Draft option' }, { title: 'AI accountability', description: 'Review', href: '/two', area: 'technology', label: 'Draft option' }]
  assert.equal(filterPolicyEntries(entries, '  HOUSING   costs ', 'all').length, 1)
  assert.equal(filterPolicyEntries(entries, 'hóusing', 'all').length, 1)
  assert.equal(filterPolicyEntries(entries, '', 'all').length, 2)
  assert.equal(filterPolicyEntries(entries, '', 'technology').length, 1)
  assert.equal(filterPolicyEntries(entries, 'housing', 'technology').length, 0)
  assert.equal(filterPolicyEntries(entries, 'unresearched geopolitics', 'all').length, 0)
})

test('unpublished drafts refuse every environment except local development', () => {
  // Narrowed on 2026-09-20, when eight options briefs were published as a
  // library. The environment predicate itself is unchanged and still refuses
  // everything but development; what changed is that publication no longer
  // depends on it. The four drafts on evidence holds are still governed by it.
  for (const env of [undefined, '', 'test', 'production', 'preview', 'staging']) assert.equal(policyDraftsAvailable(env), false)
  assert.equal(policyDraftsAvailable('development'), true)
  assert.deepEqual(POLICY_DRAFT_ROBOTS, { index: false, follow: false })

  // The sitemap may now list published briefs, and must never list a held one.
  const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
  assert.match(sitemap, /policyDraftPublished/, 'the sitemap must filter on publication, not list all drafts')
  for (const held of ['borders-asylum-immigration', 'crime-civil-liberties', 'use-of-military-force', 'china-competition-cooperation']) {
    assert.ok(!sitemap.includes(held), `${held} must never be advertised for indexing`)
  }
})

test('client search does not transmit, persist or profile the reader', () => {
  const source = fs.readFileSync('components/policy/PolicyQuestionSearch.tsx', 'utf8') + fs.readFileSync('lib/policy-expansion-search.ts', 'utf8')
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|document.cookie|sendBeacon|analytics|router.push|searchParams|policy-expansion-sources/)
  for (const label of ['htmlFor="policy-query"', 'htmlFor="policy-area"', 'aria-live="polite"', 'No matching content yet', '<noscript>']) assert.ok(source.includes(label))
})

test('double regeneration matches frozen artifacts and the map digest', () => {
  const first = policyArtifacts(); const second = policyArtifacts()
  assert.deepEqual(first, second)
  for (const [name, body] of Object.entries(first)) assert.equal(fs.readFileSync(`content/policy-expansion/v1/${name}`, 'utf8'), JSON.stringify(body, null, 2) + '\n')
  const { freezeDigest, ...body } = first['candidate-map.json']
  assert.equal(freezeDigest, createHash('sha256').update(JSON.stringify(body)).digest('hex'))
  assert.ok(first['inventory.json'].related.every(r => r.explicitPageFile))
  assert.equal(first['readiness.json'].counts.publicationApproved, 0)
  assert.equal(POLICY_METHODS.length, 4)
})
