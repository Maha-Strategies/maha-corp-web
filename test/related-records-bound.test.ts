import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  MAX_RELATED_RECORDS, citationCounts, deriveRelatedRoutes, relatedRoutesFor,
  type LinkablePage,
} from '../lib/uplift/related-records.ts'

const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))
const audit = JSON.parse(readFileSync('content/evidence-batch-9/depth-audit.json', 'utf8'))

const cluster = (n: number, sourceId = 'shared'): LinkablePage[] =>
  Array.from({ length: n }, (_, i) => ({
    route: `/k/p${String(i).padStart(4, '0')}`, sources: [{ id: sourceId }], relatedRoutes: [],
  }))

test('fan-out is bounded however large the co-citation cluster grows', () => {
  for (const n of [18, 36, 72, 144, 300]) {
    const pages = cluster(n)
    deriveRelatedRoutes(pages)
    const worst = Math.max(...pages.map((p) => p.relatedRoutes.length))
    assert.ok(worst <= MAX_RELATED_RECORDS,
      `a cluster of ${n} put ${worst} links on a page, above the bound of ${MAX_RELATED_RECORDS}`)
  }
})

test('total link slots grow linearly, not quadratically', () => {
  const slots = (n: number) => {
    const pages = cluster(n)
    deriveRelatedRoutes(pages)
    return pages.reduce((a, p) => a + p.relatedRoutes.length, 0)
  }
  const small = slots(50)
  const double = slots(100)
  // Quadratic would be ~4x. Linear is ~2x. Allow slack, but nothing near 4.
  assert.ok(double < small * 2.5,
    `doubling the cluster multiplied slots by ${(double / small).toFixed(1)}x, which is not linear`)
  assert.ok(slots(300) <= 300 * MAX_RELATED_RECORDS)
})

test('a link through a rare source outranks links through a common one', () => {
  const pages: LinkablePage[] = [
    { route: '/k/target', sources: [{ id: 'broad' }, { id: 'narrow' }], relatedRoutes: [] },
    { route: '/k/closely-related', sources: [{ id: 'narrow' }], relatedRoutes: [] },
    ...Array.from({ length: 20 }, (_, i) => ({
      route: `/k/broad${String(i).padStart(2, '0')}`, sources: [{ id: 'broad' }], relatedRoutes: [],
    })),
  ]
  const counts = citationCounts(pages)
  const links = relatedRoutesFor(pages[0], pages, counts)
  assert.equal(links.length, MAX_RELATED_RECORDS)
  assert.equal(links[0], '/k/closely-related',
    'the page sharing the rare source must survive the bound ahead of twenty sharing a common one')
})

test('the bound never pushes a page under the substantial floor', () => {
  // Two typed links are required for substantiality. A cap must not cause that.
  for (const page of compiled.pages) {
    const n = (page.after?.relatedRoutes ?? []).length
    if (n === 0) continue
    assert.ok(n >= 2 || n === 1, `${page.route} has ${n} links`)
  }
  const withLinks = compiled.pages.filter((p: { after?: { relatedRoutes?: string[] } }) =>
    (p.after?.relatedRoutes ?? []).length > 0)
  assert.equal(withLinks.filter((p: { after: { relatedRoutes: string[] } }) => p.after.relatedRoutes.length < 2).length, 0,
    'no page with derived links may sit below the two-link floor')
})

test('an explicit relationship outranks a derived one', () => {
  const pages: LinkablePage[] = [
    { route: '/k/a', sources: [{ id: 's' }], relatedRoutes: ['/k/declared'] },
    { route: '/k/b', sources: [{ id: 's' }], relatedRoutes: [] },
  ]
  const counts = citationCounts(pages)
  assert.deepEqual(relatedRoutesFor(pages[0], pages, counts), ['/k/declared'],
    'a declared related route must not be replaced by co-citation')
})

test('derivation is deterministic', () => {
  const once = cluster(40); deriveRelatedRoutes(once)
  const twice = cluster(40); deriveRelatedRoutes(twice)
  assert.deepEqual(once.map((p) => p.relatedRoutes), twice.map((p) => p.relatedRoutes))
})

test('the real corpus respects the bound', () => {
  const counts = compiled.pages.map((p: { after?: { relatedRoutes?: string[] } }) =>
    (p.after?.relatedRoutes ?? []).length)
  const max = Math.max(...counts)
  assert.ok(max <= MAX_RELATED_RECORDS, `a real page carries ${max} links`)
  assert.ok(counts.filter((n: number) => n > 0).length > 100, 'the corpus must still be linked')
})

test('bounding changed no page depth state', () => {
  // The audit counts typed links towards substantiality, so a bound that cost a
  // page its status would be a regression dressed as a fix.
  assert.equal(audit.substantialAndEvidenceBacked, 31)
  assert.equal(audit.depthDistribution['structurally-substantial-but-unsupported'], 84)
  assert.equal(Object.values(audit.depthDistribution as Record<string, number>).reduce((a, b) => a + b, 0), 167)
})

test('every derived link still points at a route that exists', () => {
  const routes = new Set(compiled.pages.map((p: { route: string }) => p.route))
  for (const page of compiled.pages) {
    for (const related of page.after?.relatedRoutes ?? []) {
      assert.ok(routes.has(related), `${page.route} links to ${related}, which does not exist`)
      assert.notEqual(related, page.route, `${page.route} links to itself`)
    }
  }
})
