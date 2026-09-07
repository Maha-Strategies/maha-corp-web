import type { MetadataRoute } from 'next'
import { FEDERATION_CANONICAL_HOSTS, normalizedRequestHost } from './federation-host-routing.ts'

export const INDEXING_SEGMENTS = [
  'knowledge',
  'research',
  'policy',
  'publishing',
  'books',
  'machine',
  'commercial',
  'core',
] as const

export type IndexingSegment = (typeof INDEXING_SEGMENTS)[number]

const KNOWN_HOSTS = new Set(FEDERATION_CANONICAL_HOSTS)

export function indexingHost(candidate: string | null): string {
  const normalized = normalizedRequestHost(candidate)
  return KNOWN_HOSTS.has(normalized as (typeof FEDERATION_CANONICAL_HOSTS)[number])
    ? normalized
    : 'www.mahastrategies.com'
}

export function indexingSegmentForUrl(url: string): IndexingSegment {
  const path = new URL(url).pathname
  if (/^\/(knowledge|clearing|concepts|sources|source-guides|mayon-volcano)(\/|$)/.test(path)) return 'knowledge'
  if (/^\/(research|federation\/research)(\/|$)/.test(path)) return 'research'
  if (/^\/policy(\/|$)/.test(path)) return 'policy'
  if (/^\/agentic-publishing(\/|$)/.test(path)) return 'publishing'
  if (/^\/books(\/|$)/.test(path)) return 'books'
  if (/^\/(developers|mcp|enterprise-mcp-gateway|context|benchmarks|guides|recipes|x402|tools|\.well-known)(\/|$)/.test(path)) return 'machine'
  if (/^\/(consulting|pricing|contact|case-studies|start)(\/|$)/.test(path)) return 'commercial'
  return 'core'
}

export function segmentSitemapRows(rows: MetadataRoute.Sitemap): Map<IndexingSegment, MetadataRoute.Sitemap> {
  const seen = new Set<string>()
  const grouped = new Map<IndexingSegment, MetadataRoute.Sitemap>()
  for (const segment of INDEXING_SEGMENTS) grouped.set(segment, [])

  for (const row of [...rows].sort((a, b) => a.url.localeCompare(b.url))) {
    if (seen.has(row.url)) throw new Error(`indexing-sitemap-duplicate:${row.url}`)
    seen.add(row.url)
    grouped.get(indexingSegmentForUrl(row.url))!.push(row)
  }

  for (const [segment, entries] of [...grouped]) if (entries.length === 0) grouped.delete(segment)
  return grouped
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function isoDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) throw new Error('indexing-sitemap-lastmod-invalid')
  return date.toISOString()
}

export function renderSitemapXml(rows: MetadataRoute.Sitemap): string {
  const body = rows.map((row) => {
    const fields = [`    <loc>${escapeXml(row.url)}</loc>`]
    if (row.lastModified) fields.push(`    <lastmod>${escapeXml(isoDate(row.lastModified))}</lastmod>`)
    return `  <url>\n${fields.join('\n')}\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body.join('\n')}\n</urlset>\n`
}

export function renderSitemapIndex(host: string, segments: Iterable<IndexingSegment>, lastModified: Date): string {
  const entries = [...segments].map((segment) => [
    '  <sitemap>',
    `    <loc>https://${escapeXml(host)}/sitemaps/${segment}.xml</loc>`,
    `    <lastmod>${escapeXml(lastModified.toISOString())}</lastmod>`,
    '  </sitemap>',
  ].join('\n'))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`
}

export const XML_RESPONSE_HEADERS = Object.freeze({
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
})
