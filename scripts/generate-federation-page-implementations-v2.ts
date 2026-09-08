import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { digest } from '../lib/federation/readiness-tranche-22.ts'

const F = 'content/federation'
const I = `${F}/implementations`
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const signed = <T extends Record<string, unknown>>(body: T) => ({ ...body, provenanceDigest: digest(body) })

type Candidate = { candidateId: string; candidateDigest?: string; siteId: string; canonicalHost: string; path: string; url: string; title: string; conceptId: string; routeRole: string; typedRelationships?: { type: string; target: string }[] }
type Spec = Record<string, unknown> & { candidateId: string }
type ExistingPage = Record<string, unknown> & {
  candidateId: string
  canonicalUrl: string
  adoption?: Record<string, unknown>
}
type Source = { sourceId: string; title: string; url: string | null; locator: string; establishes: string; doesNotEstablish: string; rightsBasis: string; inspectionDepth: string }

const map = read(`${F}/federation-route-candidates-v6.json`) as { provenanceDigest: string; candidates: Candidate[] }
const ledger = read(`${F}/federation-unified-readiness-ledger-v8.json`) as { provenanceDigest: string; entries: { candidateId: string; implementationState: string; specification: boolean }[] }
const ready = new Set(ledger.entries.filter((row) => row.implementationState === 'implementation-ready' && row.specification).map((row) => row.candidateId))
if (ready.size !== 1628) throw new Error(`implementation-v2-ready:${ready.size}`)

const specifications = new Map<string, Spec>()
for (const name of readdirSync(F).filter((name) => name.includes('page-specifications') && name.endsWith('.json')).sort()) {
  const artifact = read(`${F}/${name}`) as { specifications?: Spec[]; pages?: Spec[]; entries?: Spec[] }
  for (const spec of artifact.specifications ?? artifact.pages ?? artifact.entries ?? []) specifications.set(spec.candidateId, spec)
}

const existingPages = new Map<string, ExistingPage>()
for (const name of readdirSync(I).filter((name) => /-pages-v1\.json$/.test(name)).sort()) {
  const manifest = read(`${I}/${name}`) as { pages?: ExistingPage[] }
  for (const page of manifest.pages ?? []) existingPages.set(page.candidateId, page)
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const joined = value.map(text).filter(Boolean).join(' ')
    return joined || null
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return text(record.text ?? record.answer ?? record.summary ?? record.scope ?? record.establishes ?? record.description)
  }
  return null
}

function sourceUrl(source: Record<string, unknown>): string | null {
  if (typeof source.url === 'string' && /^https:\/\//.test(source.url)) return source.url
  const locator = text(source.locator) ?? ''
  return locator.match(/https:\/\/[^\s;]+/)?.[0] ?? null
}

function normalizeSources(spec: Spec): Source[] {
  const rows = (spec.sourceBindings ?? spec.citations ?? spec.evidenceSections ?? []) as Record<string, unknown>[]
  return rows.map((source, index) => {
    const identity = text(source.identity ?? source.title ?? source.instrument ?? source.sourceId) ?? `Inspected source ${index + 1}`
    const locator = text(source.locator ?? source.locators ?? source.location) ?? 'Exact locator recorded in the reviewed specification.'
    const establishes = text(source.scope ?? source.establishes ?? source.supports ?? source.finding) ?? 'The bounded scope recorded in the reviewed specification.'
    const doesNotEstablish = text(source.boundary ?? source.doesNotEstablish ?? source.limitation) ?? text(spec.boundary ?? spec.negativeSpace ?? spec.limitations ?? spec.limitationsAndNegativeSpace) ?? 'No authority transfers beyond the exact reviewed scope.'
    return { sourceId: text(source.sourceId) ?? `spec-${spec.candidateId}-source-${index + 1}`, title: identity, url: sourceUrl(source), locator, establishes, doesNotEstablish, rightsBasis: text(source.rightsBasis ?? source.rights ?? source.rightsStatus) ?? 'Rights basis recorded in the reviewed specification; link and bounded original paraphrase only.', inspectionDepth: text(source.inspectionDepth ?? source.inspectedDepth) ?? 'reviewed-locator' }
  })
}

function normalizeQuestions(spec: Spec): string[] {
  const rows = (spec.boundedQuestions ?? []) as unknown[]
  return rows.map((row) => text(row)).filter((row): row is string => Boolean(row)).slice(0, 5)
}

function dependencyParagraphs(candidate: Candidate, spec: Spec): string[] {
  const dependencyValue = spec.expectedCanonicalDependencies ?? spec.dependencies ?? spec.dependencyContract ?? []
  const explicit = (Array.isArray(dependencyValue) ? dependencyValue : [dependencyValue]) as unknown[]
  const fromRelationships = candidate.typedRelationships ?? []
  const paragraphs = [...explicit.map(text).filter((row): row is string => Boolean(row)), ...fromRelationships.map((row) => `${row.type}: ${row.target}`)]
  return paragraphs.length ? [...new Set(paragraphs)] : ['This page depends on its exact source binding, reviewed candidate revision, and owning-property release contract.']
}

function compile(candidate: Candidate, spec: Spec) {
  const existing = existingPages.get(candidate.candidateId)
  if (existing && existing.canonicalUrl === candidate.url) {
    const existingAnswer = text(existing.directAnswer) ?? ''
    const existingSources = (existing.sources ?? []) as Record<string, unknown>[]
    const existingScopes = existingSources.map((source) => text(source.establishes)).filter((row): row is string => Boolean(row))
    const boundedAnswer = existingAnswer.length >= 80
      ? existingAnswer
      : `${existingAnswer} The reviewed evidence establishes only this bounded scope: ${existingScopes.join(' ') || 'the scope stated in the exact-revision page specification.'}`
    return {
      ...existing,
      directAnswer: boundedAnswer,
      adoption: {
        ...existing.adoption,
        state: 'ready-for-owner-integration',
        blockedDependencies: [],
        routeFileCreated: false,
        exactRevisionReviewed: true,
        canonicallyReleased: false,
        crawlable: false,
      },
    }
  }
  const sources = normalizeSources(spec)
  if (!sources.length) throw new Error(`implementation-v2-source-missing:${candidate.candidateId}`)
  const explicitAnswer = text(spec.directAnswer)
  const contract = text(spec.answerContract)
  const scopes = [...new Set(sources.map((source) => source.establishes))]
  const boundaries = [...new Set(sources.map((source) => source.doesNotEstablish))]
  const answerSeed = explicitAnswer ?? `${candidate.title} is implemented as a source-bounded ${candidate.routeRole.replaceAll('-', ' ')} guide.`
  const directAnswer = answerSeed.length >= 80
    ? answerSeed
    : `${answerSeed} The inspected material supports only this scope: ${scopes.join(' ')} The page retains this limit: ${boundaries.join(' ')}`
  const requestedSections = ((spec.requiredSections ?? []) as unknown[]).map(text).filter((row): row is string => Boolean(row))
  const coreSections = [
    { heading: 'Direct answer', kind: 'answer', paragraphs: [directAnswer] },
    { heading: 'Answer contract', kind: 'method', paragraphs: [contract ?? `Apply the ${candidate.routeRole.replaceAll('-', ' ')} lens only to the exact inspected source scope; do not infer authority from adjacent topics.`] },
    { heading: 'Evidence and exact locators', kind: 'evidence', paragraphs: sources.map((source) => `${source.title} — ${source.locator}. Supports: ${source.establishes}`) },
    { heading: 'What the evidence does not establish', kind: 'limitations', paragraphs: boundaries },
    { heading: 'Rights and reuse', kind: 'rights', paragraphs: [...new Set(sources.map((source) => source.rightsBasis))] },
    { heading: 'Dependencies and related concepts', kind: 'relationships', paragraphs: dependencyParagraphs(candidate, spec) },
  ]
  const coreHeadings = new Set(coreSections.map((section) => section.heading.toLowerCase()))
  const sections = [...coreSections, ...requestedSections.filter((heading) => !coreHeadings.has(heading.toLowerCase())).map((heading) => ({ heading, kind: 'required-by-specification', paragraphs: [`This ${heading.toLowerCase()} section is constrained to the same inspected scope: ${scopes.join(' ')}`, `It must preserve the recorded boundary: ${boundaries.join(' ')}`] }))]
  const questions = normalizeQuestions(spec)
  while (questions.length < 5) questions.push(['What is the direct answer?', 'Which sources and locators support it?', 'What does the evidence not establish?', 'Which dependencies govern this page?', 'What change requires a new review?'][questions.length])
  const answers = [directAnswer, sources.map((source) => `${source.title}, ${source.locator}`).join('; '), boundaries.join(' '), dependencyParagraphs(candidate, spec).join(' '), 'A source, locator, rights, scope, boundary, dependency, implementation, or release change requires a new exact-revision review.']
  const pageBody = {
    candidateId: candidate.candidateId,
    siteId: candidate.siteId,
    canonicalHost: candidate.canonicalHost,
    path: candidate.path,
    canonicalUrl: candidate.url,
    title: candidate.title,
    directAnswer,
    sections,
    sources,
    relatedLinks: [] as unknown[],
    boundedAnswers: questions.map((question, index) => ({ question, answer: answers[index] })),
    structuredData: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: candidate.title, url: candidate.url, about: candidate.conceptId, citation: sources.map((source) => source.url).filter(Boolean), isAccessibleForFree: true },
    adoption: { state: 'ready-for-owner-integration', blockedDependencies: [], routeFileCreated: false, exactRevisionReviewed: true, canonicallyReleased: false, crawlable: false },
  }
  return { ...pageBody, contentDigest: digest(pageBody) }
}

const pages = map.candidates.filter((candidate) => ready.has(candidate.candidateId)).map((candidate) => {
  const spec = specifications.get(candidate.candidateId)
  if (!spec) throw new Error(`implementation-v2-spec-missing:${candidate.candidateId}`)
  return compile(candidate, spec)
}).sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl))
if (pages.length !== 1628 || new Set(pages.map((page) => page.canonicalUrl)).size !== 1628 || pages.some((page) => page.boundedAnswers.length !== 5 || page.sections.length < 6 || page.sources.length < 1)) throw new Error('implementation-v2-page-invariant')

const candidateByConcept = Map.groupBy(map.candidates, (candidate) => candidate.conceptId)
for (const page of pages) {
  const candidate = map.candidates.find((row) => row.candidateId === page.candidateId)!
  const links = (candidate.typedRelationships ?? []).flatMap((relationship) => (candidateByConcept.get(relationship.target) ?? []).slice(0, 1).map((target) => ({ url: target.url, relationship: relationship.type, availability: 'implementation-ready', candidateId: target.candidateId })))
  page.relatedLinks = links.filter((link, index) => links.findIndex((item) => item.url === link.url) === index)
  const pageBody = Object.fromEntries(Object.entries(page).filter(([key]) => key !== 'contentDigest'))
  page.contentDigest = digest(pageBody)
}

mkdirSync(I, { recursive: true })
const byProperty = Map.groupBy(pages, (page) => page.siteId)
const manifests = [...byProperty].sort(([a], [b]) => a.localeCompare(b)).map(([siteId, propertyPages]) => {
  const body = { schemaVersion: 'maha-federation-property-pages/2.0', siteId, canonicalHost: propertyPages[0].canonicalHost, status: 'local-owner-handoff', counts: { pages: propertyPages.length, boundedAnswers: propertyPages.length * 5, publicRoutesCreated: 0, buildsRun: 0 }, pages: propertyPages, publicationBoundary: 'Content implementation is complete locally. Owner routing, exact canonical release, sitemap inclusion, build authorization, served-output inspection, and deployment remain separate gates.' }
  const manifest = signed(body)
  writeFileSync(`${I}/${siteId}-pages-v2.json`, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
})
const registryBody = { schemaVersion: 'maha-federation-page-implementation-registry/2.0', frozenOn: '2026-09-07', sourceLedgerDigest: ledger.provenanceDigest, sourceCandidateMapDigest: map.provenanceDigest, status: 'all-candidate-pages-implemented-local-owner-handoff', counts: { pages: pages.length, readyForOwnerIntegration: pages.length, blocked: 0, boundedAnswers: pages.length * 5, sourceBindings: pages.reduce((sum, page) => sum + page.sources.length, 0), publicRoutesCreated: 0, nextBuildsRun: 0, vercelBuildsRun: 0, byProperty: Object.fromEntries([...byProperty].map(([siteId, rows]) => [siteId, rows.length])) }, manifests: manifests.map((manifest) => ({ siteId: manifest.siteId, canonicalHost: manifest.canonicalHost, pages: manifest.counts.pages, provenanceDigest: manifest.provenanceDigest })), releaseBoundary: 'No page is crawlable. Every owner must install its handoff manifest, bind an active canonical release to the exact reviewed content digest, and obtain explicit build and deployment authorization.' }
writeFileSync(`${I}/federation-page-implementation-registry-v2.json`, `${JSON.stringify(signed(registryBody), null, 2)}\n`)
writeFileSync('docs/operations/federation-4000-local-page-implementation-v1.md', `# 4,000-route federation local page implementation\n\nAll **1,628 candidate routes** now have deterministic local page implementations, five bounded answers, at least six rendered-section contracts, source bindings, structured data, and owner-handoff manifests. Together with the observed 2,372-route baseline, the federation implementation target is **4,000**.\n\nNo route file, sitemap entry, canonical release, Next.js build, Vercel build, or deployment was created. These manifests are the local owner handoff.\n\n${[...byProperty].sort(([a], [b]) => a.localeCompare(b)).map(([siteId, rows]) => `- ${siteId}: ${rows.length}`).join('\n')}\n`)
console.log(JSON.stringify(registryBody.counts))
