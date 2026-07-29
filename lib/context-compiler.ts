import { createHash, randomUUID } from 'node:crypto'

export const CONTEXT_COMPILER_CAPABILITY = 'context_compile' as const
export const CONTEXT_COMPILER_VERSION = '0.1.0'
export const MAX_CONTEXT_PACK_BYTES = 128_000
const MAX_DOCUMENTS = 8
const MAX_DOCUMENT_BYTES = 64_000

export type ContextPackRequest = {
  clientRequestId: string
  task: string
  tokenBudget: number
  documents: Array<{ id: string; title?: string; text: string }>
}

type Passage = { sourceId: string; sourceTitle: string; index: number; text: string; hash: string; estimatedTokens: number; score: number }

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
  return { clientRequestId: singleLine(body.clientRequestId, 'clientRequestId', 8, 120), task, tokenBudget: body.tokenBudget, documents }
}

function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function keywords(task: string): Set<string> {
  return new Set((task.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []).filter((word) => !new Set(['that', 'with', 'from', 'this', 'into', 'about', 'which', 'their', 'should', 'would', 'could', 'while', 'where', 'when']).has(word)))
}

function splitPassages(sourceId: string, sourceTitle: string, value: string, terms: Set<string>): Passage[] {
  const passages = normalize(value).split(/\n{2,}/).flatMap((paragraph) => {
    // Long paragraphs are bounded so a single unranked block cannot consume a pack.
    if (paragraph.length <= 1_600) return [paragraph]
    return paragraph.match(/[^.!?]+[.!?]+(?:\s|$)|.{1,1200}(?:\s|$)/g) ?? [paragraph]
  }).map((paragraph) => paragraph.trim()).filter(Boolean)
  return passages.map((passage, index) => {
    const words = new Set((passage.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []))
    const matches = [...terms].filter((term) => words.has(term)).length
    return { sourceId, sourceTitle, index: index + 1, text: passage, hash: sha256(passage), estimatedTokens: estimateTokens(passage), score: matches * 10 + Math.max(0, 2 - Math.floor(index / 8)) }
  })
}

export function compileContextPack(input: ContextPackRequest) {
  const terms = keywords(input.task)
  const allPassages = input.documents.flatMap((document) => splitPassages(document.id, document.title ?? document.id, document.text, terms))
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
  function renderContext(passages: Passage[]) {
    return [
      '# Context Pack',
      `Task: ${input.task}`,
      '',
      ...passages.map((passage) => `## ${passage.sourceTitle} [${passage.sourceId}:${passage.index}]\n${passage.text}`),
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
