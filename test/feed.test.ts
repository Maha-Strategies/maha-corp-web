import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAtomFeed, latestFeedEntries } from '../lib/feed.ts'

test('Atom feed includes the latest citation-ready explainers and intelligence briefs', () => {
  const entries = latestFeedEntries()
  const feed = buildAtomFeed(entries)

  assert.equal(entries.length, 30)
  assert.ok(entries.some((entry) => entry.url.endsWith('/mps/what-is-mps')))
  assert.ok(entries.some((entry) => entry.url.includes('/intelligence/briefs/')))
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/)
  assert.match(feed, /<link href="https:\/\/www\.mahastrategies\.com\/feed\.xml" rel="self" type="application\/atom\+xml" \/>/)
})

test('Atom feed escapes XML-sensitive entry data', () => {
  const feed = buildAtomFeed([{
    id: 'https://example.test/a?b=1&c=2',
    url: 'https://example.test/a?b=1&c=2',
    title: 'A < B & C',
    summary: 'Use "quotes" and apostrophes',
    published: '2026-07-20',
    updated: '2026-07-20',
    category: 'R&D',
  }])

  assert.match(feed, /A &lt; B &amp; C/)
  assert.match(feed, /https:\/\/example\.test\/a\?b=1&amp;c=2/)
  assert.match(feed, /R&amp;D/)
})

test('Atom feed can surface a human-published insight alongside the existing corpus', () => {
  const entries = latestFeedEntries(30, [{ id: 'https://www.mahastrategies.com/insights/test', url: 'https://www.mahastrategies.com/insights/test', title: 'Human-reviewed insight', summary: 'A public release created after an explicit editorial handoff.', published: '2026-07-21', updated: '2026-07-21', category: 'Evidence-led insight' }])
  assert.ok(entries.some((entry) => entry.url.endsWith('/insights/test')))
})
