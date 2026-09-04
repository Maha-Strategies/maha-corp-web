import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { MATHEMATICAL_BRIDGES, MATHEMATICAL_CONCEPTS } from '../lib/mathematics-knowledge.ts'

const insp = JSON.parse(readFileSync('content/evidence-batch-14/inspections.json', 'utf8'))
const compiled = JSON.parse(readFileSync('content/legacy-uplift/uplift-compiled.json', 'utf8'))

const CALENDAR = 'concept-calendrical-reconciliation'
const bridges = MATHEMATICAL_BRIDGES.filter((b) => b.conceptId === CALENDAR)

test('the calendar concept reaches astronomy and the tradition domains', () => {
  const domains = new Set(bridges.map((b) => b.domain))
  for (const d of ['astronomy', 'celestial-facts', 'panchanga-timing', 'astrology-traditions']) {
    assert.ok(domains.has(d as never), `no bridge reaches ${d}`)
  }
})

test('no bridge lets arithmetic settle a religious question', () => {
  // The whole hazard of a cross-domain bridge. Computing when a month begins is
  // arithmetic; whether a community observes it that way is not, and a
  // tradition may set its dates by sighting rather than by computation.
  for (const b of bridges) {
    assert.ok(b.limitations.length > 60, `${b.id}: no stated limitation`)
    assert.ok(!/proves|validates|confirms|demonstrates that|establishes that .*(faith|belief|doctrine|god)/i.test(
      `${b.application} ${b.transformation} ${b.outputs.join(' ')}`),
      `${b.id}: a bridge claims to settle something it cannot`)
  }
  const observance = bridges.filter((b) => /observance|practice|tradition|community/i.test(b.limitations))
  assert.ok(observance.length >= 2, 'the bridges touching tradition must say what they do not determine')
})

test('a bridge that only classifies is marked as formalization, not calculation', () => {
  const classifier = bridges.find((b) => b.title === 'What a calendar chooses to track')!
  assert.equal(classifier.evidenceRole, 'formalization-only',
    'classifying schemes is not a calculation and must not be labelled as one')
  const computed = bridges.filter((b) => b.evidenceRole === 'calculation')
  assert.ok(computed.length >= 3, 'the arithmetic bridges must be marked as calculation')
})

test('the derived figures reproduce the source, and the one that does not is recorded', () => {
  const tropicalYear = 365.2421896698
  const synodicMonth = 29.5305888531
  // The source states both of these; reproducing them is what validates the inputs.
  assert.ok(Math.abs(12 * synodicMonth - 354.36707) < 1e-5, 'twelve synodic months must reproduce the stated lunar year')
  assert.ok(Math.abs(235 * synodicMonth - 6939.688) < 1e-3, 'the Metonic total must reproduce the stated figure')

  const gregorianError = 146097 / 400 - tropicalYear
  const yearsPerDay = 1 / gregorianError
  assert.ok(yearsPerDay > 3000, 'the derived Gregorian error is about one day in 3200 years')

  const source = insp.inspected.find((s: { sourceId: string }) => s.sourceId === 'doggett-calendars')
  assert.match(source.arithmeticCheck, /does not reconcile/,
    'the disagreement with the stated 2500 years must be recorded, not smoothed over')
  assert.match(source.arithmeticCheck, /rather than claiming to resolve it/)
})

test('the calendar source is filed as history, not as mathematics or religion', () => {
  const source = insp.inspected.find((s: { sourceId: string }) => s.sourceId === 'doggett-calendars')
  assert.equal(source.class, 'secondary-historical-scholarship')
  assert.match(source.frameNote, /establishes nothing about observance/i)
  // Hosted by NASA but authored elsewhere; the two are different authorities.
  assert.match(source.identityBasis, /rather than as a NASA publication/)
})

test('the page states what calendar arithmetic cannot determine', () => {
  const c = MATHEMATICAL_CONCEPTS.find((x) => x.slug === 'calendrical-reconciliation')!
  assert.match(c.doesNotEstablish, /does not determine any religious observance/i)
  assert.match(c.assumptions.join(' '), /design choice about what to keep synchronised, not a fact about the sky/i)
  const page = compiled.pages.find((p: { route: string }) =>
    p.route === '/knowledge/mathematics/calendrical-reconciliation')
  assert.ok(page, 'the page must compile')
  assert.match(JSON.stringify(page.sections), /sighting rather than by computation/,
    'the page must say a tradition may set dates by observation instead')
})

test('bridge fan-out is capped per concept, and the total is free to grow', () => {
  const src = readFileSync('lib/mathematics-knowledge.ts', 'utf8')
  assert.match(src, /MATHEMATICAL_BRIDGES\.length < 40/, 'the total must be a floor')
  assert.ok(!/MATHEMATICAL_BRIDGES\.length > \d+/.test(src), 'a global ceiling blocks growth')
  const perConcept = new Map<string, number>()
  for (const b of MATHEMATICAL_BRIDGES) perConcept.set(b.conceptId, (perConcept.get(b.conceptId) ?? 0) + 1)
  for (const [id, n] of perConcept) assert.ok(n <= 8, `${id} carries ${n} bridges`)
})
