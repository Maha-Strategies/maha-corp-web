import assert from 'node:assert/strict'
import test from 'node:test'

import { BIRTH_PLACES, birthPlaceKey, findBirthPlace } from '../lib/birth-places.ts'
import { buildBirthReport } from '../lib/birth-report.ts'
import { groupTimeZones, isKnownTimeZone, listTimeZones, timeZoneLabel } from '../lib/time-zones.ts'

test('the zone list is the platform database, not a curated handful', () => {
  const zones = listTimeZones()
  // The earlier form offered fifteen zones and did not generalise.
  assert.ok(zones.length > 200, `expected the full IANA list, got ${zones.length}`)
  for (const zone of ['Asia/Kolkata', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/Argentina/Buenos_Aires', 'Africa/Lagos', 'UTC']) {
    assert.ok(zones.includes(zone), `${zone} must be selectable`)
  }
})

test('every listed zone is one the platform can actually resolve', () => {
  for (const zone of listTimeZones()) assert.ok(isKnownTimeZone(zone), `${zone} is not resolvable`)
})

test('zones are grouped by region without losing any', () => {
  const zones = listTimeZones()
  const groups = groupTimeZones(zones)
  assert.equal(groups.reduce((total, group) => total + group.zones.length, 0), zones.length)
  assert.ok(groups.some((group) => group.region === 'Asia'))
})

test('zone labels stay readable', () => {
  assert.equal(timeZoneLabel('Asia/Kolkata'), 'Kolkata (Asia)')
  assert.equal(timeZoneLabel('America/Argentina/Buenos_Aires'), 'Buenos Aires (America)')
  assert.equal(timeZoneLabel('UTC'), 'UTC')
})

test('every place preset carries a resolvable zone and plausible coordinates', () => {
  for (const place of BIRTH_PLACES) {
    assert.ok(isKnownTimeZone(place.timeZone), `${place.name} has unknown zone ${place.timeZone}`)
    assert.ok(place.latitude >= -90 && place.latitude <= 90, `${place.name} latitude`)
    assert.ok(place.longitude >= -180 && place.longitude <= 180, `${place.name} longitude`)
  }
  assert.equal(new Set(BIRTH_PLACES.map(birthPlaceKey)).size, BIRTH_PLACES.length, 'place keys must be unique')
})

test('a place preset resolves by full key or bare name', () => {
  assert.equal(findBirthPlace('Chennai, India')?.timeZone, 'Asia/Kolkata')
  assert.equal(findBirthPlace('chennai')?.latitude, 13.0827)
  assert.equal(findBirthPlace('International Falls')?.timeZone, 'America/Chicago')
  assert.equal(findBirthPlace('International Falls, MN')?.timeZone, 'America/Chicago')
  assert.equal(findBirthPlace('international falls minnesota')?.timeZone, 'America/Chicago')
  assert.equal(findBirthPlace('Cheyenne')?.timeZone, 'America/Denver')
  assert.equal(findBirthPlace('Nowhere'), undefined)
})

test('presets actually drive a report, including southern and half-hour zones', () => {
  for (const name of ['Auckland', 'Kathmandu', 'Buenos Aires', 'Lagos']) {
    const place = findBirthPlace(name)
    assert.ok(place, `${name} missing`)
    const report = buildBirthReport({
      date: '1985-06-14', time: '21:40', timeZone: place.timeZone,
      latitudeDegrees: place.latitude, longitudeDegrees: place.longitude,
    })
    assert.ok(report.panchanga.nakshatra.name.length > 0, `${name} produced no nakshatra`)
    assert.match(report.utcOffset, /^[+-]\d{2}:\d{2}$/)
  }
})

test('the International Falls preset reproduces the founder birth instant', () => {
  const place = findBirthPlace('International Falls')!
  const report = buildBirthReport({
    date: '1992-11-30', time: '20:09', timeZone: place.timeZone,
    latitudeDegrees: place.latitude, longitudeDegrees: place.longitude,
    placeLabel: birthPlaceKey(place),
  })
  assert.equal(report.instantUtc, '1992-12-01T02:09:00.000Z')
  assert.equal(report.utcOffset, '-06:00')
  assert.equal(report.placeLabel, 'International Falls, Minnesota, United States')
})

test('Nepal\u2019s 1986 offset change is honoured, not flattened', () => {
  // Nepal moved from +05:30 to +05:45 on 1 January 1986. A form that asked for
  // an offset, or that assumed today's offset, would get one of these wrong.
  const kathmandu = findBirthPlace('Kathmandu')!
  const place = { timeZone: kathmandu.timeZone, latitudeDegrees: kathmandu.latitude, longitudeDegrees: kathmandu.longitude }
  assert.equal(buildBirthReport({ date: '1985-06-14', time: '21:40', ...place }).utcOffset, '+05:30')
  assert.equal(buildBirthReport({ date: '1990-06-14', time: '21:40', ...place }).utcOffset, '+05:45')
})
