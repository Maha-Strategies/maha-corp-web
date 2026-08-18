import { createHash } from 'node:crypto'
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import canonicalize from 'canonicalize'
import previewSchema from '../../content/integrations/x402-trust-preview.schema.json' with { type: 'json' }

export const X402_TRUST_PREVIEW_ENDPOINT = 'https://x402.fuchss.app/v1/x402-trust-preview' as const
export const X402_TRUST_PREVIEW_SCHEMA_URL = 'https://x402.fuchss.app/schemas/x402-trust-preview.schema.json' as const
export const X402_TRUST_REPORT_SCHEMA_URL = 'https://x402.fuchss.app/schemas/x402-trust.schema.json' as const
export const X402_TRUST_SCHEMA_VERSION = '1.0.0' as const
export const X402_TRUST_PREVIEW_SCHEMA_SHA256 = 'sha256:aa1fb9ae7909a320c6721884b8f2c46f6e0426e4e1afe5267e33023e7512ed52' as const
export const X402_TRUST_ADAPTER_VERSION = '1.0.0' as const

const MAX_RESPONSE_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 5_000
const MAX_CLOCK_SKEW_MS = 60_000

export type X402TrustSampleRole = 'best' | 'median' | 'worst'
export type X402TrustRecommendation = 'proceed' | 'caution' | 'avoid' | 'parameterize' | 'unverified' | 'not-payable'
export type X402TrustPolicyOutcome = 'proceed' | 'require_review' | 'deny'
export type X402TrustNextAction = 'continue_to_buyer_policy' | 'request_human_review' | 'stop'

type TrustReport = {
  $schema: string
  schemaVersion: string
  schemaType: string
  resource: string
  generatedAt: number
  freshness: { live: boolean; probedAtTs: number | null; ageSeconds: number | null; liveProbeMs?: number }
  score: number
  scoreRange: { low: number; point: number; high: number }
  recommendation: X402TrustRecommendation
  confidence: number
  confidenceDetail: { overall: number; observation: number; economic: number }
  breakdown: Record<string, number>
  subscores: Record<string, number>
  stats: Record<string, unknown>
}

type TrustPreview = {
  $schema: string
  schemaVersion: string
  schemaType: string
  preview: boolean
  populationSize: number
  sampled: number
  samples: Array<{ role: X402TrustSampleRole; report: TrustReport }>
}

export type X402TrustPreviewPolicy = {
  maxAgeSeconds: number
  minConfidence: number
  minScoreRangeLow: number
  requireLiveProbe: boolean
}

export type X402TrustPreviewEvidence = {
  adapter: 'maha-x402-trust-preview'
  adapterVersion: typeof X402_TRUST_ADAPTER_VERSION
  evaluatedAt: string
  source: {
    endpoint: typeof X402_TRUST_PREVIEW_ENDPOINT
    schemaUrl: typeof X402_TRUST_PREVIEW_SCHEMA_URL
    schemaVersion: typeof X402_TRUST_SCHEMA_VERSION
    pinnedSchemaSha256: typeof X402_TRUST_PREVIEW_SCHEMA_SHA256
    transportBytesSha256: string | null
    sampleRole: X402TrustSampleRole | null
    preview: true
  }
  observation: {
    resource: string | null
    generatedAt: string | null
    probedAt: string | null
    observedAgeSeconds: number | null
    providerReportedAgeSeconds: number | null
    liveProbe: boolean | null
    recommendation: X402TrustRecommendation | null
    score: number | null
    scoreRangeLow: number | null
    confidence: number | null
  }
  decision: {
    outcome: X402TrustPolicyOutcome
    nextAction: X402TrustNextAction
    reasonCodes: string[]
    advisoryOnly: true
    paymentAuthorized: false
  }
  retention: {
    rawResponseRetained: false
    descriptionsRetained: false
    explanationsRetained: false
    credentialsRetained: false
  }
}

export type X402TrustPreviewAdapterResult = {
  ok: boolean
  validation: {
    schemaValid: boolean
    semanticValid: boolean
    errors: string[]
  }
  evidence: X402TrustPreviewEvidence
}

export type X402TrustPreviewAdapterOptions = {
  role?: X402TrustSampleRole
  policy?: Partial<X402TrustPreviewPolicy>
  now?: Date
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export const DEFAULT_X402_TRUST_PREVIEW_POLICY: X402TrustPreviewPolicy = {
  maxAgeSeconds: 300,
  minConfidence: 0.75,
  minScoreRangeLow: 65,
  requireLiveProbe: false,
}

const canonicalSchema = canonicalize(previewSchema)
if (canonicalSchema === undefined || sha256(canonicalSchema) !== X402_TRUST_PREVIEW_SCHEMA_SHA256) {
  throw new Error('Pinned x402 Trust preview schema digest does not match the reviewed contract.')
}

const ajv = new Ajv2020({ allErrors: true, strictSchema: true, strictTypes: false })
const validateSchema = ajv.compile(previewSchema)

function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= minimum
}

function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum
}

function isPublicHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => `schema${error.instancePath || '/'}: ${error.message ?? error.keyword}`)
}

function validateSemanticContract(preview: TrustPreview, nowMs: number): string[] {
  const errors: string[] = []
  if (preview.$schema !== X402_TRUST_PREVIEW_SCHEMA_URL) errors.push('semantic: unsupported preview schema URL')
  if (preview.schemaVersion !== X402_TRUST_SCHEMA_VERSION) errors.push('semantic: unsupported preview schema version')
  if (preview.schemaType !== 'x402-trust-preview') errors.push('semantic: unsupported preview schema type')
  if (preview.preview !== true) errors.push('semantic: preview marker must be true')
  if (!isIntegerAtLeast(preview.populationSize, 0)) errors.push('semantic: populationSize must be a non-negative integer')
  if (!isIntegerAtLeast(preview.sampled, 0) || preview.sampled !== preview.samples.length) errors.push('semantic: sampled must equal the sample count')
  const roles = preview.samples.map((sample) => sample.role)
  if (new Set(roles).size !== roles.length) errors.push('semantic: sample roles must be unique')

  for (const sample of preview.samples) {
    const path = `semantic: samples.${sample.role}`
    const report = sample.report
    if (report.$schema !== X402_TRUST_REPORT_SCHEMA_URL) errors.push(`${path} has an unsupported report schema URL`)
    if (report.schemaVersion !== X402_TRUST_SCHEMA_VERSION) errors.push(`${path} has an unsupported report schema version`)
    if (report.schemaType !== 'x402-trust') errors.push(`${path} has an unsupported report schema type`)
    if (!isPublicHttpsUrl(report.resource)) errors.push(`${path}.resource must be a public HTTPS URL`)
    if (!isIntegerAtLeast(report.generatedAt, 0) || report.generatedAt > nowMs + MAX_CLOCK_SKEW_MS) errors.push(`${path}.generatedAt is not a valid past Unix millisecond timestamp`)
    if (!inRange(report.score, 0, 100)) errors.push(`${path}.score must be between 0 and 100`)
    if (![report.scoreRange.low, report.scoreRange.point, report.scoreRange.high].every((value) => inRange(value, 0, 100))) {
      errors.push(`${path}.scoreRange values must be between 0 and 100`)
    } else if (report.scoreRange.low > report.scoreRange.point || report.scoreRange.point > report.scoreRange.high || report.score !== report.scoreRange.point) {
      errors.push(`${path}.scoreRange must contain the reported score at point`)
    }
    if (!inRange(report.confidence, 0, 1) || !Object.values(report.confidenceDetail).every((value) => inRange(value, 0, 1))) {
      errors.push(`${path}.confidence values must be between 0 and 1`)
    }
    if (report.confidenceDetail.overall !== report.confidence) errors.push(`${path}.confidence must equal confidenceDetail.overall`)
    if (!Object.values(report.breakdown).every((value) => inRange(value, 0, 1))) errors.push(`${path}.breakdown values must be between 0 and 1`)
    const subscoreEntries = Object.entries(report.subscores)
    if (!subscoreEntries.every(([key, value]) => inRange(value, 0, key === 'economicConfidence' ? 1 : 100))) errors.push(`${path}.subscores contain an out-of-range value`)

    const probedAt = report.freshness.probedAtTs
    const reportedAge = report.freshness.ageSeconds
    if (probedAt !== null && (!isIntegerAtLeast(probedAt, 0) || probedAt > nowMs + MAX_CLOCK_SKEW_MS)) errors.push(`${path}.freshness.probedAtTs is not a valid past Unix millisecond timestamp`)
    if (probedAt !== null && isIntegerAtLeast(report.generatedAt, 0) && probedAt > report.generatedAt + MAX_CLOCK_SKEW_MS) errors.push(`${path}.freshness.probedAtTs cannot postdate report generation`)
    if (reportedAge !== null && !isIntegerAtLeast(reportedAge, 0)) errors.push(`${path}.freshness.ageSeconds must be a non-negative integer or null`)
    if ((probedAt === null) !== (reportedAge === null)) errors.push(`${path}.freshness timestamp and age must both be present or both be null`)
    if (report.freshness.live && probedAt === null) errors.push(`${path}.freshness.live requires a probe timestamp`)

    const stats = report.stats
    const counters = ['observedDays', 'probes30d', 'probeOk30d', 'excluded30d', 'scoredProbes30d', 'envelopeValid30d', 'priceChanges30d', 'payToSharedWith', 'settlements30d', 'distinctPayers30d', 'settlementDecimals']
    if (!counters.every((key) => isIntegerAtLeast(stats[key], 0))) errors.push(`${path}.stats counters must be non-negative integers`)
    if (isFiniteNumber(stats.probeOk30d) && isFiniteNumber(stats.probes30d) && stats.probeOk30d > stats.probes30d) errors.push(`${path}.stats.probeOk30d exceeds probes30d`)
    if (isFiniteNumber(stats.envelopeValid30d) && isFiniteNumber(stats.scoredProbes30d) && stats.envelopeValid30d > stats.scoredProbes30d) errors.push(`${path}.stats.envelopeValid30d exceeds scoredProbes30d`)
  }
  return errors
}

function observedAgeSeconds(report: TrustReport, nowMs: number): number | null {
  if (report.freshness.probedAtTs === null) return null
  return Math.max(0, Math.floor((nowMs - report.freshness.probedAtTs) / 1_000))
}

function emptyEvidence(now: Date, transportDigest: string | null, errors: string[]): X402TrustPreviewEvidence {
  return {
    adapter: 'maha-x402-trust-preview', adapterVersion: X402_TRUST_ADAPTER_VERSION, evaluatedAt: now.toISOString(),
    source: { endpoint: X402_TRUST_PREVIEW_ENDPOINT, schemaUrl: X402_TRUST_PREVIEW_SCHEMA_URL, schemaVersion: X402_TRUST_SCHEMA_VERSION, pinnedSchemaSha256: X402_TRUST_PREVIEW_SCHEMA_SHA256, transportBytesSha256: transportDigest, sampleRole: null, preview: true },
    observation: { resource: null, generatedAt: null, probedAt: null, observedAgeSeconds: null, providerReportedAgeSeconds: null, liveProbe: null, recommendation: null, score: null, scoreRangeLow: null, confidence: null },
    decision: { outcome: 'deny', nextAction: 'stop', reasonCodes: errors.length > 0 ? ['trust_contract_invalid'] : ['trust_evidence_unavailable'], advisoryOnly: true, paymentAuthorized: false },
    retention: { rawResponseRetained: false, descriptionsRetained: false, explanationsRetained: false, credentialsRetained: false },
  }
}

export function evaluateX402TrustPreview(input: string | Uint8Array, options: Omit<X402TrustPreviewAdapterOptions, 'fetchImpl' | 'timeoutMs'> = {}): X402TrustPreviewAdapterResult {
  const now = options.now ?? new Date()
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const transportDigest = sha256(bytes)
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    const errors = ['schema/: response is not valid UTF-8 JSON']
    return { ok: false, validation: { schemaValid: false, semanticValid: false, errors }, evidence: emptyEvidence(now, transportDigest, errors) }
  }

  const schemaValid = validateSchema(value)
  const schemaErrors = schemaValid ? [] : formatAjvErrors(validateSchema.errors)
  if (!schemaValid) return { ok: false, validation: { schemaValid: false, semanticValid: false, errors: schemaErrors }, evidence: emptyEvidence(now, transportDigest, schemaErrors) }

  const preview = value as TrustPreview
  const semanticErrors = validateSemanticContract(preview, now.getTime())
  if (semanticErrors.length > 0) return { ok: false, validation: { schemaValid: true, semanticValid: false, errors: semanticErrors }, evidence: emptyEvidence(now, transportDigest, semanticErrors) }

  const role = options.role ?? 'median'
  const selected = preview.samples.find((sample) => sample.role === role)
  if (!selected) {
    const errors = [`semantic: requested sample role ${role} is unavailable`]
    return { ok: false, validation: { schemaValid: true, semanticValid: false, errors }, evidence: emptyEvidence(now, transportDigest, errors) }
  }

  const policy = { ...DEFAULT_X402_TRUST_PREVIEW_POLICY, ...options.policy }
  if (!isIntegerAtLeast(policy.maxAgeSeconds, 0) || !inRange(policy.minConfidence, 0, 1) || !inRange(policy.minScoreRangeLow, 0, 100)) throw new TypeError('Invalid x402 Trust preview policy.')
  const report = selected.report
  const age = observedAgeSeconds(report, now.getTime())
  const effectiveAge = Math.max(age ?? Number.POSITIVE_INFINITY, report.freshness.ageSeconds ?? Number.POSITIVE_INFINITY)
  const reasons: string[] = []
  if (!Number.isFinite(effectiveAge) || effectiveAge > policy.maxAgeSeconds) reasons.push('trust_evidence_stale')
  if (policy.requireLiveProbe && !report.freshness.live) reasons.push('live_probe_required')
  if (report.confidence < policy.minConfidence) reasons.push('trust_confidence_below_floor')
  if (report.scoreRange.low < policy.minScoreRangeLow) reasons.push('trust_score_floor_not_met')
  if (report.recommendation === 'avoid' || report.recommendation === 'unverified' || report.recommendation === 'not-payable') reasons.push(`provider_recommendation_${report.recommendation}`)

  let outcome: X402TrustPolicyOutcome
  if (reasons.length > 0) outcome = 'deny'
  else if (report.recommendation === 'caution' || report.recommendation === 'parameterize') {
    outcome = 'require_review'; reasons.push(`provider_recommendation_${report.recommendation}`)
  } else {
    outcome = 'proceed'; reasons.push('advisory_thresholds_met')
  }
  const nextAction: X402TrustNextAction = outcome === 'proceed'
    ? 'continue_to_buyer_policy'
    : outcome === 'require_review' ? 'request_human_review' : 'stop'

  const evidence: X402TrustPreviewEvidence = {
    adapter: 'maha-x402-trust-preview', adapterVersion: X402_TRUST_ADAPTER_VERSION, evaluatedAt: now.toISOString(),
    source: { endpoint: X402_TRUST_PREVIEW_ENDPOINT, schemaUrl: X402_TRUST_PREVIEW_SCHEMA_URL, schemaVersion: X402_TRUST_SCHEMA_VERSION, pinnedSchemaSha256: X402_TRUST_PREVIEW_SCHEMA_SHA256, transportBytesSha256: transportDigest, sampleRole: role, preview: true },
    observation: {
      resource: report.resource, generatedAt: new Date(report.generatedAt).toISOString(), probedAt: report.freshness.probedAtTs === null ? null : new Date(report.freshness.probedAtTs).toISOString(),
      observedAgeSeconds: age, providerReportedAgeSeconds: report.freshness.ageSeconds, liveProbe: report.freshness.live, recommendation: report.recommendation,
      score: report.score, scoreRangeLow: report.scoreRange.low, confidence: report.confidence,
    },
    decision: { outcome, nextAction, reasonCodes: reasons, advisoryOnly: true, paymentAuthorized: false },
    retention: { rawResponseRetained: false, descriptionsRetained: false, explanationsRetained: false, credentialsRetained: false },
  }
  return { ok: true, validation: { schemaValid: true, semanticValid: true, errors: [] }, evidence }
}

async function boundedJsonBytes(response: Response): Promise<Uint8Array> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) throw new Error('x402 Trust preview refused: response Content-Type is not JSON.')
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error('x402 Trust preview refused: response exceeds the byte ceiling.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('x402 Trust preview refused: response exceeds the byte ceiling.')
  return bytes
}

export async function fetchAndEvaluateX402TrustPreview(options: X402TrustPreviewAdapterOptions = {}): Promise<X402TrustPreviewAdapterResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError('Invalid x402 Trust preview timeout.')
  try {
    const response = await fetchImpl(X402_TRUST_PREVIEW_ENDPOINT, {
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return evaluateX402TrustPreview(await boundedJsonBytes(response), options)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown transport failure'
    const errors = [`transport: ${message}`]
    const now = options.now ?? new Date()
    return { ok: false, validation: { schemaValid: false, semanticValid: false, errors }, evidence: emptyEvidence(now, null, []) }
  }
}
