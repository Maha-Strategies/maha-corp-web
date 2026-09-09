// Server-side, lazily loaded by the two corpus products. No private decision corpora.
import agenticPublishing from '../../content/federation/implementations/agentic-publishing-pages-v2.json' with { type: 'json' }
import mahaOs from '../../content/federation/implementations/maha-os-pages-v2.json' with { type: 'json' }
import mahaPolicy from '../../content/federation/implementations/maha-policy-pages-v2.json' with { type: 'json' }
import mahaResearch from '../../content/federation/implementations/maha-research-pages-v2.json' with { type: 'json' }
import mahaStrategies from '../../content/federation/implementations/maha-strategies-pages-v2.json' with { type: 'json' }
import mayonRajan from '../../content/federation/implementations/mayon-rajan-pages-v2.json' with { type: 'json' }
import mayoneMaharajan from '../../content/federation/implementations/mayone-maharajan-pages-v2.json' with { type: 'json' }
import ledger from '../../content/federation/public/federation-canonical-release-ledger-v1.json' with { type: 'json' }
import index from '../../content/federation/public/federation-public-route-index-v1.json' with { type: 'json' }
import baseline from '../../content/federation/federation-route-baseline-v1.json' with { type: 'json' }
import { digest } from '../federation/readiness-tranche-22.ts'
import { provenanceDigest } from '../evidence-dossier/digest.ts'
import type { FederationPage, FederationRelease } from '../federation-publication.ts'
import { getTiruvaymoliAtlasTopic, getTiruvaymoliAtlasAnswers, TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY, TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST, TIRUVAYMOLI_ATLAS_SOURCES, TIRUVAYMOLI_ATLAS_QUALITY, tiruvaymoliAtlasTopicPath } from '../tiruvaymoli-passage-atlas.ts'

type Row = Record<string, unknown>
type Manifest = { siteId: string; canonicalHost: string; pages: FederationPage[]; provenanceDigest: string }
type RouteEntry = { candidateId: string; siteId: string; canonicalUrl: string; canonicalHost: string; path: string; releaseId: string; targetContentDigest: string; releaseDigest: string }
export type ReleaseCorpus = { manifests: Manifest[]; ledger: { entries: FederationRelease[]; provenanceDigest: string }; index: { entries: RouteEntry[]; provenanceDigest: string } }
const corpus = { manifests: [agenticPublishing, mahaOs, mahaPolicy, mahaResearch, mahaStrategies, mayonRajan, mayoneMaharajan], ledger, index } as unknown as ReleaseCorpus
const omit = (v: object, key: string) => Object.fromEntries(Object.entries(v).filter(([k]) => k !== key))
const verify = (v: object, key: string, expected: string) => { if (digest(omit(v, key)) !== expected) throw new Error('corpus-integrity-refused') }

/** Independent exact binding checks, testable against corrupted snapshots. No release mutation. */
export function projectReleasePacket(input: Row, supplied: ReleaseCorpus): Row {
  verify(supplied.ledger, 'provenanceDigest', supplied.ledger.provenanceDigest)
  verify(supplied.index, 'provenanceDigest', supplied.index.provenanceDigest)
  const matches = supplied.manifests.flatMap(manifest => manifest.pages.filter(p => p.canonicalUrl === input.canonicalUrl).map(page => ({ manifest, page })))
  if (matches.length !== 1) throw new Error('unsupported-canonical-url')
  const { manifest, page } = matches[0]
  verify(manifest, 'provenanceDigest', manifest.provenanceDigest)
  verify(page, 'contentDigest', page.contentDigest)
  const releases = supplied.ledger.entries.filter(r => r.candidateId === page.candidateId)
  const routes = supplied.index.entries.filter(r => r.candidateId === page.candidateId)
  if (releases.length !== 1 || routes.length !== 1) throw new Error('release-cardinality-refused')
  const release = releases[0], route = routes[0]
  verify(release, 'releaseDigest', release.releaseDigest)
  if (release.status !== 'active' || !page.adoption.exactRevisionReviewed || page.adoption.blockedDependencies.length ||
    page.contentDigest !== input.expectedContentDigest || release.releaseDigest !== input.expectedReleaseDigest ||
    release.targetContentDigest !== page.contentDigest || route.targetContentDigest !== page.contentDigest || route.releaseDigest !== release.releaseDigest || route.releaseId !== release.releaseId ||
    manifest.siteId !== page.siteId || manifest.canonicalHost !== page.canonicalHost) throw new Error('release-binding-refused')
  for (const key of ['canonicalHost', 'canonicalUrl', 'path', 'siteId'] as const) if (release[key] !== page[key] || route[key] !== page[key]) throw new Error('host-or-route-substitution')
  const url = new URL(page.canonicalUrl)
  if (url.protocol !== 'https:' || url.host !== page.canonicalHost || url.pathname !== page.path || url.search || url.hash || url.username || url.password) throw new Error('canonical-url-refused')
  // Each output field is chosen explicitly. No spreading a source, page, review or release object.
  return {
    canonicalUrl: page.canonicalUrl, title: page.title, contentDigest: page.contentDigest,
    release: { releaseId: release.releaseId, releaseDigest: release.releaseDigest, status: release.status },
    review: { exactRevisionReviewed: true, basis: 'recorded-repository-review-state; reviewer tier not supplied by this projection', expertReviewClaimed: false },
    sourceSnapshot: 'deployed-repository; not live external-registry observation',
    sources: page.sources.map(s => ({ sourceId: s.sourceId, title: s.title, url: s.url, locator: s.locator,
      scope: s.establishes, boundary: s.doesNotEstablish, rightsBasis: s.rightsBasis, inspectionDepth: s.inspectionDepth })),
    inspectionPerformedThisCall: false, redistributionRightsGranted: false,
  }
}

export async function releasePacket(input: Row): Promise<Row> { return projectReleasePacket(input, corpus) }

export async function passagePacket(input: Row): Promise<Row> {
  if (input.expectedRegistryDigest !== TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST || provenanceDigest(TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY) !== TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST) throw new Error('atlas-revision-refused')
  if (provenanceDigest(baseline) !== baseline.provenanceDigest) throw new Error('baseline-integrity-refused')
  const topic = getTiruvaymoliAtlasTopic(input.slug as string)
  if (!topic || !TIRUVAYMOLI_ATLAS_QUALITY.find(q => q.topicSlug === topic.slug)?.eligible) throw new Error('atlas-unit-refused')
  const canonicalUrl = `https://www.mahastrategies.com${tiruvaymoliAtlasTopicPath(topic)}`
  if (!baseline.observedProperties.some(p => p.routes.includes(canonicalUrl))) throw new Error('atlas-publication-not-recorded')
  return { canonicalUrl, registryDigest: TIRUVAYMOLI_ATLAS_REGISTRY_DIGEST, title: topic.title, passageRange: topic.range,
    voice: topic.voice, place: topic.place, devotionalContext: topic.devotionalContext, names: [...topic.names],
    identityRelationship: topic.identityRelationship, notEstablished: topic.notEstablished,
    editions: TIRUVAYMOLI_ATLAS_SOURCES.map(s => ({ sourceId: s.id, title: s.title, publisher: s.publisher, url: s.url, version: s.version, frame: s.frame, inspectedLocator: s.inspectedLocator, rightsBasis: s.rightsBasis, boundary: s.boundary })),
    answers: getTiruvaymoliAtlasAnswers(topic.slug).map(a => ({ question: a.question, answer: a.answer })),
    relatedUrls: TIRUVAYMOLI_ATLAS_PUBLIC_REGISTRY.topics.find(t => t.slug === topic.slug)!.connectedConceptPaths.map(p => `https://www.mahastrategies.com${p}`),
    limitations: [...topic.limitations], sourceTextIncluded: false, redistributionRightsGranted: false, expertReviewClaimed: false,
  }
}
