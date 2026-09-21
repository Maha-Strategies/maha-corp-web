import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CALDERA_CLARIFICATIONS,
  CALDERA_NOT_ESTABLISHED,
  CALDERA_OPEN_QUESTIONS,
  CALDERA_PATH,
  CALDERA_SCALE,
  CALDERA_STATUS_LABEL,
  CALDERA_STRATA,
} from '../lib/caldera-concept.ts'

/**
 * This page describes a building that does not exist, on land nobody owns,
 * with no funding and no approvals. The risk is not that it renders wrongly;
 * it is that someone later trims the qualifications and leaves a promotional
 * page behind. These tests guard the qualifications specifically.
 */

const page = readFileSync(new URL('../app/caldera/page.tsx', import.meta.url), 'utf8')

test('the required status label is present and rendered, not merely defined', () => {
  assert.match(CALDERA_STATUS_LABEL, /site, funding, approvals and schedule not established/i)
  // Twice on the page by design: once at the top, once in the closing note.
  assert.ok(page.split('CALDERA_STATUS_LABEL').length - 1 >= 2, 'the label must appear at the top and the foot of the page')
})

test('the page states what has not happened, including the six load-bearing absences', () => {
  const joined = CALDERA_NOT_ESTABLISHED.join(' ').toLowerCase()
  for (const [subject, pattern] of [
    ['site', /no site has been selected/],
    ['advisers', /no architect, engineer or development adviser/],
    ['budget', /no budget, financing or construction has been approved/],
    ['approvals', /no land-use approval/],
    ['schedule', /no delivery date/],
    ['securities', /offering of securities/],
  ] as const) {
    assert.match(joined, pattern, `the absence of ${subject} must be stated`)
  }
  assert.ok(page.includes('CALDERA_NOT_ESTABLISHED'), 'the list must actually render')
})

test('every stratum reserves its unknowns rather than implying a settled programme', () => {
  assert.equal(CALDERA_STRATA.length, 4)
  for (const stratum of CALDERA_STRATA) {
    assert.ok(stratum.intent.length > 60, `${stratum.name}: intent too thin`)
    assert.ok(stratum.reserved.length > 60, `${stratum.name}: nothing reserved for future design`)
  }
  // The floor numbers are a sketch, and the page has to say so.
  assert.match(page, /not an approved space schedule/i)
})

test('the scale study is never presented as a measurement or an approval', () => {
  assert.equal(CALDERA_SCALE.aboveGradeGsf, 551_000)
  assert.equal(CALDERA_SCALE.publicStrataGsf, 156_000)
  assert.match(CALDERA_SCALE.caveat, /not a demonstrated occupancy requirement|not a professional design/i)
  assert.match(page, /cannot establish a size or a price/i)
})

test('terms that would be misread as claims are corrected on the page', () => {
  const terms = CALDERA_CLARIFICATIONS.map((entry) => entry.term.toLowerCase()).join(' ')
  for (const term of ['self-sovereign', 'biological defense labs', 'low-electromagnetic', '2035']) {
    assert.ok(terms.includes(term.toLowerCase()), `${term} must be explained rather than repeated unqualified`)
  }
  const readings = CALDERA_CLARIFICATIONS.map((entry) => entry.reading).join(' ')
  assert.match(readings, /does not mean off-grid/i)
  assert.match(readings, /no wet laboratory, containment facility, clinical work or biosafety level/i)
  assert.match(readings, /no health or performance benefit/i)
  assert.match(readings, /aspiration, not a forecast/i)
})

test('open questions are posed as studies, never as findings', () => {
  assert.ok(CALDERA_OPEN_QUESTIONS.length >= 6)
  assert.match(page, /proposed studies, not engineering findings/i)
  assert.match(page, /Nobody has been commissioned/i)
})

test('no internal planning figure reaches the public page', async () => {
  // The capital stack, spending allowances and revenue aspirations live in the
  // internal package and must not surface here. Checked against what a reader
  // actually receives — the rendered strings — rather than the module's own
  // comments, which name these categories in order to exclude them.
  const data = await import('../lib/caldera-concept.ts')
  const rendered = [
    page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
    JSON.stringify(Object.values(data)),
  ].join(' ')
  for (const forbidden of ['240,000', '240000', '1.02M', '$100M', '100M+', '$5M', '$20M', 'enterprise ARR', 'conduit bond', 'capital stack']) {
    assert.ok(!rendered.includes(forbidden), `internal planning figure leaked to the public page: ${forbidden}`)
  }
  assert.doesNotMatch(rendered, /\bRFPs?\b/i, 'unissued consultant scopes must not be referenced')
})

test('the page is reachable and canonical', () => {
  assert.equal(CALDERA_PATH, '/caldera')
  assert.match(page, /alternates: \{ canonical: CALDERA_PATH \}/)
  const sitemap = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8')
  assert.ok(sitemap.includes('CALDERA_PATH'), 'the page must appear in the sitemap')
})
