import { createHash, randomUUID } from 'node:crypto'

export const CONTEXT_COMPILER_CAPABILITY = 'context_compile' as const
export const CONTEXT_COMPILER_VERSION = '0.1.0'
export const MAX_CONTEXT_PACK_BYTES = 128_000
const MAX_DOCUMENTS = 8
const MAX_DOCUMENT_BYTES = 64_000

/**
 * How each selected passage is labelled in the rendered pack.
 *
 * Measured cost of the full form is roughly 20 tokens per passage, which on a
 * payload of many short passages exceeds the text it was selected to keep --
 * the pack comes back larger than the input. The structured provenance in
 * `includedPassages` is unaffected by this choice, so `none` loses nothing a
 * caller cannot read from the response; it loses only the model's ability to
 * cite inline while it is writing.
 */
export type ProvenanceStyle = 'full' | 'compact' | 'none'

/**
 * How a passage's relevance to the task is scored.
 *
 * `keyword` counts how many task terms appear, each worth ten. Every term is
 * worth the same, so a term appearing in almost every passage carries as much
 * weight as one appearing twice. On a large payload that is fatal: hundreds of
 * passages tie on a common word, the tie breaks on position rather than
 * relevance, and a genuinely relevant passage further down is crowded out.
 * Measured, this loses an answer somewhere between 35k and 54k input tokens.
 *
 * `bm25` weights each term by how rare it is across the payload and saturates
 * repeated occurrences, so a word present everywhere contributes almost
 * nothing and a rare one dominates.
 */
export type ScoringMode = 'keyword' | 'bm25'

export type ContextPackRequest = {
  clientRequestId: string
  task: string
  tokenBudget: number
  documents: Array<{ id: string; title?: string; text: string }>
  /** Defaults to 'full', which is the behaviour callers already depend on. */
  provenance?: ProvenanceStyle
  /** Defaults to 'keyword', the original scoring. */
  scoring?: ScoringMode
}

type Passage = { sourceId: string; sourceTitle: string; index: number; text: string; hash: string; estimatedTokens: number; score: number; terms: string[] }

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function singleLine(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const output = value.trim()
  if (output.length < minimum || output.length > maximum || /[\r\n]/.test(output)) throw new Error(`${field} must contain ${minimum}-${maximum} characters on one line.`)
  return output
}

function text(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
  const output = value.trim()
  if (output.length < minimum || output.length > maximum) throw new Error(`${field} must contain ${minimum}-${maximum} characters.`)
  return output
}

export function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

export function estimateTokens(value: string): number {
  // Deliberately model-neutral. This is a reproducible approximation, not a
  // provider tokenizer count and must not be used for billing.
  const units = value.trim().match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) ?? []
  return units.length
}

export function createContextPackId(): string {
  return `ctxpack_${randomUUID().replaceAll('-', '')}`
}

export function parseContextPackRequest(value: unknown): ContextPackRequest {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  const task = text(body.task, 'task', 8, 1_200)
  if (!Array.isArray(body.documents) || body.documents.length < 1 || body.documents.length > MAX_DOCUMENTS) throw new Error(`documents must contain 1-${MAX_DOCUMENTS} source documents.`)
  if (!Number.isInteger(body.tokenBudget) || typeof body.tokenBudget !== 'number' || body.tokenBudget < 64 || body.tokenBudget > 16_000) throw new Error('tokenBudget must be an integer between 64 and 16,000.')
  const ids = new Set<string>()
  const documents = body.documents.map((item, index) => {
    const document = object(item)
    if (!document) throw new Error(`documents[${index}] must be an object.`)
    const id = singleLine(document.id, `documents[${index}].id`, 1, 80)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id)) throw new Error(`documents[${index}].id contains unsupported characters.`)
    if (ids.has(id)) throw new Error('documents[].id values must be unique.')
    ids.add(id)
    return { id, title: document.title === undefined ? undefined : singleLine(document.title, `documents[${index}].title`, 1, 160), text: text(document.text, `documents[${index}].text`, 1, MAX_DOCUMENT_BYTES) }
  })
  const provenance = body.provenance === undefined ? 'full' : body.provenance
  if (provenance !== 'full' && provenance !== 'compact' && provenance !== 'none') {
    throw new Error('provenance must be one of: full, compact, none.')
  }
  const scoring = body.scoring === undefined ? 'keyword' : body.scoring
  if (scoring !== 'keyword' && scoring !== 'bm25') throw new Error('scoring must be one of: keyword, bm25.')
  return { clientRequestId: singleLine(body.clientRequestId, 'clientRequestId', 8, 120), task, tokenBudget: body.tokenBudget, documents, provenance, scoring }
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function keywords(task: string): Set<string> {
  return new Set((task.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []).filter((word) => !new Set(['that', 'with', 'from', 'this', 'into', 'about', 'which', 'their', 'should', 'would', 'could', 'while', 'where', 'when']).has(word)))
}

const WORD = /[a-z0-9][a-z0-9-]{2,}/g

function splitPassages(sourceId: string, sourceTitle: string, value: string): Passage[] {
  const passages = normalize(value).split(/\n{2,}/).flatMap((paragraph) => {
    // Long paragraphs are bounded so a single unranked block cannot consume a pack.
    if (paragraph.length <= 1_600) return [paragraph]
    return paragraph.match(/[^.!?]+[.!?]+(?:\s|$)|.{1,1200}(?:\s|$)/g) ?? [paragraph]
  }).map((paragraph) => paragraph.trim()).filter(Boolean)
  // Scored separately: BM25 needs the whole payload's term statistics, which
  // are not knowable while a single document is being split.
  return passages.map((passage, index) => ({
    sourceId, sourceTitle, index: index + 1, text: passage, hash: sha256(passage),
    estimatedTokens: estimateTokens(passage), score: 0,
    terms: passage.toLowerCase().match(WORD) ?? [],
  }))
}

/** Positional preference, kept only to break exact ties deterministically. */
const positionBonus = (index: number) => Math.max(0, 2 - Math.floor(index / 8))

function scoreKeyword(passages: Passage[], terms: Set<string>): void {
  for (const passage of passages) {
    const words = new Set(passage.terms)
    const matches = [...terms].filter((term) => words.has(term)).length
    passage.score = matches * 10 + positionBonus(passage.index - 1)
  }
}

/**
 * Okapi BM25 over the payload's own passages.
 *
 * The payload is the corpus: a term's weight comes from how many passages in
 * *this* request contain it, so the same word can be decisive in one payload
 * and worthless in another. That is the property the keyword scorer lacks and
 * the reason it dilutes at scale.
 */
function scoreBm25(passages: Passage[], terms: Set<string>): void {
  const K1 = 1.5
  const B = 0.75
  const total = passages.length
  const averageLength = passages.reduce((sum, passage) => sum + passage.terms.length, 0) / Math.max(1, total)

  const documentFrequency = new Map<string, number>()
  for (const passage of passages) {
    for (const term of new Set(passage.terms)) {
      if (terms.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }

  // Standard BM25 idf. The +1 keeps a term present in every passage at a small
  // positive weight rather than a negative one, so ubiquity is worth almost
  // nothing without ever counting against a passage.
  const idf = new Map<string, number>()
  for (const term of terms) {
    const frequency = documentFrequency.get(term) ?? 0
    idf.set(term, Math.log(1 + (total - frequency + 0.5) / (frequency + 0.5)))
  }

  for (const passage of passages) {
    const counts = new Map<string, number>()
    for (const term of passage.terms) if (terms.has(term)) counts.set(term, (counts.get(term) ?? 0) + 1)

    let score = 0
    for (const [term, count] of counts) {
      const saturated = (count * (K1 + 1)) / (count + K1 * (1 - B + (B * passage.terms.length) / Math.max(1, averageLength)))
      score += (idf.get(term) ?? 0) * saturated
    }
    // Scaled far below one BM25 point so position can only separate passages
    // that are otherwise genuinely equal.
    passage.score = score + positionBonus(passage.index - 1) * 0.001
  }
}

export function compileContextPack(input: ContextPackRequest) {
  const terms = keywords(input.task)
  const allPassages = input.documents.flatMap((document) => splitPassages(document.id, document.title ?? document.id, document.text))
  if ((input.scoring ?? 'keyword') === 'bm25') scoreBm25(allPassages, terms)
  else scoreKeyword(allPassages, terms)
  const seen = new Set<string>()
  const unique = allPassages.filter((passage) => { if (seen.has(passage.hash)) return false; seen.add(passage.hash); return true })
  const ranked = [...unique].sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId) || left.index - right.index)
  const selected: Passage[] = []
  let used = 0
  for (const passage of ranked) {
    if (passage.estimatedTokens > input.tokenBudget - used && selected.length > 0) continue
    if (passage.estimatedTokens > input.tokenBudget) continue
    selected.push(passage)
    used += passage.estimatedTokens
    if (used >= input.tokenBudget) break
  }
  const originalText = input.documents.map((document) => normalize(document.text)).join('\n\n')
  const provenance: ProvenanceStyle = input.provenance ?? 'full'
  function renderContext(passages: Passage[]) {
    const label = (passage: Passage) => {
      if (provenance === 'none') return passage.text
      // Compact keeps a citable handle and drops the title, which is repeated
      // identically on every passage from the same source and is the bulk of
      // the cost.
      if (provenance === 'compact') return `[${passage.sourceId}:${passage.index}] ${passage.text}`
      return `## ${passage.sourceTitle} [${passage.sourceId}:${passage.index}]\n${passage.text}`
    }
    return [
      '# Context Pack',
      `Task: ${input.task}`,
      '',
      ...passages.map(label),
    ].join('\n\n')
  }
  // Heading and task overhead also count toward the caller's declared budget.
  // Remove the lowest-ranked included passages until the returned pack fits.
  let markdown = renderContext(selected)
  while (selected.length > 0 && estimateTokens(markdown) > input.tokenBudget) {
    selected.pop()
    markdown = renderContext(selected)
  }
  const sourceManifest = input.documents.map((document) => {
    const sourcePassages = allPassages.filter((passage) => passage.sourceId === document.id)
    const included = selected.filter((passage) => passage.sourceId === document.id)
    return { sourceId: document.id, title: document.title ?? document.id, sourceHash: sha256(normalize(document.text)), originalEstimatedTokens: estimateTokens(normalize(document.text)), passageCount: sourcePassages.length, includedPassageIds: included.map((passage) => `${passage.sourceId}:${passage.index}`), includedEstimatedTokens: included.reduce((total, passage) => total + passage.estimatedTokens, 0) }
  })
  const originalEstimatedTokens = estimateTokens(originalText)
  const compiledEstimatedTokens = estimateTokens(markdown)
  const reduction = originalEstimatedTokens > 0 ? Math.max(0, Number((((originalEstimatedTokens - compiledEstimatedTokens) / originalEstimatedTokens) * 100).toFixed(1))) : 0
  const warnings = [
    'Token counts are model-neutral estimates, not provider tokenizer or billing counts.',
    'This compiler ranks and deduplicates text; it does not verify claims, guarantee completeness, or prevent hallucination.',
    ...(selected.length === 0 ? ['No passage fit within the stated token budget. Increase tokenBudget or provide shorter source documents.'] : []),
  ]
  return {
    version: CONTEXT_COMPILER_VERSION,
    packId: createContextPackId(),
    clientRequestId: input.clientRequestId,
    task: input.task,
    tokenBudget: input.tokenBudget,
    context: markdown,
    metrics: { originalBytes: Buffer.byteLength(originalText, 'utf8'), compiledBytes: Buffer.byteLength(markdown, 'utf8'), originalEstimatedTokens, compiledEstimatedTokens, estimatedReductionPercent: reduction, sourceCount: input.documents.length, sourceCoveragePercent: Number(((sourceManifest.filter((source) => source.includedPassageIds.length > 0).length / input.documents.length) * 100).toFixed(1)), duplicatePassagesRemoved: allPassages.length - unique.length },
    includedPassages: selected.map((passage) => ({ sourceId: passage.sourceId, passageId: `${passage.sourceId}:${passage.index}`, passageHash: passage.hash, text: passage.text })),
    sources: sourceManifest,
    warnings,
    inputHash: sha256(JSON.stringify({ task: input.task, tokenBudget: input.tokenBudget, documents: input.documents.map((document) => ({ id: document.id, title: document.title, hash: sha256(normalize(document.text)) })) })),
    outputHash: sha256(markdown),
  }
}
