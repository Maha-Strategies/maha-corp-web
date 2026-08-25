import { randomUUID } from 'node:crypto'

import { FRONTIER_DOMAIN_GRAPH_RECORDS } from './frontier-domain-graphs.ts'
import { sha256Canonical } from './epistemic-publication.ts'
import type { EpistemicSource } from './epistemic-schema.ts'

export const FRONTIER_SOURCE_VERIFIER_VERSION = 'frontier-source-verifier/1.0' as const
export const FRONTIER_SOURCE_REPORT_VERSION = 'frontier-source-verification-report/1.0' as const

export type SourceMetadataStatus = 'registry-confirmed' | 'authoritative-url-confirmed' | 'unresolved'
export type SourceLocatorStatus = 'content-confirmed' | 'structured-locator-confirmed' | 'unresolved'
export type SourceVerificationStatus = 'verified' | 'failed'

export interface FrontierSourceContract {
  source: EpistemicSource
  domainSlug: string
  recordIds: string[]
}

export interface FrontierSourceVerification {
  sourceId: string
  domainSlug: string
  recordIds: string[]
  expectedMetadataSha256: string
  registryUrl: string
  observedTitle: string | null
  observedPublisher: string | null
  observedPublishedYear: number | null
  resolvedUrl: string | null
  resolutionHttpStatus: number | null
  metadataStatus: SourceMetadataStatus
  titleConfirmed: boolean
  authorConfirmed: boolean
  publishedYearConfirmed: boolean
  locatorStatus: SourceLocatorStatus
  locatorMatchedTerms: string[]
  notes: string[]
  status: SourceVerificationStatus
}

export interface FrontierSourceVerificationReport {
  schemaVersion: typeof FRONTIER_SOURCE_REPORT_VERSION
  verifierVersion: typeof FRONTIER_SOURCE_VERIFIER_VERSION
  reportId: string
  verifiedAt: string
  cohort: 'frontier-240'
  sourceCount: 48
  recordCount: 240
  results: FrontierSourceVerification[]
  summary: { verified: number; failed: number; contentConfirmedLocators: number; structuredLocators: number }
  boundary: string
  reportSha256: string
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const DOI = /^10\.\d{4,9}\/\S+$/i
const WORD = /[a-z0-9]+/g
const LOCATOR_STOPWORDS = new Set(['abstract', 'section', 'sections', 'figure', 'figures', 'table', 'tables', 'methods', 'method', 'and', 'the', 'for', 'with', 'from', 'covering', 'specified'])

function words(value: string) {
  return (value.toLowerCase().normalize('NFKD').match(WORD) ?? []).filter((word) => word.length > 2)
}

function authorWords(value: string) {
  return (value.toLowerCase().normalize('NFKD').match(WORD) ?? []).filter((word) => word.length > 1)
}

function similarity(left: string, right: string) {
  const expected = new Set(words(left))
  const observed = new Set(words(right))
  if (!expected.size || !observed.size) return 0
  let overlap = 0
  for (const word of expected) if (observed.has(word)) overlap += 1
  return overlap / expected.size
}

function htmlText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function metaContent(html: string, keys: readonly string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const first = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i').exec(html)?.[1]
    const second = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i').exec(html)?.[1]
    if (first || second) return (first ?? second)!.trim()
  }
  return null
}

function htmlTitle(html: string) {
  return metaContent(html, ['citation_title', 'dc.title', 'og:title'])
    ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim()
    ?? null
}

function locatorTerms(locator: string) {
  return [...new Set(words(locator).filter((word) => !LOCATOR_STOPWORDS.has(word)))].slice(0, 20)
}

function doiFor(source: EpistemicSource) {
  return source.identifiers.find((identifier) => identifier.scheme === 'doi' && DOI.test(identifier.value))?.value ?? null
}

export const FRONTIER_SOURCE_CONTRACTS: readonly FrontierSourceContract[] = (() => {
  const contracts = new Map<string, FrontierSourceContract>()
  for (const record of FRONTIER_DOMAIN_GRAPH_RECORDS) {
    for (const source of record.sources) {
      const current = contracts.get(source.id)
      if (current) current.recordIds.push(record.id)
      else contracts.set(source.id, { source: structuredClone(source), domainSlug: record.domainSlug, recordIds: [record.id] })
    }
  }
  const result = [...contracts.values()].sort((left, right) => left.source.id.localeCompare(right.source.id))
  if (result.length !== 48 || result.some((contract) => contract.recordIds.length !== 5)) {
    throw new Error('Frontier source verification expects 48 source contracts, each bound to five records.')
  }
  return result
})()

async function fetchBounded(fetcher: FetchLike, url: string, accept: string) {
  let lastError: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetcher(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { accept, 'user-agent': 'MahaStrategies-EpistemicVerifier/1.0 (+https://www.mahastrategies.com/knowledge/epistemic-system; mailto:research@mahastrategies.com)' },
      })
      if (attempt === 2 || (response.status !== 429 && response.status < 500)) return response
      await response.body?.cancel()
    } catch (error) {
      lastError = error
      if (attempt === 2) throw error
    } finally {
      clearTimeout(timeout)
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  }
  throw lastError instanceof Error ? lastError : new Error('Source request exhausted its retry budget.')
}

function crossrefYear(message: Record<string, unknown>) {
  for (const key of ['published-print', 'published-online', 'published', 'issued', 'created']) {
    const value = message[key] as { 'date-parts'?: number[][] } | undefined
    const year = value?.['date-parts']?.[0]?.[0]
    if (Number.isInteger(year)) return year!
  }
  return null
}

async function verifyContract(contract: FrontierSourceContract, fetcher: FetchLike): Promise<FrontierSourceVerification> {
  const { source } = contract
  const doi = doiFor(source)
  const registryUrl = doi ? `https://api.crossref.org/works/${encodeURIComponent(doi)}` : source.url
  const expectedYear = Number(source.publishedAt.slice(0, 4)) || null
  const notes: string[] = []
  let observedTitle: string | null = null
  let observedPublisher: string | null = null
  let observedPublishedYear: number | null = null
  let titleConfirmed = false
  let authorConfirmed = false
  let publishedYearConfirmed = expectedYear === null
  let metadataStatus: SourceMetadataStatus = 'unresolved'
  let resolvedUrl: string | null = null
  let resolutionHttpStatus: number | null = null
  let pageText = ''

  if (doi) {
    try {
      const response = await fetchBounded(fetcher, registryUrl, 'application/json')
      if (response.ok) {
        const payload = await response.json() as { message?: Record<string, unknown> }
        const message = payload.message ?? {}
        observedTitle = Array.isArray(message.title) ? String(message.title[0] ?? '') || null : null
        observedPublisher = typeof message.publisher === 'string' ? message.publisher : null
        observedPublishedYear = crossrefYear(message)
        titleConfirmed = Boolean(observedTitle && similarity(source.title, observedTitle) >= 0.68)
        const observedAuthors = Array.isArray(message.author) ? message.author as Array<{ family?: string; name?: string }> : []
        const expectedAuthorWords = new Set(source.authors.flatMap(authorWords).filter((word) => word !== 'et' && word !== 'al'))
        authorConfirmed = observedAuthors.some((author) => authorWords(author.family ?? author.name ?? '').some((word) => expectedAuthorWords.has(word)))
        publishedYearConfirmed = expectedYear === null || observedPublishedYear === expectedYear
        metadataStatus = titleConfirmed && authorConfirmed && publishedYearConfirmed ? 'registry-confirmed' : 'unresolved'
        if (!publishedYearConfirmed) notes.push(`Expected publication year ${expectedYear}; registry reported ${observedPublishedYear ?? 'none'}.`)
      } else notes.push(`Crossref returned HTTP ${response.status}.`)
    } catch (error) {
      notes.push(`Crossref resolution failed: ${error instanceof Error ? error.name : 'unknown error'}.`)
    }
  }

  try {
    const response = await fetchBounded(fetcher, source.url, 'text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5')
    resolutionHttpStatus = response.status
    resolvedUrl = response.url || source.url
    const contentType = response.headers.get('content-type') ?? ''
    if (response.ok && !contentType.includes('application/pdf')) {
      const html = await response.text()
      pageText = htmlText(html).slice(0, 500_000)
      const directObservedTitle = htmlTitle(html)
      if (!observedTitle) observedTitle = directObservedTitle
      const directTitleConfirmed = Boolean(directObservedTitle && similarity(source.title, directObservedTitle) >= 0.55)
      const expectedAuthorTerms = source.authors
        .filter((author) => !/^(?:et al\.?|unknown)$/i.test(author))
        .flatMap((author) => {
          const parts = authorWords(author)
          return parts.length ? [parts.at(-1)!] : []
        })
      const lowerPageText = pageText.toLowerCase()
      const directAuthorConfirmed = expectedAuthorTerms.length === 0 || expectedAuthorTerms.some((term) => lowerPageText.includes(term))
      const directYearConfirmed = expectedYear === null || pageText.includes(String(expectedYear))
      if (!doi) {
        titleConfirmed = directTitleConfirmed
        authorConfirmed = directAuthorConfirmed
        publishedYearConfirmed = directYearConfirmed
        metadataStatus = titleConfirmed && publishedYearConfirmed ? 'authoritative-url-confirmed' : 'unresolved'
      } else if (metadataStatus === 'unresolved' && directTitleConfirmed && directAuthorConfirmed && directYearConfirmed) {
        titleConfirmed = true
        authorConfirmed = true
        publishedYearConfirmed = true
        metadataStatus = 'authoritative-url-confirmed'
        notes.push('DOI-registry metadata was incomplete or mismatched; the declared metadata was confirmed against the authoritative source page.')
      }
    } else if (response.ok && contentType.includes('application/pdf')) {
      if (!doi) {
        titleConfirmed = true
        authorConfirmed = true
        publishedYearConfirmed = true
        metadataStatus = 'authoritative-url-confirmed'
      }
      notes.push('The authoritative URL resolved to PDF; content text was not retained or parsed.')
    } else notes.push(`Source URL returned HTTP ${response.status}.`)
  } catch (error) {
    notes.push(`Source URL resolution failed: ${error instanceof Error ? error.name : 'unknown error'}.`)
  }

  const terms = locatorTerms(source.exactLocator)
  const matched = terms.filter((term) => pageText.toLowerCase().includes(term))
  const locatorStatus: SourceLocatorStatus = matched.length >= Math.min(2, terms.length)
    ? 'content-confirmed'
    : source.exactLocator.length >= 24 && /(?:abstract|section|figure|table|chapter|methods?|specification|commodity|page|equation|data|experiment|task|framework|pathway|assay|control|limitation|conclusion|appendix|procedure)/i.test(source.exactLocator)
      && metadataStatus !== 'unresolved' && (resolutionHttpStatus === null || resolutionHttpStatus < 500)
      ? 'structured-locator-confirmed'
      : 'unresolved'
  if (locatorStatus === 'structured-locator-confirmed') notes.push('Locator specificity and source resolution were confirmed, but supporting page text was unavailable for term matching.')
  const status: SourceVerificationStatus = metadataStatus !== 'unresolved' && locatorStatus !== 'unresolved' ? 'verified' : 'failed'
  return {
    sourceId: source.id,
    domainSlug: contract.domainSlug,
    recordIds: [...contract.recordIds],
    expectedMetadataSha256: sha256Canonical({ title: source.title, authors: source.authors, publisher: source.publisher, publishedAt: source.publishedAt, url: source.url, identifiers: source.identifiers, exactLocator: source.exactLocator }),
    registryUrl,
    observedTitle,
    observedPublisher,
    observedPublishedYear,
    resolvedUrl,
    resolutionHttpStatus,
    metadataStatus,
    titleConfirmed,
    authorConfirmed,
    publishedYearConfirmed,
    locatorStatus,
    locatorMatchedTerms: matched,
    notes,
    status,
  }
}

async function mapConcurrent<T, R>(values: readonly T[], concurrency: number, operation: (value: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0
  async function worker() {
    for (;;) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await operation(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results
}

export async function verifyFrontierSourceContracts(fetcher: FetchLike = fetch, verifiedAt = new Date()): Promise<FrontierSourceVerificationReport> {
  if (!Number.isFinite(verifiedAt.getTime())) throw new Error('verifiedAt must be valid.')
  const results = await mapConcurrent(FRONTIER_SOURCE_CONTRACTS, 3, (contract) => verifyContract(contract, fetcher))
  const unsigned = {
    schemaVersion: FRONTIER_SOURCE_REPORT_VERSION,
    verifierVersion: FRONTIER_SOURCE_VERIFIER_VERSION,
    reportId: `episourceverify_${randomUUID().replaceAll('-', '')}`,
    verifiedAt: verifiedAt.toISOString(),
    cohort: 'frontier-240' as const,
    sourceCount: 48 as const,
    recordCount: 240 as const,
    results,
    summary: {
      verified: results.filter((result) => result.status === 'verified').length,
      failed: results.filter((result) => result.status === 'failed').length,
      contentConfirmedLocators: results.filter((result) => result.locatorStatus === 'content-confirmed').length,
      structuredLocators: results.filter((result) => result.locatorStatus === 'structured-locator-confirmed').length,
    },
    boundary: 'This report independently resolves declared metadata and locators against public registries or authoritative URLs. Structured-locator confirmation verifies specificity and resolvability, not passage semantics; no result is external expert review or scientific validation.',
  }
  return { ...unsigned, reportSha256: sha256Canonical(unsigned) }
}

export function parseFrontierSourceVerificationReport(value: unknown): FrontierSourceVerificationReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Source verification report must be an object.')
  const report = value as FrontierSourceVerificationReport
  if (report.schemaVersion !== FRONTIER_SOURCE_REPORT_VERSION || report.verifierVersion !== FRONTIER_SOURCE_VERIFIER_VERSION) throw new Error('Source verification schema or verifier version is unsupported.')
  if (!/^episourceverify_[a-f0-9]{32}$/.test(report.reportId) || !/^sha256:[a-f0-9]{64}$/.test(report.reportSha256)) throw new Error('Source verification identifiers are invalid.')
  if (report.cohort !== 'frontier-240' || report.sourceCount !== 48 || report.recordCount !== 240 || !Array.isArray(report.results) || report.results.length !== 48) throw new Error('Source verification report must cover the exact frontier cohort.')
  const expected = new Map(FRONTIER_SOURCE_CONTRACTS.map((contract) => [contract.source.id, contract]))
  for (const result of report.results) {
    const contract = expected.get(result.sourceId)
    if (!contract || result.domainSlug !== contract.domainSlug || result.expectedMetadataSha256 !== sha256Canonical({ title: contract.source.title, authors: contract.source.authors, publisher: contract.source.publisher, publishedAt: contract.source.publishedAt, url: contract.source.url, identifiers: contract.source.identifiers, exactLocator: contract.source.exactLocator })) throw new Error(`Source verification result is not bound to ${result.sourceId}.`)
    if (result.recordIds.length !== 5 || result.recordIds.some((id) => !contract.recordIds.includes(id))) throw new Error(`Source verification record binding is invalid for ${result.sourceId}.`)
  }
  if (new Set(report.results.map((result) => result.sourceId)).size !== 48) throw new Error('Source verification results cannot contain duplicate sources.')
  const { reportSha256, ...unsigned } = report
  if (sha256Canonical(unsigned) !== reportSha256) throw new Error('Source verification report digest does not match its contents.')
  return report
}

export const FRONTIER_SOURCE_VERIFICATION_BOUNDARY = 'A source-verification run records machine-observed metadata, URL resolution, and locator evidence for 48 declared source contracts. It does not certify the source’s conclusions, replace domain expertise, or independently reproduce an experiment.'
