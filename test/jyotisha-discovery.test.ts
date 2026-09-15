import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildNatalFoundation } from '../lib/natal-foundation.ts'

const read = (path: string) => readFileSync(path, 'utf8')
const guide = read('app/knowledge/astrology/reading-guide/page.tsx')

test('one canonical guide is linked from the reader, hub and sitemap', () => {
  const path = '/knowledge/astrology/reading-guide'
  for (const file of ['app/knowledge/birth/page.tsx', 'app/knowledge/astrology/page.tsx', 'app/sitemap.ts']) {
    assert.ok(read(file).includes(path), file)
  }
  assert.equal(read('app/sitemap.ts').split(path).length - 1, 1)
  assert.match(guide, /alternates: \{ canonical: path \}/)
  assert.match(guide, /index: true, follow: true/)
  assert.match(guide, /href="\/knowledge\/birth"/)
})

test('worked example matches the calculator rather than a personal demonstration', () => {
  const f = buildNatalFoundation({ instant: new Date('2000-01-01T12:00:00Z'), latitudeDegrees: 0, longitudeDegrees: 0 }, 0, new Date('2026-09-14T12:00:00Z'))
  assert.equal(f.d1.houses.find(h => h.number === 7)?.sign, 'Virgo')
  assert.equal(f.d1.houses.find(h => h.number === 7)?.ruler, 'Mercury')
  assert.equal(f.d9.placements.find(p => p.name === 'Mercury')?.sign, 'Gemini')
  assert.equal(f.d1.houses.find(h => h.number === 10)?.ruler, 'Jupiter')
  assert.match(guide, /synthetic fixture/)
  assert.match(guide, /modern question/)
  assert.match(guide, /Not practitioner- or expert-reviewed/)
  assert.doesNotMatch(guide, /1992|International Falls|1996|Jennie|Sadie/)
})

test('public discovery cannot execute or embed a private report', () => {
  assert.doesNotMatch(guide, /use client|buildNatalFoundation|buildBirthReport|BirthForm|searchParams|localStorage/)
  assert.doesNotMatch(guide, /aggregateRating|reviewRating|FAQPage|SoftwareApplication/)
  assert.match(guide, /does not save reports or birth details/)
  assert.match(guide, /PDF pages 52–53/)
  assert.match(guide, /withholds personalized reflection/)
})
