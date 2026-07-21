type CandidateForAssistant = {
  public_id: string
  topic_cluster: string
  proposed_path: string
  reader_question: string
  reader_outcome: string
  original_value: string
  author_attribution: string
  evidence: unknown
}

export type ContentDraftSuggestion = {
  title: string
  summary: string
  directAnswer: string
  method: string
  limitations: string
}

function text(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== 'string') throw new Error(`${field} is missing from the draft suggestion.`)
  const parsed = value.trim()
  if (parsed.length < min || parsed.length > max) throw new Error(`${field} in the draft suggestion is outside its allowed length.`)
  return parsed
}

export function parseContentDraftSuggestion(value: unknown): ContentDraftSuggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The draft assistant returned an invalid response.')
  const record = value as Record<string, unknown>
  return {
    title: text(record.title, 'title', 20, 160),
    summary: text(record.summary, 'summary', 120, 600),
    directAnswer: text(record.directAnswer, 'directAnswer', 300, 1_800),
    method: text(record.method, 'method', 300, 2_400),
    limitations: text(record.limitations, 'limitations', 100, 1_800),
  }
}

export function contentDraftAssistantPrompt(candidate: CandidateForAssistant) {
  return `You create a PRIVATE editorial draft for Maha Strategies. This is not a public page and you have no publishing authority.

Use only the supplied candidate brief and evidence metadata. Do not browse, invent sources, invent facts, make performance claims, or claim that a tool establishes factual truth. Write a practical, reader-first workflow in plain English. Keep the analysis specific to Maha's claim-level MPS approach, but do not imply independent certification.

Return ONLY valid JSON with this exact shape:
{"title":"...","summary":"...","directAnswer":"...","method":"...","limitations":"..."}

Required lengths: title 20-160 characters; summary 120-600; directAnswer 300-1800; method 300-2400; limitations 100-1800.

Candidate brief:
${JSON.stringify({
    topic: candidate.topic_cluster,
    proposedPath: candidate.proposed_path,
    readerQuestion: candidate.reader_question,
    readerOutcome: candidate.reader_outcome,
    originalValue: candidate.original_value,
    author: candidate.author_attribution,
    evidence: candidate.evidence,
  })}`
}

export function parseAssistantRequest(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const candidateId = (value as Record<string, unknown>).candidateId
  if (typeof candidateId !== 'string' || !/^contentcand_[a-f0-9]{32}$/.test(candidateId)) throw new Error('candidateId is not valid.')
  return { candidateId }
}
