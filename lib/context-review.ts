import { compileContextPack, parseContextPackRequest, sha256 } from './context-compiler.ts'

export const CONTEXT_REVIEW_MAX_BYTES = 65_536
export const CONTEXT_REVIEW_TOOL = {
  name: 'review_context_retention',
  title: 'Review context retention',
  description: 'Select passages from explicitly supplied sanitized documents under an estimated token budget, and check whether user-declared exact evidence excerpts remain in selected passages from their specified source. No web access, storage, payments, semantic correctness guarantee, or downstream prompt capture. Do not send credentials, government IDs, payment card data, protected health information, or confidential personal records.',
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  inputSchema: {
    type: 'object', additionalProperties: false,
    required: ['task', 'tokenBudget', 'documents', 'sanitized'],
    properties: {
      task: { type: 'string', minLength: 8, maxLength: 1200 },
      tokenBudget: { type: 'integer', minimum: 64, maximum: 16000 },
      sanitized: { type: 'boolean', const: true, description: 'Confirm these are authorized, sanitized or synthetic task-specific excerpts, not restricted data.' },
      documents: { type: 'array', minItems: 1, maxItems: 8, items: {
        type: 'object', additionalProperties: false, required: ['id', 'text'],
        properties: { id: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$' }, title: { type: 'string', maxLength: 160 }, text: { type: 'string', minLength: 1, maxLength: 60000 } },
      } },
      expectedEvidence: { type: 'array', maxItems: 32, description: 'Caller-declared exact excerpts required for this task. An empty list means completeness was not tested.', items: {
        type: 'object', additionalProperties: false, required: ['sourceId', 'excerpt'],
        properties: { sourceId: { type: 'string', maxLength: 80 }, excerpt: { type: 'string', minLength: 1, maxLength: 2000 } },
      } },
    },
  },
} as const

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.')
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported input field.')
}
function restricted(value: string) {
  // Defense in depth, not a complete sensitive-data detector. Consent/sanitization is still required.
  return /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b|\b\d{3}-\d{2}-\d{4}\b|(?:password|api[_ -]?key|access[_ -]?token)\s*[:=]\s*\S{8,}/i.test(value)
}

export function reviewContextRetention(value: unknown) {
  const raw = object(value)
  keys(raw, ['task', 'tokenBudget', 'documents', 'expectedEvidence', 'sanitized'])
  if (raw.sanitized !== true) throw new Error('Confirm sanitized, authorized or synthetic excerpts before review.')
  if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > CONTEXT_REVIEW_MAX_BYTES) throw new Error('Input exceeds 64 KiB.')
  if (!Array.isArray(raw.documents)) throw new Error('Documents are required.')
  for (const item of raw.documents) {
    const document = object(item)
    keys(document, ['id', 'title', 'text'])
    if (typeof document.text !== 'string' || document.text.length > 60_000) throw new Error('Each document needs text of at most 60000 characters.')
  }
  if (restricted(JSON.stringify(raw))) throw new Error('Remove possible restricted identifiers or credentials before review.')
  const input = parseContextPackRequest({ ...raw, clientRequestId: 'context-review-v1', scoring: 'bm25', provenance: 'compact', budgetMode: 'estimated' })
  const expected = raw.expectedEvidence ?? []
  if (!Array.isArray(expected) || expected.length > 32) throw new Error('Provide at most 32 evidence declarations.')
  const declarations = expected.map(item => {
    const row = object(item)
    keys(row, ['sourceId', 'excerpt'])
    if (typeof row.sourceId !== 'string' || typeof row.excerpt !== 'string' || !row.excerpt.trim() || row.excerpt.length > 2000) throw new Error('Each declaration needs a sourceId and a nonempty excerpt of at most 2000 characters.')
    if (!input.documents.some(doc => doc.id === row.sourceId)) throw new Error('An evidence declaration refers to an unknown source.')
    return { sourceId: row.sourceId, excerpt: row.excerpt }
  })
  const pack = compileContextPack(input)
  const evidence = declarations.map(row => {
    const source = input.documents.find(doc => doc.id === row.sourceId)!
    const present = source.text.includes(row.excerpt)
    const matches = pack.includedPassages.filter(passage => passage.sourceId === row.sourceId && passage.text.includes(row.excerpt))
    return { ...row, status: !present ? 'not_in_supplied_source' : matches.length ? 'retained' : 'not_retained_as_exact_excerpt', passageIds: matches.map(passage => passage.passageId) }
  })
  // Do not leak random internal request/pack IDs. Fingerprint covers actual normalized settings.
  return {
    version: '1.0.0', compilerVersion: pack.version,
    configuration: { scoring: 'bm25', provenance: 'compact', budgetMode: 'estimated', tokenBudget: input.tokenBudget },
    inputHash: sha256(JSON.stringify({ task: input.task, documents: input.documents, tokenBudget: input.tokenBudget, declarations, scoring: 'bm25', provenance: 'compact', budgetMode: 'estimated' })),
    outputHash: pack.outputHash,
    context: pack.context, metrics: { ...pack.metrics, estimatedTokenChange: pack.metrics.compiledEstimatedTokens - pack.metrics.originalEstimatedTokens, exceedsBudgetByEstimate: pack.metrics.compiledEstimatedTokens > input.tokenBudget }, includedPassages: pack.includedPassages, sources: pack.sources,
    evidence,
    declarationStatus: declarations.length ? 'exact_excerpt_checks_only' : 'no_expected_evidence_declared',
    warnings: pack.warnings,
    limitations: [
      'Exact-excerpt checks are source-specific and case-sensitive; paraphrases and spans crossing passage boundaries can be reported as not retained.',
      'The caller defines required evidence. Undeclared omissions, document authority, supersession, tenant authorization and answer correctness are not verified.',
      'Token counts are estimates, not a provider tokenizer or hard spend cap.',
      'This reports the generated context pack, not what a downstream model actually received or used.',
      'Hashes are content fingerprints, not digital signatures or proof of authenticity.',
    ],
    retentionBoundaries: pack.retentionBoundaries,
    dataHandling: { applicationPersistsInput: false, applicationPersistsOutput: false, externalFetches: false },
  }
}

export type ContextReviewReport = ReturnType<typeof reviewContextRetention>
