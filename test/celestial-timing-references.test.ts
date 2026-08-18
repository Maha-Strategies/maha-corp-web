import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  TIMING_REFERENCE_CATEGORIES,
  TIMING_REFERENCE_PATH,
  TIMING_REFERENCES,
  TIMING_REFERENCE_SOURCES,
  getTimingReference,
  timingReferencePath,
} from '../lib/celestial-timing-references.ts'
import { VIMSHOTTARI_LORDS, VIMSHOTTARI_YEARS } from '../lib/natal-timing.ts'

const root = new URL('../', import.meta.url)

test('the timing library contains 25–75 unique, substantive reference pages', () => {
  assert.equal(TIMING_REFERENCES.length, 36)
  assert.ok(TIMING_REFERENCES.length >= 25 && TIMING_REFERENCES.length <= 75)
  assert.equal(new Set(TIMING_REFERENCES.map((entry) => entry.slug)).size, TIMING_REFERENCES.length)
  assert.deepEqual(new Set(TIMING_REFERENCES.map((entry) => entry.category)), new Set(TIMING_REFERENCE_CATEGORIES))

  const sourceIds = new Set(TIMING_REFERENCE_SOURCES.map((source) => source.id))
  for (const entry of TIMING_REFERENCES) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(entry.description.length >= 100, `${entry.slug} needs a substantive description`)
    assert.ok(entry.definition.length >= 120, `${entry.slug} needs a substantive event definition`)
    assert.ok(entry.calculation.length >= 180, `${entry.slug} needs a reproducible calculation`)
    assert.ok(entry.requiredInputs.length >= 4, `${entry.slug} needs four declared inputs`)
    assert.ok(entry.mahaConvention.length >= 150, `${entry.slug} needs a declared convention`)
    assert.ok(entry.uncertainty.length >= 140, `${entry.slug} needs uncertainty treatment`)
    assert.ok(entry.reportUse.length >= 130, `${entry.slug} needs a report-use boundary`)
    assert.ok(entry.doesNotEstablish.length >= 100, `${entry.slug} needs an epistemic boundary`)
    assert.ok(entry.sourceIds.length >= 1)
    assert.ok(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.slug} cites an unknown source`)
    assert.ok(entry.relatedSlugs.every((slug) => getTimingReference(slug)), `${entry.slug} has an unknown related page`)
    assert.equal(timingReferencePath(entry), `${TIMING_REFERENCE_PATH}/${entry.slug}`)
  }
})

test('the finite collection covers the intended event families without daily permutations', () => {
  const count = (category: typeof TIMING_REFERENCE_CATEGORIES[number]) => TIMING_REFERENCES.filter((entry) => entry.category === category).length
  assert.equal(count('Ingresses'), 10)
  assert.equal(count('Stations'), 8)
  assert.equal(count('Lunations'), 6)
  assert.equal(count('Vimśottarī daśā'), 12)
  assert.equal(TIMING_REFERENCES.some((entry) => /\d{4}-\d{2}-\d{2}/.test(entry.slug)), false)
})

test('Vimshottari pages cover every lord and preserve the 120-year arithmetic', () => {
  assert.equal(Object.values(VIMSHOTTARI_YEARS).reduce((sum, years) => sum + years, 0), 120)
  for (const lord of VIMSHOTTARI_LORDS) {
    const entry = getTimingReference(`vimshottari-${lord.toLowerCase()}-dasha-reference`)
    assert.ok(entry, `${lord} needs a reference page`)
    assert.match(entry.definition, new RegExp(`${VIMSHOTTARI_YEARS[lord]} years`))
    assert.equal(entry.implementationStatus, 'production-derived')
    assert.match(entry.doesNotEstablish, /does not establish/)
  }
})

test('timing references are statically rendered, canonical, linked, registered, and in the sitemap', async () => {
  const [route, index, component, hub, birthOutput, sitemap, registry] = await Promise.all([
    readFile(new URL('app/knowledge/astrology/timing/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/timing/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/timing/TimingReferencePage.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/birth/BirthForm.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/timing/registry/route.ts', root), 'utf8'),
  ])
  assert.match(route, /generateStaticParams/)
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(index, /TIMING_REFERENCE_CATEGORIES/)
  assert.match(component, /TechArticle/)
  assert.match(component, /What this does not establish/)
  assert.match(hub, /TIMING_REFERENCE_PATH/)
  assert.match(birthOutput, /knowledge\/astrology\/timing/)
  assert.match(sitemap, /TIMING_REFERENCES/)
  assert.match(registry, /celestial-timing-references\/1\.0/)
})

