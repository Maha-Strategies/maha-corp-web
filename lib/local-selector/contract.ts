/**
 * The local context-selector contract.
 *
 * A narrow, versioned shape for running Maha's deterministic selection inside
 * the caller's own process, so source text never reaches Maha-hosted
 * infrastructure through Maha code.
 *
 * Everything this contract can promise is a property of the code in this
 * directory. It says nothing about the caller's endpoint, browser, operating
 * system, analytics, or other libraries — see PRIVACY_BOUNDARY.
 */
export const LOCAL_SELECTOR_CONTRACT_VERSION = '1.0.0'

/**
 * Bumped whenever a change could alter which passages are selected.
 *
 * Determinism is only useful if it is checkable across time, so a caller can
 * pin this and know that identical input plus identical policy version means
 * identical output.
 */
export const LOCAL_SELECTOR_POLICY_VERSION = '2026-08-21'

/** Below this model-neutral estimate, selection framing costs more than it saves. */
export const LOCAL_SELECTOR_MINIMUM_TOKENS = 1_024

export type LocalSelectorDocument = {
  id: string
  title?: string
  text: string
}

/** A span the caller says must survive, so retention can be measured locally. */
export type RequiredEvidenceLabel = {
  evidenceId: string
  sourceId: string
  text: string
}

export type LocalSelectorRequest = {
  contractVersion: typeof LOCAL_SELECTOR_CONTRACT_VERSION
  task: string
  tokenBudget: number
  documents: LocalSelectorDocument[]
  requiredEvidence?: RequiredEvidenceLabel[]
  /** Defaults to the shared selector's guaranteed mode. */
  budgetMode?: 'estimated' | 'guaranteed'
  scoring?: 'bm25' | 'keyword'
  minimumTokens?: number
}

/**
 * A retained passage, by reference rather than by value where possible.
 *
 * `text` is present because a caller needs the pack it is going to send; the
 * offsets are what let a reviewer confirm the passage came from the document
 * it claims, without the selector having to be trusted.
 */
export type RetainedPassage = {
  sourceId: string
  passageId: string
  passageHash: string
  /** Half-open byte range into the normalized source. */
  sourceStartByte: number
  sourceEndByte: number
  estimatedTokens: number
  text: string
}

export type SelectionReasonCode =
  | 'selected_by_rank'
  | 'bypassed_below_minimum'
  | 'dropped_budget_exhausted'
  | 'dropped_duplicate'
  | 'no_passage_fit_budget'

export type LocalSelectorResult = {
  contractVersion: typeof LOCAL_SELECTOR_CONTRACT_VERSION
  policyVersion: typeof LOCAL_SELECTOR_POLICY_VERSION
  packId: string
  context: string
  retained: RetainedPassage[]
  reasonCodes: SelectionReasonCode[]
  sources: {
    sourceId: string
    sourceHash: string
    passageCount: number
    retainedPassageCount: number
    originalEstimatedTokens: number
  }[]
  budget: {
    declared: number
    /** The internal allowance the selector actually filled to. */
    selectionAllowance: number
    used: number
    satisfied: boolean
    mode: 'estimated' | 'guaranteed'
  }
  metrics: {
    originalEstimatedTokens: number
    compiledEstimatedTokens: number
    tokensSaved: number
    duplicatePassagesRemoved: number
    sourceCoverageBps: number
  }
  evidence?: {
    evidenceId: string
    sourceId: string
    retained: boolean
  }[]
  bypass: { applied: boolean; reason: 'none' | 'below_minimum_size' }
  hashes: { inputHash: string; outputHash: string }
  boundaries: typeof PRIVACY_BOUNDARY
}

/**
 * What local execution does and does not establish.
 *
 * Written narrowly on purpose. "Runs locally" is often heard as "is private",
 * and only the first clause is something this code can be responsible for.
 */
export const PRIVACY_BOUNDARY = {
  sourceTextLeavesProcessThroughMahaCode: false,
  networkCallsMade: 0,
  telemetryEmitted: false,
  modelInferencePerformed: false,
  paymentPerformed: false,
  cloudFallbackAvailable: false,
  /** Hashes and metadata leave only if the caller chooses to export them. */
  metadataExportRequiresCallerAction: true,
  notClaimed: [
    'Privacy of the caller’s own endpoint, process, or storage.',
    'Browser, operating system, or device privacy properties.',
    'Absence of analytics or telemetry added by the embedding application.',
    'Behaviour of any third-party library the caller loads alongside this one.',
    'That derived hashes and metrics are non-identifying for every corpus.',
  ],
} as const

export type LocalSelectorRejection = {
  ok: false
  code: 'invalid_request' | 'invalid_document' | 'invalid_budget' | 'unsupported_contract_version'
  message: string
}

export function parseLocalSelectorRequest(value: unknown): LocalSelectorRequest {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) throw new Error('The request must be a JSON object.')
  if (record.contractVersion !== LOCAL_SELECTOR_CONTRACT_VERSION) {
    throw new Error(`Unsupported contract version. This runtime implements ${LOCAL_SELECTOR_CONTRACT_VERSION}.`)
  }
  if (typeof record.task !== 'string' || record.task.trim().length < 8) {
    throw new Error('task must be a string of at least 8 characters.')
  }
  if (!Number.isInteger(record.tokenBudget) || (record.tokenBudget as number) < 64) {
    throw new Error('tokenBudget must be an integer of at least 64.')
  }
  if (!Array.isArray(record.documents) || record.documents.length === 0) {
    throw new Error('documents must contain at least one source document.')
  }
  const seen = new Set<string>()
  for (const [index, entry] of record.documents.entries()) {
    const document = typeof entry === 'object' && entry !== null ? entry as Record<string, unknown> : null
    if (!document || typeof document.id !== 'string' || document.id.length === 0) {
      throw new Error(`documents[${index}].id must be a non-empty string.`)
    }
    if (seen.has(document.id)) throw new Error('documents[].id values must be unique.')
    seen.add(document.id)
    if (typeof document.text !== 'string' || document.text.length === 0) {
      throw new Error(`documents[${index}].text must be a non-empty string.`)
    }
  }
  return record as unknown as LocalSelectorRequest
}
