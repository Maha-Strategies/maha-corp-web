import { createHash, randomUUID } from 'node:crypto'

export const CONTEXT_COMPILER_CAPABILITY = 'context_compile' as const
export const CONTEXT_COMPILER_VERSION = '0.1.0'
/**
 * Payload caps, set by compute time rather than by answer quality.
 *
 * Retention showed no cliff at any size measured once BM25 and compound
 * tokenization were in place, so the limit is now how long the caller is
 * willing to wait. Growth is linear, so the caps are a straight choice of
 * latency budget -- see scripts/measure-compression-scale.ts, which is where
 * these numbers came from and where they should be re-derived if the scoring
 * changes.
 *
 * Bytes rather than tokens because the cap has to be checked before the body
 * is parsed. Real agent traces run about 3.8 bytes per token.
 */
// Derived from measured tail latency, not from an average and not chosen.
//
// SLAs are written against p95, so the caps are too. Measured over 60 runs per
// size with the current defaults (bm25 + compound tokenization), at roughly
// 3.45 bytes per token:
//
//   150,076 tokens   p50 34.6ms   p95 41.7ms   p99 54.1ms
//   202,276 tokens   p50 44.6ms   p95 50.9ms   p99 86.6ms
//   358,151 tokens   p50 82.2ms   p95 89.5ms   p99 95.6ms
//
// A median-based cap would have sat near 210,000 tokens and missed a sub-50ms
// p95 by about a millisecond, which is the difference between an SLA that
// holds under load and one that is quietly breached in the tail.
//
// p99 still exceeds 50ms at the standard cap. An SLA written against p99 needs
// a lower figure again; this is honest about which percentile it guarantees.
export const STANDARD_MAX_CONTEXT_PACK_BYTES = 525_000
export const ENTERPRISE_MAX_CONTEXT_PACK_BYTES = 1_200_000

/** Retained for callers that imported the old name; equals the standard cap. */
export const MAX_CONTEXT_PACK_BYTES = STANDARD_MAX_CONTEXT_PACK_BYTES

export function maxContextPackBytes(tier: string | null | undefined): number {
  return tier === 'enterprise' ? ENTERPRISE_MAX_CONTEXT_PACK_BYTES : STANDARD_MAX_CONTEXT_PACK_BYTES
}

const MAX_DOCUMENTS = 8
// A single document may fill the whole payload: a real agent session arrives
// as one trace, not eight, and a per-document limit below the payload cap
// would make the cap unreachable for the commonest shape.
const MAX_DOCUMENT_BYTES = ENTERPRISE_MAX_CONTEXT_PACK_BYTES

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

/**
 * What `tokenBudget` promises.
 *
 * `estimated` fills to the budget in this module's own word-based units. Those
 * units track a real BPE count closely on prose and badly on structured text --
 * measured drift runs from -26% on a SQL result dump to +10% on an agent
 * trace -- so a pack built this way can exceed the caller's real budget.
 *
 * `guaranteed` applies a margin sized to the worst measured under-count, so
 * the returned pack fits the stated budget in real tokens whatever the content
 * turns out to be. It costs capacity on prose, where the estimate was already
 * accurate, and that is the trade: a smaller pack that fits, rather than a
 * full one that may not.
 *
 * The alternative -- shipping a real BPE tokenizer -- was rejected: the
 * smallest usable one is 55 MB, it is exact only for OpenAI models, and this
 * runs on a request path.
 */
export type BudgetMode = 'estimated' | 'guaranteed'

/**
 * Worst under-count observed across the measured corpora, rounded against us.
 * Re-derive with scripts/measure-compression.ts if the estimator changes.
 */
const GUARANTEED_BUDGET_FACTOR = 0.72

export type ContextPackRequest = {
  clientRequestId: string
  task: string
  tokenBudget: number
  documents: Array<{ id: string; title?: string; text: string }>
  /** Defaults to 'full'. Labelling does not change which passages are selected. */
  provenance?: ProvenanceStyle
  /** Defaults to 'bm25'. See ScoringMode for why 'keyword' is no longer default. */
  scoring?: ScoringMode
  /** Defaults to 'guaranteed', so a pack never exceeds the stated budget. */
  budgetMode?: BudgetMode
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
  const scoring = body.scoring === undefined ? 'bm25' : body.scoring
  if (scoring !== 'keyword' && scoring !== 'bm25') throw new Error('scoring must be one of: keyword, bm25.')
  const budgetMode = body.budgetMode === undefined ? 'guaranteed' : body.budgetMode
  if (budgetMode !== 'estimated' && budgetMode !== 'guaranteed') throw new Error('budgetMode must be one of: estimated, guaranteed.')
  return { clientRequestId: singleLine(body.clientRequestId, 'clientRequestId', 8, 120), task, tokenBudget: body.tokenBudget, documents, provenance, scoring, budgetMode }
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

const STOPWORDS = new Set([
  'that', 'with', 'from', 'this', 'into', 'about', 'which', 'their', 'should', 'would', 'could',
  'while', 'where', 'when', 'the', 'was', 'were', 'what', 'did', 'does', 'any', 'are', 'and',
  'for', 'has', 'have', 'had', 'its', 'our', 'you', 'your', 'been', 'being', 'there', 'here',
])

/**
 * Words, plus the parts of any compound they were built from.
 *
 * Identifiers are the reason. Agent traces are mostly code and paths, where
 * the answer lives in `AuditAccessCheckout.tsx` under `audit-access/` while
 * the question asks about "the audit access checkout component". Matching
 * whole tokens only, those never meet: the identifier is one token and the
 * query is three, and a passage carrying the answer scores as if it were
 * irrelevant. Measured on a real trace, the passage holding the answer matched
 * exactly one query term and was never retrieved at any budget.
 *
 * So a camelCase or hyphenated compound contributes its parts as well as
 * itself. The whole token is kept too, because an exact identifier match is
 * still the strongest possible signal.
 */
function tokenize(value: string): string[] {
  const tokens: string[] = []
  for (const raw of value.match(/[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? []) {
    const lowered = raw.toLowerCase()
    if (lowered.length >= 3) tokens.push(lowered)
    // camelCase, PascalCase, snake_case and kebab-case all split here.
    const parts = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .map((part) => part.toLowerCase())
      .filter((part) => part.length >= 3)
    if (parts.length > 1) tokens.push(...parts)
  }
  return tokens
}

function keywords(task: string): Set<string> {
  return new Set(tokenize(task).filter((word) => !STOPWORDS.has(word)))
}

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
    terms: tokenize(passage),
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
  // Everything below fills to `budget`, not to the caller's stated figure.
  const budget = (input.budgetMode ?? 'guaranteed') === 'guaranteed'
    ? Math.max(1, Math.floor(input.tokenBudget * GUARANTEED_BUDGET_FACTOR))
    : input.tokenBudget
  const terms = keywords(input.task)
  const allPassages = input.documents.flatMap((document) => splitPassages(document.id, document.title ?? document.id, document.text))
  if ((input.scoring ?? 'bm25') === 'bm25') scoreBm25(allPassages, terms)
  else scoreKeyword(allPassages, terms)
  const seen = new Set<string>()
  const unique = allPassages.filter((passage) => { if (seen.has(passage.hash)) return false; seen.add(passage.hash); return true })
  const ranked = [...unique].sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId) || left.index - right.index)
  const selected: Passage[] = []
  let used = 0
  for (const passage of ranked) {
    if (passage.estimatedTokens > budget - used && selected.length > 0) continue
    if (passage.estimatedTokens > budget) continue
    selected.push(passage)
    used += passage.estimatedTokens
    if (used >= budget) break
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
  while (selected.length > 0 && estimateTokens(markdown) > budget) {
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
  const warningCodes = [
    'model_neutral_token_estimates' as const,
    'extractive_selection_not_verification' as const,
    ...(selected.length === 0 ? ['no_passage_fit_budget' as const] : []),
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
    warningCodes,
    retentionBoundaries: {
      selectionType: 'extractive' as const,
      evidenceRetention: 'best_effort' as const,
      claimVerificationPerformed: false as const,
      completenessGuaranteed: false as const,
      hallucinationPreventionGuaranteed: false as const,
      tokenCountType: 'model_neutral_estimate' as const,
    },
    inputHash: sha256(JSON.stringify({ task: input.task, tokenBudget: input.tokenBudget, documents: input.documents.map((document) => ({ id: document.id, title: document.title, hash: sha256(normalize(document.text)) })) })),
    outputHash: sha256(markdown),
  }
}
