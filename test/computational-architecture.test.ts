import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { architectureArticles, architectureSources, ARCHITECTURE_PATH } from '../lib/computational-architecture.ts'
import { checkProgram, SYNTHETIC_PROGRAM } from '../lib/architecture-program.ts'
test('twelve unique bounded topics with resolvable reading paths and scoped sources', () => {
  assert.equal(architectureArticles.length, 12)
  const slugs = new Set(architectureArticles.map(a => a.slug))
  assert.equal(slugs.size, 12)
  for (const a of architectureArticles) {
    for (const slug of a.related) assert.ok(slugs.has(slug))
    assert.equal(a.checks.length, 3)
    assert.ok(a.example && a.boundary && a.mechanism)
    for (const id of a.sources) assert.ok(architectureSources[id].locator && architectureSources[id].rights)
  }
})
test('program reconciles totals and independently predictable changes', () => {
  const r = checkProgram(SYNTHETIC_PROGRAM)
  assert.deepEqual(r.totals, { gross: 2000, assignable: 1400, support: 600 })
  for (const row of r.rows) assert.ok(Math.abs(row.gross - row.assignable - row.support) < 1e-9)
  const alternate = structuredClone(SYNTHETIC_PROGRAM)
  alternate.floors[0].assignableRatio = 0.8
  assert.equal(checkProgram(alternate).totals.assignable - r.totals.assignable, 100)
  assert.deepEqual(checkProgram(r.inputs), r)
  assert.equal(checkProgram({ ...SYNTHETIC_PROGRAM, unit: 'ft2' }).inputs.unit, 'ft2')
})
test('refuses malformed inputs rather than generating impressive but invalid receipts', () => {
  for (const gross of [0, -1, NaN, Infinity, '100', 1e10]) assert.throws(() => checkProgram({ unit: 'm2', floors: [{ id: 'A', gross, assignableRatio: 0.7 }] }))
  for (const assignableRatio of [-1, 1.01, NaN, null]) assert.throws(() => checkProgram({ unit: 'm2', floors: [{ id: 'A', gross: 1, assignableRatio }] }))
  for (const v of [null, {}, { ...SYNTHETIC_PROGRAM, unit: 'acres' }, { ...SYNTHETIC_PROGRAM, approved: true }, { unit: 'm2', floors: [] }, { unit: 'm2', floors: [SYNTHETIC_PROGRAM.floors[0], SYNTHETIC_PROGRAM.floors[0]] }]) assert.throws(() => checkProgram(v))
})
test('hub, metadata, sitemap and local-only tool preserve publication and privacy boundaries', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  assert.ok(read('app/knowledge/page.tsx').includes(ARCHITECTURE_PATH))
  assert.match(read('app/sitemap.ts'), /architectureArticles.map/)
  const route = read('app/knowledge/computational-architecture/[slug]/page.tsx')
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /notFound\(\)/)
  assert.match(route, /alternates: \{ canonical:/)
  const tool = read('app/knowledge/computational-architecture/ProgramChecker.tsx')
  assert.doesNotMatch(tool, /fetch\(|localStorage|sessionStorage|sendBeacon/)
  assert.match(tool, /role="alert"/)
  for (const path of ['lib/computational-architecture.ts', 'lib/architecture-program.ts']) assert.doesNotMatch(read(path), /551,?000|380,?640|Caldera|docs\/caldera/)
})
