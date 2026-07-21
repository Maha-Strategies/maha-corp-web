import assert from 'node:assert/strict'
import test from 'node:test'

import { searchPerformanceInsights, type SearchPerformanceSnapshot } from '../lib/search-performance-feedback.ts'

function snapshot(over: Partial<SearchPerformanceSnapshot> = {}): SearchPerformanceSnapshot {
  return { observedOn: '2026-07-21', query: 'claim verification api pricing', clicks: 0, impressions: 25, ctr: 0, position: 12, ...over }
}

test('ranks near-page-one, zero-click queries as actionable feedback', () => {
  const [insight] = searchPerformanceInsights([snapshot()])
  assert.equal(insight.kind, 'near_page_one')
  assert.match(insight.recommendation, /existing page/i)
  assert.ok(insight.id.startsWith('gscinsight_'))
})

test('detects meaningful impression momentum using the prior snapshot', () => {
  const insights = searchPerformanceInsights([
    snapshot({ observedOn: '2026-07-20', impressions: 20, position: 16 }),
    snapshot({ observedOn: '2026-07-21', impressions: 40, position: 14 }),
  ])
  assert.equal(insights[0].kind, 'momentum')
  assert.equal(insights[0].previous?.impressions, 20)
})

test('does not turn incidental impressions into a recommendation', () => {
  assert.deepEqual(searchPerformanceInsights([snapshot({ impressions: 1, position: 80 })]), [])
})
