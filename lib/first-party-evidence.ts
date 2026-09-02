import { createHash } from 'node:crypto'

import { canonicalJson } from './evidence-dossier/digest.ts'
import { gradeEvidence, type EvidenceProfile, type InspectionAttestation } from './legacy-evidence-levels.ts'

/**
 * First-party documentation, kept permanently apart from independent evidence.
 *
 * Thirteen supplier pages were blocked because the only documentation that
 * exists for them is written by the company being described. Leaving them
 * blocked forever is not honest either: a reader is better served by "here is
 * what this company publishes about itself, and here is why that is not
 * verification" than by nothing at all.
 *
 * So this is a separate tier, not a weaker one. A first-party profile can
 * never satisfy an independent-evidence check: `explanatory` is forced false,
 * the disclosure is mandatory, and the claim vocabulary is restricted to what
 * an organisation can say about itself.
 */

export const FIRST_PARTY_TIER = 'first-party-documented' as const

/** States a page may occupy. First-party is never merged with independent. */
export const PAGE_STATES = [
  'legacy-unchanged',
  'structurally-uplifted',
  'first-party-documented',
  'independently-source-supported',
  'blocked',
] as const
export type PageState = (typeof PAGE_STATES)[number]

/** What first-party evidence may never be treated as. */
export const FIRST_PARTY_IS_NOT = [
  'independently-supported', 'empirically-verified', 'replicated',
  'comparative-evidence', 'endorsement', 'production-performance-validation',
] as const

export const FIRST_PARTY_DISCLOSURE =
  'Evidence basis: Official first-party documentation. This page describes the supplier’s own published claims and does not independently verify performance, reliability, yield or comparative advantage.'

/**
 * Wording a first-party page may never carry.
 *
 * These are the claims a company cannot establish about itself no matter how
 * carefully its own document is inspected.
 */
export const PROHIBITED_FIRST_PARTY_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'superiority', pattern: /\b(best|leading|superior|world[- ]class|market[- ]leading|number one|unmatched|fastest|highest[- ]performing)\b/i },
  { name: 'comparative advantage', pattern: /\b(outperforms?|better than|ahead of|compared (favourably|favorably)|advantage over)\b/i },
  { name: 'measured performance', pattern: /\b(measured|demonstrated|achieved)\s+(throughput|yield|uptime|accuracy|performance)\b/i },
  { name: 'reliability claim', pattern: /\b(proven reliability|field[- ]proven|reliability of \d|failure rate of)\b/i },
  { name: 'production yield', pattern: /\b(production yield|yield of \d|yield improvement of)\b/i },
  { name: 'industry-wide adoption', pattern: /\b(industry[- ]standard|universally adopted|used by (all|most|every)|de facto standard)\b/i },
  { name: 'purchasing recommendation', pattern: /\b(recommend(ed)? (for|to)|should (buy|choose|select)|preferred supplier|ranked)\b/i },
]

export function scanFirstPartyText(text: string): readonly string[] {
  return PROHIBITED_FIRST_PARTY_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.name)
}

export interface FirstPartyDocument {
  organisation: string
  /** The page whose subject this organisation is. A vendor documents only itself. */
  documentsOrganisation: string
  title: string
  documentKind: 'technical-pdf' | 'product-manual' | 'process-description' | 'datasheet' | 'investor-filing' | 'product-overview' | 'marketing-landing-page'
  publisher: string
  publishedOrVersion: string
  url: string
  inspectedOn: string
  /** A mutable page is fingerprinted so a later change is detectable. */
  contentFingerprint: string
  exactLocator: string
  observedContent: string
  establishes: string
  doesNotEstablish: string
  accessBasis: 'public' | 'login-gated' | 'customer-only' | 'terms-restricted'
}

export interface FirstPartyVerdict {
  eligible: boolean
  refusals: readonly string[]
  disclosureRequired: string
  /** Always false. First-party evidence is never independently explanatory. */
  independentlyExplanatory: false
  state: PageState
}

const sha = (v: unknown) => `sha256:${createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex')}`

export function fingerprintContent(text: string): string {
  return sha(text).slice(7, 39)
}

/**
 * Whether a supplier page may carry the first-party tier.
 *
 * The organisation check is the one that matters most: a vendor's document
 * describes that vendor. Letting one company's document support another
 * company's page would turn self-description into third-party reporting.
 */
export function evaluateFirstParty(
  document: FirstPartyDocument,
  pageOrganisation: string,
  renderedText = '',
): FirstPartyVerdict {
  const refusals: string[] = []

  if (document.documentsOrganisation !== pageOrganisation) refusals.push('document-describes-another-organisation')
  if (document.organisation !== document.documentsOrganisation) refusals.push('publisher-is-not-the-subject')
  if (document.accessBasis !== 'public') refusals.push('access-restricted-source')
  if (!document.url || document.url.length < 10) refusals.push('no-locator')
  if (!document.exactLocator.trim()) refusals.push('no-exact-locator')
  if (document.observedContent.trim().length < 40) refusals.push('content-not-inspected')
  if (!document.contentFingerprint) refusals.push('no-content-fingerprint')
  if (document.doesNotEstablish.trim().length < 20) refusals.push('no-stated-boundary')

  // The line that matters is specifics against adjectives. A product overview
  // naming product families and the processes they perform documents
  // something; a landing page carrying only superlatives documents nothing,
  // and no amount of careful inspection turns adjectives into a fact.
  if (document.documentKind === 'marketing-landing-page') refusals.push('marketing-page-documents-no-specifics')

  const overclaims = scanFirstPartyText(`${document.establishes} ${renderedText}`)
  for (const overclaim of overclaims) refusals.push(`prohibited-claim:${overclaim}`)

  return {
    eligible: refusals.length === 0,
    refusals,
    disclosureRequired: FIRST_PARTY_DISCLOSURE,
    independentlyExplanatory: false,
    state: refusals.length === 0 ? 'first-party-documented' : 'blocked',
  }
}

/**
 * First-party evidence graded against the independent contract.
 *
 * It is run through the same grader deliberately, so the result is a fact
 * rather than a convention: subject alignment holds, but the source is not
 * independent, and `explanatory` comes back false every time.
 */
export function gradeAsIndependent(
  document: FirstPartyDocument, attestation: InspectionAttestation,
): EvidenceProfile & { independentTierClaimed: false } {
  const graded = gradeEvidence({
    sourceId: document.url,
    declaredUrl: document.url,
    establishes: document.establishes,
    boundary: document.doesNotEstablish,
    attestation,
  })
  // Whatever the levels say, a self-published document is not independent.
  return { ...graded, explanatory: false, independentTierClaimed: false }
}

/** An old document says what was true when published, not what is true now. */
export function assertNoCurrentAvailabilityInference(document: FirstPartyDocument, claim: string): void {
  if (/\b(currently|today|now|still)\s+(offers?|sells?|provides?|available)\b/i.test(claim)) {
    throw new Error(
      `${document.url} is dated ${document.publishedOrVersion}. It records what was published then, and cannot establish current availability.`,
    )
  }
}
