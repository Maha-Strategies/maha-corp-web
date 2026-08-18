import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CALCULATION_REFERENCE_CATEGORIES,
  CALCULATION_REFERENCE_PATH,
  CALCULATION_REFERENCES,
  CALCULATION_REFERENCE_SOURCES,
  calculationReferencePath,
  getCalculationReference,
} from '../lib/celestial-calculation-references.ts'

const root = new URL('../', import.meta.url)

test('the calculation authority collection contains 30–50 unique, substantive contracts', () => {
  assert.ok(CALCULATION_REFERENCES.length >= 30)
  assert.ok(CALCULATION_REFERENCES.length <= 50)
  assert.equal(new Set(CALCULATION_REFERENCES.map((entry) => entry.slug)).size, CALCULATION_REFERENCES.length)
  assert.deepEqual(new Set(CALCULATION_REFERENCES.map((entry) => entry.category)), new Set(CALCULATION_REFERENCE_CATEGORIES))

  const sourceIds = new Set(CALCULATION_REFERENCE_SOURCES.map((source) => source.id))
  for (const entry of CALCULATION_REFERENCES) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(entry.description.length >= 80, `${entry.slug} needs a substantive description`)
    assert.ok(entry.definition.length >= 80, `${entry.slug} needs a substantive definition`)
    assert.ok(entry.procedure.length >= 90, `${entry.slug} needs a reproducible procedure`)
    assert.ok(entry.inputs.length >= 3, `${entry.slug} needs at least three declared inputs`)
    assert.ok(entry.recordedConvention.length >= 80, `${entry.slug} needs a declared Maha convention`)
    assert.ok(entry.uncertainty.length >= 80, `${entry.slug} needs uncertainty treatment`)
    assert.ok(entry.doesNotEstablish.length >= 50, `${entry.slug} needs an epistemic boundary`)
    assert.ok(entry.sourceIds.length >= 1, `${entry.slug} needs at least one source`)
    assert.ok(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.slug} has an unregistered source`)
    assert.ok(entry.relatedSlugs.every((slug) => getCalculationReference(slug)), `${entry.slug} has an unknown related reference`)
    assert.equal(calculationReferencePath(entry), `${CALCULATION_REFERENCE_PATH}/${entry.slug}`)
  }
})

test('calculation references are statically rendered, canonical, linked, and included in the sitemap', async () => {
  const [route, index, component, hub, sitemap, registry] = await Promise.all([
    readFile(new URL('app/knowledge/astrology/calculations/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/calculations/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/calculations/CalculationReferencePage.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/page.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/calculations/registry/route.ts', root), 'utf8'),
  ])

  assert.match(route, /generateStaticParams/)
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(index, /CALCULATION_REFERENCE_CATEGORIES/)
  assert.match(component, /Authoritative references/)
  assert.match(component, /What this does not establish/)
  assert.match(component, /TechArticle/)
  assert.match(hub, /CALCULATION_REFERENCE_PATH/)
  assert.match(sitemap, /CALCULATION_REFERENCES/)
  assert.match(registry, /celestial-calculation-references\/1\.0/)
})
