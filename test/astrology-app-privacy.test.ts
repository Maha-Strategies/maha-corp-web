import assert from 'node:assert/strict'
import test from 'node:test'
import { isPrivateReadingTelemetry } from '../lib/jyotisha-telemetry.ts'

test('private app URLs, action transactions and navigation breadcrumbs are excluded from telemetry', () => {
  for (const url of ['/astrology', '/astrology?view=chart', 'https://www.mahastrategies.com/astrology', 'POST /astrology']) {
    assert.equal(isPrivateReadingTelemetry({ request: { url } }), true)
    assert.equal(isPrivateReadingTelemetry({ transaction: url }), true)
    for (const key of ['url', 'from', 'to']) assert.equal(isPrivateReadingTelemetry({ breadcrumbs: [{ data: { [key]: url } }] }), true)
  }
})

test('public astrology library URLs retain their existing telemetry behavior', () => {
  for (const url of ['/knowledge/astrology', '/knowledge/astrology/reading-guide', '/astrology-news', 'https://www.mahastrategies.com/knowledge/astrology']) {
    assert.equal(isPrivateReadingTelemetry({ request: { url } }), false)
  }
})
