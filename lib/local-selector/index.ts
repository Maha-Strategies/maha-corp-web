/**
 * The local context selector — a Node reference runtime.
 *
 * Runs Maha's deterministic selection in the caller's own process. The
 * selection semantics are the shared Context Compiler's, not a second
 * implementation: this module adds the local contract, byte offsets, reason
 * codes and the minimum-size bypass around it.
 *
 * Every host dependency is behind an injectable seam, because the four things
 * this code needs from a host -- a SHA-256, a UUID, a UTF-8 byte length, and
 * Unicode-aware regex -- are exactly the four that decide whether a port to
 * WASM or a browser is possible. See docs/integrations/local-selector.md.
 */
import { createHash, randomUUID } from 'node:crypto'

import { compileContextPack, estimateTokens, parseContextPackRequest } from '../context-compiler.ts'

import {
  LOCAL_SELECTOR_CONTRACT_VERSION,
  LOCAL_SELECTOR_MINIMUM_TOKENS,
  LOCAL_SELECTOR_POLICY_VERSION,
  PRIVACY_BOUNDARY,
  parseLocalSelectorRequest,
  type LocalSelectorRequest,
  type LocalSelectorResult,
  type RetainedPassage,
  type SelectionReasonCode,
} from './contract.ts'

/**
 * The host functions this runtime needs.
 *
 * Injectable so the same selector can run where `node:crypto` does not exist.
 * A caller supplying these is the whole portability story; see the feasibility
 * boundary in the guide.
 */
export type LocalSelectorHost = {
  sha256Hex: (value: string) => string
  randomId: () => string
  utf8ByteLength: (value: string) => number
}

export const nodeHost: LocalSelectorHost = {
  sha256Hex: (value) => createHash('sha256').update(value).digest('hex'),
  randomId: () => randomUUID().replaceAll('-', ''),
  utf8ByteLength: (value) => Buffer.byteLength(value, 'utf8'),
}

/**
 * A host with no `node:crypto` and no `Buffer`.
 *
 * Used by the portability test to prove the runtime does not reach for Node
 * built-ins outside these seams. The digest is a placeholder, not a hash
 * function -- `sha256Hex` must be supplied by a real host.
 */
export function portableHost(digest: (value: string) => string): LocalSelectorHost {
  return {
    sha256Hex: digest,
    randomId: () => {
      const bytes = new Uint8Array(16)
      globalThis.crypto.getRandomValues(bytes)
      return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    },
    utf8ByteLength: (value) => new TextEncoder().encode(value).length,
  }
}

/** The compiler's own normalization, mirrored so offsets index the same bytes. */
function normalize(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export type LocalSelectorOptions = { host?: LocalSelectorHost }

/**
 * Select context locally.
 *
 * Throws on invalid input rather than returning a partial result: a selector
 * that half-answers a malformed request is worse than one that refuses, because
 * the caller ships the half-answer.
 */
export function selectLocally(input: unknown, options: LocalSelectorOptions = {}): LocalSelectorResult {
  const host = options.host ?? nodeHost
  const request: LocalSelectorRequest = parseLocalSelectorRequest(input)
  const minimumTokens = request.minimumTokens ?? LOCAL_SELECTOR_MINIMUM_TOKENS
  const reasonCodes = new Set<SelectionReasonCode>()

  const normalizedSources = new Map(request.documents.map((document) => [document.id, normalize(document.text)]))
  const wholeText = [...normalizedSources.values()].join('\n\n')
  const originalEstimatedTokens = estimateTokens(wholeText)

  // Small inputs are forwarded whole. Selection framing on a short document
  // costs more tokens than it removes, and a bypass a caller can see is better
  // than a saving that is not one.
  if (originalEstimatedTokens < minimumTokens) {
    reasonCodes.add('bypassed_below_minimum')
    return buildResult({
      request, host, reasonCodes: [...reasonCodes], retained: [], context: wholeText,
      normalizedSources, originalEstimatedTokens, compiledEstimatedTokens: originalEstimatedTokens,
      duplicatePassagesRemoved: 0, sourceCoverageBps: 10_000, bypassApplied: true,
      selectionAllowance: request.tokenBudget, used: originalEstimatedTokens,
    })
  }

  const compiled = compileContextPack(parseContextPackRequest({
    clientRequestId: `local_${host.randomId().slice(0, 16)}`,
    task: request.task,
    tokenBudget: request.tokenBudget,
    documents: request.documents.map((document) => ({ id: document.id, title: document.title, text: document.text })),
    provenance: 'compact',
    scoring: request.scoring ?? 'bm25',
    budgetMode: request.budgetMode ?? 'guaranteed',
  }))

  // Offsets are computed here rather than taken on trust. A passage that
  // cannot be located in its own normalized source is a defect, not a warning:
  // the whole point of an offset is that a reviewer can check it.
  const cursors = new Map<string, number>()
  const retained: RetainedPassage[] = compiled.includedPassages.map((passage) => {
    const source = normalizedSources.get(passage.sourceId)
    if (source === undefined) throw new Error(`Retained passage references unknown source ${passage.sourceId}.`)
    const from = cursors.get(passage.sourceId) ?? 0
    const index = source.indexOf(passage.text, from)
    const at = index >= 0 ? index : source.indexOf(passage.text)
    if (at < 0) throw new Error(`Retained passage ${passage.passageId} was not found in its source.`)
    cursors.set(passage.sourceId, at + passage.text.length)
    return {
      sourceId: passage.sourceId,
      passageId: passage.passageId,
      passageHash: passage.passageHash,
      sourceStartByte: host.utf8ByteLength(source.slice(0, at)),
      sourceEndByte: host.utf8ByteLength(source.slice(0, at + passage.text.length)),
      estimatedTokens: estimateTokens(passage.text),
      text: passage.text,
    }
  })

  reasonCodes.add(retained.length > 0 ? 'selected_by_rank' : 'no_passage_fit_budget')
  if (compiled.metrics.duplicatePassagesRemoved > 0) reasonCodes.add('dropped_duplicate')
  const totalPassages = compiled.sources.reduce((sum, source) => sum + source.passageCount, 0)
  if (retained.length < totalPassages - compiled.metrics.duplicatePassagesRemoved) {
    reasonCodes.add('dropped_budget_exhausted')
  }

  return buildResult({
    request, host, reasonCodes: [...reasonCodes], retained, context: compiled.context,
    normalizedSources, originalEstimatedTokens,
    compiledEstimatedTokens: compiled.metrics.compiledEstimatedTokens,
    duplicatePassagesRemoved: compiled.metrics.duplicatePassagesRemoved,
    sourceCoverageBps: Math.round(compiled.metrics.sourceCoveragePercent * 100),
    bypassApplied: false,
    selectionAllowance: (request.budgetMode ?? 'guaranteed') === 'guaranteed'
      ? Math.max(1, Math.floor(request.tokenBudget * 0.72))
      : request.tokenBudget,
    used: compiled.metrics.compiledEstimatedTokens,
  })
}

function buildResult(input: {
  request: LocalSelectorRequest
  host: LocalSelectorHost
  reasonCodes: SelectionReasonCode[]
  retained: RetainedPassage[]
  context: string
  normalizedSources: Map<string, string>
  originalEstimatedTokens: number
  compiledEstimatedTokens: number
  duplicatePassagesRemoved: number
  sourceCoverageBps: number
  bypassApplied: boolean
  selectionAllowance: number
  used: number
}): LocalSelectorResult {
  const { request, host } = input
  const sha = (value: string) => `sha256:${host.sha256Hex(value)}`

  const inputHash = sha(JSON.stringify({
    task: request.task,
    tokenBudget: request.tokenBudget,
    documents: request.documents.map((document) => ({
      id: document.id,
      title: document.title,
      hash: sha(input.normalizedSources.get(document.id) ?? ''),
    })),
  }))

  const evidence = request.requiredEvidence?.map((label) => {
    const normalizedLabel = label.text.replace(/\s+/g, ' ').trim()
    return {
      evidenceId: label.evidenceId,
      sourceId: label.sourceId,
      // Exact-span containment against the context actually produced.
      retained: input.context.replace(/\s+/g, ' ').includes(normalizedLabel),
    }
  })

  return {
    contractVersion: LOCAL_SELECTOR_CONTRACT_VERSION,
    policyVersion: LOCAL_SELECTOR_POLICY_VERSION,
    packId: `localpack_${host.randomId()}`,
    context: input.context,
    retained: input.retained,
    reasonCodes: input.reasonCodes,
    sources: request.documents.map((document) => {
      const normalized = input.normalizedSources.get(document.id) ?? ''
      return {
        sourceId: document.id,
        sourceHash: sha(normalized),
        passageCount: normalized.split(/\n{2,}/).filter(Boolean).length,
        retainedPassageCount: input.retained.filter((passage) => passage.sourceId === document.id).length,
        originalEstimatedTokens: estimateTokens(normalized),
      }
    }),
    budget: {
      declared: request.tokenBudget,
      selectionAllowance: input.selectionAllowance,
      used: input.used,
      // A bypassed request forwards the original, which can exceed the budget
      // by design. Reporting that as satisfied would hide the trade.
      satisfied: input.bypassApplied ? input.used <= request.tokenBudget : input.used <= request.tokenBudget,
      mode: request.budgetMode ?? 'guaranteed',
    },
    metrics: {
      originalEstimatedTokens: input.originalEstimatedTokens,
      compiledEstimatedTokens: input.compiledEstimatedTokens,
      tokensSaved: Math.max(0, input.originalEstimatedTokens - input.compiledEstimatedTokens),
      duplicatePassagesRemoved: input.duplicatePassagesRemoved,
      sourceCoverageBps: input.sourceCoverageBps,
    },
    ...(evidence ? { evidence } : {}),
    bypass: { applied: input.bypassApplied, reason: input.bypassApplied ? 'below_minimum_size' : 'none' },
    hashes: { inputHash, outputHash: sha(input.context) },
    boundaries: PRIVACY_BOUNDARY,
  }
}

export { LOCAL_SELECTOR_CONTRACT_VERSION, LOCAL_SELECTOR_POLICY_VERSION, LOCAL_SELECTOR_MINIMUM_TOKENS, PRIVACY_BOUNDARY }
export type { LocalSelectorRequest, LocalSelectorResult, RetainedPassage, SelectionReasonCode } from './contract.ts'
