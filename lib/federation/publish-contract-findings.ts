/**
 * Publish foundation audit: agentic-query-letter, machine-readable-article,
 * publishing-observability.
 *
 * All three are concepts on publish.mahastrategies.com, whose route adapter is
 * in state local-owner-handoff: this repository resolves local content for the
 * property but does not own its runtime. An implementation backing one of these
 * concepts could therefore live in the owning repository and be invisible here.
 * A finding of "no implementation" below means no implementation *in this
 * repository*, which is the only thing this audit can see.
 *
 * The standard applied is exactness. A module that resembles a concept is not
 * an implementation of it. This distinction is the one that matters here,
 * because all three concepts are proposals: a query letter written by an agent,
 * an article a machine can read, observability over publishing. None is an
 * established standard, and citing an adjacent module as backing would turn a
 * proposal into a standard by association — which is the specific failure this
 * audit exists to avoid.
 *
 * On that standard, none of the three has an exact implementation here, so all
 * three keep their unresolved role. What each does have is recorded, because a
 * near-miss is useful to whoever eventually builds the thing, provided it is
 * labelled a near-miss.
 */

export type PublishConceptFinding = {
  conceptId: string
  concept: string
  owningProperty: string
  /** The verdict for the concept's routes. Never upgraded by adjacency. */
  role: 'revise' | 'blocked' | 'evidence-ready'
  implementationStatus: 'exact-implementation' | 'adjacent-pattern-only' | 'none-found'
  /** What was searched, so a later reader can tell absence from oversight. */
  searched: readonly string[]
  /** Real code found, and precisely why it does or does not back the concept. */
  nearestImplementation: {
    locator: string
    whatItIs: string
    whyItIsNotThisConcept: string
  } | null
  fixturesCreated: boolean
  reason: string
}

export const PUBLISH_CONCEPT_FINDINGS: readonly PublishConceptFinding[] = [
  {
    conceptId: 'urn:maha:concept:release:agentic-query-letter',
    concept: 'Agentic query letter',
    owningProperty: 'publish.mahastrategies.com (adapter state: local-owner-handoff)',
    role: 'revise',
    implementationStatus: 'adjacent-pattern-only',
    searched: [
      'lib/ for queryLetter, query-letter, submission, pitch, manuscript',
      'app/api/ for a submission or query endpoint',
      'test/ for any covering test',
    ],
    nearestImplementation: {
      locator: 'lib/agent-inquiries.ts — InquiryStatus, parseInquiry',
      whatItIs:
        'A machine-submitted structured inquiry with a review lifecycle — received, under_review, ' +
        'needs_clarification, declined, approved_for_scoping — gated on requesterAuthorized being true before an ' +
        'inquiry can be sent, and authenticated by bearer token with a fingerprint recorded.',
      whyItIsNotThisConcept:
        'It is an inquiry about a commercial offer, not a submission of work for publication. The shape is ' +
        'genuinely similar and worth reusing — a machine submits a structured proposal, a gatekeeper accepts, ' +
        'declines or asks for clarification — but similarity of shape is not implementation of the concept. ' +
        'Nothing here models a manuscript, a work, an author, or a publishing decision.',
    },
    fixturesCreated: false,
    reason:
      'No implementation of an agentic query letter exists in this repository. The concept stays revise. ' +
      'lib/agent-inquiries.ts is recorded as a reusable lifecycle pattern for whoever builds it, explicitly as a ' +
      'pattern and not as evidence.',
  },
  {
    conceptId: 'urn:maha:concept:release:machine-readable-article',
    concept: 'Machine-readable article',
    owningProperty: 'publish.mahastrategies.com (adapter state: local-owner-handoff)',
    role: 'revise',
    implementationStatus: 'none-found',
    searched: [
      'lib/ for an Article, NewsArticle or ScholarlyArticle schema type',
      'lib/entity.ts, the repository\'s JSON-LD source of truth',
      'lib/ and app/ for content negotiation or an application/ld+json article response',
      'lib/llms-manifest.ts and lib/mcp-public-manifest.ts for an article contract',
    ],
    nearestImplementation: {
      locator: 'lib/entity.ts — mahaEntityGraphJsonLd',
      whatItIs:
        'The repository\'s schema.org JSON-LD graph, emitting Organization, Person, WebSite, SoftwareApplication, ' +
        'WebApplication and Book nodes.',
      whyItIsNotThisConcept:
        'It contains no Article type of any kind — not Article, NewsArticle or ScholarlyArticle. It describes the ' +
        'organisation and its products, never a unit of published writing. There is no article schema, no content ' +
        'negotiation, and no machine-retrievable article representation anywhere in this repository.',
    },
    fixturesCreated: false,
    reason:
      'No article schema exists here, so no fixture can be bounded against one. The concept stays revise. Five of ' +
      'its seven route candidates are nevertheless already evidence-ready, which this audit does not change and ' +
      'does not endorse: those pages were assessed against their own sources, and whether an external standard ' +
      'carries them is a question for their own review, not for an implementation audit.',
  },
  {
    conceptId: 'urn:maha:concept:release:publishing-observability',
    concept: 'Publishing observability',
    owningProperty: 'publish.mahastrategies.com (adapter state: local-owner-handoff)',
    role: 'revise',
    implementationStatus: 'adjacent-pattern-only',
    searched: [
      'lib/observability/ in full — alerts, contracts, paging, readiness, receiver, release-alerts, sentry, telemetry',
      'lib/release-health.ts',
      'test/observability.test.ts and test/release-health.test.ts',
    ],
    nearestImplementation: {
      locator: 'lib/release-health.ts — RELEASE_MANIFEST_SCHEMA, checkProductionRelease; lib/observability/release-alerts.ts — RELEASE_ALERT_EVENTS',
      whatItIs:
        'A real, tested release-observability implementation: a versioned production release manifest schema, ' +
        'health checks against a deployment, an enumerated set of release alert events, PagerDuty paging with ' +
        'deduplication and recovery detection, and a rollback rehearsal path.',
      whyItIsNotThisConcept:
        'It observes this site\'s own production deployment — did the release land, is it healthy, page someone if ' +
        'not. Publishing observability concerns the publishing pipeline of another property: whether a work was ' +
        'published, to what, when, and whether a reader or machine could retrieve it. The subject differs even ' +
        'though the machinery rhymes.',
    },
    fixturesCreated: false,
    reason:
      'The observability machinery here is real and tested, but it observes deployments rather than publications. ' +
      'The single route candidate for this concept is a definition and stays revise. Building the concept on this ' +
      'machinery is plausible; asserting that the machinery already implements it is not.',
  },
]

export const AUDIT_BOUNDARY =
  'This audit sees one repository. All three concepts belong to a property in local-owner-handoff, so an ' +
  'implementation may exist in the owning repository and would not appear here. No finding below should be read ' +
  'as "this does not exist anywhere" — only as "this repository does not implement it", which is what was checked.'
