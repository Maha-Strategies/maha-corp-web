// Pure Search Console feedback analysis. It derives human-review insights from
// first-party query snapshots, but cannot create, edit, or publish content.

import { createHash } from 'node:crypto'

export type SearchPerformanceSnapshot = {
  observedOn: string
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type SearchPerformanceInsight = {
  id: string
  kind: 'momentum' | 'near_page_one' | 'low_ctr'
  query: string
  current: SearchPerformanceSnapshot
  previous?: SearchPerformanceSnapshot
  recommendation: string
  priority: number
}

function id(kind: string, query: string) {
  return `gscinsight_${createHash('sha256').update(`${kind}:${query.toLowerCase()}`).digest('hex').slice(0, 24)}`
}

// One actionable insight per query, ranked deterministically. The minimums are
// intentionally modest for a young site, yet prevent a single incidental
// impression from being treated as a content decision.
export function searchPerformanceInsights(rows: SearchPerformanceSnapshot[], limit = 25): SearchPerformanceInsight[] {
  const latestObservedOn = rows.reduce((latest, row) => row.observedOn > latest ? row.observedOn : latest, '')
  if (!latestObservedOn) return []
  const previousByQuery = new Map<string, SearchPerformanceSnapshot>()
  for (const row of rows) {
    if (row.observedOn >= latestObservedOn) continue
    const current = previousByQuery.get(row.query)
    if (!current || row.observedOn > current.observedOn) previousByQuery.set(row.query, row)
  }

  const insights: SearchPerformanceInsight[] = []
  for (const current of rows.filter((row) => row.observedOn === latestObservedOn)) {
    const previous = previousByQuery.get(current.query)
    const impressionGain = previous && previous.impressions > 0 ? (current.impressions - previous.impressions) / previous.impressions : 0
    if (previous && current.impressions >= 20 && impressionGain >= 0.5) {
      insights.push({ id: id('momentum', current.query), kind: 'momentum', query: current.query, current, previous, priority: Math.round(Math.min(100, current.impressions + impressionGain * 20)), recommendation: 'Inspect the ranking page and strengthen its answer, internal links, and title for this emerging query. Publish only after human review.' })
    } else if (current.impressions >= 10 && current.clicks === 0 && current.position >= 8 && current.position <= 30) {
      insights.push({ id: id('near_page_one', current.query), kind: 'near_page_one', query: current.query, current, previous, priority: Math.round(Math.min(100, current.impressions + (31 - current.position) * 2)), recommendation: 'Find the existing page already ranking for this query. Improve the direct answer and supporting evidence; do not create a duplicate page by default.' })
    } else if (current.impressions >= 20 && current.position <= 20 && current.ctr < 2) {
      insights.push({ id: id('low_ctr', current.query), kind: 'low_ctr', query: current.query, current, previous, priority: Math.round(Math.min(100, current.impressions + (2 - current.ctr) * 10)), recommendation: 'Review the ranking page’s title, description, and opening answer against this query. Test one human-approved change at a time.' })
    }
  }
  return insights.sort((left, right) => right.priority - left.priority || left.query.localeCompare(right.query)).slice(0, Math.max(1, Math.min(Math.floor(limit) || 25, 50)))
}
