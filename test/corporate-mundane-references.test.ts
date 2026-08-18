import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CORPORATE_MUNDANE_PATH,
  CORPORATE_MUNDANE_REFERENCES,
  CORPORATE_MUNDANE_SOURCES,
  corporateMundaneReferencePath,
  getCorporateMundaneReference,
} from '../lib/corporate-mundane-references.ts'

const root = new URL('../', import.meta.url)

test('the corporate and mundane library contains 30 unique, substantive pages', () => {
  assert.equal(CORPORATE_MUNDANE_REFERENCES.length, 30)
  assert.ok(CORPORATE_MUNDANE_REFERENCES.length >= 20 && CORPORATE_MUNDANE_REFERENCES.length <= 50)
  assert.equal(new Set(CORPORATE_MUNDANE_REFERENCES.map((entry) => entry.slug)).size, CORPORATE_MUNDANE_REFERENCES.length)
  assert.equal(CORPORATE_MUNDANE_REFERENCES.filter((entry) => entry.kind === 'methodology').length, 15)
  assert.equal(CORPORATE_MUNDANE_REFERENCES.filter((entry) => entry.kind === 'sanitized-case-study').length, 15)

  const sourceIds = new Set(CORPORATE_MUNDANE_SOURCES.map((source) => source.id))
  for (const entry of CORPORATE_MUNDANE_REFERENCES) {
    assert.match(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    assert.ok(entry.description.length >= 80, `${entry.slug} needs a substantive description`)
    assert.ok(entry.question.length >= 40, `${entry.slug} needs a governed question`)
    assert.ok(entry.method.length >= 120, `${entry.slug} needs a reproducible method`)
    assert.ok(entry.evidenceRequired.length >= 4, `${entry.slug} needs four evidence requirements`)
    assert.ok(entry.decisionRule.length >= 60, `${entry.slug} needs a decision rule`)
    assert.ok(entry.sanitizedExample.length >= 60, `${entry.slug} needs a bounded example`)
    assert.ok(entry.sanitization.length >= 180, `${entry.slug} needs a sanitization disclosure`)
    assert.ok(entry.limitations.length >= 60, `${entry.slug} needs limitations`)
    assert.match(entry.doesNotEstablish, /does not establish/)
    assert.equal(entry.empiricalStatus, 'not-evidence-of-predictive-skill')
    assert.ok(entry.sourceIds.every((id) => sourceIds.has(id)), `${entry.slug} cites an unknown source`)
    assert.ok(entry.relatedSlugs.every((slug) => getCorporateMundaneReference(slug)), `${entry.slug} has an unknown related page`)
    assert.equal(corporateMundaneReferencePath(entry), `${CORPORATE_MUNDANE_PATH}/${entry.slug}`)
  }
})

test('sanitized cases cannot be mistaken for named clients or outcome evidence', () => {
  const cases = CORPORATE_MUNDANE_REFERENCES.filter((entry) => entry.kind === 'sanitized-case-study')
  for (const entry of cases) {
    assert.match(entry.title, /^Sanitized case study:/)
    assert.match(entry.sanitization, /not a claimed client result/)
    assert.match(entry.sanitization, /no organization name/)
    assert.doesNotMatch(entry.slug, /\d{4}/)
  }
})

test('the methodology covers organization events, uncertainty, evidence, frames, and prospective tests', () => {
  const required = [
    'organization-event-taxonomy', 'legal-formation-event-selection', 'first-commercial-transaction-method',
    'first-deployment-method', 'public-launch-method', 'merger-acquisition-event-method',
    'event-time-confidence-method', 'date-only-stability-audit', 'event-location-policy',
    'jurisdiction-versus-event-location', 'evidence-attachment-fingerprinting',
    'civil-time-resolution-for-organizations', 'tropical-sidereal-corporate-comparison',
    'organization-house-stability-policy', 'corporate-outcome-preregistration',
  ]
  assert.ok(required.every((slug) => getCorporateMundaneReference(slug)), 'a required methodology page is missing')
})

test('corporate references are static, canonical, linked, registered, and in the sitemap', async () => {
  const [route, index, component, hub, corporateOutput, sitemap, registry] = await Promise.all([
    readFile(new URL('app/knowledge/astrology/corporate-mundane/[slug]/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/corporate-mundane/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/corporate-mundane/CorporateMundaneReferencePage.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/page.tsx', root), 'utf8'),
    readFile(new URL('app/knowledge/corporate/CorporateForm.tsx', root), 'utf8'),
    readFile(new URL('app/sitemap.ts', root), 'utf8'),
    readFile(new URL('app/knowledge/astrology/corporate-mundane/registry/route.ts', root), 'utf8'),
  ])
  assert.match(route, /generateStaticParams/)
  assert.match(route, /dynamicParams = false/)
  assert.match(route, /alternates: \{ canonical: path \}/)
  assert.match(index, /Sanitized case studies/)
  assert.match(component, /TechArticle/)
  assert.match(component, /not a client outcome/)
  assert.match(component, /What this does not establish/)
  assert.match(hub, /CORPORATE_MUNDANE_PATH/)
  assert.match(corporateOutput, /knowledge\/astrology\/corporate-mundane/)
  assert.match(sitemap, /CORPORATE_MUNDANE_REFERENCES/)
  assert.match(registry, /corporate-mundane-references\/1\.0/)
})
