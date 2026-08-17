import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { CONFORMANCE_LIMITS, loadCelestialConformanceCorpus, summarizeCelestialConformance } from '../lib/celestial-conformance.ts'

test('the frozen corpus is broad, unique, and independently attributed', async () => {
  const corpus = await loadCelestialConformanceCorpus()
  assert.equal(corpus.caseCount, 180)
  assert.equal(new Set(corpus.cases.map((entry) => entry.id)).size, 180)
  for (const tag of ['baseline', 'historical', 'modern', 'dst', 'fold', 'gap', 'polar-sunrise', 'new-moon', 'full-moon', 'planetary-station', 'ascendant-boundary', 'nakshatra-boundary', 'tithi-boundary']) {
    assert.ok(corpus.cases.some((entry) => entry.tags.includes(tag)), `missing ${tag}`)
  }
  assert.equal(corpus.reference.engine, 'Swiss Ephemeris')
  assert.equal(corpus.reference.engineVersion, '2.10.03')
  assert.deepEqual(corpus.reference.dataFiles.map((file) => file.sha256), [
    '8dccace2557601a223d5f8a7cf64de4e6bbb8a82b9b130b95a54d49adfbe546d',
    '1c65fdbb854f350d3de36afc3e4ac126a53f360ae4f6dcb57beed7c690e7eb61',
    'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66',
    '1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7',
  ])
  for (const anchor of corpus.externalAnchors) {
    const linked = corpus.cases.find((entry) => entry.id === anchor.linkedCaseId)
    assert.ok(linked, `missing external anchor case ${anchor.linkedCaseId}`)
    assert.ok(Math.abs(Date.parse(linked.instantUtc) - Date.parse(anchor.utcMinute)) <= 60_000, anchor.linkedCaseId)
  }
})

test('the generator refuses silent Moshier fallback', async () => {
  const source = await readFile(new URL('../scripts/generate-celestial-conformance-corpus.py', import.meta.url), 'utf8')
  assert.match(source, /returned & swe\.FLG_MOSEPH/)
  assert.match(source, /Swiss Ephemeris data-file calculation required/)
})

test('Maha calculations conform within declared numerical tolerances', async () => {
  const summary = summarizeCelestialConformance(await loadCelestialConformanceCorpus())
  assert.ok(summary.maxima.planetLongitudeErrorDegrees <= CONFORMANCE_LIMITS.planetLongitudeDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.sunLongitudeErrorDegrees <= CONFORMANCE_LIMITS.sunLongitudeDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.moonLongitudeErrorDegrees <= CONFORMANCE_LIMITS.moonLongitudeDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.ayanamsaErrorDegrees <= CONFORMANCE_LIMITS.ayanamsaDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.ascendantErrorDegrees <= CONFORMANCE_LIMITS.ascendantDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.sunriseErrorMinutes <= CONFORMANCE_LIMITS.solarEventMinutes, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.sunsetErrorMinutes <= CONFORMANCE_LIMITS.solarEventMinutes, JSON.stringify(summary.maxima))
  assert.deepEqual(summary.disagreements, [])
})
