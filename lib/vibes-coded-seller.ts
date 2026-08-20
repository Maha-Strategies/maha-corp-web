import { createHash } from 'node:crypto'

import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'
import { evaluateContextPack, parseContextEvaluationRequest, type ContextEvaluationRequest } from './context-pack-evaluator.ts'
import { sha256 } from './context-compiler.ts'

export const VIBES_CODED_SKU_SLUG = 'governed-context-verification-pack'
export const VIBES_CODED_SKU_METHOD = 'POST'
export const VIBES_CODED_PRICE_CENTS = 50
export const VIBES_CODED_PRICE_USD = '0.50'
export const VIBES_CODED_MAX_REQUEST_BYTES = 128_000
export const VIBES_CODED_CONTRACT_VERSION = 'seller-endpoint-call-ticket-v1'
export const VIBES_CODED_UNPAID_SMOKE_PATH = '/api/v1/seller-endpoints/vibes-demo-echo/call'

/**
 * This is the normalized contract snapshot used by the adapter. It is based
 * on the public Vibes-Coded machine index observed on 2026-08-20 and the
 * seller ticket checklist named by that index. Keeping the shape in code makes
 * the digest change whenever a binding field changes.
 */
export const VIBES_CODED_CONTRACT_SNAPSHOT = Object.freeze({
  version: VIBES_CODED_CONTRACT_VERSION,
  callPath: '/api/v1/seller-endpoints/{slug}/call',
  verifyPath: '/api/v1/seller-endpoints/{slug}/verify-call-ticket',
  receiptPath: '/api/v1/seller-endpoints/{slug}/delivery-receipt',
  ticketHeader: 'X-Vibes-Call-Ticket',
  bindingFields: ['charge', 'slug', 'method', 'request_hash', 'amount'],
  delivery: 'metadata-only',
  responseBodyRetention: 'none-beyond-existing-transient-boundary',
  minimumPriceCents: 50,
  firstTenSettledCallsFeePercent: 0,
})

export const VIBES_CODED_CONTRACT_DIGEST = sha256(JSON.stringify(VIBES_CODED_CONTRACT_SNAPSHOT))

const REQUEST_FIELDS = new Set([
  'clientRequestId', 'task', 'tokenBudget', 'documents', 'requiredEvidence',
  'provenance', 'scoring', 'budgetMode',
])

export type SellerCallState = 'verifying' | 'verification_pending' | 'paid' | 'delivery_pending' | 'delivered' | 'rejected'

export type SellerCallRecord = {
  clientRequestId: string
  skuSlug: string
  method: string
  requestHash: string
  amountCents: number
  ticketHash: string
  deliveryId: string
  state: SellerCallState
  outputHash?: string
  responseSha256?: string
  lastErrorCode?: string
}

export type SellerCallStore = {
  get(clientRequestId: string): Promise<SellerCallRecord | null>
  admit(input: Omit<SellerCallRecord, 'state'>): Promise<{ kind: 'claimed' | 'existing' | 'in_progress' | 'conflict'; record: SellerCallRecord | null }>
  update(input: { clientRequestId: string; requestHash: string; state?: SellerCallState; outputHash?: string; responseSha256?: string; lastErrorCode?: string }): Promise<void>
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalizeJson(item)]))
  }
  throw new TypeError('Only JSON-compatible values can be hashed.')
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value))
}

export function governedRequestHash(input: ContextEvaluationRequest): string {
  return sha256(canonicalJson(input))
}

function stableId(prefix: string, requestHash: string): string {
  return `${prefix}${requestHash.slice('sha256:'.length, 'sha256:'.length + 32)}`
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export function parseGovernedContextRequest(value: unknown): ContextEvaluationRequest {
  const body = object(value)
  if (!body) throw new Error('Request body must be a JSON object.')
  const unknownFields = Object.keys(body).filter((key) => !REQUEST_FIELDS.has(key))
  if (unknownFields.length > 0) throw new Error(`Unsupported request field: ${unknownFields[0]}.`)
  return parseContextEvaluationRequest(body)
}

export function requestHashForRawBody(raw: string): { input: ContextEvaluationRequest; requestHash: string } {
  const input = parseGovernedContextRequest(JSON.parse(raw))
  return { input, requestHash: governedRequestHash(input) }
}

function policyFor(input: ContextEvaluationRequest, evaluated: ReturnType<typeof evaluateContextPack>) {
  return {
    policyVersion: 'governed-context-verification-pack-policy-1',
    decision: 'accepted',
    sourceTextStored: false,
    compiledContextStored: false,
    requiredEvidenceTextStored: false,
    responseBodyStored: false,
    limits: {
      maxRequestBytes: VIBES_CODED_MAX_REQUEST_BYTES,
      maxDocuments: 8,
      maxRequiredEvidence: 32,
      maxTokenBudget: 16_000,
    },
    observed: {
      requestBytes: Buffer.byteLength(canonicalJson(input), 'utf8'),
      documentCount: input.documents.length,
      requiredEvidenceCount: input.requiredEvidence.length,
      sourceCoveragePercent: evaluated.metrics.sourceCoveragePercent,
    },
  }
}

function buildArtifact(input: ContextEvaluationRequest, requestHash: string, deliveryId: string) {
  const evaluated = evaluateContextPack(input)
  const contextPack = { ...evaluated.contextPack, packId: stableId('ctxpack_', requestHash) }
  const evaluationId = stableId('ctxeval_', requestHash)
  const base = {
    schemaVersion: '1.0.0',
    contract: { version: VIBES_CODED_CONTRACT_VERSION, digest: VIBES_CODED_CONTRACT_DIGEST },
    sku: { slug: VIBES_CODED_SKU_SLUG, method: VIBES_CODED_SKU_METHOD, priceUsd: VIBES_CODED_PRICE_USD, priceCents: VIBES_CODED_PRICE_CENTS },
    request: { clientRequestId: input.clientRequestId, requestHash },
    deliverable: {
      evaluationId,
      contextPack,
      evidence: evaluated.evidence,
      metrics: evaluated.metrics,
      policy: policyFor(input, evaluated),
      budget: {
        requestedTokenBudget: input.tokenBudget,
        budgetMode: input.budgetMode ?? 'guaranteed',
        compiledEstimatedTokens: evaluated.metrics.compiledEstimatedTokens,
        budgetSatisfied: evaluated.metrics.compiledEstimatedTokens <= input.tokenBudget,
      },
      integrity: {
        inputHash: contextPack.inputHash,
        compiledOutputHash: contextPack.outputHash,
        evaluationOutputHash: evaluated.outputHash,
      },
    },
    limitations: [
      'Selection is extractive and best-effort; evidence can be omitted under a fixed budget.',
      'Token counts are model-neutral estimates, not provider tokenizer or billing counts.',
      'Evidence retention checks exact source-span presence and does not verify claims, answer quality, legal compliance, or downstream model behavior.',
      'Delivery evidence contains metadata and hashes only; no source or result body is sent to Vibes-Coded.',
    ],
    sourceTextStored: false,
    compiledContextStored: false,
    responseBodyStored: false,
    delivery: { receiptId: deliveryId, state: 'delivered' as const },
  }
  const responseSha256 = sha256(canonicalJson(base))
  return { payload: { ...base, delivery: { ...base.delivery, responseSha256 } }, outputHash: evaluated.outputHash, responseSha256 }
}

type LedgerClient = {
  from(table: string): SupabaseQuery
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
}

type SupabaseQueryResult = { data: unknown; error: { code?: string; message?: string } | null }
type SupabaseQuery = PromiseLike<SupabaseQueryResult> & {
  select(columns?: string): SupabaseQuery
  update(values: Record<string, unknown>): SupabaseQuery
  eq(column: string, value: unknown): SupabaseQuery
  maybeSingle(): PromiseLike<SupabaseQueryResult>
}

function recordFromRow(row: Record<string, unknown>): SellerCallRecord {
  return {
    clientRequestId: String(row.client_request_id),
    skuSlug: String(row.sku_slug),
    method: String(row.method),
    requestHash: String(row.request_hash),
    amountCents: Number(row.amount_cents),
    ticketHash: String(row.ticket_hash),
    deliveryId: String(row.delivery_id),
    state: String(row.state) as SellerCallState,
    ...(row.output_hash ? { outputHash: String(row.output_hash) } : {}),
    ...(row.response_sha256 ? { responseSha256: String(row.response_sha256) } : {}),
    ...(row.last_error_code ? { lastErrorCode: String(row.last_error_code) } : {}),
  }
}

export function createVibesSellerCallStore(): SellerCallStore | null {
  const ledger = createAgentInquiryLedger() as LedgerClient | null
  if (!ledger) return null
  return {
    async get(clientRequestId) {
      const { data, error } = await ledger.from('vibes_coded_seller_calls').select('*').eq('client_request_id', clientRequestId).maybeSingle()
      if (error) throw new Error('seller_call_ledger_read_failed')
      return data ? recordFromRow(data as Record<string, unknown>) : null
    },
    async admit(input) {
      const { data, error } = await ledger.rpc('admit_vibes_coded_seller_call', {
        p_client_request_id: input.clientRequestId,
        p_sku_slug: input.skuSlug,
        p_method: input.method,
        p_request_hash: input.requestHash,
        p_amount_cents: input.amountCents,
        p_ticket_hash: input.ticketHash,
        p_delivery_id: input.deliveryId,
      })
      if (error) throw new Error('seller_call_ledger_admit_failed')
      const result = object(data)
      if (!result || typeof result.kind !== 'string') throw new Error('seller_call_ledger_invalid_admit')
      const row = object(result.record)
      return {
        kind: result.kind as 'claimed' | 'existing' | 'in_progress' | 'conflict',
        record: row ? recordFromRow(row) : null,
      }
    },
    async update(input) {
      const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.state !== undefined) values.state = input.state
      if (input.outputHash !== undefined) values.output_hash = input.outputHash
      if (input.responseSha256 !== undefined) values.response_sha256 = input.responseSha256
      if (input.lastErrorCode !== undefined) values.last_error_code = input.lastErrorCode
      const { error } = await ledger.from('vibes_coded_seller_calls').update(values).eq('client_request_id', input.clientRequestId).eq('request_hash', input.requestHash)
      if (error) throw new Error('seller_call_ledger_update_failed')
    },
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export type SellerClient = {
  verify(input: { ticket: string; requestHash: string }): Promise<{ kind: 'verified' | 'rejected' | 'unavailable'; code?: string }>
  submitReceipt(input: { ticket: string; requestHash: string; deliveryId: string; responseSha256: string }): Promise<{ kind: 'accepted' | 'rejected' | 'unavailable'; code?: string }>
}

function boundedCode(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 48)
  return normalized || fallback
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > 16_000) return null
  try { return object(JSON.parse(text)) } catch { return null }
}

async function withTimeout(fetcher: Fetcher, url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetcher(url, { ...init, signal: controller.signal, cache: 'no-store' }) } catch { return null } finally { clearTimeout(timer) }
}

export function createVibesSellerClient(options: { fetcher?: Fetcher; origin?: string; enabled?: boolean; verifyTimeoutMs?: number; receiptTimeoutMs?: number } = {}): SellerClient {
  const fetcher = options.fetcher ?? fetch
  const origin = (options.origin ?? process.env.VIBES_CODED_ORIGIN ?? 'https://vibes-coded.com').replace(/\/$/, '')
  const enabled = options.enabled ?? process.env.VIBES_CODED_SELLER_ENABLED === 'true'
  const verifyTimeoutMs = options.verifyTimeoutMs ?? Number(process.env.VIBES_CODED_VERIFY_TIMEOUT_MS ?? 5_000)
  const receiptTimeoutMs = options.receiptTimeoutMs ?? Number(process.env.VIBES_CODED_RECEIPT_TIMEOUT_MS ?? 5_000)
  const verifyUrl = `${origin}/api/v1/seller-endpoints/${VIBES_CODED_SKU_SLUG}/verify-call-ticket`
  const receiptUrl = `${origin}/api/v1/seller-endpoints/${VIBES_CODED_SKU_SLUG}/delivery-receipt`

  return {
    async verify(input) {
      if (!enabled) return { kind: 'unavailable', code: 'seller_integration_disabled' }
      const response = await withTimeout(fetcher, verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Vibes-Call-Ticket': input.ticket },
        body: JSON.stringify({
          call_ticket: input.ticket,
          slug: VIBES_CODED_SKU_SLUG,
          method: VIBES_CODED_SKU_METHOD,
          request_hash: input.requestHash,
          amount: VIBES_CODED_PRICE_USD,
          amount_cents: VIBES_CODED_PRICE_CENTS,
        }),
      }, verifyTimeoutMs)
      if (!response) return { kind: 'unavailable', code: 'verifier_unavailable' }
      const body = await readJson(response)
      if (!response.ok) return { kind: 'rejected', code: boundedCode(body?.reason ?? body?.code, response.status === 409 ? 'ticket_replayed' : 'ticket_rejected') }
      if (!body || (body.valid !== true && body.verified !== true && body.ok !== true)) return { kind: 'rejected', code: 'ticket_verification_ambiguous' }
      for (const [key, expected] of [['slug', VIBES_CODED_SKU_SLUG], ['method', VIBES_CODED_SKU_METHOD], ['request_hash', input.requestHash], ['amount_cents', VIBES_CODED_PRICE_CENTS] ] as const) {
        if (body[key] !== undefined && body[key] !== expected) return { kind: 'rejected', code: `ticket_${key}_mismatch` }
      }
      return { kind: 'verified' }
    },
    async submitReceipt(input) {
      if (!enabled) return { kind: 'unavailable', code: 'seller_integration_disabled' }
      const response = await withTimeout(fetcher, receiptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Vibes-Call-Ticket': input.ticket },
        body: JSON.stringify({
          call_ticket: input.ticket,
          slug: VIBES_CODED_SKU_SLUG,
          method: VIBES_CODED_SKU_METHOD,
          request_hash: input.requestHash,
          amount: VIBES_CODED_PRICE_USD,
          amount_cents: VIBES_CODED_PRICE_CENTS,
          receipt_id: input.deliveryId,
          delivered: true,
          response_sha256: input.responseSha256,
        }),
      }, receiptTimeoutMs)
      if (!response) return { kind: 'unavailable', code: 'receipt_endpoint_unavailable' }
      if (response.ok || response.status === 409) return { kind: 'accepted' }
      const body = await readJson(response)
      return { kind: 'rejected', code: boundedCode(body?.reason ?? body?.code, 'delivery_receipt_rejected') }
    },
  }
}

function ticketHash(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex')
}

function sameTicketHash(left: string, right: string): boolean {
  return left.length === right.length && createHash('sha256').update(left).digest('hex') === createHash('sha256').update(right).digest('hex')
}

function response(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } })
}

function pendingResponse(code: string, status = 503, extra: Record<string, unknown> = {}) {
  return response({ error: { code, message: 'Payment was accepted or may already have settled, but delivery is not confirmed. Retry the same logical request with the same call ticket; do not pay again.' }, paymentState: 'paid_delivery_pending', ...extra }, status)
}

export type GovernedContextDependencies = {
  store?: SellerCallStore | null
  client?: SellerClient
}

export async function handleGovernedContextCall(request: Request, dependencies: GovernedContextDependencies = {}): Promise<Response> {
  if (request.method !== VIBES_CODED_SKU_METHOD) return response({ error: { code: 'method_not_allowed', message: 'Only POST is supported.' } }, 405)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > VIBES_CODED_MAX_REQUEST_BYTES) return response({ error: { code: 'payload_too_large', message: 'The request exceeds the 128 KB limit.' } }, 413)

  let parsed: ContextEvaluationRequest
  let requestHash: string
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > VIBES_CODED_MAX_REQUEST_BYTES) return response({ error: { code: 'payload_too_large', message: 'The request exceeds the 128 KB limit.' } }, 413)
    const result = requestHashForRawBody(raw)
    parsed = result.input
    requestHash = result.requestHash
  } catch (error) {
    return response({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400)
  }

  const store = dependencies.store !== undefined ? dependencies.store : createVibesSellerCallStore()
  const ticket = request.headers.get('X-Vibes-Call-Ticket')?.trim() || ''
  let existing: SellerCallRecord | null = null
  if (store) {
    try { existing = await store.get(parsed.clientRequestId) } catch { if (ticket) return pendingResponse('payment_state_unavailable') }
  }
  if (existing && existing.requestHash !== requestHash) return response({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different input.' } }, 409)
  if (existing && existing.skuSlug !== VIBES_CODED_SKU_SLUG) return response({ error: { code: 'sku_mismatch', message: 'The paid request is bound to a different SKU.' } }, 409)
  if (existing && existing.method !== VIBES_CODED_SKU_METHOD) return response({ error: { code: 'method_mismatch', message: 'The paid request is bound to a different HTTP method.' } }, 409)
  if (existing && existing.amountCents !== VIBES_CODED_PRICE_CENTS) return response({ error: { code: 'amount_mismatch', message: 'The paid request is bound to a different amount.' } }, 409)

  if (existing?.state === 'delivered') {
    const artifact = buildArtifact(parsed, requestHash, existing.deliveryId)
    if (artifact.outputHash !== existing.outputHash || artifact.responseSha256 !== existing.responseSha256) return pendingResponse('recovery_integrity_failure', 500)
    return response({ ...artifact.payload, idempotentReplay: true }, 200)
  }
  if (!ticket) {
    if (existing && ['verification_pending', 'paid', 'delivery_pending'].includes(existing.state)) return pendingResponse('call_ticket_required_for_recovery', 202, { receiptId: existing.deliveryId })
    return response({ error: { code: 'payment_required', message: 'A Vibes-Coded call ticket is required.' }, sku: VIBES_CODED_SKU_SLUG, amountUsd: VIBES_CODED_PRICE_USD, paymentState: 'unpaid' }, 402)
  }
  if (!store) return pendingResponse('payment_state_unavailable')

  const suppliedTicketHash = ticketHash(ticket)
  if (existing && !sameTicketHash(existing.ticketHash, suppliedTicketHash)) return response({ error: { code: 'ticket_mismatch', message: 'The call ticket is not bound to this logical request.' } }, 409)
  if (existing?.state === 'rejected') return response({ error: { code: existing.lastErrorCode ?? 'ticket_rejected', message: 'The call ticket was rejected and cannot be reused.' } }, 409)
  if (existing?.state === 'verifying') return pendingResponse('payment_verification_in_progress', 202)

  let record = existing
  if (!record) {
    const deliveryId = stableId('receipt_', requestHash)
    try {
      const admission = await store.admit({ clientRequestId: parsed.clientRequestId, skuSlug: VIBES_CODED_SKU_SLUG, method: VIBES_CODED_SKU_METHOD, requestHash, amountCents: VIBES_CODED_PRICE_CENTS, ticketHash: suppliedTicketHash, deliveryId })
      if (admission.kind === 'conflict') return response({ error: { code: 'idempotency_conflict', message: 'clientRequestId was already used with different payment bindings.' } }, 409)
      if (admission.kind === 'in_progress') return pendingResponse('payment_verification_in_progress', 202)
      record = admission.record
    } catch { return pendingResponse('payment_state_unavailable') }
  }
  if (!record) return pendingResponse('payment_state_unavailable')

  const client = dependencies.client ?? createVibesSellerClient()
  if (record.state === 'verification_pending' || record.state === 'verifying') {
    const verified = await client.verify({ ticket, requestHash })
    if (verified.kind === 'unavailable') {
      try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'verification_pending', lastErrorCode: verified.code }) } catch { /* preserve paid-pending response */ }
      return pendingResponse(verified.code ?? 'verifier_unavailable')
    }
    if (verified.kind === 'rejected') {
      try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'rejected', lastErrorCode: verified.code }) } catch { /* rejection remains fail closed */ }
      return response({ error: { code: verified.code ?? 'ticket_rejected', message: 'The call ticket did not verify for this SKU, method, request hash, and amount.' }, paymentState: 'rejected' }, 409)
    }
    try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'paid' }) } catch { return pendingResponse('payment_state_unavailable') }
    record = { ...record, state: 'paid' }
  }

  const artifact = buildArtifact(parsed, requestHash, record.deliveryId)
  if (record.outputHash && (record.outputHash !== artifact.outputHash || record.responseSha256 !== artifact.responseSha256)) return pendingResponse('recovery_integrity_failure', 500)
  if (!record.outputHash) {
    try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'delivery_pending', outputHash: artifact.outputHash, responseSha256: artifact.responseSha256 }) } catch { return pendingResponse('payment_state_unavailable') }
  }

  const receipt = await client.submitReceipt({ ticket, requestHash, deliveryId: record.deliveryId, responseSha256: artifact.responseSha256 })
  if (receipt.kind !== 'accepted') {
    try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'delivery_pending', lastErrorCode: receipt.code }) } catch { /* retain fail-closed response */ }
    return pendingResponse(receipt.code ?? 'delivery_receipt_pending', 202, { receiptId: record.deliveryId })
  }
  try { await store.update({ clientRequestId: parsed.clientRequestId, requestHash, state: 'delivered', lastErrorCode: undefined }) } catch { return pendingResponse('delivery_state_unavailable') }
  return response({ ...artifact.payload, idempotentReplay: Boolean(existing) }, 200)
}
