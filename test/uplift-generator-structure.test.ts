import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { KNOWLEDGE_ARTICLES } from '../lib/knowledge-data.ts'
import { KNOWLEDGE_SUPPLIERS } from '../lib/knowledge-process-profiles.ts'
import { PROCESS_ID_TO_SLUG, processRoute } from '../lib/uplift/process-routes.ts'
import { VENDOR_AUTHORED_SOURCES, isVendorAuthored, vendorBackedSupplierRoutes } from '../lib/uplift/vendor-authorship.ts'
import { INTAKE_COUNTS, buildAttestations, reuseByRoute, routeScopedByRoute } from '../lib/uplift/evidence-intake.ts'

const generator = readFileSync('scripts/generate-legacy-uplift.ts', 'utf8')
const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))

test('there is exactly one vendor-authored source list', () => {
  // Two identical sets four hundred lines apart is what let a vendor source be
  // added to one and not the other. The generator must not define its own.
  assert.ok(!/VENDOR_AUTHORED\w*\s*=\s*new Set/.test(generator),
    'the generator declares a vendor set of its own; import the shared one instead')
  assert.ok(VENDOR_AUTHORED_SOURCES.size >= 4)
  assert.equal(isVendorAuthored('advantest-products-overview'), true)
  assert.equal(isVendorAuthored('neurobench-2304-04640'), false)
})

test('a vendor-backed page is derived from its sources, not a hardcoded route map', () => {
  assert.ok(!/compiledRoutesFor/.test(generator), 'the hardcoded source-to-route map is gone')
  assert.ok(!/'\/knowledge\/suppliers\/asml'\s*\]/.test(generator), 'no route literal list remains')
  const routes = vendorBackedSupplierRoutes([
    { route: '/knowledge/suppliers/acme', sources: [{ id: 'asml-lithography' }] },
    { route: '/knowledge/suppliers/clean', sources: [{ id: 'neurobench-2304-04640' }] },
    // Scoped to suppliers, so an equipment page citing a vendor is not captured.
    { route: '/knowledge/equipment/thing', sources: [{ id: 'asml-lithography' }] },
  ])
  assert.deepEqual([...routes], ['/knowledge/suppliers/acme'])
})

test('a page cannot lose the first-party label by gaining vendor documentation', () => {
  const before = vendorBackedSupplierRoutes([{ route: '/knowledge/suppliers/x', sources: [{ id: 'asml-lithography' }] }])
  const after = vendorBackedSupplierRoutes([{
    route: '/knowledge/suppliers/x',
    sources: [{ id: 'asml-lithography' }, { id: 'advantest-products-overview' }],
  }])
  assert.ok(before.has('/knowledge/suppliers/x'))
  assert.ok(after.has('/knowledge/suppliers/x'), 'more vendor documentation must not drop the label')
})

test('every process identifier resolves to an article that exists', () => {
  const slugs = new Set(KNOWLEDGE_ARTICLES.filter((a) => a.kind === 'process').map((a) => a.slug))
  for (const [id, slug] of Object.entries(PROCESS_ID_TO_SLUG)) {
    assert.ok(slugs.has(slug), `${id} maps to ${slug}, which is not a process article`)
  }
  // An unknown identifier resolves to no link rather than to a broken one.
  assert.deepEqual(processRoute('process-does-not-exist'), [])
})

test('every declared supplier process identifier has a mapping', () => {
  const declared = new Set(KNOWLEDGE_SUPPLIERS.flatMap((s) => s.processIds))
  for (const id of declared) {
    assert.ok(id in PROCESS_ID_TO_SLUG, `${id} is declared by a supplier but has no route mapping`)
  }
})

test('no generated internal route is a 404 shape', () => {
  const routes = new Set(compiled.pages.map((p: { route: string }) => p.route))
  for (const page of compiled.pages) {
    for (const related of page.after?.relatedRoutes ?? []) {
      assert.ok(routes.has(related), `${page.route} links to ${related}, which does not exist`)
      assert.ok(!/\/knowledge\/processes\/process-/.test(related), 'the double-prefix route shape is back')
    }
  }
})

test('registering a batch in intake is a single edit that reaches the compiler', () => {
  // The old failure was a batch imported in one place and forgotten in a second
  // spread further down, which was a silent no-op. Intake is now the one place.
  const intake = readFileSync('lib/uplift/evidence-intake.ts', 'utf8')
  const batchImports = (intake.match(/^import batch\d+ from/gm) ?? []).length
  assert.ok(batchImports >= 6, `expected the batches to be registered in intake, found ${batchImports}`)
  assert.ok(!/^import batch\d+ from/m.test(generator), 'the generator still imports a batch directly')

  const attestations = buildAttestations()
  // Batch 12's NeuroBench must be present, which is what proves a registered
  // batch actually reaches the attestation map.
  assert.ok('neurobench-2304-04640' in attestations, 'a registered batch did not reach the compiler')
  assert.ok(INTAKE_COUNTS.claimScopedSources > 0 && INTAKE_COUNTS.routeScopedSources > 0)
})

test('vendor-authored sources are excluded from the legacy attestation layer', () => {
  const attestations = buildAttestations()
  for (const id of VENDOR_AUTHORED_SOURCES) {
    // A vendor source may still appear via a later layer, but never with the
    // legacy "recorded at inspection" basis that confers independent support.
    if (id in attestations) {
      assert.notEqual(attestations[id].identityBasis, 'recorded at inspection',
        `${id} is conferring independent support through the legacy layer`)
    }
  }
})

test('claim-scoped support names a route per passage', () => {
  assert.ok(reuseByRoute.size > 0)
  for (const [route, entries] of reuseByRoute) {
    assert.match(route, /^\/knowledge\//)
    for (const e of entries) {
      assert.ok(e.supportingPassage.length > 20, `${route} has a passage too short to be one`)
      assert.ok(e.exactLocator.length > 0, `${route} has a source with no locator`)
    }
  }
  assert.ok(routeScopedByRoute.size > 0)
})

test('the refactor preserves output byte for byte', () => {
  const before = readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8')
  const reportBefore = readFileSync('content/legacy-uplift/uplift-report.json', 'utf8')
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/generate-legacy-uplift.ts'], { stdio: 'ignore' })
  assert.equal(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'), before)
  assert.equal(readFileSync('content/legacy-uplift/uplift-report.json', 'utf8'), reportBefore)
})

test('the generator is orchestration, not plumbing', () => {
  const lines = generator.split('\n').length
  assert.ok(lines < 460, `the generator has grown back to ${lines} lines; extract the new part`)
  // The shapes it should no longer contain.
  for (const gone of ['Object.fromEntries(inspectedSources', 'batch1ByRoute', 'batch4Flattened', 'attestationsByPage']) {
    assert.ok(!generator.includes(gone), `${gone} is back in the generator`)
  }
})
