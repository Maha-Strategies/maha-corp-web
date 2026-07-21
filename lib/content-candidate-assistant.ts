import { CONTENT_TOPIC_CLUSTERS, type ContentEvidence } from './content-publication-gate.ts'

type TopicCluster = typeof CONTENT_TOPIC_CLUSTERS[number]
type RetrievedSource = { url: string; title: string; snippet: string; publishedOn: string }

export type ContentCandidateSuggestion = {
  topicCluster: TopicCluster
  proposedPath: string
  readerQuestion: string
  readerOutcome: string
  originalValue: string
  evidence: ContentEvidence[]
  policyChecks: { readerFirst: boolean; originalAnalysis: boolean; notDoorway: boolean; attributionComplete: boolean; sourceIndependenceReviewed: boolean; humanReviewRequired: boolean }
}

function text(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`${field} is missing from the candidate suggestion.`)
  const parsed = value.trim().replace(/\s+/g, ' ')
  if (parsed.length < min || parsed.length > max) throw new Error(`${field} in the candidate suggestion is invalid.`)
  return parsed
}

export function parseCandidateAssistantRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const seedQuestion = text(body.seedQuestion, 'seedQuestion', 20, 500)
  if (typeof body.topicCluster !== 'string' || !CONTENT_TOPIC_CLUSTERS.includes(body.topicCluster as TopicCluster)) throw new Error('topicCluster is not supported.')
  return { seedQuestion, topicCluster: body.topicCluster as TopicCluster }
}

export function candidateResearchQueries(seedQuestion: string) {
  return [
    `${seedQuestion} official guidance`,
    `${seedQuestion} primary research`,
    `${seedQuestion} public data evidence`,
  ]
}

function sourceType(url: string): ContentEvidence['sourceType'] {
  const host = new URL(url).hostname.toLowerCase()
  if (host.endsWith('.gov') || host.includes('nist.gov') || host.includes('oecd.org') || host.includes('who.int') || host.includes('europa.eu')) return 'official'
  if (host.endsWith('.edu') || host.includes('nature.com') || host.includes('science.org') || host.includes('arxiv.org') || host.includes('doi.org') || host.includes('pubmed')) return 'primary'
  return 'public_data'
}

export function selectIndependentSources(value: unknown): RetrievedSource[] {
  if (!Array.isArray(value)) return []
  const sources: RetrievedSource[] = []
  const hosts = new Set<string>()
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>
    if (typeof item.url !== 'string' || typeof item.title !== 'string' || typeof item.snippet !== 'string' || typeof item.publishedOn !== 'string') continue
    let url: URL
    try { url = new URL(item.url) } catch { continue }
    if (url.protocol !== 'https:' || hosts.has(url.hostname.toLowerCase())) continue
    const published = new Date(item.publishedOn)
    if (item.title.trim().length < 8 || item.snippet.trim().length < 40 || Number.isNaN(published.valueOf())) continue
    hosts.add(url.hostname.toLowerCase())
    sources.push({ url: url.toString(), title: item.title.trim().slice(0, 240), snippet: item.snippet.trim().replace(/\s+/g, ' ').slice(0, 900), publishedOn: published.toISOString().slice(0, 10) })
    if (sources.length === 5) break
  }
  return sources
}

export function contentCandidateAssistantPrompt(input: { seedQuestion: string; topicCluster: TopicCluster; sources: RetrievedSource[] }) {
  return `Create a PRIVATE content-candidate suggestion for Maha Strategies. It is not a draft and has no publication authority.

Use only the supplied question and retrieved source metadata. Do not browse, invent sources, claim verification, state facts absent from the source excerpts, or create keyword-doorway content. The source URLs and titles will be preserved exactly; return a concise, source-specific note for each source based only on its supplied excerpt.

Return ONLY valid JSON with this exact shape:
{"proposedPath":"/lowercase-path","readerQuestion":"...","readerOutcome":"...","originalValue":"...","sourceNotes":["...","...","..."]}

Requirements: proposedPath is a lowercase Maha path; readerQuestion 20-500 characters; readerOutcome 20-750; originalValue 80-1500; sourceNotes has exactly one 30-500 character note per supplied source.

Question: ${input.seedQuestion}
Topic cluster: ${input.topicCluster}
Retrieved sources: ${JSON.stringify(input.sources)}`
}

export function parseContentCandidateSuggestion(value: unknown, input: { topicCluster: TopicCluster; sources: RetrievedSource[] }): ContentCandidateSuggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The candidate assistant returned an invalid response.')
  const record = value as Record<string, unknown>
  const proposedPath = text(record.proposedPath, 'proposedPath', 3, 181)
  if (!/^\/[a-z0-9][a-z0-9/-]{1,180}$/.test(proposedPath) || proposedPath.endsWith('/')) throw new Error('The candidate assistant returned an invalid proposed path.')
  if (!Array.isArray(record.sourceNotes) || record.sourceNotes.length !== input.sources.length) throw new Error('The candidate assistant did not return notes for every source.')
  const sourceNotes = record.sourceNotes.map((note, index) => text(note, `sourceNotes[${index}]`, 30, 500))
  return {
    topicCluster: input.topicCluster,
    proposedPath,
    readerQuestion: text(record.readerQuestion, 'readerQuestion', 20, 500),
    readerOutcome: text(record.readerOutcome, 'readerOutcome', 20, 750),
    originalValue: text(record.originalValue, 'originalValue', 80, 1_500),
    evidence: input.sources.map((source, index) => ({ url: source.url, title: source.title, sourceType: sourceType(source.url), publishedOn: source.publishedOn, note: sourceNotes[index] })),
    policyChecks: { readerFirst: true, originalAnalysis: true, notDoorway: true, attributionComplete: true, sourceIndependenceReviewed: false, humanReviewRequired: true },
  }
}
