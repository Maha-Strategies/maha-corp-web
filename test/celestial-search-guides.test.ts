import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { CELESTIAL_GUIDE_LIST } from '../lib/celestial-guides.ts'

const root = new URL('../', import.meta.url)

test('celestial method guides are canonical, substantive, and represented in the sitemap', async () => {
  const [sitemap, component] = await Promise.all([
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/CelestialGuidePage.tsx', root), 'utf8'),
  ])
  assert.match(sitemap, /CELESTIAL_GUIDE_LIST/)
  assert.match(component, /TechArticle/)
  assert.match(component, /Interpretive boundary/)

  for (const guide of CELESTIAL_GUIDE_LIST) {
    const route = guide.path.replace(/^\//, '')
    const page = await readFile(new URL(`app/${route}/page.tsx`, root), 'utf8')
    assert.match(page, /alternates: \{ canonical: guide\.path \}/)
    assert.ok(guide.summary.length > 100, `${guide.path} needs a substantive summary`)
    assert.ok(guide.sections.length >= 3, `${guide.path} needs at least three unique sections`)
  }
})

test('the corporate report and every guide are discoverable from public entry points', async () => {
  const [hub, reports, birthOutput, corporateOutput, sitemap] = await Promise.all([
    readFile(new URL('app/knowledge/astrology/page.tsx', root), 'utf8'),
    readFile(new URL('app/reports/celestial/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/birth/BirthForm.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/corporate/CorporateForm.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
  ])
  assert.match(hub, /CELESTIAL_GUIDE_LIST/)
  assert.match(reports, /CELESTIAL_GUIDE_LIST/)
  assert.match(sitemap, /knowledge\/corporate/)
  assert.match(birthOutput, /vimshottari-dasha/)
  assert.match(birthOutput, /tropical-vs-sidereal/)
  assert.match(corporateOutput, /corporate-charts/)
})
