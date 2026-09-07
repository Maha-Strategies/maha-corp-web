import agenticPublishing from '@/content/federation/implementations/agentic-publishing-pages-v2.json'
import mahaOs from '@/content/federation/implementations/maha-os-pages-v2.json'
import mahaPolicy from '@/content/federation/implementations/maha-policy-pages-v2.json'
import mahaResearch from '@/content/federation/implementations/maha-research-pages-v2.json'
import mahaStrategies from '@/content/federation/implementations/maha-strategies-pages-v2.json'
import mayonRajan from '@/content/federation/implementations/mayon-rajan-pages-v2.json'
import mayoneMaharajan from '@/content/federation/implementations/mayone-maharajan-pages-v2.json'
import releaseLedger from '@/content/federation/public/federation-canonical-release-ledger-v1.json'
import routeIndex from '@/content/federation/public/federation-public-route-index-v1.json'
import routeBaseline from '@/content/federation/federation-route-baseline-v1.json'
import { digest } from '@/lib/federation/readiness-tranche-22'
import { provenanceDigest } from '@/lib/evidence-dossier/digest'
import type { MetadataRoute } from 'next'

export type FederationSource = {
  sourceId: string
  title: string
  url: string | null
  locator: string
  establishes: string
  doesNotEstablish: string
  rightsBasis: string
  inspectionDepth: string
}

export type FederationSection = { heading: string; kind: string; paragraphs: string[] }
export type FederationAnswer = { question: string; answer: string }
export type FederationRelatedLink = { url: string; relationship: string; availability: string; candidateId: string }

export type FederationPage = {
  candidateId: string
  siteId: string
  canonicalHost: string
  path: string
  canonicalUrl: string
  title: string
  directAnswer: string
  sections: FederationSection[]
  sources: FederationSource[]
  relatedLinks: FederationRelatedLink[]
  boundedAnswers: FederationAnswer[]
  structuredData: Record<string, unknown>
  contentDigest: string
  adoption: { exactRevisionReviewed: boolean; blockedDependencies: unknown[] }
}

export type FederationRelease = {
  releaseId: string
  candidateId: string
  candidateDigest: string
  siteId: string
  canonicalHost: string
  path: string
  canonicalUrl: string
  targetContentDigest: string
  sourceManifestDigest: string
  reviewLedgerDigest: string
  status: 'active'
  releaseDigest: string
}

export type PublishedFederationPage = FederationPage & { release: FederationRelease }

type Manifest = { provenanceDigest: string; siteId: string; canonicalHost: string; pages: FederationPage[] }
const manifests = [agenticPublishing, mahaOs, mahaPolicy, mahaResearch, mahaStrategies, mayonRajan, mayoneMaharajan] as unknown as Manifest[]

function without<T extends Record<string, unknown>>(value: T, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key))
}

function verifySigned(value: Record<string, unknown> & { provenanceDigest: string }, label: string) {
  if (digest(without(value, 'provenanceDigest')) !== value.provenanceDigest) throw new Error(`federation-${label}-digest-invalid`)
}

verifySigned(releaseLedger as unknown as Record<string, unknown> & { provenanceDigest: string }, 'release-ledger')
verifySigned(routeIndex as unknown as Record<string, unknown> & { provenanceDigest: string }, 'route-index')
if (provenanceDigest(routeBaseline) !== routeBaseline.provenanceDigest) throw new Error('federation-route-baseline-digest-invalid')

const releases = new Map<string, FederationRelease>()
for (const release of releaseLedger.entries as unknown as FederationRelease[]) {
  if (release.status !== 'active' || digest(without(release as unknown as Record<string, unknown>, 'releaseDigest')) !== release.releaseDigest) {
    throw new Error(`federation-release-invalid:${release.releaseId}`)
  }
  if (releases.has(release.candidateId)) throw new Error(`federation-release-duplicate:${release.candidateId}`)
  releases.set(release.candidateId, release)
}

const pages: PublishedFederationPage[] = []
for (const manifest of manifests) {
  verifySigned(manifest as unknown as Record<string, unknown> & { provenanceDigest: string }, `manifest:${manifest.siteId}`)
  for (const page of manifest.pages) {
    if (digest(without(page as unknown as Record<string, unknown>, 'contentDigest')) !== page.contentDigest) throw new Error(`federation-page-digest-invalid:${page.candidateId}`)
    const release = releases.get(page.candidateId)
    if (!release || release.targetContentDigest !== page.contentDigest || release.path !== page.path || release.canonicalHost !== page.canonicalHost || release.canonicalUrl !== page.canonicalUrl || release.siteId !== page.siteId) {
      throw new Error(`federation-release-binding-invalid:${page.candidateId}`)
    }
    if (!page.adoption.exactRevisionReviewed || page.adoption.blockedDependencies.length) throw new Error(`federation-review-state-invalid:${page.candidateId}`)
    pages.push({ ...page, release })
  }
}

if (pages.length !== 1_628 || releases.size !== 1_628 || new Set(pages.map((page) => page.path)).size !== 1_628) throw new Error('federation-publication-cardinality-invalid')

const byPath = new Map(pages.map((page) => [page.path, page]))
const byHost = Map.groupBy(pages, (page) => page.canonicalHost)

export const FEDERATION_PUBLISHED_PAGES = Object.freeze([...pages].sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl)))

export function getFederationPublishedPage(path: string): PublishedFederationPage | null {
  return byPath.get(path) ?? null
}

export function federationPagesForHost(host: string): readonly PublishedFederationPage[] {
  return byHost.get(host) ?? []
}

export function federationPathsMatching(pattern: RegExp): string[] {
  return FEDERATION_PUBLISHED_PAGES.map((page) => page.path).filter((path) => pattern.test(path))
}

export function federationSitemapRows(host: string) {
  return federationPagesForHost(host).map((page) => ({ url: page.canonicalUrl, lastModified: new Date('2026-09-07') }))
}

export function federationObservedSitemapRows(host: string) {
  const urls = routeBaseline.observedProperties.flatMap((property) => property.routes).filter((url) => new URL(url).hostname === host)
  return urls.map((url) => ({ url, lastModified: new Date(routeBaseline.observedOn) }))
}

export function mergeFederationSitemapRows(...groups: MetadataRoute.Sitemap[]): MetadataRoute.Sitemap {
  return [...new Map(groups.flat().map((row) => [row.url, row])).values()]
}

export function federationLlmsManifest(host: string): string {
  const rows = federationPagesForHost(host)
  if (!rows.length) return ''
  return ['# Maha federated evidence pages', '', `Canonical host: https://${host}`, `Active exact-revision releases: ${rows.length}`, '', ...rows.map((page) => `- [${page.title}](${page.canonicalUrl}) — ${page.directAnswer}`), ''].join('\n')
}
