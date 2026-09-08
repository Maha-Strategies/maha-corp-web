import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { provenanceDigest, sha256Hex } from '../lib/evidence-dossier/digest.ts'

const ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_OUTPUT = resolve(ROOT, 'content/federation/federation-route-baseline-v1.json')

const OBSERVED_PROPERTIES = [
  { siteId: 'maha-os', canonicalHost: 'www.maha-os.com', sitemapUrl: 'https://www.maha-os.com/sitemap.xml', expectedCount: 13 },
  { siteId: 'maha-strategies', canonicalHost: 'www.mahastrategies.com', sitemapUrl: 'https://www.mahastrategies.com/sitemap.xml', expectedCount: 2_003 },
  { siteId: 'agentic-publishing', canonicalHost: 'publish.mahastrategies.com', sitemapUrl: 'https://publish.mahastrategies.com/sitemap.xml', expectedCount: 30 },
  { siteId: 'maha-research', canonicalHost: 'research.mahastrategies.com', sitemapUrl: 'https://research.mahastrategies.com/sitemap.xml', expectedCount: 291 },
  { siteId: 'mayone-maharajan', canonicalHost: 'www.mayonemaharajan.com', sitemapUrl: 'https://www.mayonemaharajan.com/sitemap.xml', expectedCount: 18 },
  { siteId: 'mayon-rajan', canonicalHost: 'mayonrajan.com', sitemapUrl: 'https://mayonrajan.com/sitemap.xml', expectedCount: 17 },
] as const

function argument(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function extractRoutes(xml: string, expectedHost: string): string[] {
  const routes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]!.trim()))
  if (routes.length === 0) throw new Error(`No sitemap routes found for ${expectedHost}.`)
  if (new Set(routes).size !== routes.length) throw new Error(`Duplicate sitemap route found for ${expectedHost}.`)
  for (const route of routes) {
    const url = new URL(route)
    if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password || url.hash) {
      throw new Error(`Out-of-bound sitemap route for ${expectedHost}: ${route}`)
    }
  }
  return routes
}

export function freezeBaseline(snapshotArguments: Readonly<Record<string, string>>) {
  const observed = OBSERVED_PROPERTIES.map((property) => {
    const snapshotPath = snapshotArguments[property.siteId]
    if (!snapshotPath) throw new Error(`Missing --snapshot-${property.siteId}=<path>.`)
    const xml = readFileSync(resolve(snapshotPath), 'utf8')
    const routes = extractRoutes(xml, property.canonicalHost)
    if (routes.length !== property.expectedCount) {
      throw new Error(`${property.siteId} has ${routes.length} routes; the reviewed observation expects ${property.expectedCount}.`)
    }
    return {
      siteId: property.siteId,
      canonicalHost: property.canonicalHost,
      state: 'live-observed' as const,
      sitemapUrl: property.sitemapUrl,
      sitemapSha256: `sha256:${sha256Hex(xml)}`,
      routeCount: routes.length,
      routes,
    }
  })
  const allRoutes = observed.flatMap((property) => property.routes)
  if (allRoutes.length !== 2_372 || new Set(allRoutes).size !== allRoutes.length) {
    throw new Error(`Federation baseline must contain 2,372 unique live routes; received ${allRoutes.length}.`)
  }
  const body = {
    schemaVersion: 'maha-federation-route-baseline/1.0',
    observedOn: '2026-09-05',
    observationMethod: 'Read-only retrieval of each public XML sitemap after Production deployment 6279180043 completed.',
    countingBoundary: 'Canonical sitemap URLs only. Redirects, query parameters, fragments, answer fragments, APIs absent from sitemaps, and proposed properties are not counted.',
    observedProperties: observed,
    proposedProperties: [{
      siteId: 'maha-policy',
      canonicalHost: 'policy.mahastrategies.com',
      state: 'proposed-dns-unresolved' as const,
      sitemapUrl: null,
      sitemapSha256: null,
      routeCount: 0,
      routes: [] as string[],
    }],
    totals: {
      liveProperties: observed.length,
      proposedProperties: 1,
      observedCanonicalRoutes: allRoutes.length,
      targetCanonicalRoutes: 4_000,
      candidateGap: 1_628,
    },
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}

export function writeFrozenBaseline(output: string, artifact: ReturnType<typeof freezeBaseline>, replaceReviewedBaseline = false) {
  if (existsSync(output) && !replaceReviewedBaseline) {
    throw new Error(`Refusing to overwrite frozen baseline ${output}. Pass --replace-reviewed-baseline only after a new review.`)
  }
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const snapshots = Object.fromEntries(OBSERVED_PROPERTIES.map((property) => [
    property.siteId,
    argument(`snapshot-${property.siteId}`) ?? '',
  ]))
  const output = resolve(argument('output') ?? DEFAULT_OUTPUT)
  const artifact = freezeBaseline(snapshots)
  writeFrozenBaseline(output, artifact, process.argv.includes('--replace-reviewed-baseline'))
  console.log(JSON.stringify({
    output,
    observedCanonicalRoutes: artifact.totals.observedCanonicalRoutes,
    candidateGap: artifact.totals.candidateGap,
    digest: artifact.provenanceDigest,
  }, null, 2))
}
