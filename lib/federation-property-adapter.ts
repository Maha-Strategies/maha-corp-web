import { provenanceDigest } from './evidence-dossier/digest.ts'
import { SITE_CONTRACTS, type SiteId } from './federation-4000-plan.ts'

type Page = {
  candidateId: string
  siteId: SiteId
  canonicalHost: string
  path: string
  canonicalUrl: string
  title: string
  directAnswer: string
  sections: Array<{ heading: string; kind: string; paragraphs: string[] }>
  sources: Array<{ sourceId: string; title: string; url: string | null; locator: string; establishes: string; doesNotEstablish: string }>
  relatedLinks: Array<{ url: string; relationship: string; availability: string; candidateId: string | null }>
  boundedAnswers: Array<{ question: string; answer: string }>
  structuredData: Record<string, unknown>
  adoption: { state: string; routeFileCreated: boolean; exactRevisionReviewed: boolean; canonicallyReleased: boolean; crawlable: boolean }
  contentDigest: string
}

export type PropertyManifest = {
  provenanceDigest: string
  siteId: SiteId
  canonicalHost: string
  status: string
  pages: Page[]
}

const ROOT_PATHS: Record<SiteId, string> = {
  'maha-strategies': '/clearing/',
  'maha-research': '/federation/',
  'agentic-publishing': '/agentic-publishing/',
  'maha-os': '/knowledge/',
  'mayone-maharajan': '/concepts/',
  'mayon-rajan': '/mayon-volcano/',
  'maha-policy': '/policy/',
}

function normalizePath(path: string) {
  const pathname = path.startsWith('http') ? new URL(path).pathname : path
  const normalized = `/${pathname.split('/').filter(Boolean).join('/')}`
  return normalized === '/' ? normalized : normalized.replace(/\/$/, '')
}

export function createFederationPropertyAdapter(manifest: PropertyManifest) {
  if (provenanceDigest(manifest) !== manifest.provenanceDigest) throw new Error(`Property manifest digest does not verify for ${manifest.siteId}.`)
  const contract = SITE_CONTRACTS.find((entry) => entry.siteId === manifest.siteId)
  if (!contract || contract.canonicalHost !== manifest.canonicalHost) throw new Error(`Canonical host mismatch for ${manifest.siteId}.`)
  const rootPath = ROOT_PATHS[manifest.siteId]
  const pages = manifest.pages.filter((page) => page.adoption.state === 'ready-for-owner-integration')
  if (pages.some((page) => page.canonicalHost !== manifest.canonicalHost || new URL(page.canonicalUrl).host !== manifest.canonicalHost)) throw new Error(`A page crossed the ${manifest.siteId} host boundary.`)
  if (pages.some((page) => !normalizePath(page.path).startsWith(rootPath.slice(0, -1)))) throw new Error(`A page crossed the ${manifest.siteId} route root.`)
  const byPath = new Map(pages.map((page) => [normalizePath(page.path), page]))
  if (byPath.size !== pages.length) throw new Error(`Duplicate route path in ${manifest.siteId}.`)

  return {
    siteId: manifest.siteId,
    canonicalHost: manifest.canonicalHost,
    rootPath,
    count: pages.length,
    staticParams: () => pages.map((page) => ({ segments: normalizePath(page.path).slice(rootPath.length).split('/').filter(Boolean) })),
    resolve: (path: string): Page | null => byPath.get(normalizePath(path)) ?? null,
    metadata: (path: string) => {
      const page = byPath.get(normalizePath(path))
      if (!page) return null
      return { title: page.title, description: page.directAnswer, alternates: { canonical: page.canonicalUrl } }
    },
    structuredData: (path: string) => byPath.get(normalizePath(path))?.structuredData ?? null,
    answerRegistry: () => pages.flatMap((page) => page.boundedAnswers.map((answer, index) => ({ candidateId: page.candidateId, canonicalUrl: page.canonicalUrl, answerIndex: index + 1, ...answer, contentDigest: page.contentDigest }))),
    publicationBoundary: 'The adapter resolves local content only. The owner route must still bind an exact revision and active canonical release before crawlability; a missing or unready path resolves to null.',
  }
}

export function propertyAdapterContract(manifest: PropertyManifest) {
  const adapter = createFederationPropertyAdapter(manifest)
  const entries = adapter.staticParams().map(({ segments }) => {
    const path = `${adapter.rootPath}${segments.join('/')}`
    const page = adapter.resolve(path)!
    return { candidateId: page.candidateId, path: page.path, canonicalUrl: page.canonicalUrl, segments, contentDigest: page.contentDigest }
  })
  const body = {
    schemaVersion: 'maha-federation-property-route-adapter/1.0',
    siteId: adapter.siteId,
    canonicalHost: adapter.canonicalHost,
    rootPath: adapter.rootPath,
    sourceManifestDigest: manifest.provenanceDigest,
    state: 'local-owner-handoff',
    ownerIntegration: {
      routeShape: `${adapter.rootPath}[...segments]`,
      staticParameters: true,
      dynamicParameters: false,
      metadataFromExactPage: true,
      structuredDataFromExactPage: true,
      missingOrUnreadyReturnsNotFound: true,
      exactRevisionReviewRequired: true,
      activeCanonicalReleaseRequired: true,
    },
    counts: { routes: entries.length, boundedAnswers: adapter.answerRegistry().length, publicRoutesCreated: 0, buildsRun: 0 },
    publicationBoundary: adapter.publicationBoundary,
    entries,
  }
  return { ...body, provenanceDigest: provenanceDigest(body) }
}
