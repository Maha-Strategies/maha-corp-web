import { BRIEFS, SITE_URL } from './briefs-data.ts'

export type FeedEntry = {
  id: string
  url: string
  title: string
  summary: string
  published: string
  updated: string
  category: string
}

const explainerEntries: FeedEntry[] = [
  {
    id: `${SITE_URL}/mps/what-is-mps`,
    url: `${SITE_URL}/mps/what-is-mps`,
    title: 'What Is the Maha Provenance Standard (MPS)?',
    summary: 'A citation-ready MPS/0.1 explainer covering the definition, scope, limits, five tags, and canonical sources.',
    published: '2026-07-20',
    updated: '2026-07-20',
    category: 'MPS',
  },
  {
    id: `${SITE_URL}/systemic-sovereignty`,
    url: `${SITE_URL}/systemic-sovereignty`,
    title: 'What Does Systemic Sovereignty Mean?',
    summary: 'A citation-ready explanation of Maha Strategies’ three-layer framework across infrastructure, interface, and intellect.',
    published: '2026-07-20',
    updated: '2026-07-20',
    category: 'Systemic sovereignty',
  },
  {
    id: `${SITE_URL}/on-device-ai-vs-cloud`,
    url: `${SITE_URL}/on-device-ai-vs-cloud`,
    title: 'When Should an Organization Choose On-Device AI Over Cloud AI?',
    summary: 'A decision framework for choosing on-device AI, cloud AI, or a hybrid architecture.',
    published: '2026-07-20',
    updated: '2026-07-20',
    category: 'AI infrastructure',
  },
]

function atomDate(date: string): string {
  return `${date}T00:00:00.000Z`
}

function xml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]!)
}

export function latestFeedEntries(limit = 30, humanPublishedEntries: FeedEntry[] = []): FeedEntry[] {
  const intelligenceEntries: FeedEntry[] = BRIEFS.map((brief) => ({
    id: `${SITE_URL}/intelligence/briefs/${brief.slug}`,
    url: `${SITE_URL}/intelligence/briefs/${brief.slug}`,
    title: brief.title,
    summary: brief.description,
    published: brief.datePublished,
    updated: brief.dateModified ?? brief.datePublished,
    category: brief.kicker,
  }))

  const editorialEntries = [...explainerEntries, ...humanPublishedEntries]
  const intelligenceLimit = Math.max(0, limit - editorialEntries.length)
  const selectedIntelligence = intelligenceEntries
    .sort((left, right) => right.updated.localeCompare(left.updated) || right.published.localeCompare(left.published) || left.url.localeCompare(right.url))
    .slice(0, intelligenceLimit)

  return [...editorialEntries, ...selectedIntelligence]
    .sort((left, right) => right.updated.localeCompare(left.updated) || right.published.localeCompare(left.published) || left.url.localeCompare(right.url))
    .slice(0, limit)
}

export function buildAtomFeed(entries = latestFeedEntries()): string {
  const updated = entries[0]?.updated ?? '2026-07-20'
  const itemXml = entries.map((entry) => `
  <entry>
    <id>${xml(entry.id)}</id>
    <title>${xml(entry.title)}</title>
    <link href="${xml(entry.url)}" />
    <updated>${atomDate(entry.updated)}</updated>
    <published>${atomDate(entry.published)}</published>
    <summary>${xml(entry.summary)}</summary>
    <category term="${xml(entry.category)}" />
    <author><name>Mayone Maha Rajan</name></author>
  </entry>`).join('')

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE_URL}/feed.xml</id>
  <title>Maha Strategies — Intelligence &amp; Explainers</title>
  <subtitle>Evidence-led intelligence briefs and citation-ready explainers from Maha Strategies LLC.</subtitle>
  <updated>${atomDate(updated)}</updated>
  <link href="${SITE_URL}/feed.xml" rel="self" type="application/atom+xml" />
  <link href="${SITE_URL}" />
  <author><name>Maha Strategies LLC</name></author>${itemXml}
</feed>`
}
