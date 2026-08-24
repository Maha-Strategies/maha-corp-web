import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluatePublicAuthorityConformance,
  loadPublicAuthorityConformanceCorpus,
} from '../lib/celestial-public-authority-conformance.ts'

test('public-authority conformance uses neutral JPL and USNO fixtures', async () => {
  const corpus = await loadPublicAuthorityConformanceCorpus()
  assert.equal(corpus.jplHorizons.ephemeris, 'DE441')
  assert.equal(corpus.longitudeCases.length, 4)
  assert.equal(corpus.usnoMoonPhases.events.length, 2)
  assert.match(corpus.privacyBoundary, /No participant, natal, founder, customer, or business-event data/)
  assert.doesNotMatch(JSON.stringify(corpus), /Uzabase|Maha Strategies|International Falls|Colombo/)
})

test('Maha agrees with public JPL and USNO authority data inside frozen tolerances', async () => {
  const summary = evaluatePublicAuthorityConformance(await loadPublicAuthorityConformanceCorpus())
  assert.deepEqual(summary.counts, { longitudeComparisons: 28, moonPhaseEvents: 2 })
  assert.ok(summary.maxima.maximumLongitudeErrorDegrees <= summary.tolerances.longitudeDegrees, JSON.stringify(summary.maxima))
  assert.ok(summary.maxima.maximumPhaseTimeErrorMinutes <= summary.tolerances.phaseTimeMinutes, JSON.stringify(summary.maxima))
  assert.deepEqual(summary.disagreements, [])
})
