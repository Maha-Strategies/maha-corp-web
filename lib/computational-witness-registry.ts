import { createHash } from 'node:crypto'

import { bearerApiKey, getApiKeyRecordForRawKey, authorizeAndConsumeApiUnit, type ApiKeyTier } from './api-key.ts'
import { canonicalJson } from './evidence-dossier/digest.ts'
import {
  verifyComputationalWitnessReceipt,
  type ComputationalWitnessReceipt,
} from './evidence-dossier/runtime-witness.ts'

export const WITNESS_REGISTRY_MAX_BYTES = 262_144
export const WITNESS_RETENTION_CONSENT = 'persist-receipt' as const
export const WITNESS_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const

const DIGEST = /^sha256:[a-f0-9]{64}$/
const IDEMPOTENCY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/
const UTC_SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const SECRET_KEY = /(^|[_-])(token|secret|password|authorization|credential)(s)?($|[_-])|api[_-]?key|private[_-]?key|access[_-]?token|bearer[_-]?token/i
const TOP_LEVEL_FIELDS = new Set(['schemaVersion', 'canonicalizationVersion', 'witnessVersion', 'jobId', 'callable', 'execution', 'artifacts', 'inputSha256', 'outputSha256', 'environment', 'environmentSha256', 'randomSeeds', 'configuration', 'adapters', 'bindings', 'assurance', 'receiptSha256'])

const sha256 = (value: string): string => `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`

export interface WitnessRegistryPrincipal {
  tenantId: string
  keyId: string
  tier: ApiKeyTier
  zeroDataRetention: boolean
  role: 'tenant-api-key'
  permissions: readonly WitnessPermission[]
}

export type WitnessPermission = 'witness:verify' | 'witness:submit' | 'witness:read' | 'witness:purge'
const TENANT_API_KEY_PERMISSIONS: readonly WitnessPermission[] = ['witness:verify', 'witness:submit', 'witness:read', 'witness:purge']

export type WitnessAuthorization =
  | { ok: true; principal: WitnessRegistryPrincipal }
  | { ok: false; status: 401 | 402 | 403 | 429 | 503; code: string }

export type WitnessAuthenticator = (request: Request, consumeUnit: boolean) => Promise<WitnessAuthorization>

export interface WitnessSubmissionPlan {
  tenantId: string
  receipt: ComputationalWitnessReceipt
  receiptSha256: string
  jobIdSha256: string
  bindingSha256: string
  idempotencyHash: string
  requestSha256: string
  actorFingerprint: string
  retentionDays: number
}

export interface WitnessRegistryRead {
  receiptSha256: string
  schemaVersion: string
  executionStatus: string
  inputSha256: string
  outputSha256: string
  environmentSha256: string
  artifactCount: number
  retainedUntil: string
  payloadAvailable: boolean
  receipt: ComputationalWitnessReceipt | null
}

export interface WitnessRegistryStore {
  submit(plan: WitnessSubmissionPlan): Promise<{ status: 'created' | 'idempotent' | 'replay'; receiptSha256: string; retainedUntil: string; payloadAvailable: boolean }>
  read(tenantId: string, receiptSha256: string): Promise<WitnessRegistryRead | null>
  purge(tenantId: string, receiptSha256: string, actorFingerprint: string): Promise<{ receiptSha256: string; payloadPurged: boolean; immutableIdentityRetained: boolean }>
}

export class WitnessRegistryInputError extends Error {
  readonly status: 400 | 409 | 413 | 415
  readonly code: string
  constructor(status: 400 | 409 | 413 | 415, code: string, message: string) { super(message); this.status = status; this.code = code }
}

export class WitnessRegistryConflictError extends Error {
  constructor() { super('Idempotency-Key was already used for a different witness submission.'); this.name = 'WitnessRegistryConflictError' }
}

export async function authenticateWitnessRegistry(request: Request, consumeUnit: boolean): Promise<WitnessAuthorization> {
  const rawKey = bearerApiKey(request)
  if (!rawKey) return { ok: false, status: 401, code: 'api_key_required' }
  try {
    if (consumeUnit) {
      const access = await authorizeAndConsumeApiUnit(rawKey)
      if (access.kind === 'authorized') return { ok: true, principal: { tenantId: access.tenantId, keyId: access.keyId, tier: access.tier, zeroDataRetention: access.zeroDataRetention, role: 'tenant-api-key', permissions: TENANT_API_KEY_PERMISSIONS } }
      if (access.kind === 'depleted') return { ok: false, status: 402, code: 'api_credits_depleted' }
      if (access.kind === 'rate_limited') return { ok: false, status: 429, code: 'api_rate_limited' }
      return { ok: false, status: access.kind === 'unavailable' ? 503 : 401, code: access.kind === 'unavailable' ? 'api_key_service_unavailable' : 'invalid_api_key' }
    }
    const record = await getApiKeyRecordForRawKey(rawKey)
    if (!record) return { ok: false, status: 401, code: 'invalid_api_key' }
    return { ok: true, principal: { tenantId: record.tenant_id, keyId: record.key_id, tier: record.tier, zeroDataRetention: record.zero_data_retention, role: 'tenant-api-key', permissions: TENANT_API_KEY_PERMISSIONS } }
  } catch {
    return { ok: false, status: 503, code: 'api_key_service_unavailable' }
  }
}

export async function readBoundedWitnessJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new WitnessRegistryInputError(415, 'content_type_required', 'Content-Type must be application/json.')
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > WITNESS_REGISTRY_MAX_BYTES) throw new WitnessRegistryInputError(413, 'receipt_too_large', `Receipt exceeds ${WITNESS_REGISTRY_MAX_BYTES} bytes.`)
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > WITNESS_REGISTRY_MAX_BYTES) throw new WitnessRegistryInputError(413, 'receipt_too_large', `Receipt exceeds ${WITNESS_REGISTRY_MAX_BYTES} bytes.`)
  try { return JSON.parse(text) } catch { throw new WitnessRegistryInputError(400, 'invalid_json', 'Receipt body is not valid JSON.') }
}

export function validatedWitnessReceipt(value: unknown): ComputationalWitnessReceipt {
  const findings = verifyComputationalWitnessReceipt(value)
  if (findings.length) throw new WitnessRegistryInputError(400, 'invalid_witness_receipt', `Receipt verification failed: ${findings.join(',')}`)
  const receipt = value as ComputationalWitnessReceipt
  if (Object.keys(receipt).some((key) => !TOP_LEVEL_FIELDS.has(key))) throw new WitnessRegistryInputError(400, 'receipt_field_invalid', 'Receipt contains an undeclared top-level field.')
  const exact = (record: Record<string, unknown>, fields: readonly string[]) => Object.keys(record).length === fields.length && Object.keys(record).every((key) => fields.includes(key))
  if (!exact(receipt.callable as unknown as Record<string, unknown>, ['module', 'qualname']) ||
    !exact(receipt.execution as unknown as Record<string, unknown>, ['status', 'startedAt', 'finishedAt', 'failureType']) ||
    !exact(receipt.bindings as unknown as Record<string, unknown>, ['dossierId', 'claimIds', 'calculationReceiptIds']) ||
    !exact(receipt.assurance as unknown as Record<string, unknown>, ['executionObserved', 'independentlyReproduced', 'scientificValidityCertified', 'environmentComplete', 'secretsCaptured']) ||
    receipt.artifacts.some((artifact) => !exact(artifact as unknown as Record<string, unknown>, ['name', 'role', 'mediaType', 'bytes', 'sha256']))) throw new WitnessRegistryInputError(400, 'receipt_field_invalid', 'Receipt contains an undeclared structured field.')
  const credentialKey = (input: unknown): boolean => {
    if (Array.isArray(input)) return input.some(credentialKey)
    if (!input || typeof input !== 'object') return false
    return Object.entries(input as Record<string, unknown>).some(([key, entry]) => SECRET_KEY.test(key.replace(/(?<!^)(?=[A-Z])/g, '_')) || credentialKey(entry))
  }
  if (credentialKey(receipt.environment) || credentialKey(receipt.configuration) || credentialKey(receipt.randomSeeds) || credentialKey(receipt.adapters)) throw new WitnessRegistryInputError(400, 'credential_metadata_prohibited', 'Credential-shaped metadata cannot enter the witness registry.')
  const crossRuntimeUnsafeNumber = (input: unknown): boolean => Array.isArray(input)
    ? input.some(crossRuntimeUnsafeNumber)
    : Boolean(input && typeof input === 'object')
      ? Object.values(input as Record<string, unknown>).some(crossRuntimeUnsafeNumber)
      : typeof input === 'number' && !Number.isSafeInteger(input)
  if (crossRuntimeUnsafeNumber(receipt)) throw new WitnessRegistryInputError(400, 'cross_runtime_number_invalid', 'Floating-point and unsafe integer metadata must be encoded as decimal strings.')
  if (receipt.artifacts.length > 2048) throw new WitnessRegistryInputError(400, 'artifact_limit_exceeded', 'Receipt exceeds 2048 artifact commitments.')
  const started = Date.parse(receipt.execution.startedAt), finished = Date.parse(receipt.execution.finishedAt)
  if (!UTC_SECOND.test(receipt.execution.startedAt) || !UTC_SECOND.test(receipt.execution.finishedAt) || !Number.isFinite(started) || !Number.isFinite(finished) || finished < started) throw new WitnessRegistryInputError(400, 'execution_time_invalid', 'Execution instants must be ordered UTC timestamps at second precision.')
  return receipt
}

export function retentionPolicy(request: Request): { days: number; consented: true } {
  if (request.headers.get('x-maha-witness-retention-consent') !== WITNESS_RETENTION_CONSENT) throw new WitnessRegistryInputError(409, 'retention_consent_required', `Set X-Maha-Witness-Retention-Consent: ${WITNESS_RETENTION_CONSENT}.`)
  const days = Number(request.headers.get('x-maha-witness-retention-days'))
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new WitnessRegistryInputError(400, 'retention_days_invalid', 'X-Maha-Witness-Retention-Days must be an integer from 1 to 3650.')
  return { days, consented: true }
}

export function idempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key') ?? ''
  if (!IDEMPOTENCY.test(value)) throw new WitnessRegistryInputError(400, 'idempotency_key_invalid', 'Idempotency-Key must contain 8-120 safe identifier characters.')
  return value
}

export function buildWitnessSubmissionPlan(input: {
  principal: WitnessRegistryPrincipal
  receipt: ComputationalWitnessReceipt
  idempotencyKey: string
  retentionDays: number
}): WitnessSubmissionPlan {
  const { principal, receipt } = input
  return {
    tenantId: principal.tenantId,
    receipt,
    receiptSha256: receipt.receiptSha256,
    jobIdSha256: sha256(canonicalJson(receipt.jobId)),
    bindingSha256: sha256(canonicalJson(receipt.bindings)),
    idempotencyHash: sha256(canonicalJson({ tenantId: principal.tenantId, idempotencyKey: input.idempotencyKey })),
    requestSha256: sha256(canonicalJson({ receiptSha256: receipt.receiptSha256, retentionDays: input.retentionDays })),
    actorFingerprint: sha256(canonicalJson({ keyId: principal.keyId })),
    retentionDays: input.retentionDays,
  }
}

function authResponse(auth: Exclude<WitnessAuthorization, { ok: true }>): Response {
  return Response.json({ error: { code: auth.code, message: 'Witness registry authorization failed.' } }, { status: auth.status, headers: WITNESS_RESPONSE_HEADERS })
}

function requirePermission(principal: WitnessRegistryPrincipal, permission: WitnessPermission): Exclude<WitnessAuthorization, { ok: true }> | null {
  return principal.permissions.includes(permission) ? null : { ok: false, status: 403, code: 'witness_permission_denied' }
}

function errorResponse(error: unknown): Response {
  if (error instanceof WitnessRegistryInputError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: WITNESS_RESPONSE_HEADERS })
  if (error instanceof WitnessRegistryConflictError) return Response.json({ error: { code: 'idempotency_conflict', message: error.message } }, { status: 409, headers: WITNESS_RESPONSE_HEADERS })
  console.error('[WITNESS_REGISTRY_ERROR]', error instanceof Error ? error.name : 'unknown_error')
  return Response.json({ error: { code: 'witness_registry_unavailable', message: 'Witness registry is temporarily unavailable.' } }, { status: 503, headers: WITNESS_RESPONSE_HEADERS })
}

export async function verifyWitnessRegistryRequest(request: Request, authenticate: WitnessAuthenticator): Promise<Response> {
  try {
    const preliminary = await authenticate(request, false)
    if (!preliminary.ok) return authResponse(preliminary)
    const preliminaryDenied = requirePermission(preliminary.principal, 'witness:verify')
    if (preliminaryDenied) return authResponse(preliminaryDenied)
    const receipt = validatedWitnessReceipt(await readBoundedWitnessJson(request))
    const auth = await authenticate(request, true)
    if (!auth.ok) return authResponse(auth)
    if (auth.principal.tenantId !== preliminary.principal.tenantId || auth.principal.keyId !== preliminary.principal.keyId) return authResponse({ ok: false, status: 401, code: 'api_key_identity_changed' })
    const denied = requirePermission(auth.principal, 'witness:verify')
    if (denied) return authResponse(denied)
    return Response.json({ ok: true, receiptSha256: receipt.receiptSha256, contentRetained: false, scientificValidityCertified: false, independentlyReproduced: false }, { headers: WITNESS_RESPONSE_HEADERS })
  } catch (error) { return errorResponse(error) }
}

export function createWitnessRegistryHandlers(dependencies: { authenticate: WitnessAuthenticator; store: WitnessRegistryStore }) {
  return {
    submit: async (request: Request): Promise<Response> => {
      try {
        const preliminary = await dependencies.authenticate(request, false)
        if (!preliminary.ok) return authResponse(preliminary)
        const preliminaryDenied = requirePermission(preliminary.principal, 'witness:submit')
        if (preliminaryDenied) return authResponse(preliminaryDenied)
        const retention = retentionPolicy(request)
        const key = idempotencyKey(request)
        const receipt = validatedWitnessReceipt(await readBoundedWitnessJson(request))
        const auth = await dependencies.authenticate(request, true)
        if (!auth.ok) return authResponse(auth)
        if (auth.principal.tenantId !== preliminary.principal.tenantId || auth.principal.keyId !== preliminary.principal.keyId) return authResponse({ ok: false, status: 401, code: 'api_key_identity_changed' })
        const denied = requirePermission(auth.principal, 'witness:submit')
        if (denied) return authResponse(denied)
        const plan = buildWitnessSubmissionPlan({ principal: auth.principal, receipt, idempotencyKey: key, retentionDays: retention.days })
        const result = await dependencies.store.submit(plan)
        return Response.json({ ...result, tenantId: auth.principal.tenantId, retention: { days: retention.days, payloadPurgeable: true, immutableIdentityRetainedAfterPurge: true, zeroDataRetentionOverrideApplied: auth.principal.zeroDataRetention } }, { status: result.status === 'created' ? 201 : 200, headers: WITNESS_RESPONSE_HEADERS })
      } catch (error) { return errorResponse(error) }
    },
    verify: async (request: Request): Promise<Response> => verifyWitnessRegistryRequest(request, dependencies.authenticate),
    read: async (request: Request, receiptSha256: string): Promise<Response> => {
      if (!DIGEST.test(receiptSha256)) return Response.json({ error: { code: 'receipt_id_invalid', message: 'Receipt id must be a SHA-256 digest.' } }, { status: 400, headers: WITNESS_RESPONSE_HEADERS })
      const auth = await dependencies.authenticate(request, false)
      if (!auth.ok) return authResponse(auth)
      const denied = requirePermission(auth.principal, 'witness:read')
      if (denied) return authResponse(denied)
      try {
        const record = await dependencies.store.read(auth.principal.tenantId, receiptSha256)
        if (!record) return Response.json({ error: { code: 'receipt_not_found', message: 'Receipt was not found.' } }, { status: 404, headers: WITNESS_RESPONSE_HEADERS })
        const verification = record.receipt ? verifyComputationalWitnessReceipt(record.receipt) : null
        return Response.json({ ...record, verification: verification === null ? { available: false, reason: 'payload-unavailable' } : { available: true, ok: verification.length === 0, findings: verification }, immutableIdentityRetained: true }, { status: record.payloadAvailable ? 200 : 410, headers: WITNESS_RESPONSE_HEADERS })
      } catch (error) { return errorResponse(error) }
    },
    purge: async (request: Request, receiptSha256: string): Promise<Response> => {
      if (!DIGEST.test(receiptSha256)) return Response.json({ error: { code: 'receipt_id_invalid', message: 'Receipt id must be a SHA-256 digest.' } }, { status: 400, headers: WITNESS_RESPONSE_HEADERS })
      const auth = await dependencies.authenticate(request, false)
      if (!auth.ok) return authResponse(auth)
      const denied = requirePermission(auth.principal, 'witness:purge')
      if (denied) return authResponse(denied)
      try {
        const actorFingerprint = sha256(canonicalJson({ keyId: auth.principal.keyId }))
        const result = await dependencies.store.purge(auth.principal.tenantId, receiptSha256, actorFingerprint)
        if (!result.immutableIdentityRetained) return Response.json({ error: { code: 'receipt_not_found', message: 'Receipt was not found.' } }, { status: 404, headers: WITNESS_RESPONSE_HEADERS })
        return Response.json({ ...result, contentRetained: false }, { headers: WITNESS_RESPONSE_HEADERS })
      } catch (error) { return errorResponse(error) }
    },
  }
}
